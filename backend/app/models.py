"""
===================================================================================
Script: models.py
Purpose:
    SQLAlchemy models for Watchlist database.
    Defines database schemas for tracking films, TV shows, and episodes
    with user interaction data (watched status, ratings, comments, favourites).

Author: Frank Kelly
Date: 20-02-2026
===================================================================================
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


# === MODELS ===

class TrackedMovie(Base):
    """
    Tracked movie model.
    Stores user interaction data for individual films.
    Film metadata is fetched from TMDB and not stored locally.
    """
    __tablename__ = "tracked_movies"

    tmdb_movie_id = Column(Integer, primary_key=True, index=True)
    watched = Column(Boolean, default=False, nullable=False)
    favourited = Column(Boolean, default=False, nullable=False)
    rating = Column(Integer, default=0, nullable=False)  # 0-5 stars
    comment = Column(Text, default="", nullable=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), nullable=False)


class TrackedShow(Base):
    """
    Tracked TV show model.
    Stores user interaction data for TV shows.
    Watched state is computed from tracked episodes, not stored directly.
    Show metadata is fetched from TMDB and not stored locally.
    """
    __tablename__ = "tracked_shows"

    tmdb_show_id = Column(Integer, primary_key=True, index=True)
    favourited = Column(Boolean, default=False, nullable=False)
    rating = Column(Integer, default=0, nullable=False)  # 0-5 stars
    comment = Column(Text, default="", nullable=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now(), nullable=False)

    # Denormalised counts for performance
    total_episodes = Column(Integer, nullable=True)
    watched_episodes = Column(Integer, default=0, nullable=False)

    # Relationship to episodes
    episodes = relationship("TrackedEpisode", back_populates="show", cascade="all, delete-orphan")


class TrackedEpisode(Base):
    """
    Tracked episode model.
    Stores watch state for individual episodes of tracked TV shows.
    Episodes are identified by show ID, season number, and episode number.
    """
    __tablename__ = "tracked_episodes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tmdb_show_id = Column(Integer, ForeignKey("tracked_shows.tmdb_show_id"), nullable=False, index=True)
    season_number = Column(Integer, nullable=False)
    episode_number = Column(Integer, nullable=False)
    watched = Column(Boolean, default=False, nullable=False)
    watched_at = Column(DateTime(timezone=True), nullable=True)

    # Relationship to show
    show = relationship("TrackedShow", back_populates="episodes")

    # Unique constraint: one record per episode per show
    __table_args__ = (
        UniqueConstraint('tmdb_show_id', 'season_number', 'episode_number', name='uix_show_season_episode'),
    )
