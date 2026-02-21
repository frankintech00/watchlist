import { useEffect, useState } from 'react'
import HeroBanner from '../components/home/HeroBanner'
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
  const [featuredItem, setFeaturedItem] = useState(null)

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

        // To Watch — favourited but not watched/complete
        const toWatch = [
          ...validMovies.filter(m => m.favourited && !m.watched),
          ...validShows.filter(s =>
            s.favourited && !(s.watched_episodes >= s.total_episodes && s.total_episodes > 0)
          )
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

        // Hero: pick from favourites, else in-progress
        const heroPool = allFavourites.length > 0 ? allFavourites : inProgressShows
        if (heroPool.length > 0) {
          setFeaturedItem(heroPool[Math.floor(Math.random() * heroPool.length)])
        }

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

  const backdropUrl = featuredItem?.backdrop_path
    ? `https://image.tmdb.org/t/p/original${featuredItem.backdrop_path}`
    : ''

  return (
    <div className="relative min-h-screen">
      {/* Full-page backdrop — fades out at the bottom so rows sit on #141414 */}
      {backdropUrl && (
        <div
          className="fixed inset-0 z-0"
          style={{
            backgroundImage: `url(${backdropUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            animation: 'fadeIn 2s ease-in',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, rgba(20,20,20,0.15) 0%, rgba(20,20,20,0.5) 30%, rgba(20,20,20,0.85) 55%, #141414 75%)',
            }}
          />
        </div>
      )}

      {/* Hero Banner — no top padding, bleeds behind transparent header */}
      <div className="relative z-10">
        <HeroBanner featuredItem={featuredItem} />
      </div>

      {/* Content Rows */}
      <div className="relative z-10 pb-12">
        {watchingShows.length > 0 && (
          <MediaRow title="Watching" items={watchingShows} />
        )}
        {toWatchItems.length > 0 && (
          <MediaRow title="To Watch" items={toWatchItems} />
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
