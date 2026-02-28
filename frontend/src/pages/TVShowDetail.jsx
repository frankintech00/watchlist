import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { tmdbAPI, trackingAPI } from '../api/client'
import SeasonList from '../components/tv/SeasonList'
import CastRow from '../components/movie/CastRow'
import MediaRow from '../components/home/MediaRow'
import ReviewsSection from '../components/reviews/ReviewsSection'
import ScrollableRow from '../components/common/ScrollableRow'

function TVShowDetail() {
  const { id } = useParams()
  const [show,         setShow]         = useState(null)
  const [trackingData, setTrackingData] = useState(null)
  const [episodes,     setEpisodes]     = useState([])
  const [similarShows, setSimilarShows] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  const [favourited,  setFavourited]  = useState(false)
  const [watchlisted, setWatchlisted] = useState(false)
  const [rating,      setRating]      = useState(0)
  const [comment,     setComment]     = useState('')
  const [saving,      setSaving]      = useState(false)

  const [mobileRatingOpen, setMobileRatingOpen] = useState(false)
  const [mobileNotesOpen,  setMobileNotesOpen]  = useState(false)

  useEffect(() => {
    async function fetchShowData() {
      try {
        setLoading(true)
        setEpisodes([])
        setTrackingData(null)
        setFavourited(false)
        setWatchlisted(false)
        setRating(0)
        setComment('')

        const [showData, trackingInfo, similarData] = await Promise.all([
          tmdbAPI.getTVShowDetail(id),
          trackingAPI.shows.getById(id).catch(() => null),
          tmdbAPI.getSimilarTVShows(id).catch(() => ({ results: [] }))
        ])

        setShow(showData)
        setSimilarShows((similarData.results || []).map(s => ({ ...s, media_type: 'tv' })))

        if (trackingInfo) {
          setTrackingData(trackingInfo)
          setFavourited(trackingInfo.favourited)
          setWatchlisted(trackingInfo.watchlisted)
          setRating(trackingInfo.rating)
          setComment(trackingInfo.comment)
          const episodeData = await trackingAPI.shows.getEpisodes(id)
          setEpisodes(episodeData)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchShowData()
  }, [id])

  const autoSave = async (updatedData = {}) => {
    if (!show?.id) return
    try {
      setSaving(true)
      const payload = {
        favourited:  updatedData.favourited  ?? favourited,
        watchlisted: updatedData.watchlisted ?? watchlisted,
        rating:      updatedData.rating      ?? rating,
        comment:     updatedData.comment     ?? comment,
      }
      if (trackingData) {
        await trackingAPI.shows.update(id, payload)
      } else {
        await trackingAPI.shows.track(id, payload)
        const newTracking = await trackingAPI.shows.getById(id)
        setTrackingData(newTracking)
      }
    } catch (err) {
      console.error('Error saving:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleEpisodeToggle = async (seasonNumber, episodeNumber, watched) => {
    try {
      if (!trackingData) {
        await trackingAPI.shows.track(id, { favourited: false, rating: 0, comment: '' })
        const newTracking = await trackingAPI.shows.getById(id)
        setTrackingData(newTracking)
      }
      await trackingAPI.shows.markEpisodes(id, [
        { season_number: seasonNumber, episode_number: episodeNumber, watched }
      ])
      const [episodeData, updated] = await Promise.all([
        trackingAPI.shows.getEpisodes(id),
        trackingAPI.shows.getById(id)
      ])
      setEpisodes(episodeData)
      setTrackingData(updated)
    } catch (err) {
      console.error('Error toggling episode:', err)
    }
  }

  const handleSeasonToggle = async (seasonNumber, watched) => {
    try {
      if (!trackingData) {
        await trackingAPI.shows.track(id, { favourited: false, rating: 0, comment: '' })
        const newTracking = await trackingAPI.shows.getById(id)
        setTrackingData(newTracking)
      }
      await trackingAPI.shows.markSeason(id, seasonNumber, watched)
      const [episodeData, updated] = await Promise.all([
        trackingAPI.shows.getEpisodes(id),
        trackingAPI.shows.getById(id)
      ])
      setEpisodes(episodeData)
      setTrackingData(updated)
    } catch (err) {
      console.error('Error marking season:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-400">Loading…</p>
      </div>
    )
  }

  if (error || !show) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">Error: {error || 'Show not found'}</p>
      </div>
    )
  }

  const backdropUrl = show.backdrop_path
    ? `https://image.tmdb.org/t/p/original${show.backdrop_path}`
    : ''

  const posterUrl = show.poster_path
    ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
    : ''

  const creators  = show?.created_by?.map(c => c.name).join(', ') || ''
  const year      = show.first_air_date?.split('-')[0]
  const tmdbScore = show.vote_average ? Math.round(show.vote_average * 10) : null

  const watchedEps = trackingData?.watched_episodes || 0
  const totalEps   = trackingData?.total_episodes || show.number_of_episodes || 0
  const progressPct = totalEps > 0 ? Math.round((watchedEps / totalEps) * 100) : 0

  const toggleFavourite = () => {
    const next = !favourited
    setFavourited(next)
    autoSave({ favourited: next })
  }

  const toggleWatchlist = () => {
    const next = !watchlisted
    setWatchlisted(next)
    autoSave({ watchlisted: next })
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
                  alt={show.name}
                  className="w-20 rounded shadow-2xl flex-shrink-0"
                />
              ) : (
                <div className="w-20 aspect-[2/3] rounded bg-[#2a2a2a] flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0 pb-1">
                <h1 className="text-white font-bold text-lg leading-tight mb-1 line-clamp-2">
                  {show.name}
                </h1>
                {creators && (
                  <p className="text-white/60 text-xs mb-1.5 truncate">By {creators}</p>
                )}
                <div className="flex items-center gap-1.5 text-xs text-white/50 flex-wrap">
                  {year && <span>{year}</span>}
                  {show.number_of_seasons > 0 && (
                    <><span className="text-white/25">·</span><span>{show.number_of_seasons}S</span></>
                  )}
                  {show.status && (
                    <><span className="text-white/25">·</span><span>{show.status}</span></>
                  )}
                  {tmdbScore && (
                    <><span className="text-white/25">·</span><span className="text-white/80 font-semibold">{tmdbScore}%</span></>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Episode progress bar — shown when tracking */}
          {trackingData && totalEps > 0 && (
            <div className="px-4 pt-3">
              <div className="flex items-center justify-between text-xs text-[#aaa] mb-1.5">
                <span>{watchedEps} / {totalEps} episodes</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-1 bg-[#333] rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Genres */}
          {show.genres?.length > 0 && (
            <div className="flex gap-2 flex-wrap px-4 pt-3 pb-1">
              {show.genres.map(g => (
                <span key={g.id} className="text-xs text-[#bbb] bg-[#2a2a2a] px-2 py-0.5 rounded">
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {/* ── Mobile action bar ── */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-start justify-around">

              {/* Watchlist */}
              <button onClick={toggleWatchlist} className="flex flex-col items-center gap-1.5">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  watchlisted ? 'bg-blue-500/20' : 'bg-[#2a2a2a]'
                }`}>
                  <svg
                    className={`w-5 h-5 transition-colors ${watchlisted ? 'text-blue-400' : 'text-white/60'}`}
                    fill={watchlisted ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                  </svg>
                </div>
                <span className="text-[10px] text-white/40">Watchlist</span>
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
                  placeholder="Add your thoughts about this show…"
                  rows={4}
                  className="nf-input w-full resize-none"
                />
              </div>
            )}

            {saving && <p className="text-center text-[10px] text-white/30 mt-2">Saving…</p>}
          </div>

          {/* Synopsis */}
          {show.overview && (
            <p className="text-[#ccc] text-sm leading-relaxed px-4 pt-1 pb-6">
              {show.overview}
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
                  alt={show.name}
                  className="w-full rounded shadow-2xl"
                />
              ) : (
                <div className="w-full aspect-[2/3] rounded bg-[#1f1f1f] flex items-center justify-center">
                  <span className="text-[#555] text-sm text-center px-2">{show.name}</span>
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="flex-1 min-w-0 pt-2">
              <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-2">
                {show.name}
              </h1>

              {creators && (
                <p className="text-[#aaa] text-sm mb-4">
                  Created by <span className="text-white">{creators}</span>
                </p>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-2 text-sm text-[#aaa] mb-4 flex-wrap">
                {year && <span>{year}</span>}
                {show.number_of_seasons > 0 && (
                  <>
                    <span className="text-[#555]">·</span>
                    <span>{show.number_of_seasons} Season{show.number_of_seasons !== 1 ? 's' : ''}</span>
                  </>
                )}
                {show.number_of_episodes > 0 && (
                  <>
                    <span className="text-[#555]">·</span>
                    <span>{show.number_of_episodes} Episodes</span>
                  </>
                )}
                {show.status && (
                  <>
                    <span className="text-[#555]">·</span>
                    <span>{show.status}</span>
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
              {show.genres?.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-6">
                  {show.genres.map(g => (
                    <span key={g.id} className="text-xs text-[#bbb] bg-[#2a2a2a] px-2 py-0.5 rounded">
                      {g.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Progress bar */}
              {trackingData && totalEps > 0 && (
                <div className="mb-6 max-w-sm">
                  <div className="flex items-center justify-between text-xs text-[#aaa] mb-1.5">
                    <span>{watchedEps} / {totalEps} episodes</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="h-1 bg-[#333] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <button
                  onClick={toggleWatchlist}
                  className="nf-btn-secondary"
                  style={watchlisted ? { color: '#60a5fa' } : {}}
                >
                  <svg fill={watchlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}
                    className="w-4 h-4" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                  </svg>
                  Watchlist
                </button>

                <button onClick={toggleFavourite} className="nf-btn-secondary" style={favourited ? { color: '#facc15' } : {}}>
                  <span>★</span>
                  {favourited ? 'Favourited' : 'Favourite'}
                </button>

                {saving && <span className="text-xs text-[#999]">Saving…</span>}
              </div>

              {/* Synopsis */}
              {show.overview && (
                <p className="text-[#ccc] text-sm leading-relaxed mb-8 max-w-2xl">
                  {show.overview}
                </p>
              )}

              {/* My Notes */}
              <div className="mb-6 max-w-2xl">
                <h3 className="text-white text-sm font-semibold mb-2">My Notes</h3>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  onBlur={e => autoSave({ comment: e.target.value })}
                  placeholder="Add your thoughts about this show…"
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
        {show.videos?.length > 0 && (
          <div className="mb-10">
            <h2 className="nf-row-title px-8 md:px-12">Extras</h2>
            <ScrollableRow>
              <div className="flex gap-3 pb-2">
                {show.videos.map(video => (
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

        {/* Seasons & Episodes */}
        {show.seasons?.length > 0 && (
          <div className="mb-10 px-4 md:px-12">
            <SeasonList
              showId={id}
              seasons={show.seasons}
              trackedEpisodes={episodes}
              onEpisodeToggle={handleEpisodeToggle}
              onSeasonToggle={handleSeasonToggle}
            />
          </div>
        )}

        {/* Cast */}
        {show.cast?.length > 0 && (
          <div className="mb-10">
            <CastRow cast={show.cast} />
          </div>
        )}

        {/* Reviews */}
        <div className="mb-10 px-4 md:px-12">
          <ReviewsSection showId={show?.id} type="tv" />
        </div>

        {/* Similar Shows */}
        {similarShows.length > 0 && (
          <div className="mb-12">
            <MediaRow title="Similar Shows" items={similarShows} />
          </div>
        )}
      </div>
    </div>
  )
}

export default TVShowDetail
