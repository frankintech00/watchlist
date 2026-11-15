/**
 * ProfileAvatar — a user's photo, or their initials on a colour derived from their name.
 * size: 'sm' | 'md' | 'lg'
 */

const SIZE_CLASSES = {
  sm: 'w-9 h-9 text-xs',
  md: 'w-16 h-16 text-xl',
  lg: 'w-28 h-28 text-4xl',
}

// Shades of the app's primary colour
const COLORS = ['#4a6394', '#5d77a8', '#3b507c', '#6c84b3', '#324468', '#566f9f']

function nameColor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return COLORS[hash % COLORS.length]
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

export default function ProfileAvatar({ user, size = 'md' }) {
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md

  if (user?.avatar_path) {
    const filename = user.avatar_path.split(/[\\/]/).pop()
    return (
      <img
        src={`/api/avatars/${filename}`}
        alt={user.name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}
      style={{ backgroundColor: nameColor(user?.name) }}
    >
      {initials(user?.name)}
    </div>
  )
}
