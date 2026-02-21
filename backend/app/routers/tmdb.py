"""
===================================================================================
Script: tmdb.py
Purpose:
    TMDB API proxy router for Watchlist application.
    Provides endpoints for searching films, fetching movie details,
    retrieving cast information, and finding similar titles.

Author: Frank Kelly
Date: 20-02-2026
===================================================================================
"""

from fastapi import APIRouter, HTTPException
import httpx
import os
from typing import Optional


# === ROUTER INITIALISATION ===

router = APIRouter()

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
TMDB_BASE_URL = "https://api.themoviedb.org/3"

if not TMDB_API_KEY:
    raise ValueError("TMDB_API_KEY environment variable is not set")


# === HELPER FUNCTIONS ===

async def fetch_tmdb(endpoint: str, params: Optional[dict] = None) -> dict:
    """
    Make authenticated request to TMDB API.
    Handles error responses and returns JSON data.
    """
    if params is None:
        params = {}

    params["api_key"] = TMDB_API_KEY
    url = f"{TMDB_BASE_URL}{endpoint}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"TMDB API error: {e.response.text}"
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=503,
                detail=f"Failed to connect to TMDB API: {str(e)}"
            )


# === SEARCH ENDPOINTS ===

@router.get("/search")
async def search_movies(query: str, page: int = 1):
    """
    Search TMDB catalogue by title (films only).
    Proxies request to TMDB search/movie endpoint.
    """
    if not query.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty")

    data = await fetch_tmdb("/search/movie", {"query": query, "page": page})
    return {
        "results": data.get("results", []),
        "total_pages": data.get("total_pages", 0),
        "total_results": data.get("total_results", 0),
        "page": data.get("page", page)
    }


@router.get("/search/multi")
async def search_multi(query: str, page: int = 1):
    """
    Search TMDB catalogue for films, TV shows, and people.
    Returns mixed results with media_type field ('movie', 'tv', or 'person').
    """
    if not query.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty")

    data = await fetch_tmdb("/search/multi", {"query": query, "page": page})
    return {
        "results": data.get("results", []),
        "total_pages": data.get("total_pages", 0),
        "total_results": data.get("total_results", 0),
        "page": data.get("page", page)
    }


# === MOVIE DETAIL ENDPOINTS ===

@router.get("/movie/upcoming")
async def get_upcoming_movies(page: int = 1):
    """
    Fetch upcoming theatrical releases from TMDB.
    Used for the Coming Soon row on the home screen.
    """
    data = await fetch_tmdb("/movie/upcoming", {"page": page})
    return {
        "results": data.get("results", []),
        "total_pages": data.get("total_pages", 0),
        "total_results": data.get("total_results", 0),
        "page": data.get("page", page)
    }


@router.get("/movie/{movie_id}")
async def get_movie_detail(movie_id: int):
    """
    Fetch detailed movie information from TMDB.
    Includes synopsis, runtime, release date, genres, poster, backdrop.
    Also includes videos and credits via append_to_response.
    """
    data = await fetch_tmdb(
        f"/movie/{movie_id}",
        {"append_to_response": "videos,credits,release_dates"}
    )

    # Extract all YouTube videos
    videos = []
    trailer_key = None
    if "videos" in data and "results" in data["videos"]:
        youtube_videos = [
            v for v in data["videos"]["results"]
            if v.get("site") == "YouTube"
        ]
        videos = youtube_videos

        # Also keep the first trailer for backwards compatibility
        trailers = [v for v in youtube_videos if v.get("type") == "Trailer"]
        if trailers:
            trailer_key = trailers[0].get("key")

    # Extract certification for UK or US
    certification = None
    if "release_dates" in data and "results" in data["release_dates"]:
        for country_data in data["release_dates"]["results"]:
            if country_data.get("iso_3166_1") in ["GB", "US"]:
                for release in country_data.get("release_dates", []):
                    if release.get("certification"):
                        certification = release["certification"]
                        break
                if certification:
                    break

    return {
        "id": data.get("id"),
        "title": data.get("title"),
        "overview": data.get("overview"),
        "poster_path": data.get("poster_path"),
        "backdrop_path": data.get("backdrop_path"),
        "release_date": data.get("release_date"),
        "runtime": data.get("runtime"),
        "genres": data.get("genres", []),
        "vote_average": data.get("vote_average"),
        "vote_count": data.get("vote_count"),
        "certification": certification,
        "trailer_key": trailer_key,
        "videos": videos,
        "cast": data.get("credits", {}).get("cast", [])[:20],  # Limit to top 20 cast
        "crew": data.get("credits", {}).get("crew", []),
        "credits": data.get("credits", {})
    }


