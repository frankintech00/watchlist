"""Film status migration and API regressions; never call external providers."""
import os
import unittest
from datetime import datetime
from unittest.mock import AsyncMock, patch

os.environ.setdefault("TMDB_API_KEY", "test-only")

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.migrations import run_column_migrations
from app.models import TrackedMovie, TrackedShow, User
from app.routers import tracking
from app.routers.tv_tracking import ShowTrackingUpdate


class FilmTrackingTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                                    poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.db.add_all([User(id=1, name="One"), User(id=2, name="Two")])
        self.db.commit()
        app = FastAPI()
        app.include_router(tracking.router, prefix="/tracking")
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.db.close()
        self.engine.dispose()

    def test_migration_preserves_metadata_and_tv_and_is_idempotent(self):
        timestamp = datetime(2026, 1, 1, 12, 30)
        self.db.add_all([
            TrackedMovie(user_id=1, tmdb_movie_id=278, status="watching", rating=4,
                         comment="Keep this note", added_at=timestamp, updated_at=timestamp),
            TrackedMovie(user_id=2, tmdb_movie_id=278, status="watched", rating=5),
            TrackedShow(user_id=1, tmdb_show_id=1396, status="watching", watched_episodes=7),
        ])
        self.db.commit()
        run_column_migrations(self.engine)
        run_column_migrations(self.engine)
        self.db.expire_all()
        movie = self.db.get(TrackedMovie, (1, 278))
        self.assertEqual((movie.status, movie.rating, movie.comment),
                         ("want_to_watch", 4, "Keep this note"))
        self.assertEqual((movie.added_at, movie.updated_at), (timestamp, timestamp))
        self.assertEqual(self.db.get(TrackedMovie, (2, 278)).status, "watched")
        show = self.db.get(TrackedShow, (1, 1396))
        self.assertEqual((show.status, show.watched_episodes), ("watching", 7))

    def test_film_status_transitions_preserve_note_rating_and_profile_isolation(self):
        path = "/tracking/movies/278?user_id=1"
        response = self.client.put(path, json={"status": "want_to_watch", "rating": 4, "comment": "Later"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "want_to_watch")
        for status in ("watched", "want_to_watch"):
            response = self.client.put(path, json={"status": status})
            self.assertEqual(response.status_code, 200)
            self.assertEqual((response.json()["status"], response.json()["rating"], response.json()["comment"]),
                             (status, 4, "Later"))
        response = self.client.put(path, json={"comment": "Still later"})
        self.assertEqual(response.json()["status"], "want_to_watch")
        self.assertIsNone(self.client.get("/tracking/movies/278?user_id=2").json())
        self.assertEqual(self.client.get("/tracking/ids?user_id=1").json()["movie"], {"278": "want_to_watch"})

    def test_film_validation_and_filters_use_only_film_statuses(self):
        self.assertEqual(self.client.put("/tracking/movies/278?user_id=1", json={"status": "watching"}).status_code, 422)
        self.assertEqual(self.client.get("/tracking/movies?user_id=1&status=watching").status_code, 422)
        self.assertEqual(ShowTrackingUpdate(status="watching").status, "watching")
        self.client.put("/tracking/movies/278?user_id=1", json={"status": "want_to_watch"})
        self.client.put("/tracking/movies/155?user_id=1", json={"status": "watched"})
        with patch.object(tracking, "get_movie", AsyncMock(return_value={"title": "Test film"})):
            wanted = self.client.get("/tracking/movies?user_id=1&status=want_to_watch")
            watched = self.client.get("/tracking/movies?user_id=1&status=watched")
        self.assertEqual([movie["id"] for movie in wanted.json()], [278])
        self.assertEqual([movie["id"] for movie in watched.json()], [155])

    def test_legacy_watchlist_migrates_directly_to_want_to_watch(self):
        legacy = create_engine("sqlite://")
        with legacy.begin() as conn:
            conn.execute(text("""CREATE TABLE tracked_movies (
                user_id INTEGER, tmdb_movie_id INTEGER, watched BOOLEAN,
                watchlisted BOOLEAN, favourited BOOLEAN, rating INTEGER,
                comment TEXT, added_at DATETIME, updated_at DATETIME)"""))
            conn.execute(text("""INSERT INTO tracked_movies VALUES
                (1, 278, 0, 1, 0, 4, 'Keep me', '2026-01-01', '2026-01-02')"""))
        run_column_migrations(legacy)
        run_column_migrations(legacy)
        with legacy.connect() as conn:
            row = conn.execute(text("SELECT status, rating, comment FROM tracked_movies")).one()
            self.assertEqual(tuple(row), ("want_to_watch", 4, "Keep me"))
        legacy.dispose()


if __name__ == "__main__":
    unittest.main()
