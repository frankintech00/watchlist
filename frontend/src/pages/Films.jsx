import { useEffect, useMemo, useState } from 'react'
import { filmsAPI, trackingAPI } from '../api/client'
import Carousel from '../components/Carousel'
import PosterCard, { Badge, ScoreBadge } from '../components/PosterCard'
import FilmScores from '../components/FilmScores'
import Icon from '../components/Icon'
import { ErrorMessage, RowSkeleton } from '../components/States'
import { shortDate, year } from '../lib/format'

const PERIODS = [
  { days: 30, label: 'Last month' },
  { days: 90, label: 'Last 3 months' },
  { days: 180, label: 'Last 6 months' },
]

// Score bands, best first. `on` = shown by default.
const BANDS = [
  { id: 'top', label: '90% +', title: '90% and above', test: (s) => s >= 90, on: true },
  { id: 'great', label: '75–89%', title: '75–89%', test: (s) => s >= 75 && s < 90, on: true },
  { id: 'good', label: '60–74%', title: '60–74%', test: (s) => s >= 60 && s < 75, on: true },
  { id: 'poor', label: 'Under 60%', title: 'Under 60%', test: (s) => s < 60, on: false },
  { id: 'none', label: 'No score', title: 'No score yet', test: null, on: false },
]

const bandOf = (film) =>
  film.score == null ? 'none' : BANDS.find((b) => b.test && b.test(film.score)).id

