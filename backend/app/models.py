"""
===================================================================================
Script: models.py
Purpose:
    SQLAlchemy models for Watchlist database.
    Defines database schemas for users and tracking films, TV shows, and episodes.
    All tracking data is scoped per user via composite primary keys.

Author: Frank Kelly
Date: 22-02-2026
===================================================================================
"""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, UniqueConstraint, ForeignKeyConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


# === MODELS ===

class User(Base):
    """
    User profile model.
    Netflix-style profile — no authentication, just pick a profile.
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
    Tracked movie model.
    Stores user interaction data for individual films, scoped per user.
    Film metadata is fetched from TMDB and not stored locally.
    """
    __tablename__ = "tracked_movies"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, nullable=False)
    tmdb_movie_id = Column(Integer, primary_key=True, nullable=False)
    watched = Column(Boolean, default=False, nullable=False)
    favourited = Column(Boolean, default=False, nullable=False)
    watchlisted = Column(Boolean, default=False, nullable=False)
    rating = Column(Integer, default=0, nullable=False)  # 0-5 stars
    comment = Column(Text, default="", nullable=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), default=datetime.utcnow, nullable=False)


class TrackedShow(Base):
    """
    Tracked TV show model.
    Stores user interaction data for TV shows, scoped per user.
    Show metadata is fetched from TMDB and not stored locally.
    """
    __tablename__ = "tracked_shows"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, nullable=False)
    tmdb_show_id = Column(Integer, primary_key=True, nullable=False)
    favourited = Column(Boolean, default=False, nullable=False)
    watchlisted = Column(Boolean, default=False, nullable=False)
    rating = Column(Integer, default=0, nullable=False)  # 0-5 stars
    comment = Column(Text, default="", nullable=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), default=datetime.utcnow, nullable=False)

    # Denormalised counts for performance
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
    Tracked episode model.
    Stores watch state for individual episodes, scoped per user.
    Episodes are identified by show ID, season number, and episode number.
    """
    __tablename__ = "tracked_episodes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    tmdb_show_id = Column(Integer, nullable=False)
    season_number = Column(Integer, nullable=False)
    episode_number = Column(Integer, nullable=False)
    watched = Column(Boolean, default=False, nullable=False)
    watched_at = Column(DateTime(timezone=True), nullable=True)

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
