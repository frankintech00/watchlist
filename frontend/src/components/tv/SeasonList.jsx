import { useState, useEffect } from 'react'
import { tmdbAPI } from '../../api/client'
import EpisodeList from './EpisodeList'

function SeasonList({ showId, seasons, trackedEpisodes, onEpisodeToggle, onSeasonToggle }) {
  const [expandedSeason, setExpandedSeason] = useState(null)
  const [seasonData, setSeasonData] = useState({})
  const [loading, setLoading] = useState({})

  // Filter out special seasons (season 0)
  const regularSeasons = seasons.filter(s => s.season_number > 0)

  const toggleSeason = async (seasonNumber) => {
    if (expandedSeason === seasonNumber) {
      setExpandedSeason(null)
      return
    }

    setExpandedSeason(seasonNumber)

    // Fetch season data if not already loaded
    if (!seasonData[seasonNumber]) {
      setLoading({ ...loading, [seasonNumber]: true })
      try {
        const data = await tmdbAPI.getTVSeasonDetail(showId, seasonNumber)
        setSeasonData({ ...seasonData, [seasonNumber]: data })
      } catch (err) {
        console.error('Error fetching season:', err)
      } finally {
        setLoading({ ...loading, [seasonNumber]: false })
      }
    }
  }

  const getSeasonProgress = (seasonNumber, episodeCount) => {
    const seasonEpisodes = trackedEpisodes.filter(e => e.season_number === seasonNumber)
    const watched = seasonEpisodes.filter(e => e.watched).length
    return { watched, total: episodeCount }
  }

  return (
    <div>
      <h2 className="text-2xl font-heading mb-4">Seasons</h2>
      <div className="space-y-4">
        {regularSeasons.map((season) => {
          const isExpanded = expandedSeason === season.season_number
          const progress = getSeasonProgress(season.season_number, season.episode_count)
          const hasProgress = progress.watched > 0

          return (
            <div key={season.season_number} className="bg-dark-card rounded-lg overflow-hidden">
              {/* Season Header */}
              <div
                className="p-4 cursor-pointer hover:bg-dark-lighter transition-colours"
                onClick={() => toggleSeason(season.season_number)}
              >
                <div className="flex items-centre gap-4">
                  {/* Season Poster */}
                  {season.poster_path && (
                    <img
                      src={`https://image.tmdb.org/t/p/w154${season.poster_path}`}
                      alt={season.name}
                      className="w-16 h-24 object-cover rounded"
                    />
                  )}

                  {/* Season Info */}
                  <div className="flex-1">
                    <h3 className="text-xl font-heading mb-1">{season.name}</h3>
                    <p className="text-sm text-gray-400 mb-2">
                      {season.episode_count} Episodes
                      {season.air_date && ` • ${new Date(season.air_date).getFullYear()}`}
                    </p>

                    {/* Progress Bar */}
                    {hasProgress && (
                      <div className="flex items-centre gap-2">
                        <div className="flex-1 bg-dark-lighter rounded-full h-2 overflow-hidden max-w-xs">
                          <div
                            className="bg-primary h-full transition-all"
                            style={{
                              width: `${progress.total > 0 ? (progress.watched / progress.total) * 100 : 0}%`
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {progress.watched}/{progress.total}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Expand Icon */}
                  <div className="text-gray-400">
                    {isExpanded ? '▼' : '▶'}
                  </div>
                </div>
              </div>

              {/* Season Episodes */}
              {isExpanded && (
                <div className="border-t border-dark-lighter p-4">
                  {loading[season.season_number] && (
                    <p className="text-centre text-gray-400 py-4">Loading episodes...</p>
                  )}

                  {!loading[season.season_number] && seasonData[season.season_number] && (
                    <>
                      {/* Mark All Button */}
                      <div className="mb-4 flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onSeasonToggle(season.season_number, true)
                          }}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
                        >
                          Mark All Watched
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onSeasonToggle(season.season_number, false)
                          }}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm"
                        >
                          Mark All Unwatched
                        </button>
                      </div>

                      {/* Episode List */}
                      <EpisodeList
                        episodes={seasonData[season.season_number].episodes}
                        trackedEpisodes={trackedEpisodes.filter(
                          e => e.season_number === season.season_number
                        )}
                        onEpisodeToggle={(episodeNumber, watched) =>
                          onEpisodeToggle(season.season_number, episodeNumber, watched)
                        }
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default SeasonList
