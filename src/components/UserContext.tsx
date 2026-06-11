"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import type { User } from "@/lib/types"

interface UserContextValue {
  user: User | null
  setUser: (u: User) => void
  clearUser: () => void
  ready: boolean
}

const UserCtx = createContext<UserContextValue>({
  user: null, setUser: () => {}, clearUser: () => {}, ready: false,
})

export function useUser() { return useContext(UserCtx) }

const COOKIE_NAME = "mm_uid"
const STORAGE_KEY = "mm_user"

function readUserFromStorage(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function persistUser(u: User | null) {
  if (u) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    document.cookie = `${COOKIE_NAME}=${u.id}; path=/; max-age=${60 * 60 * 24 * 365}`
  } else {
    localStorage.removeItem(STORAGE_KEY)
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`
  }
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = readUserFromStorage()
    setUserState(stored)
    setReady(true)
  }, [])

  const setUser = useCallback((u: User) => {
    setUserState(u)
    persistUser(u)
  }, [])

  const clearUser = useCallback(() => {
    setUserState(null)
    persistUser(null)
  }, [])

  return (
    <UserCtx.Provider value={{ user, setUser, clearUser, ready }}>
      {children}
    </UserCtx.Provider>
  )
}
