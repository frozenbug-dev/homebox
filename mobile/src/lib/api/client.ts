import type { ServerStatus } from './types'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Thrown when the server can't be reached or doesn't look like Homebox. */
export class ServerUnreachableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ServerUnreachableError'
  }
}

/**
 * Turns what the user typed ("homebox.example.com", "192.168.1.5:7745/",
 * "https://example.com/homebox") into a base URL without a trailing slash.
 * Plain hosts default to https; LAN addresses and localhost to http.
 */
export function normalizeServerUrl(input: string): string {
  let value = input.trim()
  if (!value) throw new ServerUnreachableError('Enter the address of your Homebox server.')

  if (!/^https?:\/\//i.test(value)) {
    const host = value.split(/[/:]/)[0]
    const isLocal =
      host === 'localhost' ||
      /^(10|127)\.\d+\.\d+\.\d+$/.test(host) ||
      /^192\.168\.\d+\.\d+$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host) ||
      host.endsWith('.local')
    value = `${isLocal ? 'http' : 'https'}://${value}`
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ServerUnreachableError('That doesn’t look like a valid address.')
  }

  // People often paste a link to a page in the web app; keep only the base.
  const path = url.pathname.replace(/\/(api(\/.*)?|login|home|items?(\/.*)?)?\/?$/, '')
  return `${url.protocol}//${url.host}${path}`
}

export function apiUrl(serverUrl: string, path: string) {
  return `${serverUrl}/api/v1${path.startsWith('/') ? path : `/${path}`}`
}

async function errorMessage(res: Response) {
  try {
    const body = (await res.json()) as { error?: string }
    if (body?.error) return body.error
  } catch {
    // not JSON
  }
  return `Request failed (${res.status})`
}

export interface RequestOptions {
  method?: string
  body?: unknown
  token?: string
  signal?: AbortSignal
}

/**
 * Low-level JSON request against a Homebox server. Cookies are never sent or
 * stored: the server prefers its session cookie over the Authorization header,
 * and a stale cookie from another account would win otherwise.
 */
export async function request<T>(serverUrl: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = options.token

  let res: Response
  try {
    res = await fetch(apiUrl(serverUrl, path), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'omit',
      signal: options.signal,
    })
  } catch (e) {
    if (options.signal?.aborted) throw e
    throw new ServerUnreachableError('Couldn’t reach the server. Check the address and your connection.')
  }

  if (!res.ok) throw new ApiError(res.status, await errorMessage(res))
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** Checks that a Homebox server lives at this address and returns what it supports. */
export async function fetchServerStatus(serverUrl: string, signal?: AbortSignal): Promise<ServerStatus> {
  let status: ServerStatus
  try {
    status = await request<ServerStatus>(serverUrl, '/status', { signal })
  } catch (e) {
    if (e instanceof ApiError) {
      throw new ServerUnreachableError(`No Homebox server found at this address (HTTP ${e.status}).`)
    }
    if (e instanceof SyntaxError) {
      throw new ServerUnreachableError('No Homebox server found at this address.')
    }
    throw e
  }
  if (!status || typeof status.oidc !== 'object') {
    throw new ServerUnreachableError('No Homebox server found at this address.')
  }
  return status
}
