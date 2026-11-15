/** Small formatting helpers shared across pages. */

const TMDB_IMG = 'https://image.tmdb.org/t/p'

/** TMDB image URL, or null when there is no image. Sizes: w92 w185 w342 w500 w780 w1280 original */
export const img = (path, size = 'w342') => (path ? `${TMDB_IMG}/${size}${path}` : null)

export const year = (date) => (date ? date.slice(0, 4) : '')

/** The API stores naive UTC timestamps — make sure they are parsed as UTC. */
export function parseUTC(value) {
  if (!value) return null
  const hasZone = /[zZ]$|[+-]\d\d:?\d\d$/.test(value)
  const d = new Date(hasZone ? value : `${value.replace(' ', 'T')}Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function timeAgo(value) {
  const d = parseUTC(value)
  if (!d) return ''
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`
  if (days < 365) return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`
  return `${Math.floor(days / 365)} year${days < 730 ? '' : 's'} ago`
}

/** '2026-11-12' -> '12 Nov' (adds the year when it is not the current one). */
export function shortDate(date, { alwaysYear = false } = {}) {
  if (!date) return ''
  const d = new Date(`${date.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(alwaysYear || !sameYear ? { year: 'numeric' } : {}),
  })
}

export function longDate(date) {
  if (!date) return ''
  const d = new Date(`${date.slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function runtime(minutes) {
  if (!minutes) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
}

/** 'S2 E4' */
export const episodeCode = (ep) => (ep ? `S${ep.season_number} E${ep.episode_number}` : '')

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Tailwind text colour for a 0-100 critic score. */
export function scoreTone(score) {
  if (score == null) return 'text-muted'
  if (score >= 75) return 'text-seen'
  if (score >= 60) return 'text-accent'
  return 'text-dim'
}

export const titlePath = (item) =>
  `/${item.media_type === 'movie' ? 'movie' : item.media_type === 'person' ? 'person' : 'tv'}/${item.id}`
