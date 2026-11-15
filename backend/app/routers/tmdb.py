"""
===================================================================================
Script: tmdb.py
Purpose:
    TMDB API proxy router for Watchlist application.
    Search (titles and people), film / TV / season detail, and rich person
    profiles with a complete filmography. The API key never reaches the browser.

Author: Frank Kelly
Date: 15-11-2026
===================================================================================
"""

import asyncio
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.ratings import ratings_for, rt_enabled, tmdb_score
from app.tmdb_client import (
    fetch_tmdb, get_movie, paged, uk_providers, REGION, TTL_DETAIL, TTL_LIST, TTL_SEARCH,
)


# === ROUTER INITIALISATION ===

router = APIRouter()

VIDEO_PARAMS = {"include_video_language": "en,null"}
SELF_GENRES = {10767, 10763}  # Talk, News


# === HELPERS ===

def _youtube(videos: dict) -> tuple:
    """(all YouTube videos, key of the best trailer or None)."""
    items = [v for v in (videos or {}).get("results", []) if v.get("site") == "YouTube"]
    order = {"Trailer": 0, "Teaser": 1}
    items.sort(key=lambda v: (order.get(v.get("type"), 2), not v.get("official", False)))
    trailer = next((v.get("key") for v in items if v.get("type") == "Trailer"), None)
    return items, trailer


def _slim_cast(cast: list, limit: int = 24) -> list:
    return [
        {
            "id": c.get("id"),
            "name": c.get("name"),
            "character": c.get("character"),
            "profile_path": c.get("profile_path"),
        }
        for c in (cast or [])[:limit]
    ]


def _key_crew(crew: list, jobs: tuple) -> list:
    seen, people = set(), []
    for c in crew or []:
        if c.get("job") in jobs and c.get("id") not in seen:
            seen.add(c.get("id"))
            people.append({"id": c.get("id"), "name": c.get("name"), "job": c.get("job")})
    return people


# === SEARCH ===

@router.get("/search")
async def search(query: str, type: Literal["multi", "tv", "movie", "person"] = "multi", page: int = 1):
    """
    Search TMDB. `type` narrows to TV, films or people; 'multi' mixes all three.
    Every result carries a `media_type`.
    """
    if not query.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty")

    data = await fetch_tmdb(
        f"/search/{type}",
        {"query": query.strip(), "page": page, "include_adult": "false", "region": REGION},
        ttl=TTL_SEARCH,
    )
    result = paged(data, page)
    if type != "multi":
        result["results"] = [{**r, "media_type": type} for r in result["results"]]
    else:
        result["results"] = [r for r in result["results"] if r.get("media_type") in ("tv", "movie", "person")]
    return result


@router.get("/trending/people")
async def trending_people():
    """People trending on TMDB this week — shown on the empty search page."""
    data = await fetch_tmdb("/trending/person/week", ttl=TTL_LIST)
    return {"results": [{**p, "media_type": "person"} for p in data.get("results", [])]}


# === FILMS ===

@router.get("/movie/{movie_id}")
async def get_movie_detail(movie_id: int, db: Session = Depends(get_db)):
    """
    Film detail: synopsis, artwork, cast, key crew, trailers, UK certification,
    UK streaming services and critic scores.
    """
    data, extras = await asyncio.gather(
        get_movie(movie_id),
        fetch_tmdb(f"/movie/{movie_id}", {"append_to_response": "videos,credits", **VIDEO_PARAMS}, ttl=TTL_DETAIL),
        return_exceptions=True,
    )
    if isinstance(data, BaseException):
        raise data
    if isinstance(extras, BaseException):
        extras = {}

    videos, trailer_key = _youtube(extras.get("videos"))
    credits = extras.get("credits") or {}

    certification = None
    for country in (data.get("release_dates") or {}).get("results", []):
        if country.get("iso_3166_1") == REGION:
            certification = next(
                (r["certification"] for r in country.get("release_dates", []) if r.get("certification")),
                None,
            )

    imdb_id = data.get("imdb_id") or (data.get("external_ids") or {}).get("imdb_id")
    rating = (await ratings_for(db, [(movie_id, imdb_id)])).get(movie_id, {})

    return {
        "id": data.get("id"),
        "title": data.get("title"),
        "tagline": data.get("tagline"),
        "overview": data.get("overview"),
        "poster_path": data.get("poster_path"),
        "backdrop_path": data.get("backdrop_path"),
        "release_date": data.get("release_date"),
        "runtime": data.get("runtime"),
        "genres": data.get("genres", []),
        "certification": certification,
        "imdb_id": imdb_id,
        "tmdb_score": tmdb_score(data),
        "rt_score": rating.get("rt_score"),
        "imdb_rating": rating.get("imdb_rating"),
        "rt_enabled": rt_enabled(),
        "providers": uk_providers(data),
        "trailer_key": trailer_key,
        "videos": videos[:8],
        "cast": _slim_cast(credits.get("cast")),
        "directors": _key_crew(credits.get("crew"), ("Director",)),
        "writers": _key_crew(credits.get("crew"), ("Screenplay", "Writer")),
    }


