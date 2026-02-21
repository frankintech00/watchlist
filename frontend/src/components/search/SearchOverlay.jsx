import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { tmdbAPI } from '../../api/client'

function SearchOverlay({ query, onResultClick, onClose }) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const debounceTimer = useRef(null)

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    if (!query || query.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    debounceTimer.current = setTimeout(async () => {
      try {
        const data = await tmdbAPI.searchMulti(query.trim())
        setResults(data.results || [])
      } catch (err) {
        setError(err.message)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current) }
  }, [query])

  function handleResultClick(result) {
    const { media_type, id } = result
    if (media_type === 'movie') navigate(`/movie/${id}`)
    else if (media_type === 'tv') navigate(`/tv/${id}`)
    else if (media_type === 'person') navigate(`/person/${id}`)
    if (onResultClick) onResultClick()
  }

  const getTitle  = (r) => r.title || r.name || 'Unknown'
  const getYear   = (r) => { const d = r.release_date || r.first_air_date; return d ? d.split('-')[0] : '' }
  const getImage  = (r) => r.media_type === 'person' ? r.profile_path : r.poster_path
  const typeLabel = (t) => ({ movie: 'FILM', tv: 'TV', person: 'PERSON' }[t] || t?.toUpperCase())

  return (
    /* Backdrop — clicking it closes the overlay */
    <div
      className="fixed top-16 inset-x-0 bottom-0 z-40 bg-[#141414]/95 overflow-y-auto scrollbar-hide"
      onClick={onClose}
    >
      {/* Grid container — stop click propagation so clicking a card doesn't close */}
      <div
        className="px-8 md:px-12 py-8"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && (
          <p className="text-[#999] text-sm animate-pulse">Searching…</p>
        )}

        {error && (
          <p className="text-red-500 text-sm">Error: {error}</p>
        )}

        {!loading && !error && results.length === 0 && query.trim().length >= 2 && (
          <p className="text-[#999] text-sm">No results for "{query}"</p>
        )}

        {!loading && !error && results.length > 0 && (
          <>
            <p className="text-[#999] text-xs mb-6 uppercase tracking-widest">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
              {results.slice(0, 20).map((result) => {
                const imagePath = getImage(result)
                const imageUrl = imagePath
                  ? `https://image.tmdb.org/t/p/w185${imagePath}`
                  : null

                return (
                  <div
                    key={`${result.media_type}-${result.id}`}
                    onClick={() => handleResultClick(result)}
                    className="cursor-pointer group"
                  >
                    {/* Poster */}
                    <div className="aspect-[2/3] rounded overflow-hidden bg-[#1f1f1f] mb-2 transition-transform duration-150 group-hover:scale-105">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={getTitle(result)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-[#444] text-xs text-center px-2">{getTitle(result)}</span>
                        </div>
                      )}
                    </div>

                    {/* Info below card */}
                    <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-white mb-1">
                      {typeLabel(result.media_type)}
                    </span>
                    <p className="text-white text-xs font-medium leading-tight line-clamp-2">
                      {getTitle(result)}
                    </p>
                    {getYear(result) && (
                      <p className="text-[#999] text-xs mt-0.5">{getYear(result)}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default SearchOverlay
