import Icon from './Icon'
import { scoreTone } from '../lib/format'

/** Distinct Rotten Tomatoes scores. Missing values never borrow another source. */
export default function FilmScores({ audience, critics, compact = false }) {
  return (
    <div className={compact ? 'mt-2 space-y-1' : 'flex flex-wrap gap-x-7 gap-y-2'}>
      {[
        { icon: 'popcorn', label: 'Audience', source: 'Rotten Tomatoes audience (Popcornmeter)', value: audience },
        { icon: 'tomato', label: 'Critics', source: 'Rotten Tomatoes critics (Tomatometer)', value: critics },
      ].map(({ icon, label, source, value }) => (
        <div key={icon} className="flex items-center gap-1.5" title={source} aria-label={`${source}: ${value == null ? 'unavailable' : `${value}%`}`}>
          <Icon name={icon} className={compact ? 'w-4 h-4 text-accent' : 'w-5 h-5 text-accent'} />
          <span className={`${compact ? 'text-xs' : 'text-xl'} font-bold ${scoreTone(value)}`}>
            {value == null ? '—' : `${value}%`}
          </span>
          <span className="text-xs text-muted">{compact ? label : `RT ${label}`}</span>
        </div>
      ))}
    </div>
  )
}