@router.get("/movie/{movie_id}/credits")
async def get_movie_credits(movie_id: int):
    """
    Fetch cast and crew information for a specific film.
    Returns actors with character names and profile images.
    """
    data = await fetch_tmdb(f"/movie/{movie_id}/credits")
    return {
        "cast": data.get("cast", []),
        "crew": data.get("crew", [])
    }


@router.get("/movie/{movie_id}/similar")
async def get_similar_movies(movie_id: int, page: int = 1):
    """
    Fetch films similar to the specified movie.
    Used for recommendations and related titles section.
    """
    data = await fetch_tmdb(f"/movie/{movie_id}/similar", {"page": page})
    return {
        "results": data.get("results", []),
        "total_pages": data.get("total_pages", 0),
        "total_results": data.get("total_results", 0),
        "page": data.get("page", page)
    }


@router.get("/movie/{movie_id}/reviews")
async def get_movie_reviews(movie_id: int, page: int = 1):
    """
    Fetch user reviews for a specific movie from TMDB.
    Returns review content, author details, and ratings.
    """
    data = await fetch_tmdb(f"/movie/{movie_id}/reviews", {"page": page})
    return {
        "results": data.get("results", []),
        "total_pages": data.get("total_pages", 0),
        "total_results": data.get("total_results", 0),
        "page": data.get("page", page)
    }


# === PERSON ENDPOINTS ===

@router.get("/person/{person_id}")
async def get_person_detail(person_id: int):
    """
    Fetch actor/director profile and filmography.
    Includes both film and TV credits.
    """
    data = await fetch_tmdb(
        f"/person/{person_id}",
        {"append_to_response": "movie_credits,tv_credits"}
    )

    # Sort movie credits by popularity
    movie_credits = data.get("movie_credits", {}).get("cast", [])
    movie_credits = sorted(
        movie_credits,
        key=lambda x: x.get("popularity", 0),
        reverse=True
    )[:20]  # Limit to top 20 films

    # Sort TV credits by popularity
    tv_credits = data.get("tv_credits", {}).get("cast", [])
    tv_credits = sorted(
        tv_credits,
        key=lambda x: x.get("popularity", 0),
        reverse=True
    )[:20]  # Limit to top 20 shows

    return {
        "id": data.get("id"),
        "name": data.get("name"),
        "biography": data.get("biography"),
        "profile_path": data.get("profile_path"),
        "birthday": data.get("birthday"),
        "place_of_birth": data.get("place_of_birth"),
        "known_for_department": data.get("known_for_department"),
        "movie_credits": movie_credits,
        "tv_credits": tv_credits
    }


# === TV SHOW ENDPOINTS ===

@router.get("/tv/upcoming")
async def get_upcoming_tv_shows(page: int = 1):
    """
    Fetch upcoming TV shows using TMDB discover endpoint.
    Filters to shows with a future first air date, sorted by popularity.
    Used for the Coming Soon — TV row on the home screen.
    """
    from datetime import date
    today = date.today().isoformat()
    data = await fetch_tmdb("/discover/tv", {
        "first_air_date.gte": today,
        "sort_by": "popularity.desc",
        "language": "en-GB",
        "page": page
    })
    return {
        "results": data.get("results", []),
        "total_pages": data.get("total_pages", 0),
        "total_results": data.get("total_results", 0),
        "page": data.get("page", page)
    }


