"""
===================================================================================
Script: tv_tracking.py
Purpose:
    TV show tracking router for Watchlist application.
    Handles CRUD operations for tracked TV shows and episode-level watch state.
    Supports season-level bulk operations and progress tracking.
    All endpoints are scoped by user_id.

Author: Frank Kelly
Date: 22-02-2026
===================================================================================
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.database import get_db
from app.models import TrackedShow, TrackedEpisode
import httpx
import os


# === PYDANTIC MODELS ===

class ShowTrackingCreate(BaseModel):
    """Request model for creating or updating show tracking data."""
    favourited: Optional[bool] = False
    watchlisted: Optional[bool] = False
    rating: Optional[int] = Field(default=0, ge=0, le=5)
    comment: Optional[str] = ""


class ShowTrackingUpdate(BaseModel):
    """Request model for partial updates to show tracking data."""
    favourited: Optional[bool] = None
    watchlisted: Optional[bool] = None
    rating: Optional[int] = Field(default=None, ge=0, le=5)
    comment: Optional[str] = None


class ShowTrackingResponse(BaseModel):
    """Response model for tracked show data."""
    user_id: int
    tmdb_show_id: int
    favourited: bool
    watchlisted: bool
    rating: int
    comment: str
    total_episodes: Optional[int]
    watched_episodes: int
    added_at: str
    updated_at: str

    class Config:
        from_attributes = True


class EpisodeTrackingRequest(BaseModel):
    """Request model for marking episodes watched/unwatched."""
    season_number: int
    episode_number: int
    watched: bool


class EpisodeTrackingBulk(BaseModel):
    """Request model for bulk episode tracking."""
    episodes: List[EpisodeTrackingRequest]


class EpisodeTrackingResponse(BaseModel):
    """Response model for episode watch state."""
    season_number: int
    episode_number: int
    watched: bool
    watched_at: Optional[str]

    class Config:
        from_attributes = True


class SeasonProgressResponse(BaseModel):
    """Response model for season progress."""
    season_number: int
    total_episodes: int
    watched_episodes: int


class ShowProgressResponse(BaseModel):
    """Response model for overall show progress."""
    tmdb_show_id: int
    total_episodes: int
    watched_episodes: int
    seasons: List[SeasonProgressResponse]


# === ROUTER INITIALISATION ===

router = APIRouter()

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
TMDB_BASE_URL = "https://api.themoviedb.org/3"


# === HELPER FUNCTIONS ===

def update_show_episode_counts(db: Session, show_id: int, user_id: int):
    """
    Update denormalised episode counts for a show scoped to a specific user.
    Counts watched episodes from tracked_episodes.
    """
    show = db.query(TrackedShow).filter(
        TrackedShow.user_id == user_id,
        TrackedShow.tmdb_show_id == show_id,
    ).first()
    if show:
        watched_count = db.query(TrackedEpisode).filter(
            TrackedEpisode.user_id == user_id,
            TrackedEpisode.tmdb_show_id == show_id,
            TrackedEpisode.watched == True,
        ).count()
        show.watched_episodes = watched_count
        db.commit()


def _show_response(s: TrackedShow) -> ShowTrackingResponse:
    return ShowTrackingResponse(
        user_id=s.user_id,
        tmdb_show_id=s.tmdb_show_id,
        favourited=s.favourited,
        watchlisted=s.watchlisted,
        rating=s.rating,
        comment=s.comment,
        total_episodes=s.total_episodes,
        watched_episodes=s.watched_episodes,
        added_at=s.added_at.isoformat() if s.added_at else '',
        updated_at=s.updated_at.isoformat() if s.updated_at else '',
    )


# === SHOW TRACKING ENDPOINTS ===

@router.get("/shows", response_model=List[ShowTrackingResponse])
async def get_tracked_shows(
    user_id: int,
    favourited: Optional[bool] = None,
    watchlisted: Optional[bool] = None,
    rated: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """
    Fetch all tracked TV shows for a user with optional filters.
    Used by library screen to display user's TV collection.
    """
    query = db.query(TrackedShow).filter(TrackedShow.user_id == user_id)

    if favourited is not None:
        query = query.filter(TrackedShow.favourited == favourited)

    if watchlisted is not None:
        query = query.filter(TrackedShow.watchlisted == watchlisted)

    if rated is not None:
        if rated:
            query = query.filter(TrackedShow.rating > 0)
        else:
            query = query.filter(TrackedShow.rating == 0)

    shows = query.order_by(TrackedShow.updated_at.desc()).all()
    return [_show_response(s) for s in shows]


@router.get("/shows/{tmdb_id}", response_model=Optional[ShowTrackingResponse])
async def get_tracked_show(tmdb_id: int, user_id: int, db: Session = Depends(get_db)):
    """
    Fetch tracking data for a specific TV show for a user.
    Returns None if show is not tracked by this user.
    """
    show = db.query(TrackedShow).filter(
        TrackedShow.user_id == user_id,
        TrackedShow.tmdb_show_id == tmdb_id,
    ).first()

    return _show_response(show) if show else None


@router.post("/shows/{tmdb_id}", response_model=ShowTrackingResponse)
async def track_show(
    tmdb_id: int,
    user_id: int,
    tracking_data: ShowTrackingCreate,
    db: Session = Depends(get_db)
):
    """
    Add or update tracking data for a TV show for a specific user.
    Creates new record if not tracked. Fetches total episode count from TMDB if new.
    """
    existing = db.query(TrackedShow).filter(
        TrackedShow.user_id == user_id,
        TrackedShow.tmdb_show_id == tmdb_id,
    ).first()

    if existing:
        existing.favourited = tracking_data.favourited
        existing.watchlisted = tracking_data.watchlisted
        existing.rating = tracking_data.rating
        existing.comment = tracking_data.comment
        show = existing
    else:
        # Fetch total episodes from TMDB
        total_episodes = None
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{TMDB_BASE_URL}/tv/{tmdb_id}",
                    params={"api_key": TMDB_API_KEY},
                    timeout=10.0
                )
                if response.status_code == 200:
                    total_episodes = response.json().get("number_of_episodes")
        except Exception:
            pass

        show = TrackedShow(
            user_id=user_id,
            tmdb_show_id=tmdb_id,
            favourited=tracking_data.favourited,
            watchlisted=tracking_data.watchlisted,
            rating=tracking_data.rating,
            comment=tracking_data.comment,
            total_episodes=total_episodes,
            watched_episodes=0,
        )
        db.add(show)

    db.commit()
    db.refresh(show)
    return _show_response(show)


@router.patch("/shows/{tmdb_id}", response_model=ShowTrackingResponse)
async def update_show_tracking(
    tmdb_id: int,
    user_id: int,
    tracking_data: ShowTrackingUpdate,
    db: Session = Depends(get_db)
):
    """
    Partially update tracking data for a TV show.
    Only updates provided fields. Returns 404 if not tracked.
    """
    show = db.query(TrackedShow).filter(
        TrackedShow.user_id == user_id,
        TrackedShow.tmdb_show_id == tmdb_id,
    ).first()

    if not show:
        raise HTTPException(
            status_code=404,
            detail=f"TV show with TMDB ID {tmdb_id} is not tracked by user {user_id}"
        )

    if tracking_data.favourited is not None:
        show.favourited = tracking_data.favourited
    if tracking_data.watchlisted is not None:
        show.watchlisted = tracking_data.watchlisted
    if tracking_data.rating is not None:
        show.rating = tracking_data.rating
    if tracking_data.comment is not None:
        show.comment = tracking_data.comment

    db.commit()
    db.refresh(show)
    return _show_response(show)


@router.delete("/shows/{tmdb_id}")
async def untrack_show(tmdb_id: int, user_id: int, db: Session = Depends(get_db)):
    """
    Remove a TV show from a user's tracked collection.
    Deletes show and all associated episode tracking data (cascade).
    Returns 404 if show is not currently tracked by this user.
    """
    show = db.query(TrackedShow).filter(
        TrackedShow.user_id == user_id,
        TrackedShow.tmdb_show_id == tmdb_id,
    ).first()

    if not show:
        raise HTTPException(
            status_code=404,
            detail=f"TV show with TMDB ID {tmdb_id} is not tracked by user {user_id}"
        )

    db.delete(show)
    db.commit()

    return {"message": "TV show untracked successfully", "tmdb_show_id": tmdb_id}


# === EPISODE TRACKING ENDPOINTS ===

@router.get("/shows/{tmdb_id}/episodes", response_model=List[EpisodeTrackingResponse])
async def get_show_episodes(tmdb_id: int, user_id: int, db: Session = Depends(get_db)):
    """
    Get all tracked episode watch states for a show for a specific user.
    Returns list of all episodes that have been marked watched or unwatched.
    """
    episodes = db.query(TrackedEpisode).filter(
        TrackedEpisode.user_id == user_id,
        TrackedEpisode.tmdb_show_id == tmdb_id,
    ).order_by(
        TrackedEpisode.season_number,
        TrackedEpisode.episode_number,
    ).all()

    return [
        EpisodeTrackingResponse(
            season_number=e.season_number,
            episode_number=e.episode_number,
            watched=e.watched,
            watched_at=e.watched_at.isoformat() if e.watched_at else None,
        )
        for e in episodes
    ]


@router.post("/shows/{tmdb_id}/episodes")
async def mark_episodes(
    tmdb_id: int,
    user_id: int,
    request: EpisodeTrackingBulk,
    db: Session = Depends(get_db)
):
    """
    Mark multiple episodes as watched or unwatched for a specific user.
    Creates or updates episode records as needed.
    Updates show's watched_episodes count.
    """
    show = db.query(TrackedShow).filter(
        TrackedShow.user_id == user_id,
        TrackedShow.tmdb_show_id == tmdb_id,
    ).first()

    if not show:
        raise HTTPException(
            status_code=404,
            detail=f"TV show with TMDB ID {tmdb_id} is not tracked by user {user_id}. Track the show first."
        )

    updated_episodes = []

    for ep_request in request.episodes:
        episode = db.query(TrackedEpisode).filter(
            TrackedEpisode.user_id == user_id,
            TrackedEpisode.tmdb_show_id == tmdb_id,
            TrackedEpisode.season_number == ep_request.season_number,
            TrackedEpisode.episode_number == ep_request.episode_number,
        ).first()

        if episode:
            episode.watched = ep_request.watched
            episode.watched_at = datetime.utcnow() if ep_request.watched else None
        else:
            episode = TrackedEpisode(
                user_id=user_id,
                tmdb_show_id=tmdb_id,
                season_number=ep_request.season_number,
                episode_number=ep_request.episode_number,
                watched=ep_request.watched,
                watched_at=datetime.utcnow() if ep_request.watched else None,
            )
            db.add(episode)

        updated_episodes.append(episode)

    db.commit()
    update_show_episode_counts(db, tmdb_id, user_id)

    return {
        "message": f"Updated {len(updated_episodes)} episodes",
        "episodes": [
            {"season": e.season_number, "episode": e.episode_number, "watched": e.watched}
            for e in updated_episodes
        ],
    }


@router.post("/shows/{tmdb_id}/season/{season_number}/mark-watched")
async def mark_season_watched(
    tmdb_id: int,
    season_number: int,
    user_id: int,
    watched: bool = True,
    db: Session = Depends(get_db)
):
    """
    Mark an entire season as watched or unwatched for a specific user.
    Fetches episode list from TMDB and marks all episodes.
    Creates episode records if they don't exist.
    """
    show = db.query(TrackedShow).filter(
        TrackedShow.user_id == user_id,
        TrackedShow.tmdb_show_id == tmdb_id,
    ).first()

    if not show:
        raise HTTPException(
            status_code=404,
            detail=f"TV show with TMDB ID {tmdb_id} is not tracked by user {user_id}. Track the show first."
        )

    # Fetch season episodes from TMDB
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{TMDB_BASE_URL}/tv/{tmdb_id}/season/{season_number}",
                params={"api_key": TMDB_API_KEY},
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()
            episodes = data.get("episodes", [])
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to fetch season data from TMDB: {str(e)}"
        )

    if not episodes:
        raise HTTPException(
            status_code=404,
            detail=f"No episodes found for season {season_number}"
        )

    updated_count = 0
    for ep_data in episodes:
        episode_number = ep_data.get("episode_number")

        episode = db.query(TrackedEpisode).filter(
            TrackedEpisode.user_id == user_id,
            TrackedEpisode.tmdb_show_id == tmdb_id,
            TrackedEpisode.season_number == season_number,
            TrackedEpisode.episode_number == episode_number,
        ).first()

        if episode:
            episode.watched = watched
            episode.watched_at = datetime.utcnow() if watched else None
        else:
            episode = TrackedEpisode(
                user_id=user_id,
                tmdb_show_id=tmdb_id,
                season_number=season_number,
                episode_number=episode_number,
                watched=watched,
                watched_at=datetime.utcnow() if watched else None,
            )
            db.add(episode)

        updated_count += 1

    db.commit()
    update_show_episode_counts(db, tmdb_id, user_id)

    return {
        "message": f"Marked {updated_count} episodes in season {season_number} as {'watched' if watched else 'unwatched'}",
        "season_number": season_number,
        "episodes_updated": updated_count,
        "watched": watched,
    }


@router.get("/shows/{tmdb_id}/progress", response_model=ShowProgressResponse)
async def get_show_progress(tmdb_id: int, user_id: int, db: Session = Depends(get_db)):
    """
    Get watch progress for a TV show for a specific user.
    Returns overall progress and per-season breakdown.
    """
    show = db.query(TrackedShow).filter(
        TrackedShow.user_id == user_id,
        TrackedShow.tmdb_show_id == tmdb_id,
    ).first()

    if not show:
        raise HTTPException(
            status_code=404,
            detail=f"TV show with TMDB ID {tmdb_id} is not tracked by user {user_id}"
        )

    episodes = db.query(TrackedEpisode).filter(
        TrackedEpisode.user_id == user_id,
        TrackedEpisode.tmdb_show_id == tmdb_id,
    ).all()

    season_progress = {}
    for episode in episodes:
        season = episode.season_number
        if season not in season_progress:
            season_progress[season] = {"total": 0, "watched": 0}
        season_progress[season]["total"] += 1
        if episode.watched:
            season_progress[season]["watched"] += 1

    seasons = [
        SeasonProgressResponse(
            season_number=season_num,
            total_episodes=stats["total"],
            watched_episodes=stats["watched"],
        )
        for season_num, stats in sorted(season_progress.items())
    ]

    return ShowProgressResponse(
        tmdb_show_id=tmdb_id,
        total_episodes=show.total_episodes or sum(s.total_episodes for s in seasons),
        watched_episodes=show.watched_episodes,
        seasons=seasons,
    )
