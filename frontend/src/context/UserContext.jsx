import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { usersAPI, setActiveUser } from '../api/client'

const UserContext = createContext(null)

const STORAGE_KEY = 'watchlist_user_id'

export function UserProvider({ children }) {
  const [users, setUsers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUsers = useCallback(async () => {
    try {
      const data = await usersAPI.getAll()
      setUsers(data)
      return data
    } catch (err) {
      console.error('Failed to load users:', err)
      return []
    }
  }, [])

  // On mount: load users, restore saved user
  useEffect(() => {
    async function init() {
      const data = await refreshUsers()
      const savedId = parseInt(localStorage.getItem(STORAGE_KEY), 10)
      if (savedId && data.some((u) => u.id === savedId)) {
        const saved = data.find((u) => u.id === savedId)
        setCurrentUser(saved)
        setActiveUser(savedId)
      }
      setLoading(false)
    }
    init()
  }, [refreshUsers])

  function selectUser(user) {
    setCurrentUser(user)
    setActiveUser(user.id)
    localStorage.setItem(STORAGE_KEY, String(user.id))
  }

  function clearUser() {
    setCurrentUser(null)
    setActiveUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <UserContext.Provider value={{ currentUser, users, loading, selectUser, clearUser, refreshUsers }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within UserProvider')
  return ctx
}
