import { Link } from 'react-router-dom'
import Icon from './Icon'

/** Placeholder row shown while a carousel's data loads. */
export function RowSkeleton({ title = true, cards = 9 }) {
  return (
    <div className="gutter mb-10" aria-hidden="true">
      {title && <div className="skeleton h-6 w-40 mb-4" />}
      <div className="flex gap-3 sm:gap-4 overflow-hidden">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="flex-none w-[122px] sm:w-[148px] lg:w-[164px]">
            <div className="skeleton aspect-[2/3]" />
            <div className="skeleton h-3.5 w-4/5 mt-2.5" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PageLoading({ label = 'Loading…' }) {
  return (
    <div className="min-h-screen flex items-center justify-center" role="status">
      <div className="flex items-center gap-3 text-muted text-sm">
        <span className="w-4 h-4 rounded-full border-2 border-line border-t-accent animate-spin" />
        {label}
      </div>
    </div>
  )
}

export function ErrorMessage({ title = 'Something went wrong', error, onRetry, page = false }) {
  return (
    <div className={`gutter ${page ? 'min-h-screen flex items-center justify-center' : 'py-10'}`} role="alert">
      <div className="card p-6 max-w-md">
        <p className="font-bold mb-1">{title}</p>
        <p className="text-sm text-muted mb-4">{error?.message || String(error || '')}</p>
        {onRetry && <button onClick={onRetry} className="btn-outline btn-sm">Try again</button>}
      </div>
    </div>
  )
}

export function EmptyState({ title, children, action = true }) {
  return (
    <div className="gutter py-16 text-center">
      <p className="text-xl font-bold mb-2">{title}</p>
      <p className="text-sm text-muted max-w-md mx-auto mb-6">{children}</p>
      {action && (
        <Link to="/search" className="btn-primary">
          <Icon name="search" className="w-4 h-4" strokeWidth={2.5} />
          Search
        </Link>
      )}
    </div>
  )
}

/** Fixed full-page artwork behind a detail page, fading into the background colour. */
export function Backdrop({ src }) {
  if (!src) return null
  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
      <div
        className="absolute inset-0 bg-cover bg-top opacity-70"
        style={{ backgroundImage: `url(${src})`, animation: 'fadeIn 1s ease-out' }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(11,16,22,0.55) 0%, rgba(11,16,22,0.82) 32%, rgba(11,16,22,0.97) 58%, #0b1016 75%)',
        }}
      />
    </div>
  )
}
