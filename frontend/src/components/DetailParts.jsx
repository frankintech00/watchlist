import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import { img, scoreTone } from '../lib/format'

/** Horizontal strip of cast, each linking to the person's page. */
export function CastRow({ cast, title = 'Cast' }) {
  if (!cast?.length) return null
  return (
    <section className="mb-10">
      <h2 className="section-title gutter mb-3.5">{title}</h2>
      <div className="gutter flex gap-3 overflow-x-auto scrollbar-hide pb-1">
        {cast.map((person) => (
          <PersonChip key={`${person.id}-${person.character}`} person={person} />
        ))}
      </div>
    </section>
  )
}

export function PersonChip({ person }) {
  const photo = img(person.profile_path, 'w185')
  return (
    <Link to={`/person/${person.id}`} className="group flex-none w-[104px] sm:w-[120px] text-center">
      <div className="w-[88px] h-[88px] sm:w-[104px] sm:h-[104px] mx-auto rounded-full overflow-hidden bg-raised ring-2 ring-transparent group-hover:ring-accent transition">
        {photo ? (
          <img src={photo} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-dim">
            {person.name?.[0]}
          </div>
        )}
      </div>
      <p className="mt-2 text-[13px] font-bold leading-tight line-clamp-2 group-hover:text-accent transition-colors">{person.name}</p>
      {person.character && <p className="text-xs text-muted leading-tight line-clamp-2 mt-0.5">{person.character}</p>}
      {person.episode_count > 0 && <p className="text-[11px] text-dim mt-0.5">{person.episode_count} eps</p>}
    </Link>
  )
}

/** UK subscription services carrying the title. */
export function Providers({ providers }) {
  if (!providers?.length) return null
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <span className="text-xs font-bold uppercase tracking-wider text-dim">Stream on</span>
      {providers.slice(0, 6).map((p) => (
        <span key={p.name} className="inline-flex items-center gap-2 h-8 pl-1 pr-3 rounded-full bg-raised border border-line text-xs font-bold">
          {p.logo_path && <img src={img(p.logo_path, 'w92')} alt="" className="w-6 h-6 rounded-full" />}
          {p.name}
        </span>
      ))}
    </div>
  )
}

/** One labelled score, e.g. 93% Rotten Tomatoes. */
export function Score({ value, label, suffix = '%', tone }) {
  if (value == null) return null
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-xl font-bold ${tone || scoreTone(value)}`}>{value}{suffix}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  )
}

/** Button that opens a YouTube trailer in a lightbox. */
export function TrailerButton({ videoKey, className = 'btn-quiet' }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  if (!videoKey) return null

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        <Icon name="play" className="w-4 h-4" filled strokeWidth={0} />
        Trailer
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Trailer"
        >
          <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button onClick={() => setOpen(false)} className="icon-btn text-fg" aria-label="Close trailer" autoFocus>
                <Icon name="close" />
              </button>
            </div>
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&rel=0`}
                title="Trailer"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** TMDB user reviews, collapsed until asked for. */
export function Reviews({ load }) {
  const [reviews, setReviews] = useState(null)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    let cancelled = false
    setReviews(null)
    setOpen(false)
    load()
      .then((data) => !cancelled && setReviews(data.results || []))
      .catch(() => !cancelled && setReviews([]))
    return () => { cancelled = true }
  }, [load])

  if (!reviews?.length) return null

  return (
    <section className="gutter mb-10">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-3 mb-3.5 group" aria-expanded={open}>
        <h2 className="section-title">Reviews</h2>
        <span className="text-sm text-dim font-bold">{reviews.length}</span>
        <Icon name="down" className={`w-4 h-4 text-muted group-hover:text-fg transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2.5} />
      </button>

      {open && (
        <div className="grid gap-3 md:grid-cols-2 max-w-6xl">
          {reviews.slice(0, 8).map((review) => {
            const long = review.content.length > 420
            const full = expanded[review.id]
            const score = review.author_details?.rating
            return (
              <article key={review.id} className="card p-4">
                <header className="flex items-center gap-2 mb-2 text-sm">
                  <span className="font-bold">{review.author_details?.name || review.author}</span>
                  {score != null && <span className={`font-bold ${scoreTone(score * 10)}`}>{score}/10</span>}
                  <span className="text-dim text-xs ml-auto">
                    {new Date(review.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </span>
                </header>
                <p className="text-sm text-muted leading-relaxed whitespace-pre-line">
                  {long && !full ? `${review.content.slice(0, 420).trimEnd()}…` : review.content}
                </p>
                {long && (
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [review.id]: !full }))}
                    className="text-xs font-bold text-accent mt-2 hover:underline"
                  >
                    {full ? 'Show less' : 'Read more'}
                  </button>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
