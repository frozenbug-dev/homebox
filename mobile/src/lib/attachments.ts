import type { ImageSource } from 'expo-image'

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
