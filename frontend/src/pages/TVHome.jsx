import { useCallback, useEffect, useMemo, useState } from 'react'
import { trackingAPI } from '../api/client'
import Carousel from '../components/Carousel'
import HeroCarousel from '../components/HeroCarousel'
import PosterCard, { Badge } from '../components/PosterCard'
import WatchingFeature from '../components/WatchingFeature'
import { EmptyState, ErrorMessage, RowSkeleton } from '../components/States'
import { episodeCode, parseUTC, shortDate, year } from '../lib/format'

const byUpdated = (a, b) => (parseUTC(b.updated_at)?.getTime() || 0) - (parseUTC(a.updated_at)?.getTime() || 0)

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
    setShows((current) =>
      current
        .map((s) => (s.id === show.id ? { ...s, ...updated, has_new_episodes: false } : s))
        .sort(byUpdated)
    )
  }, [])

  const { recent, watching, watched } = useMemo(() => {
    const all = shows || []
    return {
      recent: all.filter((s) => s.backdrop_path).slice(0, 5),
      watching: all.filter((s) => s.status === 'watching'),
      watched: all.filter((s) => s.status === 'watched'),
    }
  }, [shows])

  if (error) return <ErrorMessage page title="Could not load your shows" error={error} onRetry={load} />

  if (!shows) {
    return (
      <div className="pt-24">
        <div className="gutter mb-10"><div className="skeleton h-[46vh] min-h-[300px]" /></div>
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

  const [featured, ...others] = watching

  return (
    <div className="pb-16">
      <HeroCarousel shows={recent} />

      <div className={`max-w-page mx-auto ${recent.length === 0 ? 'pt-24' : ''}`}>
        {/* ── Watching ── */}
        <div className="gutter flex items-baseline gap-3 mb-4">
          <h2 className="text-2xl sm:text-3xl font-bold">Watching</h2>
          <span className="text-sm text-dim font-bold">{watching.length}</span>
        </div>

        {featured ? (
          <>
            <WatchingFeature show={featured} onMarkWatched={markWatched} />
            <Carousel title="Also watching" count={others.length} expandable={others.length > 8}>
              {others.map((show) => (
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
