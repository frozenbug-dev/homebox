import type { ImageSource } from 'expo-image'

import type { Attachment } from '@/lib/api/api'

import { apiUrl } from '@/lib/api/client'
import type { Session } from '@/lib/auth/storage'

/** Image source for an entity attachment, authenticated with the session's bearer token. */
export function attachmentSource(session: Session, entityId: string, attachmentId: string): ImageSource {
  return {
    uri: apiUrl(session.serverUrl, `/entities/${entityId}/attachments/${attachmentId}`),
    headers: { Authorization: session.token },
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
