import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { tmdbAPI } from '../api/client'
import Icon from './Icon'
import { episodeCode, img, runtime, shortDate, timeAgo } from '../lib/format'

/**
 * Carousel of large "pick up where you left off" cards — one per recently
 * updated show. Swipe, use the arrows, or tap a dot.
 */
export default function WatchingCarousel({ shows, onMarkWatched }) {
  const scroller = useRef(null)
  const [index, setIndex] = useState(0)

  const onScroll = useCallback(() => {
    const el = scroller.current
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }, [])

  const go = (i) => {
    const el = scroller.current
    if (el) el.scrollTo({ left: Math.max(0, Math.min(shows.length - 1, i)) * el.clientWidth, behavior: 'smooth' })
  }

  if (shows.length === 0) return null

  return (
    <section className="gutter mb-10" aria-roledescription="carousel" aria-label="Recently updated shows">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory rounded-xl"
      >
        {shows.map((show, i) => (
          <div key={show.id} className="flex-none w-full snap-start" aria-hidden={i !== index}>
            <WatchingCard show={show} onMarkWatched={onMarkWatched} active={i === index} />
          </div>
        ))}
      </div>

      {shows.length > 1 && (
        <div className="flex items-center gap-2 mt-3">
          {shows.map((show, i) => (
            <button key={show.id} onClick={() => go(i)} aria-label={`Show ${show.name}`} aria-current={i === index} className="group py-2">
              <span
                className={`block h-1 rounded-full transition-all duration-300 ${
                  i === index ? 'w-10 bg-accent' : 'w-5 bg-line group-hover:bg-dim'
                }`}
              />
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => go(index - 1)} disabled={index === 0} className="icon-btn" aria-label="Previous show">
              <Icon name="left" className="w-4 h-4" strokeWidth={2.5} />
            </button>
            <button onClick={() => go(index + 1)} disabled={index === shows.length - 1} className="icon-btn" aria-label="Next show">
              <Icon name="right" className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * One large card: a show, its next episode, and a one-tap "watched it"
 * button so progress can be logged without opening the show.
 */
function WatchingCard({ show, onMarkWatched, active }) {
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
  const tab = active ? 0 : -1   // off-screen cards stay out of the tab order

  return (
    <article className="h-full">
      <div className="card overflow-hidden md:flex h-full">
        <Link to={to} tabIndex={tab} className="relative block md:w-[46%] lg:w-[42%] flex-shrink-0 aspect-video md:aspect-auto md:min-h-[270px] bg-raised">
          {art && (
            <img src={art} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-panel via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-panel" />
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50 md:hidden">
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </Link>

        <div className="flex-1 min-w-0 p-5 sm:p-7 flex flex-col justify-center">
          <p className="eyebrow mb-2">
            Updated {timeAgo(show.updated_at)}
          </p>

          <h3 className="text-2xl sm:text-3xl font-bold leading-tight mb-3 truncate">
            <Link to={to} tabIndex={tab}>{show.name}</Link>
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
              <button onClick={mark} disabled={saving} tabIndex={tab} className="btn-primary">
                <Icon name="check" className="w-4 h-4" strokeWidth={3} />
                {saving ? 'Saving…' : `Watched ${episodeCode(next)}`}
              </button>
            )}
            <Link to={to} tabIndex={tab} className="btn-outline">All episodes</Link>
          </div>
          {error && <p className="text-xs text-rotten mt-2" role="alert">Could not save: {error}</p>}
        </div>
      </div>
    </article>
  )
}
