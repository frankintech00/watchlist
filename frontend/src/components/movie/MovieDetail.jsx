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
      {/* Page backdrop */}
      {backdropUrl && (
        <div
          className="fixed inset-0 z-0"
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
        {/* ── Two-column hero section ───────────────────── */}
        <div className="pt-28 pb-10 px-8 md:px-12">
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

        {/* ── Full-width sections ───────────────────────── */}

        {/* Extras */}
        {movie?.videos?.length > 0 && (
          <div className="mb-10">
            <h2 className="nf-row-title px-8 md:px-12">Extras</h2>
            <ScrollableRow>
              <div className="flex gap-3 px-8 md:px-12 pb-2">
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
          <div className="mb-10 px-8 md:px-12">
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
