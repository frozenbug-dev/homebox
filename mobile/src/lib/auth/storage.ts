import * as SecureStore from 'expo-secure-store'

/** A signed-in account on one Homebox server. */
export interface Session {
  serverUrl: string
  /** "Bearer <token>", sent as-is in the Authorization header. */
  token: string
  /** ISO timestamp */
  expiresAt: string
  /** Token for attachment URLs (images), passed as ?access_token=. */
  attachmentToken: string
  /** Collection (group) to work in; unset means the user's default one. Sent as X-Tenant. */
  tenantId?: string
}

const SESSION_KEY = 'homebox.session'
const LAST_SERVER_KEY = 'homebox.lastServer'

function isSession(value: unknown): value is Session {
  const v = value as Session
  return !!v && typeof v.serverUrl === 'string' && typeof v.token === 'string' && typeof v.expiresAt === 'string'
}

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isSession(parsed)) return null
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

export async function saveSession(session: Session) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session))
  await SecureStore.setItemAsync(LAST_SERVER_KEY, session.serverUrl)
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY)
}

/** The last server signed in to, to prefill the server field. */
export async function loadLastServer(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(LAST_SERVER_KEY)
  } catch {
    return null
  }
}
