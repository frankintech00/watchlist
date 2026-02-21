import { useEffect, useState } from 'react'
import { trackingAPI, tmdbAPI } from '../api/client'
import FilterTabs from '../components/library/FilterTabs'
import LibraryGrid from '../components/library/LibraryGrid'

function Library() {
  const [mediaType, setMediaType]     = useState('all')
  const [movies, setMovies]           = useState([])
  const [shows, setShows]             = useState([])
  const [activeFilter, setActiveFilter] = useState('watching')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    async function fetchLibraryData() {
      try {
        setLoading(true)
        const [moviesData, showsData] = await Promise.all([
          trackingAPI.getAll().catch(() => []),
          trackingAPI.shows.getAll().catch(() => [])
        ])

        const moviesWithDetails = await Promise.all(
          moviesData.map(async (movie) => {
            try {
              const tmdbData = await tmdbAPI.getMovieDetail(movie.tmdb_movie_id)
              return { ...movie, ...tmdbData, media_type: 'movie' }
            } catch { return { ...movie, media_type: 'movie' } }
          })
        )

        const showsWithDetails = await Promise.all(
          showsData.map(async (show) => {
            try {
              const tmdbData = await tmdbAPI.getTVShowDetail(show.tmdb_show_id)
              return { ...show, ...tmdbData, media_type: 'tv' }
            } catch { return { ...show, media_type: 'tv' } }
          })
        )

        setMovies(moviesWithDetails)
        setShows(showsWithDetails)
      } catch (err) {
        console.error('Error fetching library:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchLibraryData()
  }, [])

  const getFilteredItems = () => {
    let items = mediaType === 'films' ? movies : mediaType === 'tv' ? shows : [...movies, ...shows]

    if (activeFilter === 'watched') {
      items = items.filter(item =>
        item.media_type === 'movie' ? item.watched
          : item.watched_episodes > 0 && item.watched_episodes === item.total_episodes
      )
    } else if (activeFilter === 'unwatched') {
      items = items.filter(item =>
        item.media_type === 'movie' ? !item.watched : item.watched_episodes === 0
      )
    } else if (activeFilter === 'favourited') {
      items = items.filter(item => item.favourited)
    } else if (activeFilter === 'watching') {
      items = items.filter(item =>
        item.media_type === 'tv' &&
        item.watched_episodes > 0 &&
        item.watched_episodes < (item.total_episodes || Infinity)
      )
    } else if (activeFilter === 'to-watch') {
      items = items.filter(item =>
        item.media_type === 'movie'
          ? item.favourited && !item.watched
          : item.favourited && !(item.watched_episodes >= item.total_episodes && item.total_episodes > 0)
      )
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(item => (item.title || item.name || '').toLowerCase().includes(q))
    }

    return items
  }

  const filteredItems = getFilteredItems()

  if (loading) {
    return (
      <div className="pt-16 flex items-center justify-center h-screen bg-[#141414]">
        <p className="text-[#999] text-sm">Loading library…</p>
      </div>
    )
  }

  const mediaTypes = [
    { id: 'all',   label: `My Library (${movies.length + shows.length})` },
    { id: 'films', label: `Films (${movies.length})` },
    { id: 'tv',    label: `TV Shows (${shows.length})` },
  ]

  return (
    <div className="min-h-screen bg-[#141414] pt-32 md:pt-24 pb-16 px-8 md:px-12">
      <h1 className="text-3xl font-bold text-white mb-8">Your Library</h1>

      {/* Media type selector */}
      <div className="flex gap-6 mb-1 border-b border-[#2a2a2a]">
        {mediaTypes.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => {
              setMediaType(id)
              if (id === 'films' && activeFilter === 'watching') setActiveFilter('to-watch')
            }}
            className={`pb-3 text-sm font-semibold transition-colors duration-150 border-b-2 -mb-px ${
              mediaType === id
                ? 'text-white border-primary'
                : 'text-[#999] border-transparent hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Status filter tabs */}
      <FilterTabs activeFilter={activeFilter} onFilterChange={setActiveFilter} mediaType={mediaType} />

      {/* Search */}
      <div className="mb-8">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search your library…"
          className="nf-input w-full max-w-sm"
        />
      </div>

      {/* Grid */}
      <LibraryGrid items={filteredItems} />
    </div>
  )
}

export default Library
