import { useState } from 'react'

function ChevronIcon({ expanded }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function GuestStar({ guest }) {
  return (
    <div className="flex flex-col items-center gap-1 w-12">
      {guest.profile_path ? (
        <img
          src={`https://image.tmdb.org/t/p/w45${guest.profile_path}`}
          alt={guest.name}
          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-[#333] flex items-center justify-center flex-shrink-0">
          <span className="text-xs text-gray-400">{guest.name?.[0]}</span>
        </div>
      )}
      <span className="text-[10px] text-gray-500 text-center leading-tight line-clamp-2">
        {guest.name}
      </span>
    </div>
  )
}

function EpisodeCard({ episode, watched, onEpisodeToggle }) {
  const [expanded, setExpanded] = useState(false)

  const director = episode.crew?.find(c => c.job === 'Director')?.name
  const guestStars = episode.guest_stars?.slice(0, 5) ?? []
  const hasExpandable = episode.overview || director || guestStars.length > 0

  return (
    <div
      className="flex items-start gap-3 p-3 bg-dark-lighter rounded hover:bg-dark transition-colours cursor-pointer select-none"
      onClick={() => setExpanded(v => !v)}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={watched}
        onChange={(e) => onEpisodeToggle(episode.episode_number, e.target.checked)}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 cursor-pointer"
      />

      {/* Episode Still */}
      {episode.still_path && (
        <img
          src={`https://image.tmdb.org/t/p/w185${episode.still_path}`}
          alt={episode.name}
          className="w-24 h-14 object-cover rounded flex-shrink-0"
        />
      )}

      {/* Episode Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className={`font-medium ${watched ? 'text-gray-500 line-through' : ''}`}>
            {episode.episode_number}. {episode.name}
          </h4>
          <div className="flex items-center gap-2 flex-shrink-0">
            {episode.runtime && (
              <span className="text-xs text-gray-500">{episode.runtime}m</span>
            )}
            {hasExpandable && <ChevronIcon expanded={expanded} />}
          </div>
        </div>

        {episode.air_date && (
          <p className="text-xs text-gray-500 mb-1">
            Aired: {new Date(episode.air_date).toLocaleDateString()}
          </p>
        )}

        {/* Expandable section: synopsis + director + guest stars */}
        {hasExpandable && (
          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{ maxHeight: expanded ? '600px' : '3rem' }}
          >
            {episode.overview && (
              <p className={`text-sm ${watched ? 'text-gray-600' : 'text-gray-400'}`}>
                {episode.overview}
              </p>
            )}

            {director && (
              <p className="text-xs text-gray-500 mt-2">
                Directed by <span className="text-gray-400">{director}</span>
              </p>
            )}

            {guestStars.length > 0 && (
              <div className="flex gap-3 flex-wrap mt-3">
                {guestStars.map(guest => (
                  <GuestStar key={guest.id} guest={guest} />
                ))}
              </div>
            )}
          </div>
        )}

        {episode.vote_average > 0 && (
          <div className="flex items-centre gap-1 mt-1">
            <span className="text-yellow-500 text-xs">★</span>
            <span className="text-xs text-gray-500">
              {episode.vote_average.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function EpisodeList({ episodes, trackedEpisodes, onEpisodeToggle }) {
  const isEpisodeWatched = (episodeNumber) => {
    const tracked = trackedEpisodes.find(e => e.episode_number === episodeNumber)
    return tracked ? tracked.watched : false
  }

  return (
    <div className="space-y-2">
      {episodes.map((episode) => (
        <EpisodeCard
          key={episode.episode_number}
          episode={episode}
          watched={isEpisodeWatched(episode.episode_number)}
          onEpisodeToggle={onEpisodeToggle}
        />
      ))}
    </div>
  )
}

export default EpisodeList
