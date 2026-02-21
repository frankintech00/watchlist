import { useRef, useState, useEffect } from 'react'

function ScrollableRow({ children, className = '' }) {
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
    // Recheck after animation
    setTimeout(checkScroll, 400)
  }

  return (
    <div className="relative group/row">
      {/* Left fade + arrow */}
      {canScrollLeft && (
        <>
          <div
            className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to right, #141414, transparent)' }}
          />
          <button
            onClick={() => scroll('left')}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-opacity duration-200"
            style={{ background: 'rgba(20,20,20,0.8)', border: '1px solid rgba(255,255,255,0.15)' }}
            aria-label="Scroll left"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </>
      )}

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className={`overflow-x-auto scrollbar-hide ${className}`}
      >
        {children}
      </div>

      {/* Right fade + arrow */}
      {canScrollRight && (
        <>
          <div
            className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to left, #141414, transparent)' }}
          />
          <button
            onClick={() => scroll('right')}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-opacity duration-200"
            style={{ background: 'rgba(20,20,20,0.8)', border: '1px solid rgba(255,255,255,0.15)' }}
            aria-label="Scroll right"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}

export default ScrollableRow
