"""
===================================================================================
Script: tracking.py
Purpose:
    User tracking router for Watchlist application.
    Handles CRUD operations for tracked movies including watched status,
    ratings, comments, and favourites. Supports filtering and recommendations.

Author: Frank Kelly
Date: 20-02-2026
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
    rating: Optional[int] = Field(default=0, ge=0, le=5)
    comment: Optional[str] = ""


class TrackingUpdate(BaseModel):
    """Request model for partial updates to tracking data."""
    watched: Optional[bool] = None
    favourited: Optional[bool] = None
    rating: Optional[int] = Field(default=None, ge=0, le=5)
    comment: Optional[str] = None


class TrackingResponse(BaseModel):
    """Response model for tracked movie data."""
    tmdb_movie_id: int
    watched: bool
    favourited: bool
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


# === TRACKING ENDPOINTS ===

@router.get("/", response_model=List[TrackingResponse])
async def get_tracked_movies(
    watched: Optional[bool] = None,
    favourited: Optional[bool] = None,
    rated: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """
    Fetch all tracked movies with optional filters.
    Used by library screen to display user's collection.
    """
    query = db.query(TrackedMovie)

    # Apply filters if provided
    if watched is not None:
        query = query.filter(TrackedMovie.watched == watched)

    if favourited is not None:
        query = query.filter(TrackedMovie.favourited == favourited)

    if rated is not None:
        if rated:
            query = query.filter(TrackedMovie.rating > 0)
        else:
            query = query.filter(TrackedMovie.rating == 0)

    # Order by most recently updated
    query = query.order_by(TrackedMovie.updated_at.desc())

    movies = query.all()

    # Convert datetime objects to ISO format strings
    return [
        TrackingResponse(
            tmdb_movie_id=m.tmdb_movie_id,
            watched=m.watched,
            favourited=m.favourited,
            rating=m.rating,
            comment=m.comment,
            added_at=m.added_at.isoformat(),
            updated_at=m.updated_at.isoformat()
        )
        for m in movies
    ]


# === STATISTICS ENDPOINTS ===

@router.get("/stats")
async def get_tracking_stats(db: Session = Depends(get_db)):
    """
    Calculate tracking statistics for dashboard.
    Returns counts of total tracked, watched, favourited, and rated films.
    """
    total_tracked = db.query(TrackedMovie).count()

    watched_count = db.query(TrackedMovie).filter(
        TrackedMovie.watched == True
    ).count()

    favourited_count = db.query(TrackedMovie).filter(
        TrackedMovie.favourited == True
    ).count()

    rated_count = db.query(TrackedMovie).filter(
        TrackedMovie.rating > 0
    ).count()

    return {
        "total_tracked": total_tracked,
        "watched": watched_count,
        "favourited": favourited_count,
        "rated": rated_count,
    }


# === RECOMMENDATION ENDPOINTS ===

@router.get("/recommendations")
async def get_recommendations(db: Session = Depends(get_db)):
    """
    Generate personalised recommendations based on viewing history.
    Fetches highly-rated tracked movies (rating >= 4), queries TMDB for
    similar titles, deduplicates, and filters out already tracked films.
    Returns up to 20 recommended movies.
    """
    # Query for highly-rated movies (4 or 5 stars)
    top_rated = db.query(TrackedMovie).filter(
        TrackedMovie.rating >= 4
    ).all()

    if not top_rated:
        return []

    # Get all tracked movie IDs for filtering
    tracked_ids = {m.tmdb_movie_id for m in db.query(TrackedMovie).all()}

    # Collect similar movies from TMDB
    similar_movies = {}  # Use dict to deduplicate by movie ID

    async with httpx.AsyncClient() as client:
        for movie in top_rated:
            try:
                # Fetch similar movies from TMDB
                url = f"{TMDB_BASE_URL}/movie/{movie.tmdb_movie_id}/similar"
                params = {"api_key": TMDB_API_KEY, "page": 1, "with_original_language": "en"}
                response = await client.get(url, params=params, timeout=10.0)

                if response.status_code == 200:
                    data = response.json()
                    for result in data.get("results", []):
                        movie_id = result.get("id")
                        # Skip if already tracked or already in recommendations
                        if movie_id not in tracked_ids and movie_id not in similar_movies:
                            similar_movies[movie_id] = result

            except Exception as e:
                # Log error but continue with other movies
                print(f"Error fetching similar movies for {movie.tmdb_movie_id}: {e}")
                continue

    # Convert to list and limit to 20 results
    recommendations = list(similar_movies.values())[:20]

    return recommendations


@router.get("/{tmdb_id}", response_model=Optional[TrackingResponse])
async def get_tracked_movie(tmdb_id: int, db: Session = Depends(get_db)):
    """
    Fetch tracking data for a specific movie.
    Returns watched status, rating, comment, and favourite flag.
    Returns None if movie is not tracked.
    """
    movie = db.query(TrackedMovie).filter(
        TrackedMovie.tmdb_movie_id == tmdb_id
    ).first()

    if not movie:
        return None

    return TrackingResponse(
        tmdb_movie_id=movie.tmdb_movie_id,
        watched=movie.watched,
        favourited=movie.favourited,
        rating=movie.rating,
        comment=movie.comment,
        added_at=movie.added_at.isoformat(),
        updated_at=movie.updated_at.isoformat()
    )


@router.post("/{tmdb_id}", response_model=TrackingResponse)
async def track_movie(
    tmdb_id: int,
    tracking_data: TrackingCreate,
    db: Session = Depends(get_db)
):
    """
    Add tracking data for a movie.
    Creates new record if movie not tracked, updates existing otherwise.
    All fields (watched, favourited, rating, comment) are optional.
    """
    # Check if movie already tracked
    existing = db.query(TrackedMovie).filter(
        TrackedMovie.tmdb_movie_id == tmdb_id
    ).first()

    if existing:
        # Update existing record
        existing.watched = tracking_data.watched
        existing.favourited = tracking_data.favourited
        existing.rating = tracking_data.rating
        existing.comment = tracking_data.comment
        movie = existing
    else:
        # Create new record
        movie = TrackedMovie(
            tmdb_movie_id=tmdb_id,
            watched=tracking_data.watched,
            favourited=tracking_data.favourited,
            rating=tracking_data.rating,
            comment=tracking_data.comment
        )
        db.add(movie)

    db.commit()
    db.refresh(movie)

    return TrackingResponse(
        tmdb_movie_id=movie.tmdb_movie_id,
        watched=movie.watched,
        favourited=movie.favourited,
        rating=movie.rating,
        comment=movie.comment,
        added_at=movie.added_at.isoformat(),
        updated_at=movie.updated_at.isoformat()
    )


@router.patch("/{tmdb_id}", response_model=TrackingResponse)
async def update_tracking(
    tmdb_id: int,
    tracking_data: TrackingUpdate,
    db: Session = Depends(get_db)
):
    """
    Partially update tracking data for a movie.
    Only updates fields that are provided in the request.
    Returns 404 if movie is not currently tracked.
    """
    movie = db.query(TrackedMovie).filter(
        TrackedMovie.tmdb_movie_id == tmdb_id
    ).first()

    if not movie:
        raise HTTPException(
            status_code=404,
            detail=f"Movie with TMDB ID {tmdb_id} is not tracked"
        )

    # Update only provided fields
    if tracking_data.watched is not None:
        movie.watched = tracking_data.watched

    if tracking_data.favourited is not None:
        movie.favourited = tracking_data.favourited

    if tracking_data.rating is not None:
        movie.rating = tracking_data.rating

    if tracking_data.comment is not None:
        movie.comment = tracking_data.comment

    db.commit()
    db.refresh(movie)

    return TrackingResponse(
        tmdb_movie_id=movie.tmdb_movie_id,
        watched=movie.watched,
        favourited=movie.favourited,
        rating=movie.rating,
        comment=movie.comment,
        added_at=movie.added_at.isoformat(),
        updated_at=movie.updated_at.isoformat()
    )


@router.delete("/{tmdb_id}")
async def untrack_movie(tmdb_id: int, db: Session = Depends(get_db)):
    """
    Remove a movie from tracked collection.
    Deletes all associated tracking data.
    Returns 404 if movie is not currently tracked.
    """
    movie = db.query(TrackedMovie).filter(
        TrackedMovie.tmdb_movie_id == tmdb_id
    ).first()

    if not movie:
        raise HTTPException(
            status_code=404,
            detail=f"Movie with TMDB ID {tmdb_id} is not tracked"
        )

    db.delete(movie)
    db.commit()

    return {
        "message": "Movie untracked successfully",
        "tmdb_movie_id": tmdb_id
    }
