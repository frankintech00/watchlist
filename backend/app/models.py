"""
===================================================================================
Script: models.py
Purpose:
    SQLAlchemy models for Watchlist database.
    Every tracked title has exactly one status: 'watching' or 'watched'.
    All tracking data is scoped per user via composite primary keys.

Author: Frank Kelly
Date: 15-11-2026
===================================================================================
"""

from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, Float,
    ForeignKey, UniqueConstraint, ForeignKeyConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


# === CONSTANTS ===

STATUS_WATCHING = "watching"
STATUS_WATCHED = "watched"
VALID_STATUSES = (STATUS_WATCHING, STATUS_WATCHED)


# === MODELS ===

class User(Base):
    """
    User profile model.
    No authentication — just pick a profile.
    All tracking data is scoped to a user via foreign keys.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    avatar_path = Column(String, nullable=True)  # e.g. "avatars/abc123.jpg", relative to /app/data/
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    movies = relationship("TrackedMovie", cascade="all, delete-orphan")
    shows = relationship("TrackedShow", cascade="all, delete-orphan")


class TrackedMovie(Base):
    """
    Tracked film. Metadata is fetched from TMDB and not stored locally.

    Databases created before v3 also carry legacy `watched`, `favourited` and
    `watchlisted` columns. They are no longer mapped; their SQL defaults keep
    inserts working.
    """
    __tablename__ = "tracked_movies"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, nullable=False)
    tmdb_movie_id = Column(Integer, primary_key=True, nullable=False)
    status = Column(String, default=STATUS_WATCHED, server_default=STATUS_WATCHED, nullable=False)
    rating = Column(Integer, default=0, nullable=False)  # 0-5 stars
    comment = Column(Text, default="", nullable=False)
    # Python-side defaults matter: tables built by the old migration have no SQL default.
    added_at = Column(DateTime, server_default=func.now(), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), default=datetime.utcnow,
                        onupdate=datetime.utcnow, nullable=False)


class TrackedShow(Base):
    """
    Tracked TV show. Metadata is fetched from TMDB and not stored locally.
    Legacy `favourited` / `watchlisted` columns may exist in older databases (unmapped).
    """
    __tablename__ = "tracked_shows"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, nullable=False)
    tmdb_show_id = Column(Integer, primary_key=True, nullable=False)
    status = Column(String, default=STATUS_WATCHING, server_default=STATUS_WATCHING, nullable=False)
    rating = Column(Integer, default=0, nullable=False)  # 0-5 stars
    comment = Column(Text, default="", nullable=False)
    added_at = Column(DateTime, server_default=func.now(), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), default=datetime.utcnow,
                        onupdate=datetime.utcnow, nullable=False)

    # Denormalised counts (aired episodes at last sync / watched regular-season episodes)
    total_episodes = Column(Integer, nullable=True)
    watched_episodes = Column(Integer, default=0, nullable=False)

    # Relationship to episodes — composite FK join on both user_id and tmdb_show_id
    episodes = relationship(
        "TrackedEpisode",
        primaryjoin=(
            "and_(TrackedShow.user_id==foreign(TrackedEpisode.user_id), "
            "TrackedShow.tmdb_show_id==foreign(TrackedEpisode.tmdb_show_id))"
        ),
        cascade="all, delete-orphan",
    )


class TrackedEpisode(Base):
    """
    Watch state for an individual episode, scoped per user.
    Episodes are identified by show ID, season number, and episode number.
    """
    __tablename__ = "tracked_episodes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    tmdb_show_id = Column(Integer, nullable=False)
    season_number = Column(Integer, nullable=False)
    episode_number = Column(Integer, nullable=False)
    watched = Column(Boolean, default=False, nullable=False)
    watched_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint(
            'user_id', 'tmdb_show_id', 'season_number', 'episode_number',
            name='uix_user_show_season_episode'
        ),
        ForeignKeyConstraint(
            ['user_id', 'tmdb_show_id'],
            ['tracked_shows.user_id', 'tracked_shows.tmdb_show_id'],
            ondelete="CASCADE",
        ),
    )


class FilmRating(Base):
    """
    Cached critic scores for a film (Rotten Tomatoes etc. via OMDb).
    Shared across users; purely a cache and safe to delete.
    """
    __tablename__ = "film_ratings"

    tmdb_movie_id = Column(Integer, primary_key=True)
    imdb_id = Column(String, nullable=True)
    rt_score = Column(Integer, nullable=True)       # Tomatometer, 0-100
    imdb_rating = Column(Float, nullable=True)      # 0-10
    metascore = Column(Integer, nullable=True)      # 0-100
    fetched_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class FilmMDBRating(Base):
    """MDBList cache, separate from OMDb so enabling it fetches audience data immediately."""
    __tablename__ = "film_mdb_ratings"

    tmdb_movie_id = Column(Integer, primary_key=True)
    rt_score = Column(Integer, nullable=True)
    rt_audience_score = Column(Integer, nullable=True)
    imdb_rating = Column(Float, nullable=True)
    metascore = Column(Integer, nullable=True)
    fetched_at = Column(DateTime, default=datetime.utcnow, nullable=False)
