import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { UserProvider, useUser } from './context/UserContext'
import Header from './components/layout/Header'
import Home from './pages/Home'
import MovieDetailPage from './pages/MovieDetailPage'
import TVShowDetail from './pages/TVShowDetail'
import PersonDetail from './pages/PersonDetail'
import Library from './pages/Library'
import ProfileScreen from './pages/ProfileScreen'

function AppContent() {
  const { currentUser, loading } = useUser()

  if (loading) {
    return <div className="min-h-screen bg-[#141414]" />
  }

  if (!currentUser) {
    return <ProfileScreen />
  }

  return (
    <div className="min-h-screen bg-dark text-white">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movie/:id" element={<MovieDetailPage />} />
          <Route path="/tv/:id" element={<TVShowDetail />} />
          <Route path="/person/:id" element={<PersonDetail />} />
          <Route path="/library" element={<Library />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <Router>
      <UserProvider>
        <AppContent />
      </UserProvider>
    </Router>
  )
}

export default App
