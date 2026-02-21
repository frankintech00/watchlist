# Watchlist -- Personal Movie Tracking App

## Overview

Watchlist is a personal movie tracking web application with a Netflix/Plex-inspired interface. It allows a household to search for films, mark what they have watched, rate and comment on titles, manage favourites, and receive recommendations based on viewing history.

The app is self-hosted on a local network, accessed via a subdomain behind Cloudflare.

## Problem

There is no single, clean interface for tracking watched films across services (Netflix, iPlayer, Disney+, Prime, physical media) with personal ratings, notes, and recommendations in one place. Existing tools are either too social (Letterboxd), too cluttered, or lack a modern viewing experience.

Watchlist solves this by combining TMDB's catalogue data with a personal tracking layer.

## Core Features

- **Search** -- Persistent search bar in the header across all screens. Searches the TMDB catalogue by title, genre, or director. Add results directly to favourites or watchlist from search results.
- **Movie Detail** -- Full detail view with synopsis, trailer (YouTube embed via TMDB), cast with clickable actor profiles and filmographies, certification, runtime, and similar titles. Dynamic backdrop pulled from the film's poster/artwork.
- **Tracking** -- Per-title watched checkbox, five-star rating, favourite toggle, and free-text comment field.
- **Library** -- Filterable grid of all tracked titles. Filter by watched/unwatched/favourited/rated status. Search within the library.
- **Recommendations** -- Suggested titles based on watched and rated history, cross-referenced with TMDB's similar movies data.
- **Responsive** -- Fully responsive layout. Card grid on desktop, stacked on mobile. Dark cinematic theme throughout.

## Architecture

Three layers, containerised with Docker Compose:

1. **Frontend** -- React SPA styled with Tailwind CSS. Dark theme, persistent search in header, horizontal scroll rows on home, poster grid in library, rich detail screen. Built and served via Nginx in its own container.
2. **Backend API** -- Python FastAPI. Handles TMDB proxy requests and manages user data (ratings, comments, watched status, favourites). Runs in its own container.
3. **Database** -- SQLite. Single file, mounted as a Docker volume for persistence. No need for a separate database container.

### Infrastructure

- **Docker Compose** -- Two services: `frontend` (React build served by Nginx) and `backend` (FastAPI with Uvicorn). SQLite database file stored on a bind-mounted volume.
- **Cloudflare** -- Subdomain pointed at the host. Cloudflare handles DNS, SSL termination, and caching of static assets.
- **Reverse Proxy** -- Nginx in the frontend container proxies `/api` requests to the backend container.

### External Dependencies

- **TMDB API** -- Movie metadata, poster/backdrop images, trailers, cast, similar titles, search. Free API key required.
- **YouTube** -- Trailer playback via embed (trailer keys provided by TMDB).

## Data Model (SQLite)

The database stores user interactions only. Film metadata is fetched from TMDB at request time and not cached locally.

**Tables:**

- `tracked_movies` -- tmdb_movie_id (PK), watched (boolean), favourited (boolean), rating (integer 0-5), comment (text), added_at (datetime), updated_at (datetime)

No users table required. Single household, no authentication needed for local use.

Recommendations are computed at query time by fetching highly-rated titles, calling TMDB's similar movies endpoint for each, and filtering out titles already tracked.

## Screens

1. **Home** -- Hero banner (featured/random film), horizontal scroll rows: Your Favourites, Your Top Rated, Recommended For You, Recently Added.
2. **Movie Detail** -- Dynamic backdrop, poster, full metadata, action bar (watched/favourite/rating), synopsis, trailer, scrollable cast row with expandable actor cards, comment section, similar titles.
3. **Library** -- Filter tabs (All/Watched/Unwatched/Favourites/Rated), responsive poster grid with status overlay badges, local filter/search within tracked titles.

Search is not a separate screen. The search bar lives in the header and displays results in a dropdown/overlay. Selecting a result navigates to the detail screen.

## Technology Stack

| Layer            | Technology                            | Reason                                                           |
| ---------------- | ------------------------------------- | ---------------------------------------------------------------- |
| Frontend         | React                                 | Component model suits the UI.                                    |
| Styling          | Tailwind CSS                          | Utility-first, fast iteration, already proven in mockups.        |
| Backend          | FastAPI (Python)                      | Lightweight, async, good TMDB client library support.            |
| Database         | SQLite                                | Single-user, no server process, file-based persistence.          |
| Containerisation | Docker Compose                        | Two containers (frontend + backend), clean separation, portable. |
| Frontend serving | Nginx                                 | Serves static React build and proxies API requests to backend.   |
| DNS/SSL          | Cloudflare                            | Subdomain routing, SSL termination, static asset caching.        |
| Fonts            | Bebas Neue (headings), DM Sans (body) | Cinematic feel for titles, clean readability for metadata.       |

## Container Structure

```
docker-compose.yml
frontend/
    Dockerfile
    nginx.conf
    src/
    package.json
    tailwind.config.js
backend/
    Dockerfile
    app/
        main.py
        routers/
        models.py
        database.py
    requirements.txt
data/
    watchlist.db        # SQLite file, bind-mounted volume
```

### Docker Compose Services

- **frontend** -- Builds React app, serves via Nginx on port 80. Proxies `/api/*` to the backend service.
- **backend** -- Runs FastAPI with Uvicorn. Exposes port 8000 internally (not published to host). SQLite volume mounted at `/app/data`.

## Scope Boundaries

**In scope:**

- Single household tracking (no authentication)
- TMDB search and metadata
- Ratings, comments, watched status, favourites
- Recommendations based on viewing history
- Responsive web (desktop and mobile browsers)
- Docker Compose deployment
- Cloudflare subdomain with SSL

**Out of scope:**

- Multi-user / authentication
- Streaming service integration or playback
- TV series tracking (film-only initially)
- Native mobile apps
- Offline mode

## Project Status

Interactive mockups for all screens are complete (React prototype with sample data). Next steps:

1. Scaffold the React app with Tailwind and component structure.
2. Build the FastAPI backend with SQLite and TMDB proxy endpoints.
3. Wire the frontend to the backend API, replacing mock data.
4. Create Dockerfiles and docker-compose.yml.
5. Configure Cloudflare subdomain and deploy.
