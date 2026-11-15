import { Children, useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon'

/**
 * A titled, horizontally scrolling row of cards.
 *
 *   title       row heading
 *   count       optional number shown beside the heading
 *   expandable  adds a "See all" toggle that turns the row into a wrapping grid
 *   itemClass   width of each card while in a row (cards fill the cell)
 *   actions     extra controls rendered beside the heading
 */
export default function Carousel({
  title,
  count,
  expandable = false,
  itemClass = 'w-[122px] sm:w-[148px] lg:w-[164px]',
  gridClass = 'grid-cols-[repeat(auto-fill,minmax(112px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(148px,1fr))]',
  actions,
  children,
}) {
  const scroller = useRef(null)
  const [expanded, setExpanded] = useState(false)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const items = Children.toArray(children)

  const measure = useCallback(() => {
    const el = scroller.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure, items.length, expanded])

  const page = (direction) => {
    const el = scroller.current
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  if (items.length === 0) return null

  return (
    <section className="mb-10">
      <div className="gutter flex items-center gap-3 mb-3.5">
        <h2 className="section-title">{title}</h2>
        {count != null && <span className="text-sm text-dim font-bold">{count}</span>}
        {actions}
        <div className="ml-auto flex items-center gap-1">
          {expandable && (
            <button onClick={() => setExpanded((v) => !v)} className="chip mr-1">
              {expanded ? 'Show less' : 'See all'}
            </button>
          )}
          {!expanded && (
            <div className="hidden md:flex items-center gap-1">
              <button onClick={() => page(-1)} disabled={!canLeft} className="icon-btn" aria-label={`Scroll ${title} left`}>
                <Icon name="left" className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <button onClick={() => page(1)} disabled={!canRight} className="icon-btn" aria-label={`Scroll ${title} right`}>
                <Icon name="right" className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>
      </div>

      {expanded ? (
        <div className={`gutter grid gap-x-3 gap-y-6 sm:gap-x-4 ${gridClass}`}>
          {items}
        </div>
      ) : (
        <div
          ref={scroller}
          onScroll={measure}
          className="gutter flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide snap-x scroll-px-4 sm:scroll-px-6 lg:scroll-px-10 pb-1"
        >
          {items.map((child) => (
            <div key={child.key} className={`flex-none snap-start ${itemClass}`}>
              {child}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
