# Watchlist Project

## Docker

The frontend is a **production build baked into the Docker image** — there are no source volume mounts. Changes to frontend source files are invisible to the running container until the image is rebuilt.

**Always rebuild when applying frontend changes:**
```
docker compose up --build -d
```

Never use `docker compose restart` for frontend changes — it only restarts the existing image and will not pick up any source edits.
