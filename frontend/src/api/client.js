/**
 * Central API client for Watchlist.
 * Every request goes through fetchAPI for consistent error handling.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// === ACTIVE USER ===
let _activeUserId = null

export function setActiveUser(id) {
  _activeUserId = id
}

export class APIError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'APIError'
    this.status = status
    this.data = data
  }
}

// The API is briefly unreachable while the backend container restarts (nginx answers
// 502/503/504). Reads are safe to repeat, so retry them quietly instead of showing an error.
const RETRY_DELAYS = [400, 1000, 2000, 3000]
const RETRY_STATUSES = new Set([502, 503, 504])
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchAPI(endpoint, options = {}) {
  const isRead = !options.method || options.method === 'GET'
  let response
  for (let attempt = 0; ; attempt++) {
    const canRetry = isRead && attempt < RETRY_DELAYS.length
    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: options.body instanceof FormData
          ? options.headers
          : { 'Content-Type': 'application/json', ...options.headers },
      })
    } catch (error) {
      if (canRetry) {
        await sleep(RETRY_DELAYS[attempt])
        continue
      }
      throw new APIError(`Network error: ${error.message || 'could not reach the server'}`, 0, null)
    }
    if (canRetry && RETRY_STATUSES.has(response.status)) {
      await sleep(RETRY_DELAYS[attempt])
      continue
    }
    break
  }

  const isJSON = (response.headers.get('content-type') || '').includes('application/json')
  const data = isJSON ? await response.json() : null

  if (!response.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : null
    const fallback = RETRY_STATUSES.has(response.status)
      ? 'The server is restarting — try again in a moment'
      : `Request failed (${response.status})`
    throw new APIError(detail || fallback, response.status, data)
  }
  return data
}

const json = (method, body) => ({ method, body: body === undefined ? undefined : JSON.stringify(body) })
const user = () => `user_id=${_activeUserId}`

// === TMDB (proxied) ===

export const tmdbAPI = {
  search: (query, type = 'multi', page = 1) =>
    fetchAPI(`/tmdb/search?query=${encodeURIComponent(query)}&type=${type}&page=${page}`),
  trendingPeople: () => fetchAPI('/tmdb/trending/people'),

  movie: (id) => fetchAPI(`/tmdb/movie/${id}`),
  movieReviews: (id) => fetchAPI(`/tmdb/movie/${id}/reviews`),

  show: (id) => fetchAPI(`/tmdb/tv/${id}`),
  season: (showId, seasonNumber) => fetchAPI(`/tmdb/tv/${showId}/season/${seasonNumber}`),
  showReviews: (id) => fetchAPI(`/tmdb/tv/${id}/reviews`),

  person: (id) => fetchAPI(`/tmdb/person/${id}`),
}

// === FILM DISCOVERY (UK) ===

export const filmsAPI = {
  streaming: (days = 90) => fetchAPI(`/films/streaming?days=${days}`),
  upcoming: () => fetchAPI('/films/upcoming'),
}

// === USERS ===

export const usersAPI = {
  getAll: () => fetchAPI('/users/'),
  create: ({ name }) => fetchAPI('/users/', json('POST', { name })),
  delete: (userId) => fetchAPI(`/users/${userId}`, { method: 'DELETE' }),
  uploadAvatar: (userId, file) => {
    const body = new FormData()
    body.append('file', file)
    return fetchAPI(`/users/${userId}/avatar`, { method: 'POST', body })
  },
}

// === TRACKING ===
// Films: 'want_to_watch'/'watched'. TV: 'watching'/'watched'.

export const trackingAPI = {
  /** { tv: { [id]: status }, movie: { [id]: status } } */
  ids: () => fetchAPI(`/tracking/ids?${user()}`),

  shows: {
    list: () => fetchAPI(`/tracking/shows?${user()}`),
    get: (id) => fetchAPI(`/tracking/shows/${id}?${user()}`),
    /** Track, or update { status, rating, comment } — only the fields given. */
    save: (id, data = {}) => fetchAPI(`/tracking/shows/${id}?${user()}`, json('PUT', data)),
    remove: (id) => fetchAPI(`/tracking/shows/${id}?${user()}`, { method: 'DELETE' }),

    episodes: (id) => fetchAPI(`/tracking/shows/${id}/episodes?${user()}`),
    markEpisodes: (id, episodes) =>
      fetchAPI(`/tracking/shows/${id}/episodes?${user()}`, json('POST', { episodes })),
    markSeason: (id, seasonNumber, watched) =>
      fetchAPI(`/tracking/shows/${id}/season/${seasonNumber}/mark-watched?watched=${watched}&${user()}`, { method: 'POST' }),
    markAllWatched: (id) =>
      fetchAPI(`/tracking/shows/${id}/mark-all-watched?${user()}`, { method: 'POST' }),
  },

  movies: {
    list: () => fetchAPI(`/tracking/movies?${user()}`),
    get: (id) => fetchAPI(`/tracking/movies/${id}?${user()}`),
    save: (id, data = {}) => fetchAPI(`/tracking/movies/${id}?${user()}`, json('PUT', data)),
    remove: (id) => fetchAPI(`/tracking/movies/${id}?${user()}`, { method: 'DELETE' }),
  },
}
