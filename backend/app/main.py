"""
===================================================================================
Script: main.py
Purpose:
    FastAPI application entry point for Watchlist tracking system.
    Initialises the database, runs schema migrations, configures CORS,
    mounts static file serving for avatars, and registers API routers.

Author: Frank Kelly
Date: 15-11-2026
===================================================================================
"""

import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.database import engine, Base, SessionLocal
from app.models import TrackedMovie, TrackedShow
from app.migrations import run_migrations, run_column_migrations
from app.routers import films, tmdb, tracking, tv_tracking, users
from app.tmdb_client import close_client, gather_safe, get_movie, get_show


# === AVATAR DIRECTORY ===
# Must exist before StaticFiles mount (which checks at init time)

os.makedirs("/app/data/avatars", exist_ok=True)


# === STARTUP ===

async def _warm_tmdb_cache():
    """Pre-load TMDB metadata for every tracked title so the first page load is fast."""
    try:
        with SessionLocal() as db:
            show_ids = {row[0] for row in db.query(TrackedShow.tmdb_show_id).distinct()}
            movie_ids = {row[0] for row in db.query(TrackedMovie.tmdb_movie_id).distinct()}
        await gather_safe([get_show(i) for i in show_ids] + [get_movie(i) for i in movie_ids])
    except Exception as e:  # never block startup on TMDB
        print(f"TMDB cache warm-up skipped: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run migrations then create any missing tables on application startup."""
    run_migrations(engine)
    run_column_migrations(engine)
    Base.metadata.create_all(bind=engine)
    warmup = asyncio.create_task(_warm_tmdb_cache())
    yield
    warmup.cancel()
    await close_client()


# === APPLICATION INITIALISATION ===

app = FastAPI(
    title="Watchlist API",
    description="Backend API for tracking what you are watching and have watched",
    version="3.0.0",
    lifespan=lifespan
)


# === CORS CONFIGURATION ===

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === STATIC FILE SERVING ===
# Avatars are stored at /app/data/avatars/ and served at /api/avatars/<filename>

app.mount("/api/avatars", StaticFiles(directory="/app/data/avatars"), name="avatars")


# === ROUTER REGISTRATION ===

app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(tmdb.router, prefix="/api/tmdb", tags=["TMDB"])
app.include_router(films.router, prefix="/api/films", tags=["Film Discovery"])
app.include_router(tv_tracking.router, prefix="/api/tracking", tags=["TV Tracking"])
app.include_router(tracking.router, prefix="/api/tracking", tags=["Film Tracking"])


# === HEALTH CHECK ===

@app.get("/api/health")
def health_check():
    """Health check endpoint for monitoring. Verifies database connectivity."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "unavailable"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": "watchlist-api",
        "database": db_status,
    }
