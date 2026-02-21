import { useState, useEffect } from 'react'
import CastRow from './CastRow'
import MediaRow from '../home/MediaRow'
import ReviewsSection from '../reviews/ReviewsSection'
import ScrollableRow from '../common/ScrollableRow'
import { trackingAPI, tmdbAPI } from '../../api/client'

function MovieDetail({ movie, trackingData }) {
  const [watched,    setWatched]    = useState(trackingData?.watched    || false)
  const [favourited, setFavourited] = useState(trackingData?.favourited || false)
  const [rating,     setRating]     = useState(trackingData?.rating     || 0)
  const [comment,    setComment]    = useState(trackingData?.comment     || '')
  const [saving,     setSaving]     = useState(false)
  const [similarMovies, setSimilarMovies] = useState([])
  const [mobileRatingOpen, setMobileRatingOpen] = useState(false)
  const [mobileNotesOpen,  setMobileNotesOpen]  = useState(false)

  const backdropUrl = movie?.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : ''

  const posterUrl = movie?.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : ''

  useEffect(() => {
    async function fetchSimilar() {
      if (!movie?.id) return
      try {
        const data = await tmdbAPI.getSimilarMovies(movie.id)
        setSimilarMovies((data.results || []).map(m => ({ ...m, media_type: 'movie' })))
      } catch {
        setSimilarMovies([])
      }
    }
    fetchSimilar()
  }, [movie?.id])

  const autoSave = async (updatedData = {}) => {
    if (!movie?.id) return
    try {
      setSaving(true)
      const payload = {
        watched:    updatedData.watched    ?? watched,
        favourited: updatedData.favourited ?? favourited,
        rating:     updatedData.rating     ?? rating,
        comment:    updatedData.comment    ?? comment,
      }
      if (trackingData) {
        await trackingAPI.update(movie.id, payload)
      } else {
        await trackingAPI.track(movie.id, payload)
      }
    } catch (error) {
      console.error('Error saving:', error)
    } finally {
      setSaving(false)
    }
  }

  const director  = movie?.credits?.crew?.find(p => p.job === 'Director')
  const year      = movie?.release_date?.split('-')[0]
  const runtime   = movie?.runtime
  const cert      = movie?.certification
  const tmdbScore = movie?.vote_average ? Math.round(movie.vote_average * 10) : null

  const toggleWatched = () => {
    const next = !watched
    setWatched(next)
    autoSave({ watched: next })
  }

  const toggleFavourite = () => {
    const next = !favourited
    setFavourited(next)
    autoSave({ favourited: next })
  }

  return (
    <div className="relative min-h-screen bg-[#141414]">

      {/* Page backdrop — desktop only (mobile uses inline backdrop strip) */}
      {backdropUrl && (
        <div
          className="fixed inset-0 z-0 hidden md:block"
          style={{
            backgroundImage: `url(${backdropUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            animation: 'fadeIn 2s ease-in',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, rgba(20,20,20,0.3) 0%, rgba(20,20,20,0.75) 40%, rgba(20,20,20,0.95) 65%, #141414 80%)',
            }}
          />
        </div>
      )}

      <div className="relative z-10">

        {/* ═══════════════════════════════════════════
            MOBILE HERO  (hidden at md and above)
        ═══════════════════════════════════════════ */}
        <div className="md:hidden">

          {/* Backdrop strip — full width, ~55vw tall, fades to page bg at bottom */}
          <div
            className="relative w-full"
            style={{
              height: '65vw',
              minHeight: '220px',
              backgroundColor: '#1f1f1f',
              backgroundImage: backdropUrl ? `url(${backdropUrl})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center top',
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to bottom, rgba(20,20,20,0.1) 0%, rgba(20,20,20,0.5) 50%, #141414 100%)',
              }}
            />

            {/* Poster + title/meta anchored to bottom of backdrop */}
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 flex items-end gap-3">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={movie?.title}
                  className="w-20 rounded shadow-2xl flex-shrink-0"
                />
              ) : (
                <div className="w-20 aspect-[2/3] rounded bg-[#2a2a2a] flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0 pb-1">
                <h1 className="text-white font-bold text-lg leading-tight mb-1 line-clamp-2">
                  {movie?.title}
                </h1>
                {director && (
                  <p className="text-white/60 text-xs mb-1.5">Dir. {director.name}</p>
                )}
                <div className="flex items-center gap-1.5 text-xs text-white/50 flex-wrap">
                  {year && <span>{year}</span>}
                  {runtime && (
                    <><span className="text-white/25">·</span><span>{runtime}m</span></>
                  )}
                  {cert && (
                    <span className="border border-white/30 text-white/60 text-[10px] px-1 py-px rounded">
                      {cert}
                    </span>
                  )}
                  {tmdbScore && (
                    <><span className="text-white/25">·</span><span className="text-white/80 font-semibold">{tmdbScore}%</span></>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Genres */}
          {movie?.genres?.length > 0 && (
            <div className="flex gap-2 flex-wrap px-4 pt-3 pb-1">
              {movie.genres.map(g => (
                <span key={g.id} className="text-xs text-[#bbb] bg-[#2a2a2a] px-2 py-0.5 rounded">
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {/* ── Mobile action bar ── */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-start justify-around">

              {/* Watched */}
              <button onClick={toggleWatched} className="flex flex-col items-center gap-1.5">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  watched ? 'bg-primary' : 'bg-[#2a2a2a]'
                }`}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <span className="text-[10px] text-white/40">{watched ? 'Watched' : 'Watch'}</span>
              </button>

              {/* Favourite */}
              <button onClick={toggleFavourite} className="flex flex-col items-center gap-1.5">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  favourited ? 'bg-yellow-500/20' : 'bg-[#2a2a2a]'
                }`}>
                  <svg
                    className={`w-5 h-5 transition-colors ${favourited ? 'text-yellow-400' : 'text-white/60'}`}
                    fill={favourited ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.86L12 17.77l-6.18 3.23L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <span className="text-[10px] text-white/40">Favourite</span>
              </button>

              {/* Rating */}
              <button
                onClick={() => { setMobileRatingOpen(v => !v); setMobileNotesOpen(false) }}
                className="flex flex-col items-center gap-1.5"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  mobileRatingOpen ? 'bg-[#3a3a3a]' : 'bg-[#2a2a2a]'
                }`}>
                  {rating > 0 ? (
                    <span className="text-yellow-400 font-bold text-sm leading-none">{rating}★</span>
                  ) : (
                    <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.86L12 17.77l-6.18 3.23L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  )}
                </div>
                <span className="text-[10px] text-white/40">Rating</span>
              </button>

              {/* Notes */}
              <button
                onClick={() => { setMobileNotesOpen(v => !v); setMobileRatingOpen(false) }}
                className="flex flex-col items-center gap-1.5"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  mobileNotesOpen ? 'bg-[#3a3a3a]' : comment ? 'bg-primary/20' : 'bg-[#2a2a2a]'
                }`}>
                  <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <span className="text-[10px] text-white/40">Notes</span>
              </button>

            </div>

            {/* Inline star rating picker */}
            {mobileRatingOpen && (
              <div className="mt-4 flex items-center justify-center gap-4">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => {
                      const next = rating === star ? 0 : star
                      setRating(next)
                      autoSave({ rating: next })
                      setMobileRatingOpen(false)
                    }}
                    className={`text-3xl transition-colors ${star <= rating ? 'text-yellow-400' : 'text-white/20'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            )}

            {/* Inline notes textarea */}
            {mobileNotesOpen && (
              <div className="mt-3">
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  onBlur={e => autoSave({ comment: e.target.value })}
                  placeholder="Add your thoughts about this film…"
                  rows={4}
                  className="nf-input w-full resize-none"
                />
              </div>
            )}

            {saving && <p className="text-center text-[10px] text-white/30 mt-2">Saving…</p>}
          </div>

          {/* Synopsis */}
          {movie?.overview && (
            <p className="text-[#ccc] text-sm leading-relaxed px-4 pt-1 pb-6">
              {movie.overview}
            </p>
          )}
        </div>

        {/* ═══════════════════════════════════════════
            DESKTOP HERO  (md and above)
        ═══════════════════════════════════════════ */}
        <div className="hidden md:block pt-28 pb-10 px-8 md:px-12">
          <div className="flex gap-8 md:gap-10 max-w-screen-xl mx-auto">

            {/* Poster */}
            <div className="flex-shrink-0 w-44 md:w-52">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={movie?.title}
                  className="w-full rounded shadow-2xl"
                />
              ) : (
                <div className="w-full aspect-[2/3] rounded bg-[#1f1f1f] flex items-center justify-center">
                  <span className="text-[#555] text-sm text-center px-2">{movie?.title}</span>
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="flex-1 min-w-0 pt-2">
              <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-2">
                {movie?.title}
              </h1>

              {director && (
                <p className="text-[#aaa] text-sm mb-4">
                  Directed by <span className="text-white">{director.name}</span>
                </p>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-2 text-sm text-[#aaa] mb-4 flex-wrap">
                {year && <span>{year}</span>}
                {runtime && <><span className="text-[#555]">·</span><span>{runtime} min</span></>}
                {cert && (
                  <>
                    <span className="text-[#555]">·</span>
                    <span className="border border-[#666] text-[#aaa] text-xs px-1.5 py-px rounded">
                      {cert}
                    </span>
                  </>
                )}
                {tmdbScore && (
                  <>
                    <span className="text-[#555]">·</span>
                    <span className="text-white font-semibold">{tmdbScore}%</span>
                    <span className="text-[#aaa] text-xs">TMDB</span>
                  </>
                )}
              </div>

              {/* Genres */}
              {movie?.genres?.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-6">
                  {movie.genres.map(g => (
                    <span key={g.id} className="text-xs text-[#bbb] bg-[#2a2a2a] px-2 py-0.5 rounded">
                      {g.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <button
                  onClick={toggleWatched}
                  className={watched ? 'nf-btn-secondary' : 'nf-btn-primary'}
                >
                  <span>{watched ? '✓' : '+'}</span>
                  {watched ? 'Watched' : 'Mark Watched'}
                </button>

                <button
                  onClick={toggleFavourite}
                  className="nf-btn-secondary"
                  style={favourited ? { color: '#facc15' } : {}}
                >
                  <span>★</span>
                  {favourited ? 'Favourited' : 'Favourite'}
                </button>

                {saving && (
                  <span className="text-xs text-[#999]">Saving…</span>
                )}
              </div>

              {/* Synopsis */}
              {movie?.overview && (
                <p className="text-[#ccc] text-sm leading-relaxed mb-8 max-w-2xl">
                  {movie.overview}
                </p>
              )}

              {/* My Notes */}
              <div className="mb-6 max-w-2xl">
                <h3 className="text-white text-sm font-semibold mb-2">My Notes</h3>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  onBlur={e => autoSave({ comment: e.target.value })}
                  placeholder="Add your thoughts about this film…"
                  rows={4}
                  className="nf-input w-full resize-none"
                />
              </div>

              {/* My Rating */}
              <div>
                <h3 className="text-white text-sm font-semibold mb-2">My Rating</h3>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => {
                        const next = rating === star ? 0 : star
                        setRating(next)
                        autoSave({ rating: next })
                      }}
                      className={`text-2xl transition-colors ${
                        star <= rating ? 'text-yellow-400' : 'text-[#555] hover:text-[#888]'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Full-width sections (shared mobile + desktop) ── */}

        {/* Extras */}
        {movie?.videos?.length > 0 && (
          <div className="mb-10">
            <h2 className="nf-row-title px-8 md:px-12">Extras</h2>
            <ScrollableRow>
              <div className="flex gap-3 pb-2">
                {movie.videos.map(video => (
                  <div key={video.id} className="flex-shrink-0 w-72 md:w-80">
                    <div className="aspect-video bg-[#1f1f1f] rounded overflow-hidden mb-1.5">
                      <iframe
                        width="100%"
                        height="100%"
                        src={`https://www.youtube.com/embed/${video.key}`}
                        title={video.name}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <p className="text-[#999] text-xs">{video.type}: {video.name}</p>
                  </div>
                ))}
              </div>
            </ScrollableRow>
          </div>
        )}

        {/* Cast */}
        {movie?.cast?.length > 0 && (
          <div className="mb-10">
            <CastRow cast={movie.cast} />
          </div>
        )}

        {/* Reviews */}
        <div className="mb-10 px-8 md:px-12">
          <ReviewsSection movieId={movie?.id} type="movie" />
        </div>

        {/* Similar Films */}
        {similarMovies.length > 0 && (
          <div className="mb-12">
            <MediaRow title="Similar Films" items={similarMovies} />
          </div>
        )}
      </div>
    </div>
  )
}

export default MovieDetail
