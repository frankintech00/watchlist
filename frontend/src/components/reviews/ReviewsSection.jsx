import { useState, useEffect } from 'react'
import { tmdbAPI } from '../../api/client'
import ScrollableRow from '../common/ScrollableRow'

function ReviewsSection({ movieId, showId, type }) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchReviews() {
      if (!movieId && !showId) return

      try {
        setLoading(true)
        const data = type === 'movie'
          ? await tmdbAPI.getMovieReviews(movieId)
          : await tmdbAPI.getTVShowReviews(showId)

        // Transform TMDB reviews to our format
        const transformedReviews = (data.results || []).slice(0, 10).map(review => {
          const authorName = review.author_details?.name || review.author || 'Anonymous'
          const avatarPath = review.author_details?.avatar_path
          const initial = authorName.charAt(0).toUpperCase()

          // Generate a consistent color based on the initial
          const colors = ['#ec4899', '#f97316', '#14b8a6', '#8b5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444']
          const colorIndex = initial.charCodeAt(0) % colors.length

          return {
            id: review.id,
            user: {
              name: authorName,
              avatar: avatarPath ? `https://image.tmdb.org/t/p/w45${avatarPath}` : null,
              initial: initial,
              color: colors[colorIndex]
            },
            rating: review.author_details?.rating ? review.author_details.rating / 2 : 0, // Convert 10-point to 5-point
            date: new Date(review.created_at).toLocaleDateString('en-US', {
              month: 'long',
              day: '2-digit',
              year: 'numeric'
            }),
            text: review.content,
            likes: 0,
            comments: 0,
            reactions: []
          }
        })

        setReviews(transformedReviews)
      } catch (error) {
        console.error('Error fetching reviews:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchReviews()
  }, [movieId, showId, type])

  if (loading) {
    return null
  }

  if (reviews.length === 0) {
    return null
  }

  const renderStars = (rating) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0

    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={`full-${i}`} className="text-white text-2xl">★</span>)
    }
    if (hasHalfStar) {
      stars.push(<span key="half" className="text-white text-2xl">⯨</span>)
    }
    for (let i = stars.length; i < 5; i++) {
      stars.push(<span key={`empty-${i}`} className="text-gray-600 text-2xl">★</span>)
    }
    return stars
  }

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-heading font-bold mb-6">Ratings & Reviews</h2>

      <ScrollableRow>
        <div className="flex gap-4 pb-4">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="flex-shrink-0 w-80 bg-dark-card rounded-lg p-6"
          >
            {/* Top Row - Avatar + Name + Date */}
            <div className="flex items-start gap-3 mb-4">
              {/* Avatar */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                style={{ backgroundColor: review.user.color }}
              >
                {review.user.initial}
              </div>

              {/* Name + Date */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">{review.user.name}</p>
                <p className="text-gray-500 text-xs">{review.date}</p>
              </div>
            </div>

            {/* Middle - Stars + Review Text */}
            <div className="mb-4">
              <div className="flex gap-0.5 mb-3">
                {renderStars(review.rating)}
              </div>

              {review.text && (
                <p className="text-white text-sm leading-relaxed line-clamp-3">
                  {review.text}
                </p>
              )}
            </div>

            {/* Bottom Row - Actions + Reactions */}
            <div className="flex items-center justify-between">
              {/* Left - Action Icons */}
              <div className="flex gap-3">
                <button className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                </button>
                <button className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </button>
              </div>

              {/* Right - Reaction Stack + Count */}
              <div className="flex items-center gap-2">
                {/* Reaction Stack */}
                <div className="flex -space-x-2">
                  {review.reactions.map((emoji, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full bg-dark-lighter flex items-center justify-center text-xs border-2 border-dark-card"
                    >
                      {emoji}
                    </div>
                  ))}
                </div>

                {/* Count */}
                <span className="text-white text-sm font-medium">{review.likes}</span>
              </div>
            </div>
          </div>
        ))}
        </div>
      </ScrollableRow>
    </div>
  )
}

export default ReviewsSection