@router.get("/tv/{show_id}")
async def get_tv_show_detail(show_id: int):
    """
    Fetch detailed TV show information from TMDB.
    Includes name, overview, seasons, poster, backdrop, genres.
    """
    data = await fetch_tmdb(
        f"/tv/{show_id}",
        {"append_to_response": "videos,credits"}
    )

    # Extract all YouTube videos
    videos = []
    trailer_key = None
    if "videos" in data and "results" in data["videos"]:
        youtube_videos = [
            v for v in data["videos"]["results"]
            if v.get("site") == "YouTube"
        ]
        videos = youtube_videos

        # Also keep the first trailer for backwards compatibility
        trailers = [v for v in youtube_videos if v.get("type") == "Trailer"]
        if trailers:
            trailer_key = trailers[0].get("key")

    return {
        "id": data.get("id"),
        "name": data.get("name"),
        "overview": data.get("overview"),
        "poster_path": data.get("poster_path"),
        "backdrop_path": data.get("backdrop_path"),
        "first_air_date": data.get("first_air_date"),
        "last_air_date": data.get("last_air_date"),
        "number_of_seasons": data.get("number_of_seasons"),
        "number_of_episodes": data.get("number_of_episodes"),
        "seasons": data.get("seasons", []),
        "genres": data.get("genres", []),
        "vote_average": data.get("vote_average"),
        "vote_count": data.get("vote_count"),
        "status": data.get("status"),
        "trailer_key": trailer_key,
        "videos": videos,
        "cast": data.get("credits", {}).get("cast", [])[:20],
        "crew": data.get("credits", {}).get("crew", []),
        "created_by": data.get("created_by", []),
        "credits": data.get("credits", {})
    }


@router.get("/tv/{show_id}/season/{season_number}")
async def get_tv_season_detail(show_id: int, season_number: int):
    """
    Fetch season details with episode list.
    Returns all episodes for the specified season.
    """
    data = await fetch_tmdb(f"/tv/{show_id}/season/{season_number}")

    return {
        "id": data.get("id"),
        "name": data.get("name"),
        "overview": data.get("overview"),
        "poster_path": data.get("poster_path"),
        "season_number": data.get("season_number"),
        "air_date": data.get("air_date"),
        "episodes": data.get("episodes", [])
    }


@router.get("/tv/{show_id}/episode/{season_number}/{episode_number}")
async def get_tv_episode_detail(show_id: int, season_number: int, episode_number: int):
    """
    Fetch single episode details.
    Used for episode detail view if needed.
    """
    data = await fetch_tmdb(f"/tv/{show_id}/season/{season_number}/episode/{episode_number}")

    return {
        "id": data.get("id"),
        "name": data.get("name"),
        "overview": data.get("overview"),
        "still_path": data.get("still_path"),
        "season_number": data.get("season_number"),
        "episode_number": data.get("episode_number"),
        "air_date": data.get("air_date"),
        "runtime": data.get("runtime"),
        "vote_average": data.get("vote_average"),
        "vote_count": data.get("vote_count")
    }


@router.get("/tv/{show_id}/similar")
async def get_similar_tv_shows(show_id: int, page: int = 1):
    """
    Fetch TV shows similar to the specified show.
    Used for recommendations and related titles section.
    """
    data = await fetch_tmdb(f"/tv/{show_id}/similar", {"page": page})
    return {
        "results": data.get("results", []),
        "total_pages": data.get("total_pages", 0),
        "total_results": data.get("total_results", 0),
        "page": data.get("page", page)
    }


@router.get("/tv/{show_id}/reviews")
async def get_tv_show_reviews(show_id: int, page: int = 1):
    """
    Fetch user reviews for a specific TV show from TMDB.
    Returns review content, author details, and ratings.
    """
    data = await fetch_tmdb(f"/tv/{show_id}/reviews", {"page": page})
    return {
        "results": data.get("results", []),
        "total_pages": data.get("total_pages", 0),
        "total_results": data.get("total_results", 0),
        "page": data.get("page", page)
    }
