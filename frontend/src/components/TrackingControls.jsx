import { useEffect, useState } from 'react'
import Icon from './Icon'

/**
 * The one decision the app asks for: are you watching this, or have you watched it?
 *
 *   status    'watching' | 'watched' | null (not tracked)
 *   onSet     (status) => Promise
 *   onRemove  () => Promise
 */
export function StatusControl({ status, onSet, onRemove, busy = false }) {
  const options = [
    { value: 'watching', label: 'Watching', icon: 'play', on: 'bg-accent text-accent-ink border-accent' },
    { value: 'watched', label: 'Watched', icon: 'check', on: 'bg-seen text-ink border-seen' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Tracking status">
      {options.map(({ value, label, icon, on }) => {
        const active = status === value
        return (
          <button
            key={value}
            onClick={() => !active && onSet(value)}
            disabled={busy}
            aria-pressed={active}
            className={`btn border ${
              active ? on : 'border-line bg-ink/40 text-fg hover:border-dim hover:bg-raised'
            }`}
          >
            <Icon
              name={icon}
              className="w-4 h-4"
              filled={icon === 'play'}
              strokeWidth={icon === 'play' ? 0 : 3}
            />
            {label}
          </button>
        )
      })}

      {status && (
        <button onClick={onRemove} disabled={busy} className="btn text-muted hover:text-rotten px-3" title="Remove from your list">
          <Icon name="trash" className="w-4 h-4" />
          <span className="sr-only sm:not-sr-only">Remove</span>
        </button>
      )}
    </div>
  )
}

/** Your own star rating and a private note. Saves as you go. */
export function MyTake({ rating, comment, onSave }) {
  const [draft, setDraft] = useState(comment || '')
  const [open, setOpen] = useState(Boolean(comment))
  const [state, setState] = useState('idle') // idle | saving | saved | error
  const [hover, setHover] = useState(0)

  useEffect(() => {
    setDraft(comment || '')
    setOpen(Boolean(comment))
  }, [comment])

  const save = async (data) => {
    setState('saving')
    try {
      await onSave(data)
      setState('saved')
      setTimeout(() => setState((s) => (s === 'saved' ? 'idle' : s)), 1800)
    } catch {
      setState('error')
    }
  }

  return (
    <div className="card p-4 sm:p-5 max-w-2xl">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-sm font-bold">Your rating</span>
        <div className="flex items-center" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((star) => {
            const lit = star <= (hover || rating)
            return (
              <button
                key={star}
                onClick={() => save({ rating: rating === star ? 0 : star })}
                onMouseEnter={() => setHover(star)}
                className={`p-1 transition-colors ${lit ? 'text-accent' : 'text-line hover:text-dim'}`}
                aria-label={`${star} star${star === 1 ? '' : 's'}`}
                aria-pressed={rating === star}
              >
                <Icon name="star" className="w-6 h-6" filled={lit} strokeWidth={1.5} />
              </button>
            )
          })}
        </div>

        <span className="text-xs text-dim ml-auto" role="status">
          {state === 'saving' && 'Saving…'}
          {state === 'saved' && <span className="text-seen">Saved</span>}
          {state === 'error' && <span className="text-rotten">Could not save</span>}
        </span>

        {!open && (
          <button onClick={() => setOpen(true)} className="chip">
            <Icon name="plus" className="w-3.5 h-3.5" strokeWidth={2.5} />
            Add a note
          </button>
        )}
      </div>

      {open && (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== (comment || '') && save({ comment: draft })}
          placeholder="What did you think? Only you can see this."
          rows={3}
          className="input mt-4 resize-y"
          aria-label="Your note"
        />
      )}
    </div>
  )
}
