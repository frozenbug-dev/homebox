import type { ImageSource } from 'expo-image'

import type { Attachment } from '@/lib/api/api'

import { apiUrl } from '@/lib/api/client'
import type { Session } from '@/lib/auth/storage'

/** Image source for an entity attachment, authenticated with the session's bearer token. */
export function attachmentSource(session: Session, entityId: string, attachmentId: string): ImageSource {
  return {
    uri: apiUrl(session.serverUrl, `/entities/${entityId}/attachments/${attachmentId}`),
    headers: { Authorization: session.token, ...(session.tenantId ? { 'X-Tenant': session.tenantId } : {}) },
    cacheKey: `${session.serverUrl}/attachments/${attachmentId}`,
  }
}

/** Photos (cover first) and other files of an entity. */
export function splitAttachments(attachments: Attachment[] = []) {
  const photos = attachments
    .filter((a) => a.type === 'photo' || a.mimeType?.startsWith('image/'))
    .sort((a, b) => Number(!!b.primary) - Number(!!a.primary))
  const files = attachments.filter((a) => !photos.includes(a))
  return { photos, files }
}

/** URL for opening an attachment outside the app (browser), authenticated by query params. */
export function attachmentLink(session: Session, entityId: string, attachmentId: string) {
  const params = new URLSearchParams({ access_token: session.attachmentToken })
  if (session.tenantId) params.set('tenant', session.tenantId)
  return `${apiUrl(session.serverUrl, `/entities/${entityId}/attachments/${attachmentId}`)}?${params}`
}
