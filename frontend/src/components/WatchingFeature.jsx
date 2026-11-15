import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { tmdbAPI } from '../api/client'
import Icon from './Icon'
import { episodeCode, img, runtime, shortDate, timeAgo } from '../lib/format'

/**
 * The large "pick up where you left off" card at the top of Watching:
 * the most recently updated show, its next episode, and a one-tap
 * "watched it" button so progress can be logged without opening the show.
 */
export default function WatchingFeature({ show, onMarkWatched }) {
  const [episode, setEpisode] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const next = show.next_episode
  const season = next?.season_number
  const number = next?.episode_number

  // Look up the next episode's title and still
  useEffect(() => {
    setEpisode(null)
    if (!season) return
    let cancelled = false
    tmdbAPI.season(show.id, season)
      .then((data) => {
        if (!cancelled) setEpisode(data.episodes.find((e) => e.episode_number === number) || null)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [show.id, season, number])

  const mark = async () => {
    setSaving(true)
    setError(null)
    try {
      await onMarkWatched(show, next)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const pct = show.aired_episodes > 0 ? Math.round((show.watched_episodes / show.aired_episodes) * 100) : 0
  const art = img(episode?.still_path, 'w780') || img(show.backdrop_path, 'w780')
  const to = `/tv/${show.id}`

  return (
    <article className="gutter mb-6">
      <div className="card overflow-hidden md:flex">
        <Link to={to} className="relative block md:w-[46%] lg:w-[42%] flex-shrink-0 aspect-video md:aspect-auto md:min-h-[270px] bg-raised group">
          {art && (
            <img src={art} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-panel via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-panel" />
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50 md:hidden">
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </Link>

        <div className="flex-1 min-w-0 p-5 sm:p-7 flex flex-col justify-center">
          <p className="eyebrow mb-2">
            Pick up where you left off
            <span className="text-dim font-normal normal-case tracking-normal"> · {timeAgo(show.updated_at)}</span>
          </p>

          <h3 className="text-2xl sm:text-3xl font-bold leading-tight mb-3 truncate">
            <Link to={to} className="hover:text-accent transition-colors">{show.name}</Link>
          </h3>

          {next ? (
            <div className="mb-4">
              <p className="text-sm font-bold text-fg">
                Next up: {episodeCode(next)}
                {episode?.name && <span className="font-normal text-fg/85"> — {episode.name}</span>}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {[episode?.runtime && runtime(episode.runtime), episode?.air_date && `Aired ${shortDate(episode.air_date)}`]
                  .filter(Boolean).join('  ·  ')}
              </p>
              {episode?.overview && (
                <p className="text-sm text-muted leading-relaxed mt-2.5 line-clamp-2 max-w-2xl">{episode.overview}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted mb-4">
              {show.next_air?.air_date
                ? `No episodes to watch yet — next one airs ${shortDate(show.next_air.air_date)}.`
                : 'No episodes have aired yet.'}
            </p>
          )}

          {show.aired_episodes > 0 && (
            <div className="hidden md:flex items-center gap-3 mb-5 max-w-md">
              <div className="flex-1 h-1.5 rounded-full bg-raised overflow-hidden">
                <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-bold text-muted whitespace-nowrap">
                {show.watched_episodes} / {show.aired_episodes}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            {next && (
              <button onClick={mark} disabled={saving} className="btn-primary">
                <Icon name="check" className="w-4 h-4" strokeWidth={3} />
                {saving ? 'Saving…' : `Watched ${episodeCode(next)}`}
              </button>
            )}
            <Link to={to} className="btn-outline">All episodes</Link>
          </div>
          {error && <p className="text-xs text-rotten mt-2" role="alert">Could not save: {error}</p>}
        </div>
      </div>
    </article>
  )
}