/** Films — what is new on UK streaming (by critic score), what is coming, and what you have seen. */
export default function Films() {
  const [days, setDays] = useState(90)
  const [streaming, setStreaming] = useState(null)
  const [streamingError, setStreamingError] = useState(null)
  const [upcoming, setUpcoming] = useState([])
  const [mine, setMine] = useState(null)
  const [provider, setProvider] = useState(null)
  const [bands, setBands] = useState(() => new Set(BANDS.filter((b) => b.on).map((b) => b.id)))
  const [attempt, setAttempt] = useState(0)
  const [ranking, setRanking] = useState('audience')
  const hasAudience = streaming?.rating_source === 'rt_audience'
  const usingRT = hasAudience || streaming?.rating_source === 'rt'
  const audienceRanking = ranking === 'audience' && hasAudience

  useEffect(() => {
    document.title = 'Films · Watchlist'
    trackingAPI.movies.list().then(setMine).catch(() => setMine([]))
    filmsAPI.upcoming().then((d) => setUpcoming(d.results || [])).catch(() => {})
    return () => { document.title = 'Watchlist' }
  }, [])

  useEffect(() => {
    let cancelled = false
    setStreaming(null)
    setStreamingError(null)
    filmsAPI.streaming(days)
      .then((data) => !cancelled && setStreaming(data))
      .catch((err) => !cancelled && setStreamingError(err))
    return () => { cancelled = true }
  }, [days, attempt])

  const statusById = useMemo(
    () => Object.fromEntries((mine || []).map((m) => [m.id, m.status])),
    [mine]
  )

  // Apply the service filter, then split into score bands (best score first within each)
  const { grouped, counts, visibleProviders } = useMemo(() => {
    const films = (streaming?.films || []).filter(
      (f) => !provider || f.providers.some((p) => p.name === provider)
    ).map((film) => ({ ...film, score: audienceRanking ? film.rt_audience_score : usingRT ? film.rt_score : film.tmdb_score }))
    const grouped = Object.fromEntries(BANDS.map((b) => [b.id, []]))
    for (const film of films) grouped[bandOf(film)].push(film)
    for (const list of Object.values(grouped)) {
      list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.popularity - a.popularity)
    }
    return {
      grouped,
      counts: Object.fromEntries(BANDS.map((b) => [b.id, grouped[b.id].length])),
      visibleProviders: (streaming?.providers || []).slice(0, 9),
    }
  }, [streaming, provider, audienceRanking, usingRT])

  const toggleBand = (id) =>
    setBands((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const shownBands = BANDS.filter((b) => bands.has(b.id))
  const nothingShown = streaming && shownBands.every((b) => counts[b.id] === 0)
  const wantToWatch = (mine || []).filter((m) => m.status === 'want_to_watch')
  const watched = (mine || []).filter((m) => m.status === 'watched')

  return (
    <div className="max-w-page mx-auto pt-24 sm:pt-28 pb-16">
      {/* ── New on streaming ── */}
      <header className="gutter mb-6">
        <p className="eyebrow mb-2">Films</p>
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">New on streaming in the UK</h1>
        <p className="text-sm text-muted max-w-2xl">
          Films that have arrived on UK subscription services, grouped by{' '}
          {!streaming || audienceRanking ? 'Rotten Tomatoes audience score (Popcornmeter)' : usingRT ? 'Rotten Tomatoes critic score (Tomatometer)' : 'TMDB audience score'} — best first.
        </p>
      </header>

      <div className="gutter space-y-3 mb-8">
        <FilterRow label="Released">
          {PERIODS.map((p) => (
            <button key={p.days} onClick={() => setDays(p.days)} className={`chip ${days === p.days ? 'chip-on' : ''}`} aria-pressed={days === p.days}>
              {p.label}
            </button>
          ))}
        </FilterRow>

        {hasAudience && (
          <FilterRow label="Rank by">
            <button onClick={() => setRanking('audience')} className={`chip ${audienceRanking ? 'chip-on' : ''}`} aria-pressed={audienceRanking}>
              <Icon name="popcorn" className="w-4 h-4" /> Audience
            </button>
            <button onClick={() => setRanking('critics')} className={`chip ${!audienceRanking ? 'chip-on' : ''}`} aria-pressed={!audienceRanking}>
              <Icon name="tomato" className="w-4 h-4" /> Critics
            </button>
          </FilterRow>
        )}

        <FilterRow label="Score">
          {BANDS.map((b) => (
            <button key={b.id} onClick={() => toggleBand(b.id)} className={`chip ${bands.has(b.id) ? 'chip-on' : ''}`} aria-pressed={bands.has(b.id)}>
              {b.label}
              {streaming && <span className="opacity-60 font-normal">{counts[b.id]}</span>}
            </button>
          ))}
        </FilterRow>

        {visibleProviders.length > 0 && (
          <FilterRow label="Service">
            <button onClick={() => setProvider(null)} className={`chip ${!provider ? 'chip-on' : ''}`} aria-pressed={!provider}>All</button>
            {visibleProviders.map((name) => (
              <button key={name} onClick={() => setProvider(provider === name ? null : name)} className={`chip ${provider === name ? 'chip-on' : ''}`} aria-pressed={provider === name}>
                {name}
              </button>
            ))}
          </FilterRow>
        )}
      </div>

      {streamingError && (
        <ErrorMessage title="Could not load streaming releases" error={streamingError} onRetry={() => setAttempt((n) => n + 1)} />
      )}

      {!streaming && !streamingError && (
        <>
          <p className="gutter text-sm text-muted mb-4" role="status">Checking UK streaming services…</p>
          <RowSkeleton />
          <RowSkeleton />
        </>
      )}

      {streaming && shownBands.map((band) => (
        <Carousel
          key={band.id}
          title={band.title}
          count={counts[band.id]}
          expandable={counts[band.id] > 8}
        >
          {grouped[band.id].map((film) => (
            <PosterCard
              key={film.id}
              to={`/movie/${film.id}`}
              title={film.title}
              poster={film.poster_path}
              subtitle={[film.providers[0]?.name, shortDate(film.streaming_date)].filter(Boolean).join('  ·  ')}
              badge={!usingRT && <ScoreBadge score={film.score} />}
              ratings={usingRT && <FilmScores audience={film.rt_audience_score} critics={film.rt_score} compact />}
              status={statusById[film.id]}
            />
          ))}
        </Carousel>
      ))}

      {nothingShown && (
        <p className="gutter text-sm text-muted mb-10">
          No films match these filters. Try a longer period or turn on more score bands.
        </p>
      )}

      {/* ── Coming soon ── */}
      <Carousel title="Coming soon" count={upcoming.length} expandable={upcoming.length > 8}>
        {upcoming.map((film) => (
          <PosterCard
            key={film.id}
            to={`/movie/${film.id}`}
            title={film.title}
            poster={film.poster_path}
            subtitle={film.release_type}
            badge={<Badge tone="dark">{shortDate(film.uk_release_date)}</Badge>}
            status={statusById[film.id]}
          />
        ))}
      </Carousel>

      {/* ── Your films ── */}
      {(wantToWatch.length > 0 || watched.length > 0) && (
        <div className="gutter border-t border-line pt-8 mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold">Your films</h2>
        </div>
      )}
      <Carousel title="Want to watch" count={wantToWatch.length} expandable={wantToWatch.length > 8}>
        {wantToWatch.map((film) => (
          <PosterCard key={film.id} to={`/movie/${film.id}`} title={film.title || 'Untitled'} poster={film.poster_path} subtitle={year(film.release_date)} status="want_to_watch" />
        ))}
      </Carousel>
      <Carousel title="Watched" count={watched.length} expandable={watched.length > 8}>
        {watched.map((film) => (
          <PosterCard
            key={film.id}
            to={`/movie/${film.id}`}
            title={film.title || 'Untitled'}
            poster={film.poster_path}
            subtitle={[year(film.release_date), film.rating ? '★'.repeat(film.rating) : null].filter(Boolean).join('  ·  ')}
            status="watched"
          />
        ))}
      </Carousel>
    </div>
  )
}

function FilterRow({ label, children }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 flex-shrink-0 text-xs font-bold uppercase tracking-wider text-dim">{label}</span>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mr-4 pr-4 sm:flex-wrap sm:overflow-visible sm:mr-0 sm:pr-0">
        {children}
      </div>
    </div>
  )
}
