import { useEffect, useState } from 'react'
import HeroCarousel from '../components/home/HeroCarousel'
import MediaRow from '../components/home/MediaRow'
import { trackingAPI, tmdbAPI } from '../api/client'

function Home() {
  const [watchingShows, setWatchingShows] = useState([])
  const [toWatchItems, setToWatchItems] = useState([])
  const [favouriteItems, setFavouriteItems] = useState([])
  const [comingSoon, setComingSoon] = useState([])
  const [comingSoonTV, setComingSoonTV] = useState([])
  const [recommendedShows, setRecommendedShows] = useState([])
  const [recommendedMovies, setRecommendedMovies] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [heroItems, setHeroItems] = useState([])

  useEffect(() => {
    async function fetchHomeData() {
      try {
        setLoading(true)

        const [allMovies, allShows, movieRecommendations, upcomingData, upcomingTVData] = await Promise.all([
          trackingAPI.getAll().catch(() => []),
          trackingAPI.shows.getAll().catch(() => []),
          trackingAPI.getRecommendations().catch(() => []),
          tmdbAPI.getUpcomingMovies().catch(() => ({ results: [] })),
          tmdbAPI.getUpcomingTVShows().catch(() => ({ results: [] }))
        ])

        const upcomingMovies = (upcomingData.results || []).map(m => ({ ...m, media_type: 'movie' }))
        const upcomingTV = (upcomingTVData.results || []).map(s => ({ ...s, media_type: 'tv' }))

        // Enrich movies with TMDB data
        const moviesWithDetails = await Promise.all(
          allMovies.map(async (movie) => {
            try {
              const tmdbData = await tmdbAPI.getMovieDetail(movie.tmdb_movie_id)
              return { ...movie, ...tmdbData, media_type: 'movie', tmdb_movie_id: movie.tmdb_movie_id }
            } catch {
              return { ...movie, media_type: 'movie', tmdb_movie_id: movie.tmdb_movie_id }
            }
          })
        )
        const validMovies = moviesWithDetails.filter(m => m.tmdb_movie_id && !m.tmdb_show_id)

        // Enrich shows with TMDB data
        const showsWithDetails = await Promise.all(
          allShows.map(async (show) => {
            try {
              const tmdbData = await tmdbAPI.getTVShowDetail(show.tmdb_show_id)
              return { ...show, ...tmdbData, media_type: 'tv', tmdb_show_id: show.tmdb_show_id }
            } catch {
              return { ...show, media_type: 'tv', tmdb_show_id: show.tmdb_show_id }
            }
          })
        )
        const validShows = showsWithDetails.filter(s => s.tmdb_show_id && !s.tmdb_movie_id)

        // Watching — TV in-progress
        const inProgressShows = validShows.filter(s =>
          s.watched_episodes > 0 &&
          s.watched_episodes < (s.total_episodes || Infinity)
        )

        // Watchlist — items saved to watch later
        const toWatch = [
          ...validMovies.filter(m => m.watchlisted),
          ...validShows.filter(s => s.watchlisted)
        ]

        // Favourites — all favourited items
        const allFavourites = [
          ...validMovies.filter(m => m.favourited),
          ...validShows.filter(s => s.favourited)
        ]

        // TV recommendations — based on highest-rated tracked show
        let tvRecs = []
        const trackedShowIds = new Set(validShows.map(s => s.tmdb_show_id || s.id))
        const seedShow = [...validShows].sort((a, b) => b.rating - a.rating)[0]
        if (seedShow) {
          try {
            const similar = await tmdbAPI.getSimilarTVShows(seedShow.tmdb_show_id || seedShow.id)
            tvRecs = (similar.results || [])
              .filter(s => !trackedShowIds.has(s.id))
              .map(s => ({ ...s, media_type: 'tv' }))
              .slice(0, 20)
          } catch {
            tvRecs = []
          }
        }

        setWatchingShows(inProgressShows)
        setToWatchItems(toWatch)
        setFavouriteItems(allFavourites)
        setComingSoon(upcomingMovies)
        setComingSoonTV(upcomingTV)
        setRecommendedShows(tvRecs)
        setRecommendedMovies(movieRecommendations)

        // ── Hero carousel — build up to 5 slots ──────────────────────────────
        const libShowsSorted = [...validShows]
          .filter(s => s.backdrop_path && (s.watchlisted || s.watched_episodes > 0))
          .sort((a, b) => {
            if (b.favourited !== a.favourited) return b.favourited ? 1 : -1
            return (b.rating || 0) - (a.rating || 0)
          })

        const libFilmsSorted = [...validMovies]
          .filter(m => m.backdrop_path && (m.watchlisted || m.watched))
          .sort((a, b) => {
            if (b.favourited !== a.favourited) return b.favourited ? 1 : -1
            return (b.rating || 0) - (a.rating || 0)
          })

        const libShowIds = new Set(validShows.map(s => s.tmdb_show_id))
        const libFilmIds = new Set(validMovies.map(m => m.tmdb_movie_id))

        const upcomingTVHero    = upcomingTV.filter(s => s.backdrop_path && !libShowIds.has(s.id))
        const upcomingFilmsHero = upcomingMovies.filter(m => m.backdrop_path && !libFilmIds.has(m.id))

        const heroUsed = new Set()
        const tvKey    = s => `tv-${s.tmdb_show_id || s.id}`
        const filmKey  = m => `movie-${m.tmdb_movie_id || m.id}`
        const take = (pool, keyFn) => {
          for (const item of pool) {
            const k = keyFn(item)
            if (!heroUsed.has(k)) { heroUsed.add(k); return item }
          }
          return null
        }

        const built = []

        // Slot 1 — library TV show (fallback: upcoming TV)
        const hs1 = take(libShowsSorted, tvKey)
        if (hs1) built.push({ ...hs1, hero_type: 'library_tv' })
        else { const fb = take(upcomingTVHero, tvKey); if (fb) built.push({ ...fb, media_type: 'tv', hero_type: 'coming_soon_tv' }) }

        // Slot 2 — library film (fallback: upcoming film)
        const hf1 = take(libFilmsSorted, filmKey)
        if (hf1) built.push({ ...hf1, hero_type: 'library_film' })
        else { const fb = take(upcomingFilmsHero, filmKey); if (fb) built.push({ ...fb, media_type: 'movie', hero_type: 'coming_soon_film' }) }

        // Slot 3 — second library TV show (fallback: upcoming TV)
        const hs2 = take(libShowsSorted, tvKey)
        if (hs2) built.push({ ...hs2, hero_type: 'library_tv' })
        else { const fb = take(upcomingTVHero, tvKey); if (fb) built.push({ ...fb, media_type: 'tv', hero_type: 'coming_soon_tv' }) }

        // Slot 4 — coming soon TV (fallback: library TV)
        const cst = take(upcomingTVHero, tvKey)
        if (cst) built.push({ ...cst, media_type: 'tv', hero_type: 'coming_soon_tv' })
        else { const fb = take(libShowsSorted, tvKey); if (fb) built.push({ ...fb, hero_type: 'library_tv' }) }

        // Slot 5 — coming soon film (fallback: library film)
        const csf = take(upcomingFilmsHero, filmKey)
        if (csf) built.push({ ...csf, media_type: 'movie', hero_type: 'coming_soon_film' })
        else { const fb = take(libFilmsSorted, filmKey); if (fb) built.push({ ...fb, hero_type: 'library_film' }) }

        setHeroItems(built)

      } catch (err) {
        console.error('Error fetching home data:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchHomeData()
  }, [])

  if (loading) {
    return (
      <div className="pt-16 flex items-center justify-center h-screen">
        <p className="text-xl text-gray-400">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="pt-16 flex items-center justify-center h-screen">
        <p className="text-xl text-red-500">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">

      {/* Hero Carousel — manages its own backdrop crossfade */}
      <HeroCarousel items={heroItems} />

      {/* Content Rows */}
      <div className={`relative z-10 pb-12${heroItems.length === 0 ? ' pt-32 md:pt-16' : ''}`}>
        {watchingShows.length > 0 && (
          <MediaRow title="Watching" items={watchingShows} />
        )}
        {toWatchItems.length > 0 && (
          <MediaRow title="My Watchlist" items={toWatchItems} />
        )}
        {favouriteItems.length > 0 && (
          <MediaRow title="Favourites" items={favouriteItems} />
        )}
        {comingSoon.length > 0 && (
          <MediaRow title="Coming Soon — Films" items={comingSoon} />
        )}
        {comingSoonTV.length > 0 && (
          <MediaRow title="Coming Soon — TV" items={comingSoonTV} />
        )}
        {recommendedShows.length > 0 && (
          <MediaRow title="Recommended TV" items={recommendedShows} />
        )}
        {recommendedMovies.length > 0 && (
          <MediaRow title="Recommended Films" items={recommendedMovies} />
        )}
        {watchingShows.length === 0 && toWatchItems.length === 0 && favouriteItems.length === 0 && (
          <div className="text-center py-32 px-8">
            <p className="text-white text-xl font-semibold mb-2">Your watchlist is empty</p>
            <p className="text-[#999] text-sm">Search for films or TV shows to start tracking them</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Home
