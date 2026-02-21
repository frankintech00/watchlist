import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import MovieDetail from '../components/movie/MovieDetail'
import { tmdbAPI, trackingAPI } from '../api/client'

function MovieDetailPage() {
  const { id } = useParams()
  const [movie, setMovie] = useState(null)
  const [trackingData, setTrackingData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchMovieData() {
      try {
        setLoading(true)
        setError(null)

        // Fetch movie detail from TMDB and tracking data in parallel
        const [tmdbData, tracked] = await Promise.all([
          tmdbAPI.getMovieDetail(id),
          trackingAPI.getById(id).catch(() => null) // Returns null if not tracked
        ])

        setMovie(tmdbData)
        setTrackingData(tracked)
      } catch (err) {
        console.error('Error fetching movie data:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchMovieData()
  }, [id])

  if (loading) {
    return <div className="pt-16 flex items-center justify-center h-screen">Loading...</div>
  }

  if (error) {
    return (
      <div className="pt-16 flex items-center justify-center h-screen">
        <p className="text-xl text-red-500">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="pt-16">
      <MovieDetail movie={movie} trackingData={trackingData} />
    </div>
  )
}

export default MovieDetailPage
