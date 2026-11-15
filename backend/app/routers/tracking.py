"""
===================================================================================
Script: tracking.py
Purpose:
    Film tracking router for Watchlist application.
    A tracked film is either 'watching' or 'watched', with an optional personal
    rating and note. All endpoints are scoped by user_id.

Author: Frank Kelly
Date: 15-11-2026
===================================================================================
"""

from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TrackedMovie, TrackedShow, STATUS_WATCHED
from app.tmdb_client import get_movie, gather_safe


# === PYDANTIC MODELS ===

class MovieTrackingUpdate(BaseModel):
    """Partial update. Creates the tracking record if the film is not tracked yet."""
    status: Optional[Literal["watching", "watched"]] = None
    rating: Optional[int] = Field(default=None, ge=0, le=5)
    comment: Optional[str] = None


# === ROUTER INITIALISATION ===

router = APIRouter()


# === HELPERS ===

def _tracking_dict(m: TrackedMovie) -> dict:
    return {
        "user_id": m.user_id,
        "tmdb_movie_id": m.tmdb_movie_id,
        "status": m.status,
        "rating": m.rating,
        "comment": m.comment,
        "added_at": m.added_at.isoformat() if m.added_at else '',
        "updated_at": m.updated_at.isoformat() if m.updated_at else '',
    }


def _get_movie_row(db: Session, user_id: int, tmdb_id: int) -> Optional[TrackedMovie]:
    return db.query(TrackedMovie).filter(
        TrackedMovie.user_id == user_id,
        TrackedMovie.tmdb_movie_id == tmdb_id,
    ).first()


# === ENDPOINTS ===

@router.get("/ids")
async def get_tracked_ids(user_id: int, db: Session = Depends(get_db)):
    """
    Lightweight map of everything a user tracks: {"tv": {id: status}, "movie": {id: status}}.
    Lets search, people and discovery pages badge titles without loading the full lists.
    """
    return {
        "tv": dict(
            db.query(TrackedShow.tmdb_show_id, TrackedShow.status)
            .filter(TrackedShow.user_id == user_id).all()
        ),
        "movie": dict(
            db.query(TrackedMovie.tmdb_movie_id, TrackedMovie.status)
            .filter(TrackedMovie.user_id == user_id).all()
        ),
    }


@router.get("/movies")
async def get_tracked_movies(
    user_id: int,
    status: Optional[Literal["watching", "watched"]] = None,
    db: Session = Depends(get_db),
):
    """All tracked films for a user, most recently updated first, with TMDB metadata."""
    query = db.query(TrackedMovie).filter(TrackedMovie.user_id == user_id)
    if status:
        query = query.filter(TrackedMovie.status == status)
    movies = query.order_by(TrackedMovie.updated_at.desc()).all()

    details = await gather_safe([get_movie(m.tmdb_movie_id) for m in movies])

    items = []
    for movie, detail in zip(movies, details):
        detail = detail or {}
        items.append({
            **_tracking_dict(movie),
            "id": movie.tmdb_movie_id,
            "media_type": "movie",
            "title": detail.get("title"),
            "overview": detail.get("overview"),
            "poster_path": detail.get("poster_path"),
            "backdrop_path": detail.get("backdrop_path"),
            "release_date": detail.get("release_date"),
            "runtime": detail.get("runtime"),
        })
    return items


@router.get("/movies/{tmdb_id}")
async def get_tracked_movie(tmdb_id: int, user_id: int, db: Session = Depends(get_db)):
    """Tracking data for one film, or null if this user is not tracking it."""
    movie = _get_movie_row(db, user_id, tmdb_id)
    return _tracking_dict(movie) if movie else None


@router.put("/movies/{tmdb_id}")
async def upsert_movie(
    tmdb_id: int,
    user_id: int,
    data: MovieTrackingUpdate,
    db: Session = Depends(get_db),
):
    """
    Track a film or update its status / rating / note. Only supplied fields change.
    A newly tracked film defaults to 'watched'.
    """
    movie = _get_movie_row(db, user_id, tmdb_id)
    if not movie:
        movie = TrackedMovie(
            user_id=user_id, tmdb_movie_id=tmdb_id,
            status=STATUS_WATCHED, rating=0, comment="",
        )
        db.add(movie)

    if data.status is not None:
        movie.status = data.status
    if data.rating is not None:
        movie.rating = data.rating
    if data.comment is not None:
        movie.comment = data.comment
    movie.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(movie)
    return _tracking_dict(movie)


@router.delete("/movies/{tmdb_id}")
async def untrack_movie(tmdb_id: int, user_id: int, db: Session = Depends(get_db)):
    """Stop tracking a film."""
    movie = _get_movie_row(db, user_id, tmdb_id)
    if not movie:
        raise HTTPException(status_code=404, detail=f"Film {tmdb_id} is not tracked by user {user_id}")

    db.delete(movie)
    db.commit()
    return {"message": "Film untracked successfully", "tmdb_movie_id": tmdb_id}
