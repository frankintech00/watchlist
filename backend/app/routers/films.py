"""
===================================================================================
Script: films.py
Purpose:
    Film discovery for the UK: what has recently arrived on subscription streaming
    (scored by Rotten Tomatoes where available) and what is coming soon.

Author: Frank Kelly
Date: 15-11-2026
===================================================================================
"""

import time
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import mdblist
from app.ratings import ratings_for, rt_enabled, tmdb_score
from app.tmdb_client import fetch_tmdb, get_movie, gather_safe, uk_providers, REGION, TTL_LIST


# === ROUTER INITIALISATION ===

router = APIRouter()

RELEASE_TYPES = {1: "Premiere", 2: "Cinemas (limited)", 3: "Cinemas", 4: "Digital", 5: "Physical", 6: "TV"}
MAX_DISCOVER_PAGES = 6       # 120 films
RESPONSE_TTL = 3 * 3600

_response_cache: dict = {}   # days -> (stored_at, payload)


# === HELPERS ===

def _gb_releases(detail: dict) -> list:
    """[(date 'YYYY-MM-DD', type, certification)] for the UK, oldest first."""
    for country in (detail.get("release_dates") or {}).get("results", []):
        if country.get("iso_3166_1") == REGION:
            return sorted(
                ((r.get("release_date") or "")[:10], r.get("type"), r.get("certification") or "")
                for r in country.get("release_dates", [])
            )
    return []


def _certification(releases: list) -> Optional[str]:
    return next((cert for _, _, cert in releases if cert), None)


async def _discover(params: dict, max_pages: int) -> list:
    """Collect several pages of /discover/movie, de-duplicated."""
    first = await fetch_tmdb("/discover/movie", {**params, "page": 1}, ttl=TTL_LIST)
    pages = min(first.get("total_pages", 1), max_pages)
    rest = await gather_safe([
        fetch_tmdb("/discover/movie", {**params, "page": p}, ttl=TTL_LIST)
        for p in range(2, pages + 1)
    ])
    seen, films = set(), []
    for page in [first, *rest]:
        for film in (page or {}).get("results", []):
            if film["id"] not in seen:
                seen.add(film["id"])
                films.append(film)
    return films


# === ENDPOINTS ===

@router.get("/streaming")
async def new_on_streaming(
    days: int = Query(default=90, ge=7, le=365),
    db: Session = Depends(get_db),
):
    """
    Films released digitally in the UK within the last `days` days that are
    available on a UK subscription service right now.

    Each film carries `score` (0-100 or null) and the response says where scores
    come from: 'rt_audience' (MDBList Popcornmeter), 'rt' (OMDb Tomatometer)
    or 'tmdb' (fallback). Films are returned highest score first, unscored last.
    """
    cached = _response_cache.get(days)
    if cached and time.monotonic() - cached[0] < RESPONSE_TTL:
        return cached[1]

    today = date.today()
    listed = await _discover({
        "region": REGION,
        "watch_region": REGION,
        "with_watch_monetization_types": "flatrate",
        "with_release_type": "4|6",
        "release_date.gte": (today - timedelta(days=days)).isoformat(),
        "release_date.lte": today.isoformat(),
        "sort_by": "popularity.desc",
        "include_adult": "false",
    }, MAX_DISCOVER_PAGES)

    details = await gather_safe([get_movie(f["id"]) for f in listed])
    ratings = await ratings_for(
        db,
        [(d["id"], d.get("imdb_id") or (d.get("external_ids") or {}).get("imdb_id"))
         for d in details if d],
    )
    use_rt = rt_enabled()
    use_audience = mdblist.enabled()

    films, provider_counts = [], {}
    for summary, detail in zip(listed, details):
        detail = detail or summary
        releases = _gb_releases(detail)
        streaming_date = next(
            (d for d, kind, _ in reversed(releases) if kind in (4, 6) and d <= today.isoformat()),
            None,
        ) or summary.get("release_date")
        providers = uk_providers(detail)
        for p in providers:
            provider_counts[p["name"]] = provider_counts.get(p["name"], 0) + 1

        rating = ratings.get(summary["id"], {})
        audience = tmdb_score(detail)
        films.append({
            "id": summary["id"],
            "media_type": "movie",
            "title": detail.get("title") or summary.get("title"),
            "overview": detail.get("overview"),
            "poster_path": detail.get("poster_path"),
            "backdrop_path": detail.get("backdrop_path"),
            "release_date": detail.get("release_date"),
            "streaming_date": streaming_date,
            "runtime": detail.get("runtime"),
            "certification": _certification(releases),
            "genres": [g.get("name") for g in detail.get("genres", [])],
            "providers": providers,
            "popularity": summary.get("popularity") or 0,
            "rt_score": rating.get("rt_score"),
            "rt_audience_score": rating.get("rt_audience_score"),
            "imdb_rating": rating.get("imdb_rating"),
            "tmdb_score": audience,
            "score": (rating.get("rt_audience_score") if use_audience
                      else rating.get("rt_score") if use_rt else audience),
        })

    payload = {
        "rating_source": "rt_audience" if use_audience else "rt" if use_rt else "tmdb",
        "days": days,
        "generated_at": datetime.utcnow().isoformat(),
        "providers": [name for name, _ in sorted(provider_counts.items(), key=lambda kv: -kv[1])],
        "films": sorted(films, key=lambda film: (
            film["score"] if film["score"] is not None else -1, film["popularity"]), reverse=True),
    }
    _response_cache[days] = (time.monotonic(), payload)
    return payload


@router.get("/upcoming")
async def coming_soon():
    """
    Films arriving in UK cinemas or on digital/streaming over the next four months,
    soonest first, each with its UK release date and how it is being released.
    """
    today = date.today()
    start = (today + timedelta(days=1)).isoformat()
    end = (today + timedelta(days=120)).isoformat()

    listed = await _discover({
        "region": REGION,
        "with_release_type": "3|4",
        "release_date.gte": start,
        "release_date.lte": end,
        "sort_by": "popularity.desc",
        "include_adult": "false",
    }, 2)
    details = await gather_safe([get_movie(f["id"]) for f in listed])

    films = []
    for summary, detail in zip(listed, details):
        detail = detail or summary
        releases = _gb_releases(detail)
        upcoming = next(
            ((d, kind) for d, kind, _ in releases if start <= d <= end and kind in (3, 4)), None
        )
        if not upcoming or not detail.get("poster_path"):
            continue
        films.append({
            "id": summary["id"],
            "media_type": "movie",
            "title": detail.get("title") or summary.get("title"),
            "poster_path": detail.get("poster_path"),
            "backdrop_path": detail.get("backdrop_path"),
            "uk_release_date": upcoming[0],
            "release_type": RELEASE_TYPES.get(upcoming[1], "Release"),
            "certification": _certification(releases),
            "popularity": summary.get("popularity") or 0,
        })

    films.sort(key=lambda f: f["uk_release_date"])
    return {"results": films}