@router.get("/movie/{movie_id}/reviews")
async def get_movie_reviews(movie_id: int, page: int = 1):
    """TMDB user reviews for a film."""
    return paged(await fetch_tmdb(f"/movie/{movie_id}/reviews", {"page": page, "language": "en-US"}, ttl=TTL_LIST), page)


# === TV ===

@router.get("/tv/{show_id}")
async def get_tv_show_detail(show_id: int):
    """
    TV show detail: seasons, artwork, cast, creators, trailers, UK streaming
    services and the last / next episode to air.
    Credits, videos and providers are separate requests so that a failure on any
    of them degrades gracefully instead of breaking the page.
    """
    results = await asyncio.gather(
        fetch_tmdb(f"/tv/{show_id}", ttl=TTL_DETAIL),
        fetch_tmdb(f"/tv/{show_id}/videos", VIDEO_PARAMS, ttl=TTL_DETAIL),
        fetch_tmdb(f"/tv/{show_id}/aggregate_credits", ttl=TTL_DETAIL),
        fetch_tmdb(f"/tv/{show_id}/watch/providers", ttl=TTL_DETAIL),
        return_exceptions=True,
    )
    if isinstance(results[0], BaseException):
        raise results[0]

    data = results[0]
    videos_data, credits_data, providers_data = (
        {} if isinstance(r, BaseException) else r for r in results[1:]
    )
    videos, trailer_key = _youtube(videos_data)

    cast = [
        {
            "id": c.get("id"),
            "name": c.get("name"),
            "character": ", ".join(r.get("character") for r in c.get("roles", [])[:2] if r.get("character")),
            "episode_count": c.get("total_episode_count"),
            "profile_path": c.get("profile_path"),
        }
        for c in credits_data.get("cast", [])[:24]
    ]

    def episode(ep):
        if not ep:
            return None
        return {
            "name": ep.get("name"),
            "air_date": ep.get("air_date"),
            "season_number": ep.get("season_number"),
            "episode_number": ep.get("episode_number"),
        }

    return {
        "id": data.get("id"),
        "name": data.get("name"),
        "tagline": data.get("tagline"),
        "overview": data.get("overview"),
        "poster_path": data.get("poster_path"),
        "backdrop_path": data.get("backdrop_path"),
        "first_air_date": data.get("first_air_date"),
        "last_air_date": data.get("last_air_date"),
        "last_episode_to_air": episode(data.get("last_episode_to_air")),
        "next_episode_to_air": episode(data.get("next_episode_to_air")),
        "number_of_seasons": data.get("number_of_seasons"),
        "number_of_episodes": data.get("number_of_episodes"),
        "seasons": data.get("seasons", []),
        "genres": data.get("genres", []),
        "networks": [n.get("name") for n in data.get("networks", [])],
        "tmdb_score": tmdb_score(data),
        "status": data.get("status"),
        "providers": uk_providers({"watch/providers": providers_data}),
        "trailer_key": trailer_key,
        "videos": videos[:8],
        "cast": cast,
        "created_by": [{"id": c.get("id"), "name": c.get("name")} for c in data.get("created_by", [])],
    }


