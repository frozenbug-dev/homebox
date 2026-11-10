import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'

import { ApiError, request, type RequestOptions } from '@/lib/api/client'
import { queryClient } from '@/lib/query-client'

import { refreshSession, revokeSession } from './api'
import { clearSession, loadSession, saveSession, type Session } from './storage'

/** Refresh the token once less than this much of its lifetime is left. */
const REFRESH_WINDOW_MS = 1000 * 60 * 60 * 24 * 3

interface SessionContextValue {
  /** True until the stored session has been read. */
  isLoading: boolean
  session: Session | null
  signIn: (session: Session) => Promise<void>
  signOut: () => Promise<void>
  /** JSON request against the signed-in server; signs out when the token is rejected. */
  authedRequest: <T>(path: string, options?: Omit<RequestOptions, 'token'>) => Promise<T>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)

  const dropSession = useCallback(async () => {
    setSession(null)
    queryClient.clear()
    await clearSession()
  }, [])

  const maybeRefresh = useCallback(
    async (current: Session) => {
      const remaining = new Date(current.expiresAt).getTime() - Date.now()
      if (remaining > REFRESH_WINDOW_MS) return
      try {
        const next = await refreshSession(current)
        await saveSession(next)
        setSession((s) => (s?.token === current.token ? next : s))
      } catch (e) {
        // Offline or server down: keep the token until it actually expires.
        if (e instanceof ApiError && e.status === 401) await dropSession()
      }
    },
    [dropSession],
  )

  useEffect(() => {
    let cancelled = false
    loadSession().then((stored) => {
      if (cancelled) return
      setSession(stored)
      setIsLoading(false)
      if (stored) maybeRefresh(stored)
    })
    return () => {
      cancelled = true
    }
  }, [maybeRefresh])

  useEffect(() => {
    if (!session) return
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') maybeRefresh(session)
    })
    return () => sub.remove()
  }, [session, maybeRefresh])

  const signIn = useCallback(async (next: Session) => {
    queryClient.clear()
    await saveSession(next)
    setSession(next)
  }, [])

  const signOut = useCallback(async () => {
    const current = session
    await dropSession()
    // Revoke server-side too; signing out locally must not wait on the network.
    if (current) revokeSession(current).catch(() => {})
  }, [session, dropSession])

  const authedRequest = useCallback(
    async <T,>(path: string, options: Omit<RequestOptions, 'token'> = {}) => {
      if (!session) throw new ApiError(401, 'Not signed in')
      try {
        return await request<T>(session.serverUrl, path, { ...options, token: session.token })
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) await dropSession()
        throw e
      }
    },
    [session, dropSession],
  )

  const value = useMemo(
    () => ({ isLoading, session, signIn, signOut, authedRequest }),
    [isLoading, session, signIn, signOut, authedRequest],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}

export function useSession() {
  const ctx = use(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}

