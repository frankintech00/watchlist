import { useRef, useState } from 'react'
import { useUser } from '../context/UserContext'
import { usersAPI } from '../api/client'
import ProfileAvatar from '../components/ProfileAvatar'
import Icon, { Logo } from '../components/Icon'

/** "Who's watching?" — pick, add, or manage profiles. */
export default function ProfileScreen() {
  const { users, selectUser, refreshUsers } = useUser()
  const [manage, setManage] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fileInput = useRef(null)
  const photoFor = useRef(null)

  const attempt = async (action) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      await refreshUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const add = () => {
    if (!name.trim()) return
    attempt(async () => {
      await usersAPI.create({ name: name.trim() })
      setName('')
      setAdding(false)
    })
  }

  const remove = (user) => {
    if (!window.confirm(`Delete ${user.name}'s profile? Everything they have tracked will be deleted.`)) return
    attempt(() => usersAPI.delete(user.id))
  }

  const choosePhoto = (user) => {
    photoFor.current = user.id
    fileInput.current?.click()
  }

  const uploadPhoto = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file && photoFor.current) attempt(() => usersAPI.uploadAvatar(photoFor.current, file))
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <Logo className="w-14 h-14 mb-6" />
      <h1 className="text-3xl sm:text-4xl font-bold mb-2">Who’s watching?</h1>
      <p className="text-sm text-muted mb-10">
        {manage ? 'Change a photo or delete a profile.' : 'Each profile keeps its own list.'}
      </p>

      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={uploadPhoto} />

      <div className="flex flex-wrap justify-center gap-6 sm:gap-8 mb-10">
        {users.map((user) => (
          <div key={user.id} className="relative flex flex-col items-center gap-3 w-28">
            <button
              onClick={() => (manage ? choosePhoto(user) : selectUser(user))}
              disabled={busy}
              className="group relative rounded-full ring-4 ring-transparent hover:ring-accent focus-visible:ring-accent transition"
              aria-label={manage ? `Change ${user.name}'s photo` : `Continue as ${user.name}`}
            >
              <ProfileAvatar user={user} size="lg" />
              {manage && (
                <span className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center text-fg">
                  <Icon name="camera" className="w-7 h-7" />
                </span>
              )}
            </button>
            <span className="text-sm font-bold truncate max-w-full">{user.name}</span>

            {manage && (
              <button
                onClick={() => remove(user)}
                disabled={busy}
                className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-rotten text-white flex items-center justify-center shadow-lg hover:brightness-110"
                aria-label={`Delete ${user.name}'s profile`}
              >
                <Icon name="trash" className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}

        {!manage && (
          <div className="flex flex-col items-center gap-3 w-28">
            {adding ? (
              <>
                <ProfileAvatar user={{ name: name || '?' }} size="lg" />
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') add()
                    if (e.key === 'Escape') { setAdding(false); setName('') }
                  }}
                  placeholder="Name"
                  maxLength={32}
                  aria-label="Profile name"
                  className="input text-center w-36 py-2"
                />
                <div className="flex gap-2">
                  <button onClick={add} disabled={busy || !name.trim()} className="btn-primary btn-sm">Add</button>
                  <button onClick={() => { setAdding(false); setName('') }} className="btn-outline btn-sm">Cancel</button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => setAdding(true)}
                  className="w-28 h-28 rounded-full border-2 border-dashed border-line text-dim hover:border-accent hover:text-accent flex items-center justify-center transition-colors"
                  aria-label="Add a profile"
                >
                  <Icon name="plus" className="w-9 h-9" strokeWidth={1.5} />
                </button>
                <span className="text-sm text-muted">Add profile</span>
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-rotten mb-6" role="alert">{error}</p>}

      {users.length > 0 && (
        <button onClick={() => { setManage((m) => !m); setAdding(false); setError(null) }} className="btn-outline">
          {manage ? 'Done' : 'Manage profiles'}
        </button>
      )}
    </div>
  )
}
