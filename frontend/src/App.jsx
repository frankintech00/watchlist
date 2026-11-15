import { useEffect } from 'react'
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { UserProvider, useUser } from './context/UserContext'
import Header from './components/Header'
import TVHome from './pages/TVHome'
import Films from './pages/Films'
import ShowDetail from './pages/ShowDetail'
import FilmDetail from './pages/FilmDetail'
import Person from './pages/Person'
import Search from './pages/Search'
import ProfileScreen from './pages/ProfileScreen'

/** Start each page at the top (search refines in place, so it is left alone). */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function AppContent() {
  const { currentUser, loading } = useUser()

  if (loading) return <div className="min-h-screen" />
  if (!currentUser) return <ProfileScreen />

  return (
    // Keyed by profile so switching user reloads every page's data
    <div key={currentUser.id} className="min-h-screen">
      <ScrollToTop />
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<TVHome />} />
          <Route path="/films" element={<Films />} />
          <Route path="/tv/:id" element={<ShowDetail />} />
          <Route path="/movie/:id" element={<FilmDetail />} />
          <Route path="/person/:id" element={<Person />} />
          <Route path="/search" element={<Search />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <UserProvider>
        <AppContent />
      </UserProvider>
    </Router>
  )
}
