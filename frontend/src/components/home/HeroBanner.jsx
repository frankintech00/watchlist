import { Link } from 'react-router-dom'

function HeroBanner({ featuredItem }) {
  if (!featuredItem) return null

  const isMovie = featuredItem.media_type === 'movie' ||
    (!featuredItem.media_type && featuredItem.tmdb_movie_id && !featuredItem.tmdb_show_id)

  const itemId = isMovie
    ? (featuredItem.id || featuredItem.tmdb_movie_id)
    : (featuredItem.id || featuredItem.tmdb_show_id)

  const title    = featuredItem.title || featuredItem.name
  const route    = isMovie ? `/movie/${itemId}` : `/tv/${itemId}`
  const year     = (featuredItem.release_date || featuredItem.first_air_date || '').split('-')[0]
  const genres   = featuredItem.genres?.map(g => g.name).slice(0, 3).join(' · ') || ''

  return (
    <div className="relative h-[56vh] min-h-[480px] flex items-end">

      {/* Content */}
      <div className="relative z-10 px-8 md:px-12 pb-4 md:pb-16 max-w-2xl">
        {/* Meta line */}
        {(year || genres) && (
          <p className="text-white/60 text-sm mb-2 tracking-wide">
            {[year, genres].filter(Boolean).join(' · ')}
          </p>
        )}

        {/* Title */}
        <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-4">
          {title}
        </h1>

        {/* Synopsis */}
        {featuredItem.overview && (
          <p className="text-white/80 text-sm md:text-base leading-relaxed mb-6 line-clamp-3 max-w-lg">
            {featuredItem.overview}
          </p>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <Link to={route} className="nf-btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            More Info
          </Link>
          <Link to={route} className="nf-btn-secondary">
            {featuredItem.favourited ? '★ Favourited' : '+ My List'}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default HeroBanner
