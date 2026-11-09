import createClient from 'openapi-fetch'

import { ApiError, ServerUnreachableError } from './client'
import type { components, paths } from './schema'

export type Schemas = components['schemas']
export type Entity = Schemas['repo.EntityOut']
export type EntitySummary = Schemas['repo.EntitySummary']
export type EntityUpdate = Schemas['repo.EntityUpdate']
export type EntityCreate = Schemas['repo.EntityCreate']
export type EntityType = Schemas['repo.EntityTypeSummary']
export type Tag = Schemas['repo.TagOut']
export type TagSummary = Schemas['repo.TagSummary']
export type TreeItem = Schemas['repo.TreeItem']
export type Attachment = Schemas['repo.ItemAttachment']
export type EntityPath = Schemas['repo.EntityPath']

/** The Go API sends the zero UUID for "no parent". */
export const NIL_UUID = '00000000-0000-0000-0000-000000000000'

export function isNil(id?: string | null) {
  return !id || id === NIL_UUID
}

/**
 * Typed client for one signed-in server. Cookies are never sent: the server
 * prefers its session cookie over the Authorization header.
 */
export function createApiClient(serverUrl: string, token: string, onUnauthorized: () => void) {
  const client = createClient<paths>({
    baseUrl: `${serverUrl}/api`,
    credentials: 'omit',
    headers: { Authorization: token },
  })
  client.use({
    onResponse({ response }) {
      if (response.status === 401) onUnauthorized()
    },
    onError() {
      return new ServerUnreachableError('Couldn’t reach the server. Check your connection.')
    },
  })
  return client
}

export type ApiClient = ReturnType<typeof createApiClient>

/** Resolves with the response data, or throws an ApiError carrying the server's message. */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<NonNullable<T>> {
  const { data, error, response } = await call
  if (!response.ok) {
    const message = (error as { error?: string } | undefined)?.error
    throw new ApiError(response.status, message || `Request failed (${response.status})`)
  }
  return data as NonNullable<T>
}
