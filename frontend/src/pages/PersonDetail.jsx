import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { tmdbAPI } from '../api/client'

function CreditCard({ credit, to }) {
  const title      = credit.title || credit.name
  const year       = (credit.release_date || credit.first_air_date || '').split('-')[0]
  const posterUrl  = credit.poster_path
    ? `https://image.tmdb.org/t/p/w342${credit.poster_path}`
    : null

  return (
    <Link to={to} className="block group/card relative" style={{ zIndex: 'auto' }}>
      <div
        className="relative transition-transform duration-200 ease-out group-hover/card:scale-[1.1] group-hover/card:z-30"
        style={{ transformOrigin: 'top center' }}
      >
        {/* Poster */}
        <div className="aspect-[2/3] rounded overflow-hidden bg-[#1f1f1f]">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-2">
              <span className="text-[#555] text-xs text-center leading-tight">{title}</span>
            </div>
          )}
        </div>

        {/* Hover panel */}
        <div
          className="absolute left-0 right-0 bg-[#1f1f1f] rounded-b px-2 pt-2 pb-2.5 shadow-2xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-150"
          style={{ top: '100%' }}
        >
          <p className="text-white text-xs font-semibold leading-tight line-clamp-2 mb-1">{title}</p>
          <div className="flex items-center gap-1 flex-wrap">
            {year && <span className="text-[#999] text-[10px]">{year}</span>}
            {credit.character && (
              <span className="text-[#bbb] text-[10px] truncate">as {credit.character}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

function PersonDetail() {
  const { id } = useParams()
  const [person,      setPerson]      = useState(null)
  const [activeTab,   setActiveTab]   = useState('movies')
  const [bioExpanded, setBioExpanded] = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  useEffect(() => {
    async function fetchPersonData() {
      try {
        setLoading(true)
        const data = await tmdbAPI.getPersonDetail(id)
        setPerson(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchPersonData()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-400">Loading…</p>
      </div>
    )
  }

  if (error || !person) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">Error: {error || 'Person not found'}</p>
      </div>
    )
  }

  const profileUrl   = person.profile_path
    ? `https://image.tmdb.org/t/p/w500${person.profile_path}`
    : null

  const movieCredits = (person.movie_credits || []).filter(c => c.poster_path || c.title)
  const tvCredits    = (person.tv_credits    || []).filter(c => c.poster_path || c.name)

  const bio         = person.biography || ''
  const bioLimit    = 600
  const bioTruncated = bio.length > bioLimit && !bioExpanded
    ? bio.slice(0, bioLimit).trimEnd() + '…'
    : bio

  const birthday = person.birthday
    ? new Date(person.birthday).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="relative min-h-screen bg-[#141414]">
      <div className="relative z-10">

        {/* ── Two-column header ─────────────────────────── */}
        <div className="pt-32 md:pt-28 pb-10 px-8 md:px-12">
          <div className="flex gap-8 md:gap-10 max-w-screen-xl mx-auto">

            {/* Profile photo */}
            <div className="flex-shrink-0 w-20 md:w-52">
              {profileUrl ? (
                <img
                  src={profileUrl}
                  alt={person.name}
                  className="w-full rounded shadow-2xl"
                />
              ) : (
                <div className="w-full aspect-[2/3] rounded bg-[#1f1f1f] flex items-center justify-center">
                  <span className="text-[#555] text-sm">No photo</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-2">
              <h1 className="text-2xl md:text-5xl font-bold text-white leading-tight mb-4">
                {person.name}
              </h1>

              {/* Meta */}
              <div className="space-y-1.5 mb-6 text-sm">
                {person.known_for_department && (
                  <p>
                    <span className="text-[#aaa]">Known for </span>
                    <span className="text-white">{person.known_for_department}</span>
                  </p>
                )}
                {birthday && (
                  <p>
                    <span className="text-[#aaa]">Born </span>
                    <span className="text-white">{birthday}</span>
                    {person.place_of_birth && (
                      <span className="text-[#aaa]"> in {person.place_of_birth}</span>
                    )}
                  </p>
                )}
              </div>

              {/* Biography */}
              {bio && (
                <div className="max-w-2xl">
                  <h3 className="text-white text-sm font-semibold mb-2">Biography</h3>
                  <p className="text-[#ccc] text-sm leading-relaxed whitespace-pre-line">
                    {bioTruncated}
                  </p>
                  {bio.length > bioLimit && (
                    <button
                      onClick={() => setBioExpanded(!bioExpanded)}
                      className="text-[#aaa] text-xs mt-2 hover:text-white transition-colors"
                    >
                      {bioExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Filmography ───────────────────────────────── */}
        <div className="px-8 md:px-12 pb-16">

          {/* Tabs */}
          <div className="flex border-b border-[#333] mb-6">
            <button
              onClick={() => setActiveTab('movies')}
              className={`nf-tab ${activeTab === 'movies' ? 'nf-tab-active' : ''}`}
            >
              Films ({movieCredits.length})
            </button>
            <button
              onClick={() => setActiveTab('tv')}
              className={`nf-tab ${activeTab === 'tv' ? 'nf-tab-active' : ''}`}
            >
              TV ({tvCredits.length})
            </button>
          </div>

          {/* Film grid */}
          {activeTab === 'movies' && (
            movieCredits.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-4 pb-40">
                {movieCredits.map(credit => (
                  <CreditCard key={credit.id} credit={credit} to={`/movie/${credit.id}`} />
                ))}
              </div>
            ) : (
              <p className="text-[#555] text-sm py-8">No film credits available</p>
            )
          )}

          {/* TV grid */}
          {activeTab === 'tv' && (
            tvCredits.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-4 pb-40">
                {tvCredits.map(credit => (
                  <CreditCard key={credit.id} credit={credit} to={`/tv/${credit.id}`} />
                ))}
              </div>
            ) : (
              <p className="text-[#555] text-sm py-8">No TV credits available</p>
            )
          )}
        </div>

      </div>
    </div>
  )
}

export default PersonDetail
