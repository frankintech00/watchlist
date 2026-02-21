import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Header from './components/layout/Header'
import Home from './pages/Home'
import MovieDetailPage from './pages/MovieDetailPage'
import TVShowDetail from './pages/TVShowDetail'
import PersonDetail from './pages/PersonDetail'
import Library from './pages/Library'

function App() {
  return (
    <Router>
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
    </Router>
  )
}

export default App