@router.get("/tv/{show_id}/season/{season_number}")
async def get_tv_season_detail(show_id: int, season_number: int):
    """Season detail with its episode list."""
    data = await fetch_tmdb(f"/tv/{show_id}/season/{season_number}", ttl=3600)
    return {
        "id": data.get("id"),
        "name": data.get("name"),
        "overview": data.get("overview"),
        "poster_path": data.get("poster_path"),
        "season_number": data.get("season_number"),
        "air_date": data.get("air_date"),
        "episodes": [
            {
                "id": e.get("id"),
                "name": e.get("name"),
                "overview": e.get("overview"),
                "still_path": e.get("still_path"),
                "episode_number": e.get("episode_number"),
                "air_date": e.get("air_date"),
                "runtime": e.get("runtime"),
                "vote_average": e.get("vote_average"),
                "director": next((c.get("name") for c in e.get("crew", []) if c.get("job") == "Director"), None),
                "guest_stars": [
                    {"id": g.get("id"), "name": g.get("name"), "character": g.get("character"),
                     "profile_path": g.get("profile_path")}
                    for g in e.get("guest_stars", [])[:8]
                ],
            }
            for e in data.get("episodes", [])
        ],
    }


@router.get("/tv/{show_id}/reviews")
async def get_tv_show_reviews(show_id: int, page: int = 1):
    """TMDB user reviews for a TV show."""
    return paged(await fetch_tmdb(f"/tv/{show_id}/reviews", {"page": page, "language": "en-US"}, ttl=TTL_LIST), page)


# === PEOPLE ===

def _credit_date(credit: dict) -> str:
    return credit.get("release_date") or credit.get("first_air_date") or ""


def _is_self(credit: dict) -> bool:
    """Chat-show / news style appearances rather than a role."""
    role = (credit.get("character") or "").lower()
    return (
        "self" in role
        or bool(SELF_GENRES & set(credit.get("genre_ids") or []))
    )


def _merge_credits(credits: list, role_field: str) -> list:
    """
    Collapse TMDB's one-row-per-role credits into one row per title, joining the
    roles ("Writer, Director") and keeping only what the UI needs.
    """
    merged: dict = {}
    for c in credits:
        if c.get("media_type") not in ("movie", "tv"):
            continue
        key = (c["media_type"], c.get("id"))
        role = (c.get(role_field) or "").strip()
        row = merged.get(key)
        if row is None:
            merged[key] = row = {
                "id": c.get("id"),
                "media_type": c["media_type"],
                "title": c.get("title") or c.get("name"),
                "poster_path": c.get("poster_path"),
                "date": _credit_date(c),
                "roles": [],
                "department": c.get("department"),
                "episode_count": c.get("episode_count") or 0,
                "vote_average": c.get("vote_average") or 0,
                "vote_count": c.get("vote_count") or 0,
                "popularity": c.get("popularity") or 0,
                "appearance": _is_self(c) if role_field == "character" else False,
            }
        else:
            row["episode_count"] = max(row["episode_count"], c.get("episode_count") or 0)
            if role_field == "character" and not _is_self(c):
                row["appearance"] = False
        if role and role not in row["roles"]:
            row["roles"].append(role)
    return list(merged.values())


@router.get("/person/{person_id}")
async def get_person_detail(person_id: int):
    """
    Person profile with their complete filmography: every acting credit and every
    crew credit (one row per title), plus the handful of titles they are best
    known for.
    """
    data = await fetch_tmdb(
        f"/person/{person_id}",
        {"append_to_response": "combined_credits,external_ids"},
        ttl=TTL_DETAIL,
    )
    combined = data.get("combined_credits") or {}
    acting = _merge_credits(combined.get("cast", []), "character")
    crew = _merge_credits(combined.get("crew", []), "job")

    department = data.get("known_for_department") or "Acting"
    if department == "Acting":
        pool = [c for c in acting if not c["appearance"]]
    else:
        pool = [c for c in crew if c["department"] == department] or crew
    # Weight TV by episode count so a one-episode cameo in a huge show does not win.
    def weight(c):
        involvement = 1.0 if c["media_type"] == "movie" else min(1.0, 0.15 + c["episode_count"] / 10)
        return c["vote_count"] * involvement
    known_for = sorted((c for c in pool if c["poster_path"]), key=weight, reverse=True)[:10]

    external = data.get("external_ids") or {}
    return {
        "id": data.get("id"),
        "name": data.get("name"),
        "biography": data.get("biography"),
        "profile_path": data.get("profile_path"),
        "birthday": data.get("birthday"),
        "deathday": data.get("deathday"),
        "place_of_birth": data.get("place_of_birth"),
        "known_for_department": department,
        "imdb_id": external.get("imdb_id") or data.get("imdb_id"),
        "known_for": known_for,
        "acting": acting,
        "crew": crew,
    }
