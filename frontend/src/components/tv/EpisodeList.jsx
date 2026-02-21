function EpisodeList({ episodes, trackedEpisodes, onEpisodeToggle }) {
  const isEpisodeWatched = (episodeNumber) => {
    const tracked = trackedEpisodes.find(e => e.episode_number === episodeNumber)
    return tracked ? tracked.watched : false
  }

  return (
    <div className="space-y-2">
      {episodes.map((episode) => {
        const watched = isEpisodeWatched(episode.episode_number)

        return (
          <div
            key={episode.episode_number}
            className="flex items-start gap-3 p-3 bg-dark-lighter rounded hover:bg-dark transition-colours"
          >
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={watched}
              onChange={(e) => onEpisodeToggle(episode.episode_number, e.target.checked)}
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
                {episode.runtime && (
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {episode.runtime}m
                  </span>
                )}
              </div>

              {episode.air_date && (
                <p className="text-xs text-gray-500 mb-1">
                  Aired: {new Date(episode.air_date).toLocaleDateString()}
                </p>
              )}

              {episode.overview && (
                <p className={`text-sm line-clamp-2 ${watched ? 'text-gray-600' : 'text-gray-400'}`}>
                  {episode.overview}
                </p>
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
      })}
    </div>
  )
}

export default EpisodeList
