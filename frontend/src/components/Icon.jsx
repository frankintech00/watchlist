/** Stroke icons (24px grid). <Icon name="check" className="w-4 h-4" /> */

const PATHS = {
  bookmark: 'M6 3h12v18l-6-4-6 4V3z',
  popcorn: 'M5 10h14l-2 11H7L5 10zM9 13l1 5M15 13l-1 5M5 10a3 3 0 01-1-5 3 3 0 015-2 3 3 0 016 0 3 3 0 015 2 3 3 0 01-1 5M9 7a3 3 0 016 0',
  tomato: 'M12 7C6 4 2 9 3 15c1 7 17 7 18 0 1-6-3-11-9-8zM12 7V2M7 5l5 2-3 4M17 5l-5 2 3 4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M21 21l-4.3-4.3M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  down: 'M5 9l7 7 7-7',
  play: 'M8 5.5v13l11-6.5-11-6.5z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z',
  external: 'M14 5h5v5M19 5l-8 8M11 7H6a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1v-5',
  swap: 'M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  camera: 'M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1zM12 16a3 3 0 100-6 3 3 0 000 6z',
}

export default function Icon({ name, className = 'w-5 h-5', filled = false, strokeWidth = 2 }) {
  return (
    <svg
      className={`flex-shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

/** The app mark: a screen with a tick on it. */
export function Logo({ className = 'w-8 h-8' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="22" fill="#a1b5d8" />
      <rect x="18" y="24" width="64" height="44" rx="8" fill="#0d121b" />
      <rect x="36" y="75" width="28" height="6" rx="3" fill="#0d121b" />
      <path d="M36 46 L46 56 L65 36" fill="none" stroke="#a1b5d8" strokeWidth="7.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
