"""
===================================================================================
Script: database.py
Purpose:
    SQLAlchemy database configuration for Watchlist application.
    Configures SQLite connection and provides session management for
    database operations.

Author: Frank Kelly
Date: 20-02-2026
===================================================================================
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker


# === CONFIGURATION ===

DATABASE_PATH = os.getenv("DATABASE_PATH", "./data/watchlist.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DATABASE_PATH}"


# === ENGINE AND SESSION ===

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}  # Required for SQLite
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# === DEPENDENCY ===

def get_db():
    """
    Database session dependency for FastAPI routes.
    Yields a database session and ensures it closes after request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
