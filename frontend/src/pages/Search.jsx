import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { tmdbAPI, trackingAPI } from '../api/client'
import Icon from '../components/Icon'
import PosterCard, { Badge } from '../components/PosterCard'
import { ErrorMessage } from '../components/States'
import { img, year } from '../lib/format'

const TABS = [
  { id: 'multi', label: 'Everything' },
  { id: 'tv', label: 'TV' },
  { id: 'movie', label: 'Films' },
  { id: 'person', label: 'People' },
]

const GRID = 'grid gap-x-3 gap-y-6 sm:gap-x-4 grid-cols-[repeat(auto-fill,minmax(112px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(148px,1fr))]'
const PEOPLE_GRID = 'grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'

/** Search shows, films and people. The query lives in the URL (?q=…&type=…). */
export default function Search() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || ''
  const type = TABS.some((t) => t.id === params.get('type')) ? params.get('type') : 'multi'

  const [text, setText] = useState(query)
  const [results, setResults] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [trending, setTrending] = useState([])
  const [tracked, setTracked] = useState({ tv: {}, movie: {} })
  const input = useRef(null)

  useEffect(() => {
    document.title = 'Search · Watchlist'
    input.current?.focus()
    tmdbAPI.trendingPeople().then((d) => setTrending(d.results || [])).catch(() => {})
    trackingAPI.ids().then(setTracked).catch(() => {})
    return () => { document.title = 'Watchlist' }
  }, [])

  // Typing updates the URL after a short pause
  useEffect(() => {
    if (text.trim() === query) return
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params)
      if (text.trim()) next.set('q', text.trim())
      else next.delete('q')
      setParams(next, { replace: true })
    }, 300)
    return () => clearTimeout(timer)
  }, [text, query, params, setParams])

  // The URL drives the search
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setTotalPages(0)
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    tmdbAPI.search(query, type, 1)
      .then((data) => {
        if (cancelled) return
        setResults(data.results)
        setPage(1)
        setTotalPages(data.total_pages)
      })
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [query, type])

  const loadMore = async () => {
    setLoading(true)
    try {
      const data = await tmdbAPI.search(query, type, page + 1)
      setResults((current) => {
        const seen = new Set(current.map((r) => `${r.media_type}-${r.id}`))
        return [...current, ...data.results.filter((r) => !seen.has(`${r.media_type}-${r.id}`))]
      })
      setPage(page + 1)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  const setType = (next) => {
    const updated = new URLSearchParams(params)
    if (next === 'multi') updated.delete('type')
    else updated.set('type', next)
    setParams(updated, { replace: true })
  }

  const people = results.filter((r) => r.media_type === 'person')
  const titles = results.filter((r) => r.media_type !== 'person')
  const peopleFirst = results[0]?.media_type === 'person'
  const searching = query.length >= 2

  const titleGrid = titles.length > 0 && (
    <section key="titles" className="mb-10">
      {type === 'multi' && <h2 className="section-title mb-3.5">Shows &amp; films</h2>}
      <div className={GRID}>
        {titles.map((item) => (
          <PosterCard
            key={`${item.media_type}-${item.id}`}
            to={`/${item.media_type === 'movie' ? 'movie' : 'tv'}/${item.id}`}
            title={item.title || item.name}
            poster={item.poster_path}
            subtitle={year(item.release_date || item.first_air_date)}
            badge={type === 'multi' ? <Badge tone="dark">{item.media_type === 'movie' ? 'Film' : 'TV'}</Badge> : null}
            status={tracked[item.media_type]?.[item.id]}
          />
        ))}
      </div>
    </section>
  )

  const peopleGrid = people.length > 0 && (
    <section key="people" className="mb-10">
      {type === 'multi' && <h2 className="section-title mb-3.5">People</h2>}
      <div className={PEOPLE_GRID}>
        {people.map((person) => <PersonResult key={person.id} person={person} />)}
      </div>
    </section>
  )

  return (
    <div className="max-w-page mx-auto gutter pt-20 sm:pt-28 pb-16">
      <div className="max-w-3xl mb-5">
        <label className="relative block">
          <Icon name="search" className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
          <input
            ref={input}
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search shows, films and people"
            aria-label="Search shows, films and people"
            autoComplete="off"
            enterKeyHint="search"
            className="input h-14 pl-12 pr-12 text-lg rounded-2xl [&::-webkit-search-cancel-button]:hidden"
          />
          {text && (
            <button
              onClick={() => { setText(''); input.current?.focus() }}
              className="icon-btn absolute right-2.5 top-1/2 -translate-y-1/2"
              aria-label="Clear search"
            >
              <Icon name="close" className="w-4 h-4" strokeWidth={2.5} />
            </button>
          )}
        </label>
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Result type">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={type === tab.id}
            onClick={() => setType(tab.id)}
            className={`chip ${type === tab.id ? 'chip-on' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <ErrorMessage title="Search failed" error={error} />}

      {searching && !error && (
        <>
          {peopleFirst ? [peopleGrid, titleGrid] : [titleGrid, peopleGrid]}

          {loading && results.length === 0 && <p className="text-sm text-muted" role="status">Searching…</p>}
          {!loading && results.length === 0 && (
            <p className="text-sm text-muted">Nothing found for “{query}”. Check the spelling or try fewer words.</p>
          )}
          {results.length > 0 && page < totalPages && (
            <button onClick={loadMore} disabled={loading} className="btn-outline">
              {loading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}

      {/* Nothing typed yet — something to browse */}
      {!searching && trending.length > 0 && (
        <section>
          <h2 className="section-title mb-1">Trending people</h2>
          <p className="text-sm text-muted mb-4">Popular this week — open anyone to see their full filmography.</p>
          <div className={PEOPLE_GRID}>
            {trending.slice(0, 18).map((person) => <PersonResult key={person.id} person={person} />)}
          </div>
        </section>
      )}
    </div>
  )
}

function PersonResult({ person }) {
  const photo = img(person.profile_path, 'w185')
  const knownFor = (person.known_for || []).map((k) => k.title || k.name).filter(Boolean).slice(0, 3)

  return (
    <Link to={`/person/${person.id}`} className="group card flex items-center gap-4 p-3 hover:border-accent transition-colors">
      <span className="w-16 h-16 rounded-full overflow-hidden bg-raised flex-shrink-0">
        {photo ? (
          <img src={photo} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-xl font-bold text-dim">{person.name?.[0]}</span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block font-bold truncate group-hover:text-accent transition-colors">{person.name}</span>
        {person.known_for_department && <span className="block text-xs text-dim font-bold uppercase tracking-wider">{person.known_for_department}</span>}
        {knownFor.length > 0 && <span className="block text-xs text-muted truncate mt-0.5">{knownFor.join(', ')}</span>}
      </span>
    </Link>
  )
}
