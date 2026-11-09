import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'

import { createApiClient, type ApiClient } from '@/lib/api/api'
import { ApiError } from '@/lib/api/client'
import { queryClient } from '@/lib/query-client'
import { clearUploads } from '@/lib/uploads'

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
  /** Switch collection; clears cached data from the previous one. */
  setTenant: (tenantId: string) => Promise<void>
  /** Typed client for the signed-in server; a 401 signs out. Null while signed out. */
  api: ApiClient | null
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)

  const dropSession = useCallback(async () => {
    setSession(null)
    queryClient.clear()
    clearUploads()
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

  const api = useMemo(
    () =>
      session
        ? createApiClient(session.serverUrl, session.token, session.tenantId, () => {
            dropSession()
          })
        : null,
    [session, dropSession],
  )

  const setTenant = useCallback(
    async (tenantId: string) => {
      if (!session || session.tenantId === tenantId) return
      const next = { ...session, tenantId }
      queryClient.clear()
      await saveSession(next)
      setSession(next)
    },
    [session],
  )

  const value = useMemo(
    () => ({ isLoading, session, signIn, signOut, setTenant, api }),
    [isLoading, session, signIn, signOut, setTenant, api],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}

export function useSession() {
  const ctx = use(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}

