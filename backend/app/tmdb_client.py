"""
===================================================================================
Script: tmdb_client.py
Purpose:
    Shared TMDB API client for the Watchlist backend.
    One pooled HTTP client, a concurrency cap, and a small in-memory TTL cache so
    that list pages (which need metadata for every tracked title) stay fast.
    Also holds the helpers that turn a TMDB show payload into episode progress.

Author: Frank Kelly
Date: 15-11-2026
===================================================================================
"""

import asyncio
import os
import re
import time
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException


# === CONFIGURATION ===

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
TMDB_BASE_URL = "https://api.themoviedb.org/3"
LANGUAGE = "en-GB"
REGION = "GB"

if not TMDB_API_KEY:
    raise ValueError("TMDB_API_KEY environment variable is not set")

# Cache lifetimes (seconds)
TTL_DETAIL = 6 * 3600      # show / film / person detail
TTL_LIST = 3 * 3600        # discover / upcoming lists
TTL_SEARCH = 10 * 60

_MAX_CACHE_ENTRIES = 3000
_cache: dict = {}                       # key -> (stored_at, data)
_semaphore = asyncio.Semaphore(20)      # stay well under TMDB's rate limit
_client: Optional[httpx.AsyncClient] = None
_refreshing: set = set()                # cache keys with a background refresh in flight
_background: set = set()                # strong refs so refresh tasks are not garbage collected


# === HTTP ===

def get_client() -> httpx.AsyncClient:
    """Lazily create the shared HTTP client (also used for OMDb)."""
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=10.0)
    return _client


async def close_client():
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def _prune_cache():
    if len(_cache) <= _MAX_CACHE_ENTRIES:
        return
    oldest = sorted(_cache.items(), key=lambda kv: kv[1][0])[: len(_cache) // 2]
    for key, _ in oldest:
        _cache.pop(key, None)


async def _request(endpoint: str, query: dict) -> dict:
    async with _semaphore:
        response = await get_client().get(
            f"{TMDB_BASE_URL}{endpoint}", params={**query, "api_key": TMDB_API_KEY}
        )
    response.raise_for_status()
    return response.json()


async def _refresh(key: str, endpoint: str, query: dict):
    """Background refresh of an expired cache entry; failures keep the stale copy."""
    try:
        _cache[key] = (time.monotonic(), await _request(endpoint, query))
    except Exception:
        pass
    finally:
        _refreshing.discard(key)


async def fetch_tmdb(endpoint: str, params: Optional[dict] = None, ttl: int = 0,
                     stale_ok: bool = False) -> dict:
    """
    GET a TMDB endpoint and return its JSON.

    ttl > 0 caches the response for that many seconds.
    stale_ok serves an expired copy immediately and refreshes it in the background,
    so list pages never wait on TMDB once the cache is warm.
    If TMDB is unreachable or erroring, a stale copy is served in preference to failing.
    """
    query = {"language": LANGUAGE, **(params or {})}
    key = f"{endpoint}?{urlencode(sorted(query.items()))}"
    cached = _cache.get(key)
    if ttl and cached:
        if time.monotonic() - cached[0] < ttl:
            return cached[1]
        if stale_ok:
            if key not in _refreshing:
                _refreshing.add(key)
                task = asyncio.create_task(_refresh(key, endpoint, query))
                _background.add(task)
                task.add_done_callback(_background.discard)
            return cached[1]

    try:
        data = await _request(endpoint, query)
    except httpx.HTTPStatusError as e:
        if cached and e.response.status_code != 404:
            return cached[1]
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"TMDB API error: {e.response.text}",
        )
    except httpx.RequestError as e:
        if cached:
            return cached[1]
        raise HTTPException(status_code=503, detail=f"Failed to connect to TMDB API: {type(e).__name__}")

    if ttl:
        _cache[key] = (time.monotonic(), data)
        _prune_cache()
    return data


def paged(data: dict, page: int = 1) -> dict:
    """Normalise a TMDB paged response."""
    return {
        "results": data.get("results", []),
        "total_pages": data.get("total_pages", 0),
        "total_results": data.get("total_results", 0),
        "page": data.get("page", page),
    }


# === CACHED DETAIL LOOKUPS ===

async def get_show(show_id: int) -> dict:
    """Core TV show payload (seasons, air dates, artwork)."""
    return await fetch_tmdb(f"/tv/{show_id}", ttl=TTL_DETAIL, stale_ok=True)


