import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { tmdbAPI, trackingAPI } from '../api/client'
import Carousel from '../components/Carousel'
import Icon from '../components/Icon'
import PosterCard, { TrackedMark } from '../components/PosterCard'
import { Backdrop, ErrorMessage, PageLoading } from '../components/States'
import { img, longDate, plural, titlePath, year } from '../lib/format'

const SORTS = {
  newest: { label: 'Newest first', compare: (a, b) => (b.date || '9999').localeCompare(a.date || '9999') },
  popular: { label: 'Best known', compare: (a, b) => b.vote_count - a.vote_count },
  rated: {
    label: 'Highest rated',
    // Ignore averages built on a handful of votes
    compare: (a, b) => (b.vote_count >= 50 ? b.vote_average : 0) - (a.vote_count >= 50 ? a.vote_average : 0),
  },
}

function age(birthday, deathday) {
  if (!birthday) return null
  const end = deathday ? new Date(deathday) : new Date()
  const born = new Date(birthday)
  let years = end.getFullYear() - born.getFullYear()
  if (end < new Date(end.getFullYear(), born.getMonth(), born.getDate())) years -= 1
  return years
}

export default function Person() {
  const { id } = useParams()
  const [person, setPerson] = useState(null)
  const [tracked, setTracked] = useState({ tv: {}, movie: {} })
  const [error, setError] = useState(null)

  const [role, setRole] = useState('acting')     // acting | crew
  const [media, setMedia] = useState('all')      // all | movie | tv
  const [sort, setSort] = useState('newest')
  const [appearances, setAppearances] = useState(false)
  const [mineOnly, setMineOnly] = useState(false)
  const [bioOpen, setBioOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPerson(null)
    setError(null)
    setBioOpen(false)
    setMedia('all')
    setMineOnly(false)
    setAppearances(false)

    tmdbAPI.person(id)
      .then((data) => {
        if (cancelled) return
        setPerson(data)
        setRole(data.known_for_department !== 'Acting' && data.crew.length > 0 ? 'crew' : data.acting.length > 0 ? 'acting' : 'crew')
        document.title = `${data.name} · Watchlist`
      })
      .catch((err) => !cancelled && setError(err))
    trackingAPI.ids().then((ids) => !cancelled && setTracked(ids)).catch(() => {})

    return () => {
      cancelled = true
      document.title = 'Watchlist'
    }
  }, [id])

  const statusOf = (credit) => tracked[credit.media_type]?.[credit.id]

  const { credits, hiddenAppearances, seenCount } = useMemo(() => {
    if (!person) return { credits: [], hiddenAppearances: 0, seenCount: 0 }
    const pool = person[role] || []
    const everything = new Map()
    for (const c of [...person.acting, ...person.crew]) everything.set(`${c.media_type}-${c.id}`, c)

    return {
      credits: pool
        .filter((c) => media === 'all' || c.media_type === media)
        .filter((c) => appearances || !c.appearance)
        .filter((c) => !mineOnly || tracked[c.media_type]?.[c.id])
        .sort(SORTS[sort].compare),
      hiddenAppearances: pool.filter((c) => c.appearance && (media === 'all' || c.media_type === media)).length,
      seenCount: [...everything.values()].filter((c) => tracked[c.media_type]?.[c.id]).length,
    }
  }, [person, role, media, sort, appearances, mineOnly, tracked])

  if (error) return <ErrorMessage page title="Could not load this person" error={error} />
  if (!person) return <PageLoading />

  const photo = img(person.profile_path, 'w500')
  const years = age(person.birthday, person.deathday)
  const bio = person.biography || ''
  const longBio = bio.length > 520
  const roles = [
    { id: 'acting', label: 'Acting', count: person.acting.length },
    { id: 'crew', label: 'Behind the camera', count: person.crew.length },
  ].filter((r) => r.count > 0)

  return (
    <div className="relative min-h-screen">
      <Backdrop src={img(person.known_for?.[0]?.poster_path, 'original')} portrait />
      <div className="relative z-10 max-w-page mx-auto pt-20 sm:pt-28 pb-16">
      {/* ── Profile ── */}
      <div className="gutter grid grid-cols-[6.5rem_1fr] md:grid-cols-[14rem_1fr] gap-x-4 md:gap-x-10 gap-y-5 mb-10">
        <div className="md:row-span-2">
          {photo ? (
            <img src={photo} alt="" className="w-full rounded-lg md:rounded-xl shadow-2xl ring-1 ring-white/10" />
          ) : (
            <div className="w-full aspect-[2/3] rounded-lg bg-panel flex items-center justify-center text-4xl font-bold text-dim">
              {person.name?.[0]}
            </div>
          )}
        </div>

        <div className="min-w-0 self-end md:self-start">
          <p className="eyebrow mb-2">{person.known_for_department}</p>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold leading-tight">{person.name}</h1>
        </div>

        <div className="col-span-2 md:col-span-1 min-w-0 space-y-5">
          <dl className="flex flex-wrap gap-x-10 gap-y-3 text-sm">
            {person.birthday && (
              <Fact label="Born">
                {longDate(person.birthday)}
                {!person.deathday && years != null && <span className="text-muted"> (age {years})</span>}
              </Fact>
            )}
            {person.deathday && (
              <Fact label="Died">
                {longDate(person.deathday)}
                {years != null && <span className="text-muted"> (aged {years})</span>}
              </Fact>
            )}
            {person.place_of_birth && <Fact label="From">{person.place_of_birth}</Fact>}
            <Fact label="Credits">{person.acting.length + person.crew.length}</Fact>
            {seenCount > 0 && (
              <Fact label="On your list">
                <span className="text-seen font-bold">{plural(seenCount, 'title')}</span>
              </Fact>
            )}
          </dl>

          {bio && (
            <div className="max-w-3xl">
              <p className="text-[15px] leading-relaxed text-fg/85 whitespace-pre-line">
                {longBio && !bioOpen ? `${bio.slice(0, 520).trimEnd()}…` : bio}
              </p>
              {longBio && (
                <button onClick={() => setBioOpen((v) => !v)} className="text-sm font-bold text-accent mt-2 hover:underline">
                  {bioOpen ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          )}

          {person.imdb_id && (
            <a href={`https://www.imdb.com/name/${person.imdb_id}/`} target="_blank" rel="noreferrer" className="btn-outline btn-sm">
              IMDb
              <Icon name="external" className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* ── Known for ── */}
      <Carousel title="Known for">
        {person.known_for.map((credit) => (
          <PosterCard
            key={`${credit.media_type}-${credit.id}`}
            to={titlePath(credit)}
            title={credit.title}
            poster={credit.poster_path}
            subtitle={[year(credit.date), credit.roles[0]].filter(Boolean).join('  ·  ')}
            status={statusOf(credit)}
          />
        ))}
      </Carousel>

      {/* ── Filmography ── */}
      <section className="gutter">
        <h2 className="section-title mb-4">Filmography</h2>

        <div className="flex flex-wrap items-center gap-2 mb-5">
          {roles.length > 1 && roles.map((r) => (
            <button key={r.id} onClick={() => setRole(r.id)} className={`chip ${role === r.id ? 'chip-on' : ''}`} aria-pressed={role === r.id}>
              {r.label} <span className="opacity-60 font-normal">{r.count}</span>
            </button>
          ))}
          {roles.length > 1 && <span className="w-px h-5 bg-line mx-1" />}

          {[['all', 'All'], ['movie', 'Films'], ['tv', 'TV']].map(([value, label]) => (
            <button key={value} onClick={() => setMedia(value)} className={`chip ${media === value ? 'chip-on' : ''}`} aria-pressed={media === value}>
              {label}
            </button>
          ))}
          <span className="w-px h-5 bg-line mx-1" />

          {seenCount > 0 && (
            <button onClick={() => setMineOnly((v) => !v)} className={`chip ${mineOnly ? 'chip-on' : ''}`} aria-pressed={mineOnly}>
              On my list
            </button>
          )}
          {role === 'acting' && hiddenAppearances > 0 && (
            <button onClick={() => setAppearances((v) => !v)} className={`chip ${appearances ? 'chip-on' : ''}`} aria-pressed={appearances} title="Chat shows, news and other appearances as themselves">
              As self <span className="opacity-60 font-normal">{hiddenAppearances}</span>
            </button>
          )}

          <label className="ml-auto flex items-center gap-2 text-xs text-dim font-bold">
            <span className="hidden sm:inline uppercase tracking-wider">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="input w-auto py-1.5 pr-8 text-xs font-bold">
              {Object.entries(SORTS).map(([value, s]) => <option key={value} value={value}>{s.label}</option>)}
            </select>
          </label>
        </div>

        {credits.length === 0 ? (
          <p className="text-sm text-muted py-6">No credits match these filters.</p>
        ) : (
          <ul className="grid gap-x-8 lg:grid-cols-2 max-w-6xl">
            {credits.map((credit) => (
              <CreditRow key={`${credit.media_type}-${credit.id}`} credit={credit} status={statusOf(credit)} />
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  )
}

function Fact({ label, children }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-dim mb-0.5">{label}</dt>
      <dd className="text-fg">{children}</dd>
    </div>
  )
}

function CreditRow({ credit, status }) {
  const poster = img(credit.poster_path, 'w92')
  const detail = [
    credit.roles.slice(0, 3).join(', '),
    credit.media_type === 'tv' && credit.episode_count > 0 ? plural(credit.episode_count, 'episode') : null,
  ].filter(Boolean)

  return (
    <li className="border-b border-line/60">
      <Link to={titlePath(credit)} className="group flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-panel transition-colors">
        <span className="w-10 text-sm font-bold text-dim tabular-nums flex-shrink-0">{year(credit.date) || 'TBA'}</span>
        <span className="w-9 h-[54px] rounded overflow-hidden bg-raised flex-shrink-0">
          {poster && <img src={poster} alt="" loading="lazy" className="w-full h-full object-cover" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold truncate group-hover:text-accent transition-colors">{credit.title}</span>
          <span className="block text-xs text-muted truncate">
            <span className="text-dim">{credit.media_type === 'tv' ? 'TV' : 'Film'}</span>
            {detail.length > 0 && `  ·  ${detail.join('  ·  ')}`}
          </span>
        </span>
        {status && <TrackedMark status={status} />}
      </Link>
    </li>
  )
}
