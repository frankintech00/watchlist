"""
===================================================================================
Script: tracking.py
Purpose:
    User tracking router for Watchlist application.
    Handles CRUD operations for tracked movies including watched status,
    ratings, comments, and favourites. All endpoints are scoped by user_id.

Author: Frank Kelly
Date: 22-02-2026
===================================================================================
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field
from typing import Optional, List
from app.database import get_db
from app.models import TrackedMovie
import httpx
import os


# === PYDANTIC MODELS ===

class TrackingCreate(BaseModel):
    """Request model for creating or updating tracking data."""
    watched: Optional[bool] = False
    favourited: Optional[bool] = False
    watchlisted: Optional[bool] = False
    rating: Optional[int] = Field(default=0, ge=0, le=5)
    comment: Optional[str] = ""


class TrackingUpdate(BaseModel):
    """Request model for partial updates to tracking data."""
    watched: Optional[bool] = None
    favourited: Optional[bool] = None
    watchlisted: Optional[bool] = None
    rating: Optional[int] = Field(default=None, ge=0, le=5)
    comment: Optional[str] = None


class TrackingResponse(BaseModel):
    """Response model for tracked movie data."""
    user_id: int
    tmdb_movie_id: int
    watched: bool
    favourited: bool
    watchlisted: bool
    rating: int
    comment: str
    added_at: str
    updated_at: str

    class Config:
        from_attributes = True


# === ROUTER INITIALISATION ===

router = APIRouter()

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
TMDB_BASE_URL = "https://api.themoviedb.org/3"


# === HELPER ===

def _movie_response(m: TrackedMovie) -> TrackingResponse:
    return TrackingResponse(
        user_id=m.user_id,
        tmdb_movie_id=m.tmdb_movie_id,
        watched=m.watched,
        favourited=m.favourited,
        watchlisted=m.watchlisted,
        rating=m.rating,
        comment=m.comment,
        added_at=m.added_at.isoformat() if m.added_at else '',
        updated_at=m.updated_at.isoformat() if m.updated_at else '',
    )


# === TRACKING ENDPOINTS ===

@router.get("/", response_model=List[TrackingResponse])
async def get_tracked_movies(
    user_id: int,
    watched: Optional[bool] = None,
    favourited: Optional[bool] = None,
    watchlisted: Optional[bool] = None,
    rated: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """
    Fetch all tracked movies for a user with optional filters.
    Used by library screen to display user's collection.
    """
    query = db.query(TrackedMovie).filter(TrackedMovie.user_id == user_id)

    if watched is not None:
        query = query.filter(TrackedMovie.watched == watched)

    if favourited is not None:
        query = query.filter(TrackedMovie.favourited == favourited)

    if watchlisted is not None:
        query = query.filter(TrackedMovie.watchlisted == watchlisted)

    if rated is not None:
        if rated:
            query = query.filter(TrackedMovie.rating > 0)
        else:
            query = query.filter(TrackedMovie.rating == 0)

    movies = query.order_by(TrackedMovie.updated_at.desc()).all()
    return [_movie_response(m) for m in movies]


# === STATISTICS ENDPOINTS ===

@router.get("/stats")
async def get_tracking_stats(user_id: int, db: Session = Depends(get_db)):
    """
    Calculate tracking statistics for a user's dashboard.
    Returns counts of total tracked, watched, favourited, and rated films.
    """
    base = db.query(TrackedMovie).filter(TrackedMovie.user_id == user_id)

    return {
        "total_tracked": base.count(),
        "watched": base.filter(TrackedMovie.watched == True).count(),
        "favourited": base.filter(TrackedMovie.favourited == True).count(),
        "watchlisted": base.filter(TrackedMovie.watchlisted == True).count(),
        "rated": base.filter(TrackedMovie.rating > 0).count(),
    }


# === RECOMMENDATION ENDPOINTS ===

@router.get("/recommendations")
async def get_recommendations(user_id: int, db: Session = Depends(get_db)):
    """
    Generate personalised recommendations based on a user's viewing history.
    Fetches highly-rated tracked movies (rating >= 4), queries TMDB for
    similar titles, deduplicates, and filters out already tracked films.
    Returns up to 20 recommended movies.
    """
    top_rated = db.query(TrackedMovie).filter(
        TrackedMovie.user_id == user_id,
        TrackedMovie.rating >= 4
    ).all()

    if not top_rated:
        return []

    tracked_ids = {
        m.tmdb_movie_id
        for m in db.query(TrackedMovie).filter(TrackedMovie.user_id == user_id).all()
    }

    similar_movies = {}

    async with httpx.AsyncClient() as client:
        for movie in top_rated:
            try:
                url = f"{TMDB_BASE_URL}/movie/{movie.tmdb_movie_id}/similar"
                params = {"api_key": TMDB_API_KEY, "page": 1, "with_original_language": "en"}
                response = await client.get(url, params=params, timeout=10.0)

                if response.status_code == 200:
                    data = response.json()
                    for result in data.get("results", []):
                        movie_id = result.get("id")
                        if movie_id not in tracked_ids and movie_id not in similar_movies:
                            similar_movies[movie_id] = result

            except Exception as e:
                print(f"Error fetching similar movies for {movie.tmdb_movie_id}: {e}")
                continue

    return list(similar_movies.values())[:20]


@router.get("/{tmdb_id}", response_model=Optional[TrackingResponse])
async def get_tracked_movie(tmdb_id: int, user_id: int, db: Session = Depends(get_db)):
    """
    Fetch tracking data for a specific movie for a user.
    Returns None if movie is not tracked by this user.
    """
    movie = db.query(TrackedMovie).filter(
        TrackedMovie.user_id == user_id,
        TrackedMovie.tmdb_movie_id == tmdb_id,
    ).first()

    return _movie_response(movie) if movie else None


@router.post("/{tmdb_id}", response_model=TrackingResponse)
async def track_movie(
    tmdb_id: int,
    user_id: int,
    tracking_data: TrackingCreate,
    db: Session = Depends(get_db)
):
    """
    Add or update tracking data for a movie for a specific user.
    Creates new record if not tracked, updates existing otherwise.
    """
    existing = db.query(TrackedMovie).filter(
        TrackedMovie.user_id == user_id,
        TrackedMovie.tmdb_movie_id == tmdb_id,
    ).first()

    if existing:
        existing.watched = tracking_data.watched
        existing.favourited = tracking_data.favourited
        existing.watchlisted = tracking_data.watchlisted
        existing.rating = tracking_data.rating
        existing.comment = tracking_data.comment
        movie = existing
    else:
        movie = TrackedMovie(
            user_id=user_id,
            tmdb_movie_id=tmdb_id,
            watched=tracking_data.watched,
            favourited=tracking_data.favourited,
            watchlisted=tracking_data.watchlisted,
            rating=tracking_data.rating,
            comment=tracking_data.comment,
        )
        db.add(movie)

    db.commit()
    db.refresh(movie)
    return _movie_response(movie)


@router.patch("/{tmdb_id}", response_model=TrackingResponse)
async def update_tracking(
    tmdb_id: int,
    user_id: int,
    tracking_data: TrackingUpdate,
    db: Session = Depends(get_db)
):
    """
    Partially update tracking data for a movie.
    Only updates fields that are provided. Returns 404 if not tracked.
    """
    movie = db.query(TrackedMovie).filter(
        TrackedMovie.user_id == user_id,
        TrackedMovie.tmdb_movie_id == tmdb_id,
    ).first()

    if not movie:
        raise HTTPException(
            status_code=404,
            detail=f"Movie with TMDB ID {tmdb_id} is not tracked by user {user_id}"
        )

    if tracking_data.watched is not None:
        movie.watched = tracking_data.watched
    if tracking_data.favourited is not None:
        movie.favourited = tracking_data.favourited
    if tracking_data.watchlisted is not None:
        movie.watchlisted = tracking_data.watchlisted
    if tracking_data.rating is not None:
        movie.rating = tracking_data.rating
    if tracking_data.comment is not None:
        movie.comment = tracking_data.comment

    db.commit()
    db.refresh(movie)
    return _movie_response(movie)


@router.delete("/{tmdb_id}")
async def untrack_movie(tmdb_id: int, user_id: int, db: Session = Depends(get_db)):
    """
    Remove a movie from a user's tracked collection.
    Returns 404 if movie is not currently tracked by this user.
    """
    movie = db.query(TrackedMovie).filter(
        TrackedMovie.user_id == user_id,
        TrackedMovie.tmdb_movie_id == tmdb_id,
    ).first()

    if not movie:
        raise HTTPException(
            status_code=404,
            detail=f"Movie with TMDB ID {tmdb_id} is not tracked by user {user_id}"
        )

    db.delete(movie)
    db.commit()

    return {"message": "Movie untracked successfully", "tmdb_movie_id": tmdb_id}
