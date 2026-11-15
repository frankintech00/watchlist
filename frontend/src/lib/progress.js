/**
 * Episode progress for a show — mirrors `aired_episodes` / `show_progress`
 * in backend/app/tmdb_client.py so the UI can update instantly on a tick.
 */

export const episodeKey = (season, episode) => `${season}-${episode}`

/** Ordered [{ season_number, episode_number }] of every regular episode that has aired. */
export function airedEpisodes(show) {
  const last = show?.last_episode_to_air
  if (!last?.season_number || !last?.episode_number) return []

  const aired = []
  const seasons = (show.seasons || [])
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number)

  for (const season of seasons) {
    if (season.season_number > last.season_number) break
    let count = season.episode_count || 0
    if (season.season_number === last.season_number) {
      count = count ? Math.min(count, last.episode_number) : last.episode_number
    }
    for (let ep = 1; ep <= count; ep++) {
      aired.push({ season_number: season.season_number, episode_number: ep })
    }
  }
  return aired
}

/**
 * watched: Set of episodeKey() strings.
 * Returns { aired, watched, next, perSeason: { [season]: { aired, watched } } }.
 */
export function showProgress(show, watched) {
  const aired = airedEpisodes(show)
  const perSeason = {}

  for (const { season_number } of aired) {
    perSeason[season_number] ??= { aired: 0, watched: 0 }
    perSeason[season_number].aired += 1
  }
  for (const key of watched) {
    const season = Number(key.split('-')[0])
    if (season > 0) {
      perSeason[season] ??= { aired: 0, watched: 0 }
      perSeason[season].watched += 1
    }
  }

  let watchedCount = 0
  for (const s of Object.values(perSeason)) watchedCount += Math.min(s.watched, s.aired)

  const next = aired.find(
    (ep) =>
      perSeason[ep.season_number].watched < perSeason[ep.season_number].aired &&
      !watched.has(episodeKey(ep.season_number, ep.episode_number))
  ) || null

  return { aired: aired.length, watched: watchedCount, next, perSeason }
}
