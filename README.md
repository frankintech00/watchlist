# Watchlist

A self-hosted app for keeping track of what you are **watching** and what you have **watched**. TV and films are kept separate, every title has exactly one status, and it all runs from a single household server.

## What it does

### TV

- **Recently updated** — a full-width carousel of the last five shows you touched.
- **Watching** — the show you updated most recently is shown large, with its next episode and a one-tap "Watched S2 E4" button. Everything else you are watching sits in a carousel underneath.
- **Watched** — a carousel of everything you have finished. Shows that have aired new episodes since are flagged **New episodes**.
- **Episode tracking** — tick individual episodes, a whole season, or the entire show. Status follows your ticks automatically:
  - every aired episode ticked → the show moves to **Watched**
  - anything left to watch (including a newly ticked episode of a new season) → it moves back to **Watching**

### Films

- **New on streaming in the UK** — films released digitally in the last 1, 3 or 6 months that are on a UK subscription service right now, **grouped by Rotten Tomatoes score** (90%+, 75–89%, 60–74%, under 60%, no score) and filterable by score band and streaming service.
- **Coming soon** — UK cinema and digital releases over the next four months, with dates.
- **Your films** — mark any film as Watching or Watched.

### People and search

- **Search** shows, films and people, with tabs for each. Titles already on your list are marked.
- **Person pages** show a complete filmography (acting and behind-the-camera credits, one row per title), what they are best known for, and which of their titles are on your list. Filter by films/TV, sort by date, fame or rating, and hide chat-show appearances.
- Cast, creators, directors and episode guest stars all link through to their person page.

### Also

- **Profiles** — a "Who's watching?" screen; each profile has its own list. No passwords.
- **Your rating and a private note** on any title.
- **Installable** as an app on phones (PWA).

## Rotten Tomatoes scores (optional, recommended)

