import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { tmdbAPI, trackingAPI } from '../api/client'
import { CastRow, Providers, Reviews, Score, TrailerButton } from '../components/DetailParts'
import { MyTake, StatusControl } from '../components/TrackingControls'
import { Backdrop, ErrorMessage, PageLoading } from '../components/States'
import { img, longDate, runtime, year } from '../lib/format'

export default function FilmDetail() {
  const { id } = useParams()
  const [film, setFilm] = useState(null)
  const [tracking, setTracking] = useState(null)   // null = not tracked
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFilm(null)
    setTracking(null)
    setError(null)
    setActionError(null)

    Promise.all([tmdbAPI.movie(id), trackingAPI.movies.get(id)])
      .then(([filmData, trackingData]) => {
        if (cancelled) return
        setFilm(filmData)
        setTracking(trackingData)
        document.title = `${filmData.title} · Watchlist`
      })
      .catch((err) => !cancelled && setError(err))

    return () => {
      cancelled = true
      document.title = 'Watchlist'
    }
  }, [id])

  const run = async (action) => {
    setBusy(true)
    setActionError(null)
    try {
      await action()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const setStatus = (status) => run(async () => setTracking(await trackingAPI.movies.save(id, { status })))

  const remove = () =>
    run(async () => {
      if (!window.confirm(`Remove ${film.title} from your list? Your rating and note will be deleted.`)) return
      await trackingAPI.movies.remove(id)
      setTracking(null)
    })

  const saveTake = async (data) => setTracking(await trackingAPI.movies.save(id, data))

  const loadReviews = useCallback(() => tmdbAPI.movieReviews(id), [id])

  if (error) return <ErrorMessage page title="Could not load this film" error={error} />
  if (!film) return <PageLoading />

  const meta = [year(film.release_date), film.certification, runtime(film.runtime)].filter(Boolean)
  const poster = img(film.poster_path, 'w500')
  const released = film.release_date && film.release_date <= new Date().toISOString().slice(0, 10)

  return (
    <div className="relative min-h-screen">
      <Backdrop src={img(film.backdrop_path, 'w1280')} />

      <div className="relative z-10 max-w-page mx-auto pt-20 sm:pt-28 pb-16">
        <div className="gutter grid grid-cols-[6.5rem_1fr] md:grid-cols-[14rem_1fr] gap-x-4 md:gap-x-10 gap-y-5 mb-10">
          <div className="md:row-span-2">
            {poster ? (
              <img src={poster} alt="" className="w-full rounded-lg md:rounded-xl shadow-2xl ring-1 ring-white/10" />
            ) : (
              <div className="w-full aspect-[2/3] rounded-lg bg-panel" />
            )}
          </div>

          <div className="min-w-0 self-end md:self-start">
            <p className="eyebrow mb-2">
              Film
              {!released && film.release_date && (
                <span className="text-muted font-normal normal-case tracking-normal"> · Released {longDate(film.release_date)}</span>
              )}
            </p>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-2">{film.title}</h1>
            {meta.length > 0 && <p className="text-sm text-fg/75">{meta.join('  ·  ')}</p>}
            {film.directors?.length > 0 && (
              <p className="text-sm text-muted mt-1">
                Directed by{' '}
                {film.directors.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 && ', '}
                    <Link to={`/person/${d.id}`} className="text-fg hover:text-accent transition-colors">{d.name}</Link>
                  </span>
                ))}
              </p>
            )}
          </div>

          <div className="col-span-2 md:col-span-1 min-w-0 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusControl status={tracking?.status || null} onSet={setStatus} onRemove={remove} busy={busy} />
              <TrailerButton videoKey={film.trailer_key} />
            </div>

            {actionError && <p className="text-sm text-rotten" role="alert">Could not save: {actionError}</p>}

            {/* Scores */}
            {(film.rt_score != null || film.imdb_rating != null || film.tmdb_score != null) && (
              <div className="flex flex-wrap items-baseline gap-x-7 gap-y-2">
                <Score value={film.rt_score} label="Rotten Tomatoes" />
                <Score value={film.imdb_rating} label="IMDb" suffix="" tone="text-fg" />
                <Score value={film.tmdb_score} label="TMDB" />
              </div>
            )}

            {film.genres?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {film.genres.map((g) => <span key={g.id} className="tag">{g.name}</span>)}
              </div>
            )}

            {film.tagline && <p className="text-fg/70 italic">{film.tagline}</p>}
            {film.overview && <p className="text-[15px] leading-relaxed text-fg/85 max-w-3xl">{film.overview}</p>}

            <Providers providers={film.providers} />

            <MyTake rating={tracking?.rating || 0} comment={tracking?.comment || ''} onSave={saveTake} />
          </div>
        </div>

        <CastRow cast={film.cast} />
        <Reviews load={loadReviews} />
      </div>
    </div>
  )
}
