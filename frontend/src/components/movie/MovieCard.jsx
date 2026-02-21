import { Link } from 'react-router-dom'

function MovieCard({ movie }) {
  if (!movie) return null

  const movieId = movie.id || movie.tmdb_movie_id
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : null

  // Movie may have tracking data embedded (from tracking API)
  const hasTracking = 'watched' in movie || 'favourited' in movie

  return (
    <Link to={`/movie/${movieId}`} className="block movie-card">
      <div className="relative rounded-lg overflow-hidden bg-dark-card">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={movie.title}
            className="w-full h-auto aspect-[2/3] object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full aspect-[2/3] flex items-center justify-center bg-dark-lighter">
            <span className="text-gray-600 text-sm">No Poster</span>
          </div>
        )}

        {/* Status Badges */}
        {hasTracking && (
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {movie.watched && (
              <span className="bg-green-600 text-xs px-2 py-1 rounded shadow-lg">
                Watched
              </span>
            )}
            {movie.favourited && (
              <span className="bg-primary text-xs px-2 py-1 rounded shadow-lg">
                ★
              </span>
            )}
            {movie.rating > 0 && (
              <span className="bg-yellow-600 text-xs px-2 py-1 rounded shadow-lg font-medium">
                {movie.rating}★
              </span>
            )}
          </div>
        )}

        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3">
          <h3 className="text-sm font-medium truncate">{movie.title}</h3>
          {movie.release_date && (
            <p className="text-xs text-gray-400">
              {new Date(movie.release_date).getFullYear()}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

export default MovieCard
