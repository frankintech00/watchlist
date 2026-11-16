"""
===================================================================================
Script: ratings.py
Purpose:
    Film ratings from MDBList (critics and audience), with OMDb filling missing
    critic, IMDb and Metacritic scores. Provider caches are kept independently.
    Without either key the app uses a clearly labelled TMDB audience score.

Author: Frank Kelly
Date: 15-11-2026
===================================================================================
"""

import asyncio
import os
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models import FilmRating
from app import mdblist
from app.tmdb_client import get_client


# === CONFIGURATION ===

OMDB_API_KEY = (os.getenv("OMDB_API_KEY") or "").strip()
OMDB_URL = "https://www.omdbapi.com/"

FRESH_WITH_SCORE = timedelta(days=7)     # scores settle; refresh weekly
FRESH_WITHOUT_SCORE = timedelta(days=1)  # new releases gain a score within days

_semaphore = asyncio.Semaphore(8)


def rt_enabled() -> bool:
    return bool(OMDB_API_KEY) or mdblist.enabled()


# === OMDb ===

def _to_int(value) -> Optional[int]:
    try:
        return int(str(value).strip().rstrip('%').split('/')[0])
    except (TypeError, ValueError):
        return None


def _to_float(value) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


async def _fetch_omdb(imdb_id: str) -> Optional[dict]:
    """
    Returns {'rt_score', 'imdb_rating', 'metascore'} (values may be None), or None
    when OMDb could not be asked (network error, bad key, daily limit) — in which
    case nothing should be cached.
    """
    try:
        async with _semaphore:
            response = await get_client().get(OMDB_URL, params={"apikey": OMDB_API_KEY, "i": imdb_id})
        if response.status_code != 200:
            return None
        data = response.json()
    except Exception:
        return None

    if data.get("Response") != "True":
        error = (data.get("Error") or "").lower()
        if "limit" in error or "key" in error:
            return None
        return {"rt_score": None, "imdb_rating": None, "metascore": None}

    rt = next(
        (r.get("Value") for r in data.get("Ratings", []) if r.get("Source") == "Rotten Tomatoes"),
        None,
    )
    return {
        "rt_score": _to_int(rt),
        "imdb_rating": _to_float(data.get("imdbRating")),
        "metascore": _to_int(data.get("Metascore")),
    }


# === PUBLIC API ===

async def _omdb_ratings_for(db: Session, films: list) -> dict:
    """
    Critic scores for many films at once.

    films: [(tmdb_id, imdb_id or None), ...]
    Returns {tmdb_id: {'rt_score', 'imdb_rating', 'metascore'}} for every film a
    score record exists for. Empty when no OMDb key is configured.
    """
    if not OMDB_API_KEY or not films:
        return {}

    ids = [tmdb_id for tmdb_id, _ in films]
    cached = {
        row.tmdb_movie_id: row
        for row in db.query(FilmRating).filter(FilmRating.tmdb_movie_id.in_(ids)).all()
    }

    now = datetime.utcnow()
    stale = []
    for tmdb_id, imdb_id in films:
        if not imdb_id:
            continue
        row = cached.get(tmdb_id)
        max_age = FRESH_WITH_SCORE if (row and row.rt_score is not None) else FRESH_WITHOUT_SCORE
        if row is None or now - row.fetched_at > max_age:
            stale.append((tmdb_id, imdb_id))

    if stale:
        fetched = await asyncio.gather(*(_fetch_omdb(imdb_id) for _, imdb_id in stale))
        for (tmdb_id, imdb_id), result in zip(stale, fetched):
            if result is None:
                continue
            row = cached.get(tmdb_id)
            if row is None:
                row = FilmRating(tmdb_movie_id=tmdb_id)
                db.add(row)
                cached[tmdb_id] = row
            row.imdb_id = imdb_id
            row.rt_score = result["rt_score"]
            row.imdb_rating = result["imdb_rating"]
            row.metascore = result["metascore"]
            row.fetched_at = now
        db.commit()

    return {
        tmdb_id: {"rt_score": r.rt_score, "imdb_rating": r.imdb_rating, "metascore": r.metascore}
        for tmdb_id, r in cached.items()
    }


async def ratings_for(db: Session, films: list) -> dict:
    """Prefer MDBList; OMDb fills missing critic/IMDb/Metacritic scores only."""
    primary = await mdblist.ratings_for(db, [movie_id for movie_id, _ in films])
    missing = [(movie_id, imdb_id) for movie_id, imdb_id in films
               if any(primary.get(movie_id, {}).get(field) is None
                      for field in ("rt_score", "imdb_rating", "metascore"))]
    fallback = await _omdb_ratings_for(db, missing)
    return {
        movie_id: {
            field: primary.get(movie_id, {}).get(field)
            if primary.get(movie_id, {}).get(field) is not None
            else fallback.get(movie_id, {}).get(field)
            for field in mdblist.FIELDS
        }
        for movie_id in primary.keys() | fallback.keys()
    }


def tmdb_score(payload: dict, min_votes: int = 10) -> Optional[int]:
    """TMDB audience score as a percentage, ignoring titles with too few votes."""
    if (payload.get("vote_count") or 0) < min_votes or not payload.get("vote_average"):
        return None
    return round(payload["vote_average"] * 10)
