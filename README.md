# Watchlist

A self-hosted film and TV tracking application with a Netflix-style interface. Search for titles, track what you've watched, rate and review, manage favourites, and get personalised recommendations — all from a single household server.

## Features

- **Multi-user profiles** — Netflix-style "Who's watching?" screen on first load; each profile has its own independent library and tracking data
- **Search** — search films, TV shows, and people via TMDB
- **Track** — mark films as watched, track TV episodes and seasons individually
- **Rate & review** — 5-star personal rating and freetext notes per title
- **Favourites** — star any title to surface it on the home screen
- **Recommendations** — TV recommendations based on your highest-rated tracked show
- **Coming Soon** — upcoming films and TV shows from TMDB
- **Netflix-style UI** — scrollable rows, hover cards with detail panels, full-page backdrop images

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React 18, Tailwind CSS 3, Vite, served by Nginx |
| Backend | FastAPI, SQLAlchemy, httpx (TMDB proxy) |
| Database | SQLite (bind-mounted volume) |
| Deployment | Docker Compose (two containers) |

## Prerequisites

- Docker and Docker Compose
- TMDB API key — free registration at [themoviedb.org](https://www.themoviedb.org/settings/api)

## Getting Started

1. Clone the repository
2. Create a `.env` file in the project root:
   ```
   TMDB_API_KEY=your_api_key_here
   ```
3. Build and start:
   ```bash
   docker compose up --build
   ```
4. Open [http://localhost:3000](http://localhost:3000)

The backend API is available at [http://localhost:8000](http://localhost:8000).

## Project Structure

```
watchlist/
├── frontend/
│   ├── src/
│   │   ├── api/            # API client (trackingAPI, tmdbAPI, usersAPI)
│   │   ├── context/        # UserContext — active profile state
│   │   ├── components/
│   │   │   ├── common/     # ScrollableRow, ProfileAvatar
│   │   │   ├── home/       # HeroBanner, MediaRow, MediaCard
│   │   │   ├── layout/     # Header, SearchOverlay
│   │   │   ├── library/    # LibraryGrid, FilterTabs
│   │   │   ├── movie/      # MovieDetail, CastRow, TrailerEmbed
│   │   │   ├── reviews/    # ReviewsSection
│   │   │   ├── search/     # MediaTypeBadge
│   │   │   └── tv/         # SeasonList
│   │   ├── pages/          # Home, Library, MovieDetailPage,
│   │   │                   # TVShowDetail, PersonDetail, ProfileScreen
│   │   └── index.css       # Tailwind base + component classes
│   ├── tailwind.config.js
│   └── Dockerfile
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── tmdb.py       # TMDB API proxy
│   │   │   ├── tracking.py   # Movie tracking endpoints
│   │   │   ├── tv_tracking.py# TV show + episode tracking
│   │   │   └── users.py      # User profile CRUD + avatar upload
│   │   └── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── data/                   # SQLite database + avatars/ (not committed)
├── .env                    # TMDB_API_KEY (not committed)
└── docker-compose.yml
```

## Development

### Rebuilding after frontend changes

```bash
docker compose build frontend && docker compose up -d frontend
```

### Rebuilding after backend changes

```bash
docker compose build backend && docker compose up -d backend
```

### Rebuilding everything

```bash
docker compose up --build -d
```

### Viewing logs

```bash
docker compose logs -f frontend
docker compose logs -f backend
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TMDB_API_KEY` | Yes | API key from themoviedb.org |
| `DATABASE_PATH` | No | SQLite path (default: `/app/data/watchlist.db`) |

## Ports

| Service | Port |
|---|---|
| Frontend (Nginx) | 3000 |
| Backend (FastAPI) | 8000 |

## Multi-User Profiles

On first load the app shows a "Who's watching?" screen. Each profile has its own independent tracking data — watched status, ratings, notes, and favourites are never shared between profiles.

- **Add a profile** — click the `+` card on the profile screen, type a name, press Add
- **Switch profile** — click your avatar in the top-right header → "Switch Profile"
- **Delete a profile** — click "Manage Profiles", then the red × on any card (this also deletes all their tracking data)
- **Avatar images** — upload a profile photo via the users API (`POST /api/users/{id}/avatar`); initials with a colour are shown as a fallback
- The active profile is persisted in `localStorage` so the browser remembers who was last watching

## Notes

- The `data/` directory is bind-mounted into the backend container and holds the SQLite database and avatar images. It is not committed to version control.
- The `.env` file is not committed to version control.
- TMDB image assets are served directly from `image.tmdb.org` — no local caching.
- The backend proxies all TMDB requests so the API key is never exposed to the browser.
