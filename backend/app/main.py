"""
===================================================================================
Script: main.py
Purpose:
    FastAPI application entry point for Watchlist tracking system.
    Initialises the database, configures CORS, and registers API routers
    for TMDB proxy and user tracking endpoints (films and TV shows).

Author: Frank Kelly
Date: 20-02-2026
===================================================================================
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import tmdb, tracking, tv_tracking


# === APPLICATION INITIALISATION ===

app = FastAPI(
    title="Watchlist API",
    description="Backend API for personal movie tracking",
    version="1.0.0"
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
    """Create database tables on application startup."""
    Base.metadata.create_all(bind=engine)


# === ROUTER REGISTRATION ===
# Note: TV tracking router must be registered before film tracking router
# to avoid route collision (specific /shows routes before generic /{tmdb_id})

app.include_router(tmdb.router, prefix="/api/tmdb", tags=["TMDB"])
app.include_router(tv_tracking.router, prefix="/api/tracking", tags=["TV Tracking"])
app.include_router(tracking.router, prefix="/api/tracking", tags=["Film Tracking"])


# === HEALTH CHECK ===

@app.get("/api/health")
def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy", "service": "watchlist-api"}
