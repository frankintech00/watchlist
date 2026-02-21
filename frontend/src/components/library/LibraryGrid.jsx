import { Link } from 'react-router-dom'

function LibraryGrid({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="text-white font-semibold mb-1">Nothing here yet</p>
        <p className="text-[#999] text-sm">Search for films or TV shows to start tracking them.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-4">
      {items.map((item) => {
        const isMovie   = item.media_type === 'movie'
        const id        = isMovie ? item.tmdb_movie_id : item.tmdb_show_id
        const title     = item.title || item.name
        const route     = isMovie ? `/movie/${id}` : `/tv/${id}`
        const year      = (item.release_date || item.first_air_date || '').split('-')[0]
        const genres    = item.genres?.slice(0, 2).map(g => g.name) || []
        const posterUrl = item.poster_path
          ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
          : null

        const progressPct = !isMovie && item.total_episodes > 0
          ? Math.round((item.watched_episodes / item.total_episodes) * 100)
          : 0

        return (
          <Link key={`${item.media_type}-${id}`} to={route} className="block group/card relative" style={{ zIndex: 'auto' }}>
            <div
              className="relative transition-transform duration-200 ease-out group-hover/card:scale-[1.1] group-hover/card:z-30"
              style={{ transformOrigin: 'top center' }}
            >
              {/* Poster */}
              <div className="aspect-[2/3] rounded overflow-hidden bg-[#1f1f1f]">
                {posterUrl ? (
                  <img
                    src={posterUrl}
                    alt={title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-2">
                    <span className="text-[#555] text-xs text-center leading-tight">{title}</span>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {progressPct > 0 && progressPct < 100 && (
                <div className="h-[3px] bg-[#333] overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${progressPct}%` }} />
                </div>
              )}

              {/* Hover detail panel */}
              <div
                className="absolute left-0 right-0 bg-[#1f1f1f] rounded-b px-2 pt-2 pb-2.5 shadow-2xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-150"
                style={{ top: '100%' }}
              >
                <p className="text-white text-xs font-semibold leading-tight line-clamp-2 mb-1">
                  {title}
                </p>

                <div className="flex items-center gap-1 flex-wrap mb-1.5">
                  {year && <span className="text-[#999] text-[10px]">{year}</span>}
                  {genres.map(g => (
                    <span key={g} className="text-[10px] text-[#bbb] bg-[#2a2a2a] px-1 py-px rounded">
                      {g}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {isMovie && item.watched && (
                    <span className="text-primary text-[10px] font-bold">✓ Watched</span>
                  )}
                  {!isMovie && progressPct > 0 && (
                    <span className="text-primary text-[10px] font-bold">{progressPct}%</span>
                  )}
                  {item.favourited && (
                    <span className="text-yellow-400 text-xs leading-none">★</span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

export default LibraryGrid
