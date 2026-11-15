import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { tmdbAPI } from '../api/client'
import Icon from './Icon'
import { episodeKey } from '../lib/progress'
import { img, runtime, shortDate, year } from '../lib/format'

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Seasons as an accordion; each episode has a tick to mark it watched.
 *
 *   watched         Set of episodeKey() strings
 *   perSeason       { [season]: { aired, watched } } from showProgress()
 *   openSeason      season number to expand initially (the one being watched)
 *   onToggleEpisode (season, episode, watched) => void
 *   onToggleSeason  (season, watched) => Promise
 */
export default function SeasonList({ showId, seasons, watched, perSeason, openSeason, onToggleEpisode, onToggleSeason }) {
  const [open, setOpen] = useState(openSeason ?? null)
  const [data, setData] = useState({})        // season number -> episodes | 'error'
  const [busySeason, setBusySeason] = useState(null)

  const regular = seasons.filter((s) => s.season_number > 0)

  // Load episodes for whichever season is open
  useEffect(() => {
    if (open == null || data[open]) return
    let cancelled = false
    tmdbAPI.season(showId, open)
      .then((season) => !cancelled && setData((d) => ({ ...d, [open]: season.episodes })))
      .catch(() => !cancelled && setData((d) => ({ ...d, [open]: 'error' })))
    return () => { cancelled = true }
  }, [open, showId, data])

  const toggleSeason = async (seasonNumber, value) => {
    setBusySeason(seasonNumber)
    try {
      await onToggleSeason(seasonNumber, value)
    } finally {
      setBusySeason(null)
    }
  }

  if (regular.length === 0) return null

  return (
    <div className="space-y-2.5">
      {regular.map((season) => {
        const number = season.season_number
        const isOpen = open === number
        const stats = perSeason[number] || { aired: 0, watched: 0 }
        const total = season.episode_count || 0
        const seen = Math.min(stats.watched, total || stats.watched)
        const complete = stats.aired > 0 && stats.watched >= stats.aired
        const episodes = data[number]

        return (
          <div key={number} className="card overflow-hidden">
            <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
              <button
                onClick={() => setOpen(isOpen ? null : number)}
                className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 text-left group"
                aria-expanded={isOpen}
              >
                <div className="w-11 h-16 sm:w-12 sm:h-[72px] rounded-md overflow-hidden bg-raised flex-shrink-0">
                  {season.poster_path && (
                    <img src={img(season.poster_path, 'w185')} alt="" loading="lazy" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate group-hover:text-accent transition-colors">{season.name}</h3>
                  <p className="text-xs text-muted">
                    {total} episode{total === 1 ? '' : 's'}
                    {season.air_date && `  ·  ${year(season.air_date)}`}
                  </p>
                  <div className="flex items-center gap-2.5 mt-2 max-w-xs">
                    <div className="flex-1 h-1 rounded-full bg-raised overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${complete ? 'bg-seen' : 'bg-accent'}`}
                        style={{ width: `${total ? Math.round((seen / total) * 100) : 0}%` }}
                      />
                    </div>
                    <span className={`text-[11px] font-bold ${complete ? 'text-seen' : 'text-muted'}`}>{seen}/{total}</span>
                  </div>
                </div>
              </button>

              {stats.aired > 0 && (
                <button
                  onClick={() => toggleSeason(number, !complete)}
                  disabled={busySeason === number}
                  className={`btn btn-sm border flex-shrink-0 ${
                    complete ? 'border-seen/40 text-seen hover:bg-seen/10' : 'border-line text-muted hover:text-fg hover:border-dim'
                  }`}
                  title={complete ? 'Mark the whole season unwatched' : 'Mark the whole season watched'}
                >
                  <Icon name="check" className="w-3.5 h-3.5" strokeWidth={3} />
                  <span className="hidden sm:inline">{complete ? 'Season watched' : 'Mark season watched'}</span>
                  <span className="sm:hidden">{complete ? 'Done' : 'All'}</span>
                </button>
              )}

              <button onClick={() => setOpen(isOpen ? null : number)} className="icon-btn flex-shrink-0" aria-label={isOpen ? 'Collapse season' : 'Expand season'}>
                <Icon name="down" className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} strokeWidth={2.5} />
              </button>
            </div>

            {isOpen && (
              <div className="border-t border-line">
                {!episodes && <p className="p-4 text-sm text-muted">Loading episodes…</p>}
                {episodes === 'error' && <p className="p-4 text-sm text-rotten">Could not load this season's episodes.</p>}
                {Array.isArray(episodes) && (
                  <ul className="divide-y divide-line/60">
                    {episodes.map((episode) => (
                      <EpisodeRow
                        key={episode.episode_number}
                        episode={episode}
                        watched={watched.has(episodeKey(number, episode.episode_number))}
                        onToggle={(value) => onToggleEpisode(number, episode.episode_number, value)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function EpisodeRow({ episode, watched, onToggle }) {
  const [expanded, setExpanded] = useState(false)
  const aired = episode.air_date && episode.air_date <= today()
  const hasMore = episode.overview || episode.director || episode.guest_stars?.length > 0
  const still = img(episode.still_path, 'w185')

  return (
    <li className={`flex items-start gap-3 p-3 sm:px-4 transition-colors ${watched ? 'bg-ink/40' : ''}`}>
      <button
        onClick={() => onToggle(!watched)}
        disabled={!aired && !watched}
        role="checkbox"
        aria-checked={watched}
        aria-label={`${watched ? 'Unmark' : 'Mark'} episode ${episode.episode_number} as watched`}
        className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed ${
          watched ? 'bg-seen border-seen text-ink' : 'border-dim text-transparent hover:border-seen hover:text-seen/60'
        }`}
      >
        <Icon name="check" className="w-3.5 h-3.5" strokeWidth={3.5} />
      </button>

      {still && (
        <img
          src={still}
          alt=""
          loading="lazy"
          className={`hidden sm:block w-28 aspect-video object-cover rounded-md flex-shrink-0 ${watched ? 'opacity-50' : ''}`}
        />
      )}

      <div className="flex-1 min-w-0">
        <button
          onClick={() => hasMore && setExpanded((v) => !v)}
          className={`w-full text-left flex items-start gap-2 ${hasMore ? 'cursor-pointer' : 'cursor-default'}`}
          aria-expanded={hasMore ? expanded : undefined}
        >
          <span className="flex-1 min-w-0">
            <span className={`block text-sm font-bold ${watched ? 'text-muted' : 'text-fg'}`}>
              <span className="text-dim font-normal">{episode.episode_number}.</span> {episode.name}
            </span>
            <span className="block text-xs text-dim mt-0.5">
              {[
                episode.air_date ? (aired ? shortDate(episode.air_date, { alwaysYear: true }) : `Airs ${shortDate(episode.air_date)}`) : 'Date to be announced',
                runtime(episode.runtime),
              ].filter(Boolean).join('  ·  ')}
            </span>
          </span>
          {hasMore && (
            <Icon name="down" className={`w-4 h-4 mt-0.5 text-dim transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          )}
        </button>

        {expanded && (
          <div className="mt-2 pb-1">
            {episode.overview && <p className="text-sm text-muted leading-relaxed max-w-3xl">{episode.overview}</p>}
            {episode.director && <p className="text-xs text-dim mt-2">Directed by <span className="text-muted">{episode.director}</span></p>}
            {episode.guest_stars?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {episode.guest_stars.map((guest) => (
                  <Link
                    key={guest.id}
                    to={`/person/${guest.id}`}
                    className="inline-flex items-center gap-1.5 h-7 pl-0.5 pr-2.5 rounded-full bg-raised text-xs hover:bg-line transition-colors"
                    title={guest.character ? `as ${guest.character}` : undefined}
                  >
                    {guest.profile_path ? (
                      <img src={img(guest.profile_path, 'w92')} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-line flex items-center justify-center text-[10px] font-bold">{guest.name?.[0]}</span>
                    )}
                    {guest.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
