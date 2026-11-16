"""Offline regression checks for provider mapping, cache upgrades and failures."""
import asyncio
import os
import unittest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

os.environ.setdefault("TMDB_API_KEY", "test-only")

import httpx
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session

from app import mdblist, ratings
from app.database import Base
from app.models import FilmRating, FilmMDBRating
from app.routers import films


class RatingsTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        # Simulate an existing OMDb-only installation before create_all.
        FilmRating.__table__.create(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.key_patch = patch.object(mdblist, "MDBLIST_API_KEY", "test-only")
        self.key_patch.start()
        mdblist._cache_lock = asyncio.Lock()
        mdblist._semaphore = asyncio.Semaphore(4)
        mdblist._retry_at = 0

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        self.key_patch.stop()

    def test_sources_are_distinct_and_zero_is_valid(self):
        result = mdblist.parse_ratings({"ratings": [
            {"source": "tomatoes", "value": 89},
            {"source": "popcorn", "value": 0},
            {"source": "imdb", "value": 9.3},
            {"source": "tmdb", "value": 87},
        ]})
        self.assertEqual(result["rt_score"], 89)
        self.assertEqual(result["rt_audience_score"], 0)
        self.assertEqual(result["imdb_rating"], 9.3)

    def test_missing_audience_never_uses_other_sources(self):
        for value in [None, "N/A", -1, 101, float("nan")]:
            result = mdblist.parse_ratings({"ratings": [
                {"source": "popcorn", "value": value},
                {"source": "imdb", "value": 9.3},
                {"source": "tomatoes", "value": 89},
            ]})
            self.assertIsNone(result["rt_audience_score"])
        self.assertEqual(mdblist.parse_ratings({"ratings": [
            {"source": "tomatoesaudience", "value": 98}
        ]})["rt_audience_score"], 98)

    async def test_existing_omdb_cache_does_not_delay_audience_fetch(self):
        self.db.add(FilmRating(tmdb_movie_id=278, imdb_id="tt0111161", rt_score=88))
        self.db.commit()
        sample = dict(rt_score=89, rt_audience_score=98, imdb_rating=9.3, metascore=82)
        with patch.object(mdblist, "_fetch_batch", AsyncMock(return_value={278: sample})) as fetch:
            with patch.object(ratings, "_omdb_ratings_for", AsyncMock(return_value={})):
                result = await ratings.ratings_for(self.db, [(278, "tt0111161")])
                self.assertEqual(result[278], sample)
                await ratings.ratings_for(self.db, [(278, "tt0111161")])
            fetch.assert_awaited_once_with([278])
        self.assertEqual(self.db.get(FilmRating, 278).rt_score, 88)
        Base.metadata.create_all(self.engine)
        self.assertIn("film_mdb_ratings", inspect(self.engine).get_table_names())

    async def test_failed_refresh_keeps_previous_scores_and_timestamp(self):
        old_time = datetime.utcnow() - timedelta(days=8)
        self.db.add(FilmMDBRating(tmdb_movie_id=278, rt_score=89,
                                 rt_audience_score=98, fetched_at=old_time))
        self.db.commit()
        with patch.object(mdblist, "_fetch_batch", AsyncMock(return_value=None)):
            result = await mdblist.ratings_for(self.db, [278])
        self.assertEqual(result[278]["rt_audience_score"], 98)
        self.assertEqual(self.db.get(FilmMDBRating, 278).fetched_at, old_time)

    async def test_rate_limit_pauses_requests_without_caching_absence(self):
        client = AsyncMock()
        client.post.return_value = httpx.Response(429, headers={"Retry-After": "3600"})
        with patch.object(mdblist, "get_client", return_value=client):
            self.assertIsNone(await mdblist._fetch_batch([278]))
            self.assertIsNone(await mdblist._fetch_batch([155]))
        client.post.assert_awaited_once()
        self.assertEqual(self.db.query(FilmMDBRating).count(), 0)

    async def test_fallback_preserves_audience_and_zero_critic(self):
        primary = {278: dict(rt_score=0, rt_audience_score=98, imdb_rating=None, metascore=None)}
        fallback = {278: dict(rt_score=89, imdb_rating=9.3, metascore=82)}
        with patch.object(mdblist, "ratings_for", AsyncMock(return_value=primary)):
            with patch.object(ratings, "_omdb_ratings_for", AsyncMock(return_value=fallback)):
                result = await ratings.ratings_for(self.db, [(278, "tt0111161")])
        self.assertEqual(result[278], dict(rt_score=0, rt_audience_score=98, imdb_rating=9.3, metascore=82))

    async def test_streaming_ranks_by_popcorn_with_unscored_last(self):
        listed = [{"id": i, "title": f"Film {i}", "popularity": 10 - i} for i in range(1, 5)]
        scores = {
            1: {"rt_score": 100, "rt_audience_score": None},
            2: {"rt_score": 50, "rt_audience_score": 98},
            3: {"rt_score": 80, "rt_audience_score": 60},
            4: {"rt_score": 90, "rt_audience_score": 0},
        }
        with patch.object(films, "_response_cache", {}):
            with patch.object(films, "_discover", AsyncMock(return_value=listed)):
                with patch.object(films, "get_movie", AsyncMock(side_effect=listed)):
                    with patch.object(films, "ratings_for", AsyncMock(return_value=scores)):
                        result = await films.new_on_streaming(days=180, db=self.db)
        self.assertEqual(result["rating_source"], "rt_audience")
        self.assertEqual([film["id"] for film in result["films"]], [2, 3, 4, 1])
        self.assertEqual([film["score"] for film in result["films"]], [98, 60, 0, None])

    async def test_omdb_only_mode_still_works(self):
        with patch.object(mdblist, "MDBLIST_API_KEY", ""):
            with patch.object(ratings, "OMDB_API_KEY", "test-only"):
                with patch.object(ratings, "_omdb_ratings_for", AsyncMock(return_value={278: {
                    "rt_score": 89, "imdb_rating": 9.3, "metascore": 82,
                }})):
                    self.assertTrue(ratings.rt_enabled())
                    result = await ratings.ratings_for(self.db, [(278, "tt0111161")])
        self.assertEqual(result[278]["rt_score"], 89)
        self.assertIsNone(result[278]["rt_audience_score"])

    async def test_batch_maps_by_id_not_response_order(self):
        client = AsyncMock()
        client.post.return_value = httpx.Response(200, json=[
            {"ids": {"tmdb": 155}, "ratings": [{"source": "popcorn", "value": 94}]},
            {"ids": {"tmdb": 278}, "ratings": [{"source": "popcorn", "value": 98}]},
            {"ids": {"tmdb": 999}, "ratings": [{"source": "popcorn", "value": 10}]},
        ])
        with patch.object(mdblist, "get_client", return_value=client):
            result = await mdblist._fetch_batch([278, 155, 1])
        self.assertEqual(result[278]["rt_audience_score"], 98)
        self.assertEqual(result[155]["rt_audience_score"], 94)
        self.assertNotIn(999, result)
        self.assertNotIn(1, result)

    async def test_batch_failure_does_not_create_empty_cache_rows(self):
        with patch.object(mdblist, "_fetch_batch", AsyncMock(return_value=None)):
            self.assertEqual(await mdblist.ratings_for(self.db, [278]), {})
        self.assertEqual(self.db.query(FilmMDBRating).count(), 0)


if __name__ == "__main__":
    unittest.main()
