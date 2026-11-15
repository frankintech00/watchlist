"""
===================================================================================
Script: tv_tracking.py
Purpose:
    TV show tracking router for Watchlist application.
    A tracked show is either 'watching' or 'watched'. Episode-level watch state
    drives that status automatically; it can also be set by hand.
    All endpoints are scoped by user_id.

Author: Frank Kelly
Date: 15-11-2026
===================================================================================
"""

from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TrackedShow, TrackedEpisode, STATUS_WATCHING, STATUS_WATCHED
from app.tmdb_client import get_show, gather_safe, aired_episodes, show_progress


# === PYDANTIC MODELS ===

class ShowTrackingUpdate(BaseModel):
    """Partial update. Creates the tracking record if the show is not tracked yet."""
    status: Optional[Literal["watching", "watched"]] = None
    rating: Optional[int] = Field(default=None, ge=0, le=5)
    comment: Optional[str] = None


class EpisodeTrackingRequest(BaseModel):
    season_number: int
    episode_number: int
    watched: bool


class EpisodeTrackingBulk(BaseModel):
    episodes: List[EpisodeTrackingRequest]


# === ROUTER INITIALISATION ===

router = APIRouter()


# === HELPERS ===

def _iso(value) -> str:
    return value.isoformat() if value else ''


def _tracking_dict(s: TrackedShow) -> dict:
    return {
        "user_id": s.user_id,
        "tmdb_show_id": s.tmdb_show_id,
        "status": s.status,
        "rating": s.rating,
        "comment": s.comment,
        "total_episodes": s.total_episodes,
        "watched_episodes": s.watched_episodes,
        "added_at": _iso(s.added_at),
        "updated_at": _iso(s.updated_at),
    }


def _get_show_row(db: Session, user_id: int, tmdb_id: int) -> Optional[TrackedShow]:
    return db.query(TrackedShow).filter(
        TrackedShow.user_id == user_id,
        TrackedShow.tmdb_show_id == tmdb_id,
    ).first()


def _get_or_create(db: Session, user_id: int, tmdb_id: int) -> TrackedShow:
    show = _get_show_row(db, user_id, tmdb_id)
    if not show:
        show = TrackedShow(
            user_id=user_id, tmdb_show_id=tmdb_id,
            status=STATUS_WATCHING, rating=0, comment="", watched_episodes=0,
        )
        db.add(show)
        db.flush()
    return show


def _watched_pairs(db: Session, user_id: int, tmdb_id: int) -> set:
    rows = db.query(TrackedEpisode.season_number, TrackedEpisode.episode_number).filter(
        TrackedEpisode.user_id == user_id,
        TrackedEpisode.tmdb_show_id == tmdb_id,
        TrackedEpisode.watched == True,  # noqa: E712
        TrackedEpisode.season_number > 0,
    ).all()
    return {(r[0], r[1]) for r in rows}


def _set_episodes(db: Session, user_id: int, tmdb_id: int, pairs, watched: bool):
    """Create or update watch state for the given (season, episode) pairs."""
    existing = {
        (e.season_number, e.episode_number): e
        for e in db.query(TrackedEpisode).filter(
            TrackedEpisode.user_id == user_id,
            TrackedEpisode.tmdb_show_id == tmdb_id,
        ).all()
    }
    now = datetime.utcnow()
    for pair in pairs:
        episode = existing.get(pair)
        if episode:
            if episode.watched != watched:
                episode.watched = watched
                episode.watched_at = now if watched else None
        else:
            episode = TrackedEpisode(
                user_id=user_id, tmdb_show_id=tmdb_id,
                season_number=pair[0], episode_number=pair[1],
                watched=watched, watched_at=now if watched else None,
            )
            db.add(episode)
            existing[pair] = episode


async def _sync_progress(db: Session, show: TrackedShow) -> dict:
    """
    Recalculate counts after episode changes and move the show between
    'watching' and 'watched' to match: every aired episode seen -> watched,
    anything outstanding -> watching. Always bumps updated_at so the show
    surfaces as most recently updated.
    """
    db.flush()
    watched = _watched_pairs(db, show.user_id, show.tmdb_show_id)
    try:
        detail = await get_show(show.tmdb_show_id)
    except HTTPException:
        detail = None

    progress = show_progress(detail, watched)
    show.watched_episodes = progress["watched_episodes"]
    if detail is not None and progress["aired_episodes"] > 0:
        show.total_episodes = progress["aired_episodes"]
        show.status = STATUS_WATCHING if progress["next_episode"] else STATUS_WATCHED
    show.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(show)
    return {**_tracking_dict(show), **progress}