async def get_movie(movie_id: int) -> dict:
    """Core film payload plus IDs, UK watch providers and release dates."""
    return await fetch_tmdb(
        f"/movie/{movie_id}",
        {"append_to_response": "external_ids,watch/providers,release_dates"},
        ttl=TTL_DETAIL,
        stale_ok=True,
    )


async def gather_safe(coros):
    """Run lookups concurrently; a failed lookup yields None instead of raising."""
    results = await asyncio.gather(*coros, return_exceptions=True)
    return [None if isinstance(r, BaseException) else r for r in results]


# === SHOW PROGRESS HELPERS ===

def aired_episodes(show: Optional[dict]) -> list:
    """
    Ordered [(season, episode), ...] of every regular-season episode that has aired,
    derived from the season list and `last_episode_to_air` (no per-season requests).
    Specials (season 0) are excluded.
    """
    if not show:
        return []
    last = show.get("last_episode_to_air") or {}
    last_season = last.get("season_number")
    last_episode = last.get("episode_number")
    if not last_season or not last_episode:
        return []

    aired = []
    seasons = sorted(
        (s for s in show.get("seasons", []) if (s.get("season_number") or 0) > 0),
        key=lambda s: s["season_number"],
    )
    for season in seasons:
        number = season["season_number"]
        count = season.get("episode_count") or 0
        if number > last_season:
            break
        if number == last_season:
            count = min(count, last_episode) if count else last_episode
        aired.extend((number, ep) for ep in range(1, count + 1))
    return aired


def show_progress(show: Optional[dict], watched: set) -> dict:
    """
    Combine a TMDB show payload with the set of watched (season, episode) pairs.
    Returns aired / watched counts and the next episode to watch (or None).
    """
    aired = aired_episodes(show)
    if not aired:
        return {"aired_episodes": 0, "watched_episodes": len(watched), "next_episode": None}

    # Compare per-season counts rather than exact pairs, so shows that TMDB numbers
    # continuously across seasons (S2 starting at episode 13) still complete.
    aired_per_season: dict = {}
    for season, _ in aired:
        aired_per_season[season] = aired_per_season.get(season, 0) + 1
    watched_per_season: dict = {}
    for season, _ in watched:
        watched_per_season[season] = watched_per_season.get(season, 0) + 1

    watched_count = sum(
        min(watched_per_season.get(season, 0), count) for season, count in aired_per_season.items()
    )
    incomplete = {
        season for season, count in aired_per_season.items()
        if watched_per_season.get(season, 0) < count
    }
    next_up = next((p for p in aired if p[0] in incomplete and p not in watched), None)
    return {
        "aired_episodes": len(aired),
        "watched_episodes": watched_count,
        "next_episode": (
            {"season_number": next_up[0], "episode_number": next_up[1]} if next_up else None
        ),
    }


# "Netflix Standard with Ads", "Paramount Plus Apple TV channel", "Paramount Plus Premium" ...
_PROVIDER_VARIANT = re.compile(
    r"\s+(amazon channel|apple tv channel|roku premium channel|(standard |basic )?with ads|premium|essential)$",
    re.IGNORECASE,
)
_PROVIDER_ALIASES = {
    "amazon prime video": "Prime Video",
    "now tv cinema": "NOW",
    "now tv": "NOW",
    "disney plus": "Disney+",
    "apple tv plus": "Apple TV+",
    "apple tv": "Apple TV+",
    "paramount plus": "Paramount+",
    "paramount+": "Paramount+",
}


def uk_providers(payload: Optional[dict]) -> list:
    """
    Subscription streaming services carrying a title in the UK, de-duplicated.
    Collapses ad tiers and reseller add-ons ("Netflix Standard with Ads",
    "Paramount+ Amazon Channel") into the underlying service.
    """
    gb = ((payload or {}).get("watch/providers") or {}).get("results", {}).get("GB") or {}
    seen, providers = set(), []
    for p in sorted(gb.get("flatrate", []), key=lambda p: p.get("display_priority", 999)):
        name = p.get("provider_name") or ""
        name = _PROVIDER_VARIANT.sub("", name).strip()
        name = _PROVIDER_ALIASES.get(name.lower(), name)
        if name and name not in seen:
            seen.add(name)
            providers.append({"name": name, "logo_path": p.get("logo_path")})
    return providers
