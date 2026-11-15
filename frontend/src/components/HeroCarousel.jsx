import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import { episodeCode, img, plural, timeAgo, year } from '../lib/format'

const INTERVAL = 7000

/**
 * Full-width carousel of the most recently updated shows.
 * Each slide has a soft blurred fill of its artwork behind the sharp image,
 * all fading into the page background.
 */
export default function HeroCarousel({ shows }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStart = useRef(null)
  const count = shows.length

  const go = useCallback((next) => setIndex(((next % count) + count) % count), [count])

  useEffect(() => {
    if (index >= count) setIndex(0)
  }, [index, count])

  useEffect(() => {
    if (paused || count <= 1) return
    const timer = setTimeout(() => go(index + 1), INTERVAL)
    return () => clearTimeout(timer)
  }, [paused, count, index, go])

  if (count === 0) return null

  const onTouchEnd = (e) => {
    if (touchStart.current == null) return
    const dx = e.changedTouches[0].clientX - touchStart.current
    touchStart.current = null
    if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1))
  }

  return (
    <section
      className="relative h-[72vh] min-h-[460px] max-h-[760px] overflow-hidden mb-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => { touchStart.current = e.touches[0].clientX }}
      onTouchEnd={onTouchEnd}
      aria-roledescription="carousel"
      aria-label="Recently updated shows"
    >
      {/* Artwork layers — crossfade */}
      {shows.map((show, i) => {
        const art = img(show.backdrop_path, 'w1280')
        return (
          <div
            key={show.id}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: i === index ? 1 : 0 }}
            aria-hidden="true"
          >
            {art && (
              <>
                <div
                  className="absolute -inset-10 bg-cover bg-center blur-3xl opacity-60"
                  style={{ backgroundImage: `url(${img(show.backdrop_path, 'w780')})` }}
                />
                <div
                  className="absolute inset-y-0 right-0 w-full lg:w-[78%] bg-cover bg-top"
                  style={{
                    backgroundImage: `url(${art})`,
                    WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 45%)',
                    maskImage: 'linear-gradient(to right, transparent 0%, black 45%)',
                  }}
                />
              </>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/45 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink via-ink/70 to-transparent" />
          </div>
        )
      })}

      {/* Slide content */}
      {shows.map((show, i) => (
        <Slide key={show.id} show={show} active={i === index} />
      ))}

      {/* Controls */}
      {count > 1 && (
        <div className="absolute bottom-5 inset-x-0 z-20 gutter max-w-page mx-auto flex items-center gap-2">
          {shows.map((show, i) => (
            <button
              key={show.id}
              onClick={() => go(i)}
              aria-label={`Show ${show.name}`}
              aria-current={i === index}
              className="group py-2"
            >
              <span
                className={`block h-1 rounded-full transition-all duration-300 ${
                  i === index ? 'w-10 bg-accent' : 'w-5 bg-white/30 group-hover:bg-white/60'
                }`}
              />
            </button>
          ))}
          <div className="ml-auto hidden sm:flex items-center gap-1">
            <button onClick={() => go(index - 1)} className="icon-btn bg-ink/50" aria-label="Previous show">
              <Icon name="left" className="w-4 h-4" strokeWidth={2.5} />
            </button>
            <button onClick={() => go(index + 1)} className="icon-btn bg-ink/50" aria-label="Next show">
              <Icon name="right" className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function Slide({ show, active }) {
  const watched = show.status === 'watched'
  const pct = show.aired_episodes > 0 ? Math.round((show.watched_episodes / show.aired_episodes) * 100) : 0
  const meta = [
    year(show.first_air_date),
    show.networks?.[0],
    show.number_of_seasons ? plural(show.number_of_seasons, 'season') : null,
    show.genres?.slice(0, 2).join(' / '),
  ].filter(Boolean)

  let action = 'Open show'
  if (show.next_episode) {
    action = `${show.watched_episodes > 0 ? 'Continue' : 'Start'} · ${episodeCode(show.next_episode)}`
  }

  return (
    <div
      className="absolute inset-0 z-10 flex items-end transition-opacity duration-700"
      style={{ opacity: active ? 1 : 0, pointerEvents: active ? 'auto' : 'none' }}
      aria-hidden={!active}
    >
      <div className="gutter w-full max-w-page mx-auto pb-16 sm:pb-20">
        <div className="max-w-xl">
          <p className="eyebrow mb-3">
            <span className={watched ? 'text-seen' : ''}>{watched ? 'Watched' : 'Watching'}</span>
            <span className="text-muted font-normal normal-case tracking-normal"> · updated {timeAgo(show.updated_at)}</span>
          </p>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] mb-3 line-clamp-2 drop-shadow-lg">
            {show.name}
          </h1>

          {meta.length > 0 && <p className="text-sm text-fg/75 mb-4">{meta.join('  ·  ')}</p>}

          {show.overview && (
            <div className="hidden sm:block mb-5">
              <p className="text-[15px] leading-relaxed text-fg/80 line-clamp-3">{show.overview}</p>
            </div>
          )}

          {show.aired_episodes > 0 && (
            <div className="flex items-center gap-3 mb-6 max-w-sm">
              <div className="flex-1 h-1.5 rounded-full bg-white/15 overflow-hidden">
                <div className={`h-full rounded-full ${watched && pct === 100 ? 'bg-seen' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-bold text-fg/80 whitespace-nowrap">
                {show.watched_episodes} / {show.aired_episodes} episodes
              </span>
            </div>
          )}

          <Link to={`/tv/${show.id}`} className="btn-primary h-11 px-6" tabIndex={active ? 0 : -1}>
            <Icon name="play" className="w-4 h-4" filled strokeWidth={0} />
            {action}
          </Link>
        </div>
      </div>
    </div>
  )
}
