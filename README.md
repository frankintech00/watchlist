# Watchlist

Personal movie tracking application with a Netflix/Plex-inspired interface.

## Overview

Watchlist allows a household to search for films, track what has been watched, rate and comment on titles, manage favourites, and receive personalised recommendations based on viewing history.

The application is self-hosted on a local network and accessed via a subdomain behind Cloudflare.

## Architecture

- **Frontend**: React SPA with Tailwind CSS, served by Nginx
- **Backend**: FastAPI application with TMDB integration
- **Database**: SQLite (single file, bind-mounted volume)
- **Deployment**: Docker Compose (two containers)

## Prerequisites

- Docker and Docker Compose
- TMDB API key (free registration at https://www.themoviedb.org/settings/api)

## Getting Started

1. Clone the repository
2. Create a `.env` file in the project root:
   ```
   TMDB_API_KEY=your_api_key_here
   ```
3. Build and start the containers:
   ```bash
   docker-compose up --build
   ```
4. Access the application at http://localhost

## Project Structure

```
watchlist/
├── frontend/          # React application
├── backend/           # FastAPI application
├── data/              # SQLite database (not committed)
└── docker-compose.yml
```

## Development

See `.claude/watchlist-project-intro.md` for full specification and architecture details.
