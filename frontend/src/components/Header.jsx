import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import ProfileAvatar from './ProfileAvatar'
import Icon, { Logo } from './Icon'

const NAV = [
  { to: '/', label: 'TV', match: (path) => path === '/' || path.startsWith('/tv') },
  { to: '/films', label: 'Films', match: (path) => path.startsWith('/films') || path.startsWith('/movie') },
]

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { currentUser, clearUser } = useUser()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setMenuOpen(false), [pathname])

  // Close the profile menu on outside click / Escape; "/" jumps to search
  useEffect(() => {
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        navigate('/search')
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [navigate])

  const onSearch = pathname.startsWith('/search')

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
        scrolled ? 'bg-ink/90 backdrop-blur-md border-b border-line/70' : 'bg-gradient-to-b from-ink/80 to-transparent'
      }`}
    >
      <div className="gutter flex items-center h-14 sm:h-16 gap-2 sm:gap-6 max-w-page mx-auto">
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0" aria-label="Watchlist home">
          <Logo className="w-8 h-8" />
          <span className="hidden sm:block text-lg font-bold tracking-tight">Watchlist</span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Main">
          {NAV.map(({ to, label, match }) => {
            const active = match(pathname)
            return (
              <NavLink
                key={to}
                to={to}
                className={`px-3.5 sm:px-4 h-9 inline-flex items-center rounded-full text-sm font-bold transition-colors duration-150 ${
                  active ? 'bg-fg text-ink' : 'text-muted hover:text-fg hover:bg-white/10'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {label}
              </NavLink>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Search — a full field on desktop, an icon on phones */}
          <Link
            to="/search"
            className={`hidden md:flex items-center gap-2.5 h-9 w-64 lg:w-80 px-3.5 rounded-full text-sm border transition-colors duration-150 ${
              onSearch ? 'border-accent text-fg bg-raised' : 'border-line text-dim bg-ink/50 hover:border-dim hover:text-muted'
            }`}
          >
            <Icon name="search" className="w-4 h-4" />
            <span className="flex-1">Search shows, films, people</span>
            <kbd className="text-[10px] font-bold border border-line rounded px-1.5 py-0.5">/</kbd>
          </Link>
          <Link to="/search" className={`md:hidden icon-btn ${onSearch ? 'text-accent' : ''}`} aria-label="Search">
            <Icon name="search" />
          </Link>

          {currentUser && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((open) => !open)}
                className="block rounded-full ring-2 ring-transparent hover:ring-accent transition"
                aria-label="Profile menu"
                aria-expanded={menuOpen}
              >
                <ProfileAvatar user={currentUser} size="sm" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 card shadow-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-line flex items-center gap-3">
                    <ProfileAvatar user={currentUser} size="sm" />
                    <span className="text-sm font-bold truncate">{currentUser.name}</span>
                  </div>
                  <button
                    onClick={clearUser}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-muted hover:text-fg hover:bg-raised transition-colors"
                  >
                    <Icon name="swap" className="w-4 h-4" />
                    Switch profile
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
