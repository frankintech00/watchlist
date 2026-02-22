/**
 * Central API client for Watchlist application
 * Handles all HTTP requests with consistent error handling
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// === ACTIVE USER ===
let _activeUserId = null

export function setActiveUser(id) {
  _activeUserId = id
}

export function getActiveUser() {
  return _activeUserId
}

class APIError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'APIError'
    this.status = status
    this.data = data
  }
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    // Handle non-JSON responses or empty responses
    const contentType = response.headers.get('content-type')
    let data = null

    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    }

    if (!response.ok) {
      throw new APIError(
        data?.detail || `API request failed: ${response.statusText}`,
        response.status,
        data
      )
    }

    return data
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    throw new APIError('Network error: Failed to connect to API', 0, null)
  }
}

// === TMDB ENDPOINTS ===

export const tmdbAPI = {
  searchMovies: (query, page = 1) =>
    fetchAPI(`/tmdb/search?query=${encodeURIComponent(query)}&page=${page}`),

  searchMulti: (query, page = 1) =>
    fetchAPI(`/tmdb/search/multi?query=${encodeURIComponent(query)}&page=${page}`),

  getMovieDetail: (movieId) =>
    fetchAPI(`/tmdb/movie/${movieId}`),

  getTVShowDetail: (showId) =>
    fetchAPI(`/tmdb/tv/${showId}`),

  getTVSeasonDetail: (showId, seasonNumber) =>
    fetchAPI(`/tmdb/tv/${showId}/season/${seasonNumber}`),

  getMovieCredits: (movieId) =>
    fetchAPI(`/tmdb/movie/${movieId}/credits`),

  getUpcomingMovies: (page = 1) =>
    fetchAPI(`/tmdb/movie/upcoming?page=${page}`),

  getSimilarMovies: (movieId, page = 1) =>
    fetchAPI(`/tmdb/movie/${movieId}/similar?page=${page}`),

  getUpcomingTVShows: (page = 1) =>
    fetchAPI(`/tmdb/tv/upcoming?page=${page}`),

  getSimilarTVShows: (showId, page = 1) =>
    fetchAPI(`/tmdb/tv/${showId}/similar?page=${page}`),

  getPersonDetail: (personId) =>
    fetchAPI(`/tmdb/person/${personId}`),

  getMovieReviews: (movieId, page = 1) =>
    fetchAPI(`/tmdb/movie/${movieId}/reviews?page=${page}`),

  getTVShowReviews: (showId, page = 1) =>
    fetchAPI(`/tmdb/tv/${showId}/reviews?page=${page}`),
}

// === USERS ENDPOINTS ===

export const usersAPI = {
  getAll: () =>
    fetchAPI('/users/'),

  create: ({ name }) =>
    fetchAPI('/users/', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  delete: (userId) =>
    fetchAPI(`/users/${userId}`, {
      method: 'DELETE',
    }),

  uploadAvatar: async (userId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${API_BASE_URL}/users/${userId}/avatar`, {
      method: 'POST',
      body: formData,
    })
    const contentType = response.headers.get('content-type')
    let data = null
    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    }
    if (!response.ok) {
      throw new APIError(
        data?.detail || `Avatar upload failed: ${response.statusText}`,
        response.status,
        data
      )
    }
    return data
  },
}

// === TRACKING ENDPOINTS ===

export const trackingAPI = {
  // Films
  getAll: (filters = {}) => {
    const params = new URLSearchParams({ user_id: _activeUserId, ...filters }).toString()
    return fetchAPI(`/tracking/?${params}`)
  },

  getById: (tmdbId) =>
    fetchAPI(`/tracking/${tmdbId}?user_id=${_activeUserId}`),

  track: (tmdbId, data) =>
    fetchAPI(`/tracking/${tmdbId}?user_id=${_activeUserId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (tmdbId, data) =>
    fetchAPI(`/tracking/${tmdbId}?user_id=${_activeUserId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (tmdbId) =>
    fetchAPI(`/tracking/${tmdbId}?user_id=${_activeUserId}`, {
      method: 'DELETE',
    }),

  getRecommendations: () =>
    fetchAPI(`/tracking/recommendations?user_id=${_activeUserId}`),

  getStats: () =>
    fetchAPI(`/tracking/stats?user_id=${_activeUserId}`),

  // TV Shows
  shows: {
    getAll: (filters = {}) => {
      const params = new URLSearchParams({ user_id: _activeUserId, ...filters }).toString()
      return fetchAPI(`/tracking/shows?${params}`)
    },

    getById: (tmdbId) =>
      fetchAPI(`/tracking/shows/${tmdbId}?user_id=${_activeUserId}`),

    track: (tmdbId, data) =>
      fetchAPI(`/tracking/shows/${tmdbId}?user_id=${_activeUserId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (tmdbId, data) =>
      fetchAPI(`/tracking/shows/${tmdbId}?user_id=${_activeUserId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (tmdbId) =>
      fetchAPI(`/tracking/shows/${tmdbId}?user_id=${_activeUserId}`, {
        method: 'DELETE',
      }),

    getEpisodes: (tmdbId) =>
      fetchAPI(`/tracking/shows/${tmdbId}/episodes?user_id=${_activeUserId}`),

    markEpisodes: (tmdbId, episodes) =>
      fetchAPI(`/tracking/shows/${tmdbId}/episodes?user_id=${_activeUserId}`, {
        method: 'POST',
        body: JSON.stringify({ episodes }),
      }),

    markSeason: (tmdbId, seasonNumber, watched) =>
      fetchAPI(`/tracking/shows/${tmdbId}/season/${seasonNumber}/mark-watched?watched=${watched}&user_id=${_activeUserId}`, {
        method: 'POST',
      }),

    getProgress: (tmdbId) =>
      fetchAPI(`/tracking/shows/${tmdbId}/progress?user_id=${_activeUserId}`),
  },
}

export { APIError }
