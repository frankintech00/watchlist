import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { tmdbAPI, trackingAPI } from '../api/client'
import Icon from '../components/Icon'
import SeasonList from '../components/SeasonList'
import { CastRow, Providers, Reviews, Score, TrailerButton } from '../components/DetailParts'
import { MyTake, StatusControl } from '../components/TrackingControls'
import { Backdrop, ErrorMessage, PageLoading } from '../components/States'
import { episodeKey, showProgress } from '../lib/progress'
import { episodeCode, img, plural, shortDate, year } from '../lib/format'

const toWatchedSet = (episodes) =>
  new Set(episodes.filter((e) => e.watched).map((e) => episodeKey(e.season_number, e.episode_number)))

export default function ShowDetail() {
  const { id } = useParams()
  const [show, setShow] = useState(null)
  const [tracking, setTracking] = useState(null)   // null = not tracked
  const [watched, setWatched] = useState(() => new Set())
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setShow(null)
    setTracking(null)
    setWatched(new Set())
    setError(null)
    setActionError(null)

    Promise.all([tmdbAPI.show(id), trackingAPI.shows.get(id), trackingAPI.shows.episodes(id)])
      .then(([showData, trackingData, episodes]) => {
        if (cancelled) return
        setShow(showData)
        setTracking(trackingData)
        setWatched(toWatchedSet(episodes))
        document.title = `${showData.name} · Watchlist`
      })
      .catch((err) => !cancelled && setError(err))

    return () => {
      cancelled = true
      document.title = 'Watchlist'
    }
  }, [id])

  const progress = useMemo(() => showProgress(show, watched), [show, watched])

  /** Run a tracking action; surface failures instead of swallowing them. */
  const run = useCallback(async (action) => {
    setBusy(true)
    setActionError(null)
    try {
      await action()
    } catch (err) {
      setActionError(err.message)
      throw err
    } finally {
      setBusy(false)
    }
  }, [])

  const reloadEpisodes = useCallback(
    async () => setWatched(toWatchedSet(await trackingAPI.shows.episodes(id))),
    [id]
  )

  // ── Episode ticks (optimistic) ──────────────────────────────────────────
  const toggleEpisode = async (season, episode, value) => {
    const key = episodeKey(season, episode)
    const apply = (on) =>
      setWatched((current) => {
        const next = new Set(current)
        if (on) next.add(key)
        else next.delete(key)
        return next
      })

    apply(value)
    setActionError(null)
    try {
      setTracking(await trackingAPI.shows.markEpisodes(id, [
        { season_number: season, episode_number: episode, watched: value },
      ]))
    } catch (err) {
      apply(!value)
      setActionError(err.message)
    }
  }

  const toggleSeason = (season, value) =>
    run(async () => {
      setTracking(await trackingAPI.shows.markSeason(id, season, value))
      await reloadEpisodes()
    }).catch(() => {})

  // ── Status ──────────────────────────────────────────────────────────────
  const setStatus = (status) =>
    run(async () => {
      const remaining = progress.aired - progress.watched
      if (status === 'watched' && remaining > 0) {
        const ok = window.confirm(
          `Mark ${remaining === progress.aired ? `all ${remaining}` : `the remaining ${remaining}`} aired episode${remaining === 1 ? '' : 's'} as watched?`
        )
        if (!ok) return
        setTracking(await trackingAPI.shows.markAllWatched(id))
        await reloadEpisodes()
      } else {
        setTracking(await trackingAPI.shows.save(id, { status }))
      }
    }).catch(() => {})

  const remove = () =>
    run(async () => {
      if (!window.confirm(`Remove ${show.name} from your list? Your episode ticks, rating and note will be deleted.`)) return
      await trackingAPI.shows.remove(id)
      setTracking(null)
      setWatched(new Set())
    }).catch(() => {})

  const saveTake = async (data) => setTracking(await trackingAPI.shows.save(id, data))

  const loadReviews = useCallback(() => tmdbAPI.showReviews(id), [id])

  if (error) return <ErrorMessage page title="Could not load this show" error={error} />
  if (!show) return <PageLoading />

  const pct = progress.aired > 0 ? Math.round((progress.watched / progress.aired) * 100) : 0
  const ended = show.status === 'Ended' || show.status === 'Canceled'
  const span = show.first_air_date
    ? `${year(show.first_air_date)}${ended && show.last_air_date && year(show.last_air_date) !== year(show.first_air_date) ? `–${year(show.last_air_date)}` : ended ? '' : '–'}`
    : null
  const meta = [
    span,
    show.number_of_seasons ? plural(show.number_of_seasons, 'season') : null,
    show.number_of_episodes ? plural(show.number_of_episodes, 'episode') : null,
    show.networks?.[0],
  ].filter(Boolean)
  const upcoming = show.next_episode_to_air
  const poster = img(show.poster_path, 'w500')

  return (
    <div className="relative min-h-screen">
      <Backdrop src={img(show.backdrop_path, 'w1280')} />

      <div className="relative z-10 max-w-page mx-auto pt-20 sm:pt-28 pb-16">
        {/* ── Header ── */}
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
              TV series
              {show.status && <span className="text-muted font-normal normal-case tracking-normal"> · {show.status}</span>}
            </p>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-2">{show.name}</h1>
            {meta.length > 0 && <p className="text-sm text-fg/75">{meta.join('  ·  ')}</p>}
            {show.created_by?.length > 0 && (
              <p className="text-sm text-muted mt-1">
                Created by{' '}
                {show.created_by.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ', '}
                    <Link to={`/person/${c.id}`} className="text-fg hover:text-accent transition-colors">{c.name}</Link>
                  </span>
                ))}
              </p>
            )}
          </div>

          <div className="col-span-2 md:col-span-1 min-w-0 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusControl status={tracking?.status || null} onSet={setStatus} onRemove={remove} busy={busy} />
              <TrailerButton videoKey={show.trailer_key} />
            </div>

            {actionError && <p className="text-sm text-rotten" role="alert">Could not save: {actionError}</p>}

            {/* Progress */}
            {tracking && progress.aired > 0 && (
              <div className="max-w-lg">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-seen' : 'bg-accent'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold whitespace-nowrap">{progress.watched} / {progress.aired}</span>
                </div>
                <p className="text-sm text-muted mt-2">
                  {progress.next ? (
                    <>
                      <span className="text-fg font-bold">Next up: {episodeCode(progress.next)}</span>
                      <button
                        onClick={() => toggleEpisode(progress.next.season_number, progress.next.episode_number, true)}
                        className="chip ml-3 align-middle"
                      >
                        <Icon name="check" className="w-3.5 h-3.5" strokeWidth={3} />
                        Mark watched
                      </button>
                    </>
                  ) : (
                    <span className="text-seen font-bold">
                      All caught up
                      {upcoming?.air_date && <span className="text-muted font-normal"> · {episodeCode(upcoming)} airs {shortDate(upcoming.air_date)}</span>}
                    </span>
                  )}
                </p>
              </div>
            )}

            {!tracking && upcoming?.air_date && (
              <p className="text-sm text-muted">Next episode: {episodeCode(upcoming)} airs {shortDate(upcoming.air_date)}</p>
            )}

            {show.genres?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {show.genres.map((g) => <span key={g.id} className="tag">{g.name}</span>)}
              </div>
            )}

            {show.overview && <p className="text-[15px] leading-relaxed text-fg/85 max-w-3xl">{show.overview}</p>}

            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <Score value={show.tmdb_score} label="TMDB" />
              <Providers providers={show.providers} />
            </div>

            <MyTake rating={tracking?.rating || 0} comment={tracking?.comment || ''} onSave={saveTake} />
          </div>
        </div>

        {/* ── Episodes ── */}
        {show.seasons?.some((s) => s.season_number > 0) && (
          <section className="gutter mb-10">
            <h2 className="section-title mb-3.5">Episodes</h2>
            <div className="max-w-5xl">
              <SeasonList
                key={show.id}
                showId={id}
                seasons={show.seasons}
                watched={watched}
                perSeason={progress.perSeason}
                openSeason={tracking ? progress.next?.season_number : undefined}
                onToggleEpisode={toggleEpisode}
                onToggleSeason={toggleSeason}
              />
            </div>
          </section>
        )}

        <CastRow cast={show.cast} />
        <Reviews load={loadReviews} />
      </div>
    </div>
  )
}
