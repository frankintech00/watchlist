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
    v3 migration: collapse watched / watchlisted / favourited into a single
    `status` column ('watching' | 'watched') on films and shows.

    Idempotent — each step checks the live schema first, so it is safe on every boot
    and on fresh databases (where the tables do not exist yet and create_all builds
    them in their final shape).

    Mapping:
      films  watched                      -> 'watched'
             otherwise (was on watchlist) -> 'watching'
      shows  every counted episode seen   -> 'watched'
             otherwise                    -> 'watching'
    Rows carrying no information at all (never watched, not on the watchlist, not a
    favourite, no rating, no note) were invisible leftovers of un-ticked buttons and
    are removed rather than resurfacing as "watching".
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    def columns(table):
        return {c['name'] for c in inspect(engine).get_columns(table)}

    def flag(cols, name):
        """SQL expression for a legacy boolean column that may not exist."""
        return name if name in cols else '0'

    # ── Films ────────────────────────────────────────────────────────────────
    if 'tracked_movies' in existing_tables and 'status' not in columns('tracked_movies'):
        cols = columns('tracked_movies')
        watched, wl, fav = flag(cols, 'watched'), flag(cols, 'watchlisted'), flag(cols, 'favourited')
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE tracked_movies ADD COLUMN status TEXT DEFAULT 'watched' NOT NULL"
            ))
            conn.execute(text(f"""
                DELETE FROM tracked_movies
                WHERE {watched} = 0 AND {wl} = 0 AND {fav} = 0 AND rating = 0 AND comment = ''
            """))
            conn.execute(text(f"""
                UPDATE tracked_movies
                SET status = CASE WHEN {watched} = 1 THEN 'watched' ELSE 'watching' END
            """))

    # ── Shows ────────────────────────────────────────────────────────────────
    if 'tracked_shows' in existing_tables and 'status' not in columns('tracked_shows'):
        cols = columns('tracked_shows')
        wl, fav = flag(cols, 'watchlisted'), flag(cols, 'favourited')
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE tracked_shows ADD COLUMN status TEXT DEFAULT 'watching' NOT NULL"
            ))
            empty = f"""
                watched_episodes = 0 AND {wl} = 0 AND {fav} = 0 AND rating = 0 AND comment = ''
                AND NOT EXISTS (
                    SELECT 1 FROM tracked_episodes e
                    WHERE e.user_id = tracked_shows.user_id
                      AND e.tmdb_show_id = tracked_shows.tmdb_show_id
                      AND e.watched = 1
                )
            """
            if 'tracked_episodes' in existing_tables:
                # Explicit delete: FK cascades are not enforced on this connection.
                conn.execute(text(f"""
                    DELETE FROM tracked_episodes
                    WHERE EXISTS (
                        SELECT 1 FROM tracked_shows
                        WHERE tracked_shows.user_id = tracked_episodes.user_id
                          AND tracked_shows.tmdb_show_id = tracked_episodes.tmdb_show_id
                          AND {empty}
                    )
                """))
                conn.execute(text(f"DELETE FROM tracked_shows WHERE {empty}"))
            conn.execute(text("""
                UPDATE tracked_shows
                SET status = CASE
                    WHEN total_episodes IS NOT NULL AND total_episodes > 0
                         AND watched_episodes >= total_episodes THEN 'watched'
                    ELSE 'watching'
                END
            """))

    # ── Drop the legacy flag columns ─────────────────────────────────────────
    # They are NOT NULL; leaving them unmapped would break inserts on databases
    # where they were created without an SQL default.
    for table, legacy in [
        ('tracked_movies', ('watched', 'favourited', 'watchlisted')),
        ('tracked_shows', ('favourited', 'watchlisted')),
    ]:
        if table not in existing_tables:
            continue
        cols = columns(table)
        for col in legacy:
            if col in cols:
                with engine.begin() as conn:
                    conn.execute(text(f"ALTER TABLE {table} DROP COLUMN {col}"))

    # ── Backfill NULL timestamps (tables built by run_migrations had no default) ──
    for table in ('tracked_movies', 'tracked_shows'):
        if table in existing_tables:
            with engine.begin() as conn:
                conn.execute(text(
                    f"UPDATE {table} SET added_at = COALESCE(added_at, updated_at, CURRENT_TIMESTAMP), "
                    f"updated_at = COALESCE(updated_at, added_at, CURRENT_TIMESTAMP) "
                    f"WHERE added_at IS NULL OR updated_at IS NULL"
                ))
