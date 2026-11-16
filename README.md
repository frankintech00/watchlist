# Watchlist

A self-hosted app for keeping track of TV you are **watching**, films you **want to watch**, and what you have **watched**. TV and films are kept separate, every title has exactly one status, and it all runs from a single household server.

## What it does

### TV

- **Watching** — a carousel of large cards for the seven shows you updated most recently, each with its next episode and a one-tap "Watched S2 E4" button. Every show you are watching sits in a poster carousel underneath.
- **Watched** — a carousel of everything you have finished. Shows that have aired new episodes since are flagged **New episodes**.
- **Episode tracking** — tick individual episodes, a whole season, or the entire show. Status follows your ticks automatically:
  - every aired episode ticked → the show moves to **Watched**
  - anything left to watch (including a newly ticked episode of a new season) → it moves back to **Watching**

### Films

- **New on streaming in the UK** — films released digitally in the last 1, 3 or 6 months that are on a UK subscription service right now. With MDBList configured, films rank by **Rotten Tomatoes audience score (Popcornmeter)** by default, highest first, in score bands (90%+, 75–89%, 60–74%, under 60%, no score). Switch to **Critics** to rank by Tomatometer instead, or filter by streaming service.
- **Both Rotten Tomatoes scores** appear on streaming film cards and detail pages: a popcorn icon for audience scores and a tomato icon for critics. Missing scores appear as a dash; they are never replaced by IMDb or TMDB ratings. Films without the selected score are in **No score**, which can be enabled in the filters.
- **Coming soon** — UK cinema and digital releases over the next four months, with dates.
- **Your films** — mark any film as **Want to watch** or **Watched**. Planned films have a bookmark marker; watched films have a tick. The film detail page lets you switch between the two or remove a film from your list.

### People and search

- **Search** shows, films and people, with tabs for each. Titles already on your list are marked.
- **Person pages** show a complete filmography (acting and behind-the-camera credits, one row per title), what they are best known for, and which of their titles are on your list. Filter by films/TV, sort by date, fame or rating, and hide chat-show appearances.
- Cast, creators, directors and episode guest stars all link through to their person page.
- Actor/person and film detail pages share TV's shaded artwork background. Person pages use the poster from the first **Best known for** title, fading at the sides and into the page; if there is no poster, the background stays plain. Films use landscape artwork with a poster fallback when no backdrop is available.

### Also

- **Profiles** — a "Who's watching?" screen; each profile has its own list. No passwords.
- **Your rating and a private note** on any title.
- **Installable** as an app on phones (PWA).

## Rotten Tomatoes critic and audience scores

