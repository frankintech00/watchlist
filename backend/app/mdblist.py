"""Rotten Tomatoes critic and audience scores from MDBList, cached per film."""

import asyncio
import logging
import math
import os
import time
from datetime import datetime, timedelta

from app.models import FilmMDBRating
from app.tmdb_client import get_client

MDBLIST_API_KEY = (os.getenv("MDBLIST_API_KEY") or "").strip()
MDBLIST_URL = "https://api.mdblist.com"
FIELDS = ("rt_score", "rt_audience_score", "imdb_rating", "metascore")
_semaphore = asyncio.Semaphore(4)
_cache_lock = asyncio.Lock()
_retry_at = 0.0
logger = logging.getLogger(__name__)


def enabled():
    return bool(MDBLIST_API_KEY)


def _number(value, maximum):
    try:
        number = float(value)
        return number if math.isfinite(number) and 0 <= number <= maximum else None
    except (TypeError, ValueError):
        return None


def parse_ratings(data):
    """Match explicit sources; IMDb/TMDB scores never stand in for RT audience."""
    sources = {r.get("source"): r.get("value") for r in data["ratings"] if isinstance(r, dict)}

    def percent(*names):
        for name in names:
            value = _number(sources.get(name), 100)
            if value is not None:
                return round(value)
        return None

    return {
        "rt_score": percent("tomatoes"),
        "rt_audience_score": percent("popcorn", "tomatoesaudience"),
        "imdb_rating": _number(sources.get("imdb"), 10),
        "metascore": percent("metacritic"),
    }


async def _fetch_batch(movie_ids):
    global _retry_at
    async with _semaphore:
        if time.monotonic() < _retry_at:
            return None
        try:
            response = await get_client().post(
                f"{MDBLIST_URL}/tmdb/movie", params={"apikey": MDBLIST_API_KEY},
                json={"ids": [str(movie_id) for movie_id in movie_ids]},
            )
            if response.status_code != 200:
                delay = 60
                if response.status_code == 429:
                    try:
                        delay = max(60, min(86400, int(response.headers.get("Retry-After", "3600"))))
                    except ValueError:
                        delay = 3600
                elif response.status_code in (401, 403):
                    delay = 300
                _retry_at = time.monotonic() + delay
                logger.warning("MDBList lookup failed (HTTP %s); retrying later", response.status_code)
                return None
            data = response.json()
            if not isinstance(data, list):
                return None
            results = {}
            for item in data:
                if not isinstance(item, dict) or not isinstance(item.get("ratings"), list):
                    continue
                try:
                    movie_id = int((item.get("ids") or {}).get("tmdb"))
                except (TypeError, ValueError):
                    continue
                if movie_id in movie_ids:
                    results[movie_id] = parse_ratings(item)
            return results
        except Exception as exc:
            # Never log the request URL: it contains the API key.
            _retry_at = time.monotonic() + 60
            logger.warning("MDBList lookup failed (%s)", type(exc).__name__)
            return None


async def ratings_for(db, movie_ids):
    if not enabled() or not movie_ids:
        return {}
    # Serialise cache fills so simultaneous list/detail requests share the result.
    async with _cache_lock:
        ids = set(movie_ids)
        cached = {row.tmdb_movie_id: row for row in db.query(FilmMDBRating).filter(
            FilmMDBRating.tmdb_movie_id.in_(ids)).populate_existing().all()}
        now = datetime.utcnow()
        stale = []
        for movie_id in ids:
            row = cached.get(movie_id)
            age = timedelta(days=7 if row and row.rt_score is not None
                            and row.rt_audience_score is not None else 1)
            if row is None or now - row.fetched_at > age:
                stale.append(movie_id)
        # The API returns items in its own order: join by TMDB ID, never position.
        batches = await asyncio.gather(*(_fetch_batch(stale[i:i + 200])
                                         for i in range(0, len(stale), 200)))
        fetched = {movie_id: result for batch in batches if batch is not None
                   for movie_id, result in batch.items()}
        for movie_id, result in fetched.items():
            row = cached.get(movie_id)
            if row is None:
                row = FilmMDBRating(tmdb_movie_id=movie_id)
                db.add(row)
                cached[movie_id] = row
            for field in FIELDS:
                setattr(row, field, result[field])
            row.fetched_at = now
        if fetched:
            db.commit()
        return {movie_id: {field: getattr(row, field) for field in FIELDS}
                for movie_id, row in cached.items()}
