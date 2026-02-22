import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SearchOverlay from '../search/SearchOverlay'
import { useUser } from '../../context/UserContext'
import ProfileAvatar from '../common/ProfileAvatar'

function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [headerHeight, setHeaderHeight] = useState(64)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const inputRef = useRef(null)
  const headerRef = useRef(null)
  const profileMenuRef = useRef(null)
  const location = useLocation()
  const { currentUser, clearUser } = useUser()

  // Solid background on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Measure header height so the overlay can anchor directly below it.
  useEffect(() => {
    const update = () => {
      if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Close search and profile menu on route change
  useEffect(() => {
    closeSearch()
    setProfileMenuOpen(false)
  }, [location.pathname])

  // ESC to close search or profile menu
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        closeSearch()
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Click outside profile menu to close it
  useEffect(() => {
    const onClick = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false)
      }
    }
    if (profileMenuOpen) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [profileMenuOpen])

  // Focus desktop input when search opens
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

  function handleSwitchProfile() {
    setProfileMenuOpen(false)
    clearUser()
  }

  return (
    <>
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-50 transition-colors duration-300"
        style={{ background: scrolled ? '#141414' : 'transparent' }}
      >
        {/* ── Row 1: Logo + Nav + Search toggle (desktop) + Profile ── */}
        <div className="flex items-center h-16 px-4 md:px-12">
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

          <div className="ml-auto flex items-center gap-3">
            {/* Search toggle — desktop only */}
            <div className="hidden md:flex items-center">
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

            {/* Profile avatar + dropdown — visible on all breakpoints */}
            {currentUser && (
              <div className="relative mr-2 md:mr-0" ref={profileMenuRef}>
                <button
                  onClick={() => setProfileMenuOpen((o) => !o)}
                  className="rounded-md ring-offset-1 ring-offset-transparent hover:ring-2 hover:ring-white/60 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-white/60"
                  aria-label="Profile menu"
                >
                  <ProfileAvatar user={currentUser} size="sm" />
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
                      <ProfileAvatar user={currentUser} size="sm" />
                      <span className="text-white text-sm font-medium truncate">{currentUser.name}</span>
                    </div>
                    <button
                      onClick={handleSwitchProfile}
                      className="w-full text-left px-4 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors duration-150"
                    >
                      Switch Profile
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Row 2: Full-width search bar — mobile only ── */}
        <div className="md:hidden px-4 pb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search titles, people, genres"
            className="w-full bg-black/80 border border-white/40 text-white text-sm px-3 py-1.5 rounded focus:outline-none focus:border-white placeholder-white/40"
          />
        </div>
      </header>

      {/* Search overlay — anchored directly below the header (height varies by breakpoint) */}
      {showResults && (
        <SearchOverlay
          query={searchQuery}
          onResultClick={handleResultClick}
          onClose={closeSearch}
          topOffset={headerHeight}
        />
      )}
    </>
  )
}

export default Header
