import * as Crypto from 'expo-crypto'
import * as WebBrowser from 'expo-web-browser'

import { ApiError, apiUrl, request } from '@/lib/api/client'
import type { TokenDetail, TokenResponse } from '@/lib/api/types'

import type { Session } from './storage'

/**
 * Where the server sends the browser back after OIDC sign-in. Must be listed in
 * the server's HBOX_OIDC_APP_REDIRECT_URIS (the default includes it).
 */
export const OIDC_REDIRECT_URI = 'homecrate://auth/callback'

function toSession(serverUrl: string, res: TokenResponse): Session {
  return { serverUrl, token: res.token, expiresAt: res.expiresAt, attachmentToken: res.attachmentToken }
}

export async function signInWithPassword(serverUrl: string, username: string, password: string): Promise<Session> {
  try {
    const res = await request<TokenResponse>(serverUrl, '/users/login', {
      method: 'POST',
      body: { username, password, stayLoggedIn: true },
    })
    return toSession(serverUrl, res)
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw new Error('Incorrect email or password.')
    if (e instanceof ApiError && e.status === 429) throw new Error('Too many attempts. Wait a minute and try again.')
    throw e
  }
}

export class SignInCancelledError extends Error {
  constructor() {
    super('Sign-in was cancelled.')
    this.name = 'SignInCancelledError'
  }
}

function toBase64Url(base64: string) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64Url(bytes: Uint8Array) {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return toBase64Url(btoa(binary))
}

/**
 * Signs in through the server's OIDC provider in the system browser, then
 * exchanges the single-use code the server hands back for a session token.
 * The PKCE verifier never leaves the app, so another app catching the
 * redirect can't use the code.
 */
export async function signInWithOidc(serverUrl: string): Promise<Session> {
  const verifier = base64Url(Crypto.getRandomBytes(32))
  const challenge = toBase64Url(
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
      encoding: Crypto.CryptoEncoding.BASE64,
    }),
  )

  const params = new URLSearchParams({
    redirect_uri: OIDC_REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  const result = await WebBrowser.openAuthSessionAsync(
    `${apiUrl(serverUrl, '/users/login/oidc')}?${params}`,
    OIDC_REDIRECT_URI,
  )

  if (result.type !== 'success') throw new SignInCancelledError()

  const returned = new URL(result.url)
  const error = returned.searchParams.get('error')
  if (error) throw new Error('The sign-in provider rejected the sign-in. Try again or ask your server admin.')

  const code = returned.searchParams.get('code')
  if (!code) throw new Error('The server didn’t return a sign-in code.')

  try {
    const res = await request<TokenResponse>(serverUrl, '/users/login/oidc/exchange', {
      method: 'POST',
      body: { code, codeVerifier: verifier },
    })
    return toSession(serverUrl, res)
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw new Error('Sign-in expired. Try again.')
    throw e
  }
}

/** Issues a fresh one-week token from the current one. */
export async function refreshSession(session: Session): Promise<Session> {
  const res = await request<TokenDetail>(session.serverUrl, '/users/refresh', { token: session.token })
  return {
    serverUrl: session.serverUrl,
    token: `Bearer ${res.raw}`,
    expiresAt: res.expiresAt,
    attachmentToken: res.attachmentToken,
  }
}

export async function revokeSession(session: Session) {
  await request<void>(session.serverUrl, '/users/logout', { method: 'POST', token: session.token })
}
