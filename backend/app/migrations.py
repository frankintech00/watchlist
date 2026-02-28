"""
===================================================================================
Script: migrations.py
Purpose:
    Idempotent schema migration runner for Watchlist database.
    Handles migration from single-user schema to multi-user schema with
    composite primary keys and a new `users` table.

    Called at application startup before create_all(). Safe to run every boot.

Author: Frank Kelly
Date: 22-02-2026
===================================================================================
"""

from sqlalchemy import inspect, text


def run_migrations(engine):
    """
    Migrate database from single-user to multi-user schema.

    Strategy:
      - If `users` table already has rows → already migrated, skip.
      - Otherwise: create `users`, insert Frank (id=1), then recreate each
        tracking table with composite PKs, copying all existing rows as user_id=1.

    Tables recreated (SQLite cannot ALTER PRIMARY KEY):
      - tracked_movies  → composite PK (user_id, tmdb_movie_id)
      - tracked_shows   → composite PK (user_id, tmdb_show_id)
      - tracked_episodes → add user_id, update unique constraint + composite FK
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    # Check if already migrated
    if 'users' in existing_tables:
        with engine.connect() as conn:
            count = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()
            if count > 0:
                return  # Already migrated — nothing to do

    # Run full migration in a single transaction
    with engine.begin() as conn:
        # Disable FK enforcement so we can drop/recreate tables freely
        conn.execute(text("PRAGMA foreign_keys = OFF"))

        # ── 1. Create users table and seed Frank ─────────────────────────────
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL,
                avatar_path TEXT NULL,
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(text("INSERT INTO users (id, name) VALUES (1, 'Frank')"))

        # ── 2. Migrate tracked_movies ─────────────────────────────────────────
        if 'tracked_movies' in existing_tables:
            conn.execute(text("""
                CREATE TABLE tracked_movies_new (
                    user_id       INTEGER NOT NULL,
                    tmdb_movie_id INTEGER NOT NULL,
                    watched       BOOLEAN DEFAULT 0 NOT NULL,
                    favourited    BOOLEAN DEFAULT 0 NOT NULL,
                    rating        INTEGER DEFAULT 0 NOT NULL,
                    comment       TEXT    DEFAULT '' NOT NULL,
                    added_at      DATETIME,
                    updated_at    DATETIME,
                    PRIMARY KEY (user_id, tmdb_movie_id),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """))
            conn.execute(text("""
                INSERT INTO tracked_movies_new
                    (user_id, tmdb_movie_id, watched, favourited, rating, comment, added_at, updated_at)
                SELECT 1, tmdb_movie_id, watched, favourited, rating, comment, added_at, updated_at
                FROM tracked_movies
            """))
            conn.execute(text("DROP TABLE tracked_movies"))
            conn.execute(text("ALTER TABLE tracked_movies_new RENAME TO tracked_movies"))

        # ── 3. Migrate tracked_shows ──────────────────────────────────────────
        if 'tracked_shows' in existing_tables:
            conn.execute(text("""
                CREATE TABLE tracked_shows_new (
                    user_id          INTEGER NOT NULL,
                    tmdb_show_id     INTEGER NOT NULL,
                    favourited       BOOLEAN DEFAULT 0 NOT NULL,
                    rating           INTEGER DEFAULT 0 NOT NULL,
                    comment          TEXT    DEFAULT '' NOT NULL,
                    total_episodes   INTEGER NULL,
                    watched_episodes INTEGER DEFAULT 0 NOT NULL,
                    added_at         DATETIME,
                    updated_at       DATETIME,
                    PRIMARY KEY (user_id, tmdb_show_id),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """))
            conn.execute(text("""
                INSERT INTO tracked_shows_new
                    (user_id, tmdb_show_id, favourited, rating, comment,
                     total_episodes, watched_episodes, added_at, updated_at)
                SELECT 1, tmdb_show_id, favourited, rating, comment,
                       total_episodes, watched_episodes, added_at, updated_at
                FROM tracked_shows
            """))
            conn.execute(text("DROP TABLE tracked_shows"))
            conn.execute(text("ALTER TABLE tracked_shows_new RENAME TO tracked_shows"))

        # ── 4. Migrate tracked_episodes ───────────────────────────────────────
        if 'tracked_episodes' in existing_tables:
            conn.execute(text("""
                CREATE TABLE tracked_episodes_new (
                    id             INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id        INTEGER NOT NULL,
                    tmdb_show_id   INTEGER NOT NULL,
                    season_number  INTEGER NOT NULL,
                    episode_number INTEGER NOT NULL,
                    watched        BOOLEAN DEFAULT 0 NOT NULL,
                    watched_at     DATETIME NULL,
                    UNIQUE (user_id, tmdb_show_id, season_number, episode_number),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id, tmdb_show_id)
                        REFERENCES tracked_shows(user_id, tmdb_show_id) ON DELETE CASCADE
                )
            """))
            conn.execute(text("""
                INSERT INTO tracked_episodes_new
                    (user_id, tmdb_show_id, season_number, episode_number, watched, watched_at)
                SELECT 1, tmdb_show_id, season_number, episode_number, watched, watched_at
                FROM tracked_episodes
            """))
            conn.execute(text("DROP TABLE tracked_episodes"))
            conn.execute(text("ALTER TABLE tracked_episodes_new RENAME TO tracked_episodes"))

        # Re-enable FK enforcement
        conn.execute(text("PRAGMA foreign_keys = ON"))


def run_column_migrations(engine):
    """
    Add new columns to existing tables if they don't already exist.
    Safe to run on every boot — checks before altering.
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    for table, col in [('tracked_movies', 'watchlisted'), ('tracked_shows', 'watchlisted')]:
        existing_cols = {c['name'] for c in inspector.get_columns(table)} if table in existing_tables else set()
        if col not in existing_cols:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} BOOLEAN DEFAULT 0 NOT NULL"))
