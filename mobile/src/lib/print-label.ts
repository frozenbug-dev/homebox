import * as Print from 'expo-print'
import { Alert } from 'react-native'

import { apiUrl } from '@/lib/api/client'
import type { Session } from '@/lib/auth/storage'

function toDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Couldn’t read the label'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Prints the server-rendered Homebox label (QR code, name, asset id) for an
 * item or place through the system print dialog (AirPrint / Android print).
 */
export async function printLabel(session: Session, kind: 'item' | 'location', id: string) {
  try {
    const res = await fetch(apiUrl(session.serverUrl, `/labelmaker/${kind}/${id}`), {
      headers: { Authorization: session.token, ...(session.tenantId ? { 'X-Tenant': session.tenantId } : {}) },
    })
    if (!res.ok) throw new Error(`The server couldn’t make a label (${res.status}).`)
    const image = await toDataUrl(await res.blob())
    await Print.printAsync({
      html: `<html><body style="margin:0"><img src="${image}" style="display:block;max-width:100%" /></body></html>`,
    })
  } catch (e) {
    // Closing the print dialog without printing isn't an error worth showing.
    const message = e instanceof Error ? e.message : String(e)
    if (!/cancel/i.test(message)) Alert.alert('Couldn’t print label', message)
  }
}
