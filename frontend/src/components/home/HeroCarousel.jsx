import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

function HeroCarousel({ items }) {
  const [idx, setIdx]       = useState(0)
  const [paused, setPaused] = useState(false)
  const resumeTimer         = useRef(null)

  // Auto-advance every 5 seconds
  useEffect(() => {
    if (paused || items.length <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % items.length), 5000)
    return () => clearInterval(t)
  }, [paused, items.length])

  // Clean up resume timer on unmount
  useEffect(() => () => clearTimeout(resumeTimer.current), [])

  const goTo = (i) => {
    setIdx(i)
    setPaused(true)
    clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(() => setPaused(false), 5000)
  }

  if (!items?.length) return null

  return (
    <div
      className="relative h-[70vh] min-h-[480px] bg-[#141414] overflow-hidden"
      onMouseEnter={() => { clearTimeout(resumeTimer.current); setPaused(true) }}
      onMouseLeave={() => { clearTimeout(resumeTimer.current); setPaused(false) }}
    >

      {/* ── Backdrop crossfade layers ── */}
      {items.map((item, i) => (
        <div
          key={`bg-${i}`}
          className="absolute inset-0 transition-opacity duration-[1000ms]"
          style={{ opacity: i === idx ? 1 : 0 }}
        >
          {item.backdrop_path && (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(https://image.tmdb.org/t/p/original${item.backdrop_path})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center top',
              }}
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, rgba(20,20,20,0.1) 0%, rgba(20,20,20,0.4) 45%, rgba(20,20,20,0.88) 75%, #141414 100%)',
            }}
          />
        </div>
      ))}

      {/* ── Content crossfade slides ── */}
      {items.map((item, i) => {
        const isMovie  = item.media_type === 'movie'
        const itemId   = isMovie ? (item.id || item.tmdb_movie_id) : (item.id || item.tmdb_show_id)
        const title    = item.title || item.name
        const route    = isMovie ? `/movie/${itemId}` : `/tv/${itemId}`
        const year     = (item.release_date || item.first_air_date || '').split('-')[0]
        const genres   = item.genres?.map(g => g.name).slice(0, 3).join(' · ') || ''
        const isComingSoon = item.hero_type?.startsWith('coming_soon')

        return (
          <div
            key={`slide-${i}`}
            className="absolute bottom-0 left-0 right-0 px-8 md:px-12 pb-14 transition-opacity duration-[1000ms]"
            style={{
              opacity: i === idx ? 1 : 0,
              pointerEvents: i === idx ? 'auto' : 'none',
              zIndex: i === idx ? 2 : 1,
            }}
          >
            <div className="max-w-2xl">

              {isComingSoon && (
                <p className="text-[10px] font-bold tracking-widest uppercase text-white/55 mb-2">
                  Coming Soon
                </p>
              )}

              {(year || genres) && (
                <p className="text-white/60 text-sm mb-2 tracking-wide">
                  {[year, genres].filter(Boolean).join(' · ')}
                </p>
              )}

              <h1 className="text-4xl md:text-6xl font-bold text-white leading-snug pb-1 mb-3 line-clamp-2">
                {title}
              </h1>

              {item.overview && (
                <p className="text-white/80 text-sm md:text-base leading-relaxed mb-5 line-clamp-3 max-w-lg">
                  {item.overview}
                </p>
              )}

              <div className="flex items-center gap-3">
                <Link to={route} className="nf-btn-primary">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  More Info
                </Link>
                {!isComingSoon && (
                  <Link to={route} className="nf-btn-secondary">
                    {item.favourited ? '★ Favourited' : item.watchlisted ? '+ Watchlisted' : '+ My List'}
                  </Link>
                )}
              </div>

            </div>
          </div>
        )
      })}

      {/* ── Dot indicators ── */}
      {items.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-1.5 z-10">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === idx
                  ? 'w-8 bg-white opacity-100'
                  : 'w-1.5 bg-white/40 hover:bg-white/65'
              }`}
            />
          ))}
        </div>
      )}

    </div>
  )
}

export default HeroCarousel