Use [MDBList](https://mdblist.com/signin) for both scores. Sign in, generate a key in [Preferences → API](https://mdblist.com/preferences/#api), and add `MDBLIST_API_KEY` to your local `.env`. The [free API tier](https://docs.mdblist.com/docs/api) allows 1,000 requests per day, shared with any other apps using that account.

[OMDb](https://www.omdbapi.com/apikey.aspx) is optional: it fills missing critic, IMDb and Metacritic scores. It does not supply the audience score used here. MDBList's `tomatoes` value supplies critics; `popcorn` (or legacy `tomatoesaudience`) supplies audience scores. IMDb remains a separate rating out of 10.

With MDBList configured, the default ranking uses Popcornmeter. With only OMDb, it uses Tomatometer. With neither, it uses the clearly labelled TMDB audience score. Some titles have no scores even when the API connection works.

Both providers have separate SQLite caches. MDBList results with both RT scores refresh after seven days; incomplete results refresh after one day. OMDb results refresh after seven days with a critic score, or one day without one. Enabling MDBList fills its new cache immediately without deleting existing ratings. Provider failures retain cached scores; MDBList rate-limit responses pause further lookups until the retry time. The streaming response is also cached for three hours.

After editing keys, recreate the backend (a plain restart does not reload `.env`):

```bash
docker compose up -d --force-recreate --wait backend
```

Keep `.env` local: Git ignores it. `.env.example` contains placeholders only. Keys stay in the backend, never in the browser bundle.

MDBList lookups use batches of up to 200 films, matched by TMDB ID, to avoid a separate network round trip for every poster. Missing batch entries and failed requests do not overwrite cached scores.

## Getting started

You need Docker with Docker Compose, and a free TMDB API key from [themoviedb.org](https://www.themoviedb.org/settings/api).

1. Clone the repository.
2. Copy `.env.example` to `.env` in the project root and set your keys:
   ```
   TMDB_API_KEY=your_tmdb_key
   MDBLIST_API_KEY=your_mdblist_key  # optional — critics and audience
   OMDB_API_KEY=your_omdb_key        # optional — fallback critic and IMDb scores
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
| `MDBLIST_API_KEY` | No | Rotten Tomatoes critics and audience; enables default Popcornmeter ranking |
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
│   │   ├── components/        # Header, Carousel, PosterCard, WatchingFeature (carousel),
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
│   ├── ratings.py             # combines MDBList with cached OMDb fallback
│   ├── mdblist.py             # cached RT critic and audience scores, retry cooldown
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

- **One status per title.** Films use `want_to_watch` or `watched`; TV shows use `watching` or `watched`. Film tracking updates and status filters accept only the two film statuses. There are no separate watchlist or favourite flags.
- **Metadata is not stored.** Titles, artwork and episode lists come from TMDB on demand. The backend caches TMDB responses in memory (stale copies are served instantly and refreshed in the background) and pre-loads every tracked title at startup, so list pages need a single request.
- **Progress counts aired episodes only**, excluding specials, so a show can be completed while a future season is merely announced.
- **The API keys stay on the server** — the browser only ever talks to `/api`.
- **Look and feel** is defined in two places: the palette (every colour is a shade of the primary, `#A1B5D8`) and font (Arial) in `frontend/tailwind.config.js`, and shared classes (`.btn-primary`, `.chip`, `.card`…) in `frontend/src/index.css`.
- **Poster cards stay in place on hover.** Carousels leave vertical space for hover and keyboard-focus borders so the top edge is not clipped.

## Profiles

- **Add** — the `+` on the "Who's watching?" screen.
- **Switch** — your avatar in the header → *Switch profile*.
- **Change photo / delete** — *Manage profiles*, then click a profile to upload a photo or the bin to delete it. Deleting a profile deletes everything it tracked.
- The active profile is remembered per browser.

## Upgrading from version 2

Version 3 replaced *watched / to watch / favourites* with a single status. Films now use Want to watch / Watched, while TV retains Watching / Watched. The migration runs automatically on first start and is safe to re-run:

| Before | After |
|---|---|
| Film marked watched | Watched |
| Film on the watchlist, not watched | Want to watch |
| Film previously marked Watching | Want to watch |
| Show with every counted episode ticked | Watched |
| Any other show with ticks, or on the watchlist | Watching |
| Entries with nothing on them — no ticks, not on the watchlist, not a favourite, no rating or note | Removed |

Episode ticks, ratings and notes are kept. The favourite and watchlist columns are dropped. **Back up `data/watchlist.db` before upgrading** if you may want to roll back.

The film status rename preserves each film's rating, note and timestamps. It does not change TV tracking or episode progress. Refresh open browser tabs after upgrading to load the new film controls.

## Notes

- Backend regression tests, including ratings and film status migration (no external requests): `docker compose run --rm --no-deps -v ./backend/tests:/app/tests backend python -m unittest discover -s tests -v`.
- The additional `film_mdb_ratings` cache table is created automatically at startup; existing tracking data and OMDb cache entries are preserved.

- `data/` is bind-mounted into the backend container and holds the database and avatar images. Back it up to back up everything.
- Images are served directly from `image.tmdb.org`.
- UK streaming availability comes from TMDB (supplied by JustWatch). It reflects digital release dates, so a film that reaches a subscription service long after its original digital release can be missed.
- This product uses the TMDB API but is not endorsed or certified by TMDB.
