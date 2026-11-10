import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'

import {
  type CaptureRequest,
  getSheetRequest,
  setSheetRequest,
  type PlacePickRequest,
  type SheetRequests,
  type TagsPickRequest,
  type TextEditRequest,
} from './sheet-requests'

/** Opens the shared picker / editor sheets. */
export function useSheets() {
  const router = useRouter()
  return {
    pickPlace(request: PlacePickRequest) {
      setSheetRequest('place', request)
      router.push('/pick-place')
    },
    pickTags(request: TagsPickRequest) {
      setSheetRequest('tags', request)
      router.push('/pick-tags')
    },
    editText(request: TextEditRequest) {
      setSheetRequest('text', request)
      router.push('/edit-text')
    },
    /** Opens the camera and hands the photos back instead of uploading them. */
    capturePhotos(request: CaptureRequest) {
      setSheetRequest('capture', request)
      router.push('/capture')
    },
  }
}

/**
 * The request a sheet route was opened with. If there is none (e.g. the app
 * restored the route after a restart), the sheet closes itself.
 */
export function useSheetRequest<K extends keyof SheetRequests>(kind: K): SheetRequests[K] | undefined {
  const router = useRouter()
  const [request] = useState(() => getSheetRequest(kind))
  useEffect(() => {
    if (!request && router.canGoBack()) router.back()
  }, [request, router])
  return request
}
