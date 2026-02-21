import { Link } from 'react-router-dom'
import MovieCard from '../movie/MovieCard'

function MovieRow({ title, movies }) {
  if (!movies || movies.length === 0) {
    return null
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-heading mb-4">{title}</h2>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4">
        {movies.map((movie) => (
          <div key={movie.id || movie.tmdb_movie_id} className="flex-shrink-0 w-48">
            <MovieCard movie={movie} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default MovieRow
