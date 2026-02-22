import { useState } from 'react'
import { useUser } from '../context/UserContext'
import { usersAPI } from '../api/client'
import ProfileAvatar from '../components/common/ProfileAvatar'

export default function ProfileScreen() {
  const { users, selectUser, refreshUsers } = useUser()
  const [manageMode, setManageMode] = useState(false)
  const [addingProfile, setAddingProfile] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    try {
      await usersAPI.create({ name })
      await refreshUsers()
      setNewName('')
      setAddingProfile(false)
    } catch (err) {
      console.error('Failed to create profile:', err)
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(userId) {
    if (!window.confirm('Remove this profile? All their tracking data will be deleted.')) return
    setDeletingId(userId)
    try {
      await usersAPI.delete(userId)
      await refreshUsers()
    } catch (err) {
      console.error('Failed to delete profile:', err)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center px-4">
      <h1 className="text-white text-4xl md:text-5xl font-light mb-12 tracking-wide">
        Who are you?
      </h1>

      {/* Profile grid */}
      <div className="flex flex-wrap justify-center gap-6 mb-10">
        {users.map((user) => (
          <div key={user.id} className="relative flex flex-col items-center gap-3 group">
            {/* Delete overlay in manage mode */}
            {manageMode && (
              <button
                onClick={() => handleDelete(user.id)}
                disabled={deletingId === user.id}
                className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white text-xs font-bold shadow-lg transition-colors"
                aria-label={`Remove ${user.name}`}
              >
                {deletingId === user.id ? '…' : '×'}
              </button>
            )}

            <button
              onClick={() => !manageMode && selectUser(user)}
              disabled={manageMode}
              className="rounded-md ring-offset-2 ring-offset-[#141414] group-hover:ring-2 group-hover:ring-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-white disabled:cursor-default"
            >
              <ProfileAvatar user={user} size="lg" />
            </button>

            <span className="text-white/70 text-sm group-hover:text-white transition-colors duration-150">
              {user.name}
            </span>
          </div>
        ))}

        {/* Add Profile card */}
        {!manageMode && (
          <div className="flex flex-col items-center gap-3">
            {addingProfile ? (
              <div className="flex flex-col items-center gap-3">
                {/* Preview avatar while typing */}
                <div className="w-28 h-28 rounded-md overflow-hidden">
                  <ProfileAvatar user={{ name: newName || '?' }} size="lg" />
                </div>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd()
                    if (e.key === 'Escape') { setAddingProfile(false); setNewName('') }
                  }}
                  placeholder="Name"
                  maxLength={32}
                  className="w-32 bg-black/60 border border-white/30 text-white text-sm px-2 py-1 rounded text-center focus:outline-none focus:border-white placeholder-white/30"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAdd}
                    disabled={adding || !newName.trim()}
                    className="px-3 py-1 text-xs bg-white text-black rounded font-semibold hover:bg-white/90 disabled:opacity-40 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setAddingProfile(false); setNewName('') }}
                    className="px-3 py-1 text-xs border border-white/40 text-white/70 rounded hover:text-white hover:border-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setAddingProfile(true)}
                  className="w-28 h-28 rounded-md border-2 border-dashed border-white/30 hover:border-white/70 text-white/40 hover:text-white/80 flex items-center justify-center text-5xl font-light transition-all duration-150 focus:outline-none"
                  aria-label="Add profile"
                >
                  +
                </button>
                <span className="text-white/40 text-sm">Add Profile</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Manage / Done button */}
      <button
        onClick={() => { setManageMode((m) => !m); setAddingProfile(false) }}
        className="px-6 py-2 border border-white/40 text-white/60 hover:text-white hover:border-white text-sm tracking-widest uppercase transition-colors duration-150"
      >
        {manageMode ? 'Done' : 'Manage Profiles'}
      </button>
    </div>
  )
}
