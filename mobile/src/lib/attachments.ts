import type { Attachment } from '@/lib/api/api'
import type { ImageSource } from '@/components/image'

import { apiUrl } from '@/lib/api/client'
import type { Session } from '@/lib/auth/storage'

/**
 * Image source for an entity attachment. The image loader can't send
 * headers, so it authenticates like `attachmentLink` (query params); the
 * cache key leaves the token out so the cache outlives it.
 */
export function attachmentSource(session: Session, entityId: string, attachmentId: string): ImageSource {
  return {
    uri: attachmentLink(session, entityId, attachmentId),
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
