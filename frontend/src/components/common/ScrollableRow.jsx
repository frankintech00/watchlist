import { useRef, useState, useEffect } from 'react'

// cardHeight (px): visible card height (excluding any bottom padding added for hover-panel
// overflow).  When supplied the arrow columns are clamped to this height so the buttons
// sit at the card's visual centre rather than the centre of the inflated scroll container.
// Leave undefined for rows whose items fill the column naturally (e.g. CastRow).
function ScrollableRow({ children, className = '', cardHeight }) {
  const scrollRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft]   = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setCanScrollLeft(scrollLeft > 4)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4)
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [children])

  const scroll = (direction) => {
    if (!scrollRef.current) return
    const amount = scrollRef.current.clientWidth * 0.85
    scrollRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
    setTimeout(checkScroll, 400)
  }

  // When cardHeight is set the column is given an explicit height so the button
  // centres on the card, not on the taller container that includes bottom padding.
  // Without cardHeight the column stretches to match its siblings (flex default),
  // which works well for rows whose items fill the available height naturally.
  const colStyle = cardHeight ? { height: `${cardHeight}px` } : undefined

  // Arrow button — a plain flex child of its column div, never absolutely positioned,
  // so it can never physically overlap the scroll container.
  const ArrowButton = ({ dir }) => (
    <button
      onClick={() => scroll(dir)}
      className={
        'w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white ' +
        'opacity-0 group-hover/row:opacity-100 transition-opacity duration-200'
      }
      style={{
        background: 'rgba(20,20,20,0.8)',
        border: '1px solid rgba(255,255,255,0.15)',
      }}
      aria-label={dir === 'left' ? 'Scroll left' : 'Scroll right'}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
          d={dir === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
        />
      </svg>
    </button>
  )

  return (
    // Three-column flex layout: [left arrow col] [scroll area] [right arrow col]
    //
    // The arrow columns are dedicated flex siblings of the scroll container —
    // the scroll container never occupies the same horizontal space as an arrow.
    // Moving the mouse toward an arrow therefore never crosses a card, eliminating
    // the hover/expand interference entirely.
    <div className="flex group/row">

      {/* ── Left arrow column ───────────────────────────────────────────────────
          • flex-none w-12: fixed 48 px gutter, matching the page's px-12 margin.
          • items-center justify-center: centres the button within the column height.
          • colStyle (optional): clamps height to card area only so the button sits
            at the card's visual midpoint rather than the inflated container height. */}
      <div
        className="hidden md:flex flex-none w-12 items-center justify-center"
        style={colStyle}
      >
        {canScrollLeft && <ArrowButton dir="left" />}
      </div>

      {/* ── Scrollable content ──────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className={`flex-1 min-w-0 overflow-x-auto scrollbar-hide ${className}`}
      >
        {children}
      </div>

      {/* ── Right arrow column ──────────────────────────────────────────────── */}
      <div
        className="hidden md:flex flex-none w-12 items-center justify-center"
        style={colStyle}
      >
        {canScrollRight && <ArrowButton dir="right" />}
      </div>

    </div>
  )
}

export default ScrollableRow
