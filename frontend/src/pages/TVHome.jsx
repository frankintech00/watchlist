import { useCallback, useEffect, useMemo, useState } from 'react'
import { trackingAPI } from '../api/client'
import Carousel from '../components/Carousel'
import PosterCard, { Badge } from '../components/PosterCard'
import WatchingCarousel from '../components/WatchingFeature'
import { EmptyState, ErrorMessage, RowSkeleton } from '../components/States'
import { episodeCode, shortDate, year } from '../lib/format'

const RECENT = 7   // large cards at the top of Watching

/** TV — what you are watching and what you have watched. */
export default function TVHome() {
  const [shows, setShows] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setError(null)
    trackingAPI.shows.list().then(setShows).catch(setError)
  }, [])

  useEffect(load, [load])

  // Log the next episode straight from the home page, then fold the result back in
  const markWatched = useCallback(async (show, episode) => {
    const updated = await trackingAPI.shows.markEpisodes(show.id, [{ ...episode, watched: true }])
    // Updated in place (not re-sorted) so the card you are on does not jump away
    setShows((current) =>
      current.map((s) => (s.id === show.id ? { ...s, ...updated, has_new_episodes: false } : s))
    )
  }, [])

  const { watching, watched } = useMemo(() => {
    const all = shows || []
    return {
      watching: all.filter((s) => s.status === 'watching'),
      watched: all.filter((s) => s.status === 'watched'),
    }
  }, [shows])

  if (error) return <ErrorMessage page title="Could not load your shows" error={error} onRetry={load} />

  if (!shows) {
    return (
      <div className="pt-24 sm:pt-28">
        <div className="gutter mb-10"><div className="skeleton h-[300px]" /></div>
        <RowSkeleton />
        <RowSkeleton />
      </div>
    )
  }

  if (shows.length === 0) {
    return (
      <div className="pt-32">
        <EmptyState title="Nothing here yet">
          Search for a show you are watching, or one you have finished, and it will appear here.
        </EmptyState>
      </div>
    )
  }

  // The list arrives most-recently-updated first
  const recent = watching.slice(0, RECENT)

  return (
    <div className="pt-24 sm:pt-28 pb-16">
      <div className="max-w-page mx-auto">
        {/* ── Watching ── */}
        <div className="gutter flex items-baseline gap-3 mb-4">
          <h2 className="text-2xl sm:text-3xl font-bold">Watching</h2>
          <span className="text-sm text-dim font-bold">{watching.length}</span>
        </div>

        {watching.length > 0 ? (
          <>
            <WatchingCarousel shows={recent} onMarkWatched={markWatched} />
            <Carousel title="All watching" count={watching.length} expandable={watching.length > 8}>
              {watching.map((show) => (
                <PosterCard
                  key={show.id}
                  to={`/tv/${show.id}`}
                  title={show.name || 'Untitled'}
                  poster={show.poster_path}
                  subtitle={watchingSubtitle(show)}
                  progress={show.aired_episodes > 0 ? show.watched_episodes / show.aired_episodes : null}
                />
              ))}
            </Carousel>
          </>
        ) : (
          <p className="gutter text-sm text-muted mb-10">
            Nothing on the go. Tick an episode on any show and it will move back here.
          </p>
        )}

        {/* ── Watched ── */}
        <Carousel title="Watched" count={watched.length} expandable={watched.length > 8}>
          {watched.map((show) => (
            <PosterCard
              key={show.id}
              to={`/tv/${show.id}`}
              title={show.name || 'Untitled'}
              poster={show.poster_path}
              subtitle={watchedSubtitle(show)}
              badge={show.has_new_episodes ? <Badge>New episodes</Badge> : null}
              status="watched"
            />
          ))}
        </Carousel>
      </div>
    </div>
  )
}

function watchingSubtitle(show) {
  if (show.next_episode) {
    return `${episodeCode(show.next_episode)} next  ·  ${show.watched_episodes}/${show.aired_episodes}`
  }
  if (show.next_air?.air_date) return `Starts ${shortDate(show.next_air.air_date)}`
  return year(show.first_air_date) || 'Not aired yet'
}

function watchedSubtitle(show) {
  if (show.has_new_episodes) {
    const unseen = show.aired_episodes - show.watched_episodes
    return `${unseen} new episode${unseen === 1 ? '' : 's'}`
  }
  if (show.next_air?.air_date) return `Returns ${shortDate(show.next_air.air_date)}`
  return [year(show.first_air_date), show.show_status === 'Ended' || show.show_status === 'Canceled' ? 'Ended' : null]
    .filter(Boolean).join('  ·  ')
}
