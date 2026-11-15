import { Link } from 'react-router-dom'
import Icon from './Icon'
import { img, scoreTone } from '../lib/format'

/**
 * Poster with a title and one line of detail underneath.
 *
 *   badge     node pinned top-left (e.g. <ScoreBadge />, <Badge>NEW</Badge>)
 *   status    'watching' | 'watched' — shows the tracked marker top-right
 *   progress  0-1 — bar along the bottom of the poster
 */
export default function PosterCard({ to, title, poster, subtitle, badge, status, progress }) {
  const src = img(poster, 'w342')

  return (
    <Link to={to} className="group block min-w-0" title={title}>
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-panel ring-1 ring-white/10 transition duration-200 group-hover:ring-2 group-hover:ring-accent group-hover:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-accent">
        {src ? (
          <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-3 text-center text-xs text-dim font-bold">
            {title}
          </div>
        )}

        {badge && <div className="absolute top-1.5 left-1.5">{badge}</div>}
        {status && <div className="absolute top-1.5 right-1.5"><TrackedMark status={status} /></div>}

        {progress != null && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
            <div className="h-full bg-accent" style={{ width: `${Math.round(Math.min(1, progress) * 100)}%` }} />
          </div>
        )}
      </div>

      <p className="mt-2 text-[13px] sm:text-sm font-bold text-fg truncate">{title}</p>
      {subtitle && <p className="text-xs text-muted truncate">{subtitle}</p>}
    </Link>
  )
}

/** Small round marker: pale tick = watched, dot = watching. */
export function TrackedMark({ status }) {
  if (status === 'watched') {
    return (
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-seen text-ink shadow" title="Watched">
        <Icon name="check" className="w-3 h-3" strokeWidth={3.5} />
      </span>
    )
  }
  return (
    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-ink/85 shadow" title="Watching">
      <span className="w-2 h-2 rounded-full bg-accent" />
    </span>
  )
}

export function Badge({ children, tone = 'accent' }) {
  const tones = {
    accent: 'bg-accent text-accent-ink',
    dark: 'bg-ink/85 text-fg backdrop-blur',
  }
  return (
    <span className={`inline-flex items-center h-5 px-1.5 rounded text-[10px] font-bold uppercase tracking-wide shadow ${tones[tone]}`}>
      {children}
    </span>
  )
}

/** Critic score chip, coloured by how good the score is. */
export function ScoreBadge({ score }) {
  if (score == null) return null
  return (
    <span className={`inline-flex items-center h-5 px-1.5 rounded text-[11px] font-bold bg-ink/90 backdrop-blur shadow ${scoreTone(score)}`}>
      {score}%
    </span>
  )
}