Rotten Tomatoes has no public API, so scores are read through [OMDb](https://www.omdbapi.com/apikey.aspx), which offers a free key (1,000 requests a day). Scores are cached in the database, so normal use stays far below that.

Without a key the Films page still works, but groups films by **TMDB audience score** instead and says so on the page.

To turn Rotten Tomatoes on, add the key to `.env` and recreate the backend:

```
OMDB_API_KEY=your_omdb_key
```

```bash
docker compose up -d backend
```

## Getting started

You need Docker with Docker Compose, and a free TMDB API key from [themoviedb.org](https://www.themoviedb.org/settings/api).

1. Clone the repository.
2. Create a `.env` file in the project root:
   ```
   TMDB_API_KEY=your_tmdb_key
   OMDB_API_KEY=your_omdb_key   # optional — Rotten Tomatoes scores
   ```
3. Build and start:
   ```bash
   docker compose up --build -d
   ```
4. Open [http://localhost:3000](http://localhost:3000).

| Service | Port |
|---|---|
| Frontend (Nginx) | 3000 |
| Backend (FastAPI) — interactive API docs at `/docs` | 8000 |

| Variable | Required | Description |
|---|---|---|
| `TMDB_API_KEY` | Yes | Titles, artwork, cast, UK streaming availability |
| `OMDB_API_KEY` | No | Rotten Tomatoes and IMDb scores for films |
| `DATABASE_PATH` | No | SQLite path (default `/app/data/watchlist.db`) |

## Applying changes

The frontend is a production build **baked into the Docker image** — there are no source mounts, so edits are invisible until the image is rebuilt. Always rebuild:

```bash
docker compose up --build -d
```

`docker compose restart` only restarts the existing image and will not pick up changes.

```bash
docker compose logs -f backend     # or frontend
```

For frontend work outside Docker, point the dev server at a running backend:

```bash
cd frontend
VITE_PROXY_TARGET=http://localhost:8000 npm run dev
```

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router, Tailwind CSS 3, Vite; served by Nginx |
| Backend | FastAPI, SQLAlchemy, httpx |
| Database | SQLite, in the bind-mounted `data/` directory |
| Deployment | Docker Compose (two containers) |

```
watchlist/
├── frontend/
│   ├── src/
│   │   ├── api/client.js      # all HTTP calls (tmdbAPI, filmsAPI, trackingAPI, usersAPI)
│   │   ├── context/           # UserContext — the active profile
│   │   ├── lib/               # formatting helpers, episode-progress maths
│   │   ├── components/        # Header, Carousel, PosterCard, HeroCarousel, WatchingFeature,
│   │   │                      # SeasonList, TrackingControls, DetailParts, States, Icon
│   │   ├── pages/             # TVHome, Films, ShowDetail, FilmDetail, Person, Search,
│   │   │                      # ProfileScreen
│   │   └── index.css          # Tailwind layers + shared component classes
│   ├── scripts/generate-icons.cjs   # draws the app icon at build time
│   └── tailwind.config.js     # colour palette and font
├── backend/app/
│   ├── main.py                # app setup, startup migrations, cache warm-up
│   ├── models.py              # users, tracked shows / films / episodes, score cache
│   ├── migrations.py          # idempotent schema migrations, run on every boot
│   ├── tmdb_client.py         # shared TMDB client, cache, episode-progress helpers
│   ├── ratings.py             # Rotten Tomatoes scores via OMDb, cached
│   └── routers/
│       ├── tv_tracking.py     # /api/tracking/shows…   shows and episodes
│       ├── tracking.py        # /api/tracking/movies…  films; /api/tracking/ids
│       ├── films.py           # /api/films/streaming, /api/films/upcoming
│       ├── tmdb.py            # /api/tmdb/…  search, detail pages, people
│       └── users.py           # /api/users/… profiles and avatars
├── data/                      # SQLite database + avatars (not committed)
├── .env                       # API keys (not committed)
└── docker-compose.yml
```

### How it fits together

- **One status per title.** `tracked_shows.status` and `tracked_movies.status` are either `watching` or `watched`. There are no separate watchlist or favourite flags.
- **Metadata is not stored.** Titles, artwork and episode lists come from TMDB on demand. The backend caches TMDB responses in memory (stale copies are served instantly and refreshed in the background) and pre-loads every tracked title at startup, so list pages need a single request.
- **Progress counts aired episodes only**, excluding specials, so a show can be completed while a future season is merely announced.
- **The API keys stay on the server** — the browser only ever talks to `/api`.
- **Look and feel** is defined in two places: the palette and font (Arial) in `frontend/tailwind.config.js`, and shared classes (`.btn-primary`, `.chip`, `.card`…) in `frontend/src/index.css`.

## Profiles

- **Add** — the `+` on the "Who's watching?" screen.
- **Switch** — your avatar in the header → *Switch profile*.
- **Change photo / delete** — *Manage profiles*, then click a profile to upload a photo or the bin to delete it. Deleting a profile deletes everything it tracked.
- The active profile is remembered per browser.

## Upgrading from version 2

Version 3 replaced *watched / to watch / favourites* with the single watching-or-watched status. The migration runs automatically on first start and is safe to re-run:

| Before | After |
|---|---|
| Film marked watched | Watched |
| Film on the watchlist, not watched | Watching |
| Show with every counted episode ticked | Watched |
| Any other show with ticks, or on the watchlist | Watching |
| Entries with nothing on them — no ticks, not on the watchlist, not a favourite, no rating or note | Removed |

Episode ticks, ratings and notes are kept. The favourite and watchlist columns are dropped. **Back up `data/watchlist.db` before upgrading** if you may want to roll back.

## Notes

- `data/` is bind-mounted into the backend container and holds the database and avatar images. Back it up to back up everything.
- Images are served directly from `image.tmdb.org`.
- UK streaming availability comes from TMDB (supplied by JustWatch). It reflects digital release dates, so a film that reaches a subscription service long after its original digital release can be missed.
- This product uses the TMDB API but is not endorsed or certified by TMDB.