# === SHOW TRACKING ENDPOINTS ===

@router.get("/shows")
async def get_tracked_shows(
    user_id: int,
    status: Optional[Literal["watching", "watched"]] = None,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    All tracked shows for a user, most recently updated first, each enriched with
    TMDB artwork/metadata and live episode progress so list pages need one request.
    """
    query = db.query(TrackedShow).filter(TrackedShow.user_id == user_id)
    if status:
        query = query.filter(TrackedShow.status == status)
    query = query.order_by(TrackedShow.updated_at.desc())
    if limit:
        query = query.limit(limit)
    shows = query.all()

    watched_by_show: dict = {}
    for show_id, season, episode in db.query(
        TrackedEpisode.tmdb_show_id, TrackedEpisode.season_number, TrackedEpisode.episode_number
    ).filter(
        TrackedEpisode.user_id == user_id,
        TrackedEpisode.watched == True,  # noqa: E712
        TrackedEpisode.season_number > 0,
    ):
        watched_by_show.setdefault(show_id, set()).add((season, episode))

    details = await gather_safe([get_show(s.tmdb_show_id) for s in shows])

    items = []
    healed = False
    for show, detail in zip(shows, details):
        detail = detail or {}
        progress = show_progress(detail, watched_by_show.get(show.tmdb_show_id, set()))
        if not detail:
            # TMDB unavailable — fall back to the stored counts
            progress["aired_episodes"] = show.total_episodes or 0
            progress["watched_episodes"] = show.watched_episodes

        # Self-heal: everything aired has been seen but the show still says
        # 'watching' (episode counts stored before v3 could be out of date).
        # updated_at is passed through explicitly so the show keeps its place.
        if show.status == STATUS_WATCHING and progress["aired_episodes"] > 0 and not progress["next_episode"]:
            db.execute(
                update(TrackedShow)
                .where(TrackedShow.user_id == user_id, TrackedShow.tmdb_show_id == show.tmdb_show_id)
                .values(status=STATUS_WATCHED, updated_at=TrackedShow.updated_at)
            )
            healed = True
            show_status = STATUS_WATCHED
        else:
            show_status = show.status

        # A finished show that has aired more episodes since
        has_new = bool(show_status == STATUS_WATCHED and progress["next_episode"])
        next_air = detail.get("next_episode_to_air") or None

        items.append({
            **_tracking_dict(show),
            "status": show_status,
            **progress,
            "has_new_episodes": has_new,
            "id": show.tmdb_show_id,
            "media_type": "tv",
            "name": detail.get("name"),
            "overview": detail.get("overview"),
            "poster_path": detail.get("poster_path"),
            "backdrop_path": detail.get("backdrop_path"),
            "first_air_date": detail.get("first_air_date"),
            "show_status": detail.get("status"),
            "number_of_seasons": detail.get("number_of_seasons"),
            "genres": [g.get("name") for g in detail.get("genres", [])],
            "networks": [n.get("name") for n in detail.get("networks", [])][:2],
            "next_air": (
                {
                    "air_date": next_air.get("air_date"),
                    "season_number": next_air.get("season_number"),
                    "episode_number": next_air.get("episode_number"),
                } if next_air else None
            ),
        })
    if healed:
        db.commit()
    return items


@router.get("/shows/{tmdb_id}")
async def get_tracked_show(tmdb_id: int, user_id: int, db: Session = Depends(get_db)):
    """Tracking data for one show, or null if this user is not tracking it."""
    show = _get_show_row(db, user_id, tmdb_id)
    return _tracking_dict(show) if show else None


@router.put("/shows/{tmdb_id}")
async def upsert_show(
    tmdb_id: int,
    user_id: int,
    data: ShowTrackingUpdate,
    db: Session = Depends(get_db),
):
    """
    Track a show or update its status / rating / note. Only supplied fields change.
    A newly tracked show defaults to 'watching'.
    """
    show = _get_or_create(db, user_id, tmdb_id)

    if show.total_episodes is None:
        try:
            show.total_episodes = len(aired_episodes(await get_show(tmdb_id))) or None
        except HTTPException:
            pass

    if data.status is not None:
        show.status = data.status
    if data.rating is not None:
        show.rating = data.rating
    if data.comment is not None:
        show.comment = data.comment
    show.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(show)
    return _tracking_dict(show)


@router.delete("/shows/{tmdb_id}")
async def untrack_show(tmdb_id: int, user_id: int, db: Session = Depends(get_db)):
    """Stop tracking a show. Deletes the show and all of its episode state."""
    show = _get_show_row(db, user_id, tmdb_id)
    if not show:
        raise HTTPException(status_code=404, detail=f"TV show {tmdb_id} is not tracked by user {user_id}")

    db.delete(show)
    db.commit()
    return {"message": "TV show untracked successfully", "tmdb_show_id": tmdb_id}


# === EPISODE TRACKING ENDPOINTS ===

@router.get("/shows/{tmdb_id}/episodes")
async def get_show_episodes(tmdb_id: int, user_id: int, db: Session = Depends(get_db)):
    """Every episode watch state recorded for a show."""
    episodes = db.query(TrackedEpisode).filter(
        TrackedEpisode.user_id == user_id,
        TrackedEpisode.tmdb_show_id == tmdb_id,
    ).order_by(TrackedEpisode.season_number, TrackedEpisode.episode_number).all()

    return [
        {
            "season_number": e.season_number,
            "episode_number": e.episode_number,
            "watched": e.watched,
            "watched_at": e.watched_at.isoformat() if e.watched_at else None,
        }
        for e in episodes
    ]


@router.post("/shows/{tmdb_id}/episodes")
async def mark_episodes(
    tmdb_id: int,
    user_id: int,
    request: EpisodeTrackingBulk,
    db: Session = Depends(get_db),
):
    """
    Mark episodes watched or unwatched. Starts tracking the show if needed and
    returns the show's refreshed tracking data and progress.
    """
    show = _get_or_create(db, user_id, tmdb_id)
    for watched in (True, False):
        pairs = [(e.season_number, e.episode_number) for e in request.episodes if e.watched is watched]
        if pairs:
            _set_episodes(db, user_id, tmdb_id, pairs, watched)
    return await _sync_progress(db, show)


@router.post("/shows/{tmdb_id}/season/{season_number}/mark-watched")
async def mark_season_watched(
    tmdb_id: int,
    season_number: int,
    user_id: int,
    watched: bool = True,
    db: Session = Depends(get_db),
):
    """
    Mark a whole season watched (aired episodes only) or unwatched (every episode).
    """
    detail = await get_show(tmdb_id)
    season = next(
        (s for s in detail.get("seasons", []) if s.get("season_number") == season_number), None
    )
    if season is None:
        raise HTTPException(status_code=404, detail=f"Season {season_number} not found")

    if watched:
        pairs = [p for p in aired_episodes(detail) if p[0] == season_number]
        if season_number == 0:
            pairs = [(0, ep) for ep in range(1, (season.get("episode_count") or 0) + 1)]
    else:
        pairs = [(season_number, ep) for ep in range(1, (season.get("episode_count") or 0) + 1)]

    if watched and not pairs:
        raise HTTPException(status_code=400, detail=f"No episodes of season {season_number} have aired yet")

    show = _get_or_create(db, user_id, tmdb_id)
    if watched:
        _set_episodes(db, user_id, tmdb_id, pairs, True)
    else:
        # Clear everything recorded for the season, including oddly numbered episodes
        for episode in db.query(TrackedEpisode).filter(
            TrackedEpisode.user_id == user_id,
            TrackedEpisode.tmdb_show_id == tmdb_id,
            TrackedEpisode.season_number == season_number,
        ):
            episode.watched = False
            episode.watched_at = None
    return await _sync_progress(db, show)


@router.post("/shows/{tmdb_id}/mark-all-watched")
async def mark_show_watched(tmdb_id: int, user_id: int, db: Session = Depends(get_db)):
    """Mark every aired episode of a show as watched (and so the show as 'watched')."""
    detail = await get_show(tmdb_id)
    pairs = aired_episodes(detail)
    show = _get_or_create(db, user_id, tmdb_id)
    if pairs:
        _set_episodes(db, user_id, tmdb_id, pairs, True)
    else:
        show.status = STATUS_WATCHED
    return await _sync_progress(db, show)
