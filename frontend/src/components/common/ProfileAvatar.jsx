/**
 * ProfileAvatar — shows user avatar image or colored initials fallback.
 * Props:
 *   user  — { name, avatar_path }
 *   size  — 'sm' | 'md' | 'lg'
 */

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-16 h-16 text-xl',
  lg: 'w-28 h-28 text-4xl',
}

// Deterministic color from name string
const COLORS = [
  '#e11d48', '#db2777', '#9333ea', '#7c3aed',
  '#2563eb', '#0891b2', '#059669', '#ca8a04',
  '#ea580c', '#dc2626',
]

function nameColor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return COLORS[hash % COLORS.length]
}

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export default function ProfileAvatar({ user, size = 'md' }) {
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md

  if (user?.avatar_path) {
    // Strip any directory prefix, keep just the filename
    const filename = user.avatar_path.split(/[\\/]/).pop()
    return (
      <img
        src={`/api/avatars/${filename}`}
        alt={user.name}
        className={`${sizeClass} rounded-md object-cover flex-shrink-0`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-md flex items-center justify-center font-semibold text-white flex-shrink-0`}
      style={{ backgroundColor: nameColor(user?.name) }}
    >
      {initials(user?.name)}
    </div>
  )
}
