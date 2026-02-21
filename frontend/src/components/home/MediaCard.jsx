import { Link } from 'react-router-dom'

function MediaCard({ item }) {
  if (!item) return null

  const isMovie = item.media_type === 'movie' ||
    (!item.media_type && item.tmdb_movie_id && !item.tmdb_show_id)

  const id     = isMovie ? (item.id || item.tmdb_movie_id) : (item.id || item.tmdb_show_id)
  const title  = item.title || item.name
  const route  = isMovie ? `/movie/${id}` : `/tv/${id}`
  const year   = (item.release_date || item.first_air_date || '').split('-')[0]
  const genres = item.genres?.slice(0, 2).map(g => g.name) || []

  const imageUrl = item.poster_path
    ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
    : null

  const progressPct = !isMovie && item.total_episodes > 0
    ? Math.round((item.watched_episodes / item.total_episodes) * 100)
    : 0

  return (
    <Link to={route} className="block group/card relative" style={{ zIndex: 'auto' }}>
      {/* Inner wrapper — this is what scales. Panel lives inside so it scales too,
          meaning top:100% aligns exactly with the visual bottom of the scaled image. */}
      <div
        className="relative transition-transform duration-200 ease-out group-hover/card:scale-[1.12] group-hover/card:z-30"
        style={{ transformOrigin: 'top center' }}
      >
        {/* Poster */}
        <div className="aspect-[2/3] rounded overflow-hidden bg-[#1f1f1f]">
          {imageUrl ? (
            <img
              src={imageUrl}
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

        {/* Progress bar — in-progress TV only */}
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
            {year && (
              <span className="text-[#999] text-[10px]">{year}</span>
            )}
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
}

export default MediaCard
