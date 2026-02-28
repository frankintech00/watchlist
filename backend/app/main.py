"""
===================================================================================
Script: main.py
Purpose:
    FastAPI application entry point for Watchlist tracking system.
    Initialises the database, runs schema migrations, configures CORS,
    mounts static file serving for avatars, and registers API routers.

Author: Frank Kelly
Date: 22-02-2026
===================================================================================
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import engine, Base
from app.migrations import run_migrations, run_column_migrations
from app.routers import tmdb, tracking, tv_tracking, users


# === AVATAR DIRECTORY ===
# Must exist before StaticFiles mount (which checks at init time)

os.makedirs("/app/data/avatars", exist_ok=True)


# === APPLICATION INITIALISATION ===

app = FastAPI(
    title="Watchlist API",
    description="Backend API for personal movie tracking",
    version="2.0.0"
)


# === CORS CONFIGURATION ===

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === DATABASE INITIALISATION ===

@app.on_event("startup")
def startup_event():
    """Run migrations then create any missing tables on application startup."""
    run_migrations(engine)
    run_column_migrations(engine)
    Base.metadata.create_all(bind=engine)


# === STATIC FILE SERVING ===
# Avatars are stored at /app/data/avatars/ and served at /api/avatars/<filename>

app.mount("/api/avatars", StaticFiles(directory="/app/data/avatars"), name="avatars")


# === ROUTER REGISTRATION ===
# Note: TV tracking router must be registered before film tracking router
# to avoid route collision (specific /shows routes before generic /{tmdb_id})

app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(tmdb.router, prefix="/api/tmdb", tags=["TMDB"])
app.include_router(tv_tracking.router, prefix="/api/tracking", tags=["TV Tracking"])
app.include_router(tracking.router, prefix="/api/tracking", tags=["Film Tracking"])


# === HEALTH CHECK ===

@app.get("/api/health")
def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy", "service": "watchlist-api"}
