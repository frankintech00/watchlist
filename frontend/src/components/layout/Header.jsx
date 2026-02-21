import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SearchOverlay from '../search/SearchOverlay'

function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const inputRef = useRef(null)
  const location = useLocation()

  // Solid background on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close search on route change
  useEffect(() => {
    closeSearch()
  }, [location.pathname])

  // ESC to close search
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeSearch() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Focus input when search opens
  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [searchOpen])

  function openSearch() {
    setSearchOpen(true)
  }

  function closeSearch() {
    setSearchOpen(false)
    setSearchQuery('')
    setShowResults(false)
  }

  function handleSearchChange(e) {
    const value = e.target.value
    setSearchQuery(value)
    setShowResults(value.trim().length >= 2)
  }

  function handleResultClick() {
    closeSearch()
  }

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-colors duration-300"
        style={{ background: scrolled ? '#141414' : 'transparent' }}
      >
        <div className="flex items-center h-16 px-8 md:px-12">
          {/* Logo */}
          <Link to="/" className="font-logo text-2xl tracking-widest text-white flex-shrink-0">
            WATCHLIST
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-6 ml-8">
            <Link
              to="/"
              className="text-sm text-white/70 hover:text-white transition-colors duration-150"
            >
              Home
            </Link>
            <Link
              to="/library"
              className="text-sm text-white/70 hover:text-white transition-colors duration-150"
            >
              Library
            </Link>
          </nav>

          {/* Search — far right */}
          <div className="ml-auto flex items-center">
            {searchOpen ? (
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Titles, people, genres"
                  className="w-56 md:w-72 bg-black/80 border border-white/40 text-white text-sm px-3 py-1.5 rounded focus:outline-none focus:border-white placeholder-white/40 transition-all duration-200"
                />
                <button
                  onClick={closeSearch}
                  className="text-white/70 hover:text-white transition-colors duration-150 p-1"
                  aria-label="Close search"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={openSearch}
                className="text-white/70 hover:text-white transition-colors duration-150 p-1"
                aria-label="Open search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Full-page search overlay — rendered outside header so backdrop-filter doesn't confine it */}
      {searchOpen && showResults && (
        <SearchOverlay
          query={searchQuery}
          onResultClick={handleResultClick}
          onClose={closeSearch}
        />
      )}
    </>
  )
}

export default Header
