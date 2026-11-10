import { useEffect, useRef, useSyncExternalStore, type ComponentRef, type RefObject } from 'react'
import { Dimensions, type View } from 'react-native'

/**
 * Shared state for the photo viewer's open/close morph: where each photo sits
 * on the screen behind (its "slot"), the photos' aspect ratios, and which slot
 * is hidden while its photo is out in the viewer.
 */

/** Where a photo was opened from. A photo can appear in both at once. */
export type PhotoSource = 'cover' | 'strip'

export interface SlotRect {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

type SlotRef = RefObject<ComponentRef<typeof View> | null>

const slots = new Map<string, { ref: SlotRef; radius: number }>()
const aspects = new Map<string, number>()
const listeners = new Set<() => void>()
let hidden: string | null = null

const slotKey = (source: PhotoSource, id: string) => `${source}:${id}`

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Registers a view as the on-screen slot of a photo. Put the returned ref on
 * a plain View around the image, and hide it (opacity 0) while `hidden`, so
 * the photo looks like it left its place rather than being copied.
 */
export function usePhotoSlot(source: PhotoSource, id: string, radius = 0) {
  const ref: SlotRef = useRef(null)
  const key = slotKey(source, id)

  useEffect(() => {
    slots.set(key, { ref, radius })
    return () => {
      if (slots.get(key)?.ref === ref) slots.delete(key)
    }
  }, [key, radius])

  const isHidden = useSyncExternalStore(subscribe, () => hidden === key)
  return { ref, hidden: isHidden }
}

/** The slot's current position in the window, or null when it isn't on screen. */
export function measureSlot(source: PhotoSource, id: string): Promise<SlotRect | null> {
  const slot = slots.get(slotKey(source, id))
  const view = slot?.ref.current
  if (!slot || !view) return Promise.resolve(null)
  return new Promise((resolve) => {
    view.measureInWindow((x, y, width, height) => {
      const screen = Dimensions.get('window')
      const onScreen = width > 0 && height > 0 && x < screen.width && x + width > 0 && y < screen.height && y + height > 0
      resolve(onScreen ? { x, y, width, height, radius: slot.radius } : null)
    })
  })
}

/** Hides one slot (the photo currently "out" in the viewer), or none. */
export function setHiddenSlot(source: PhotoSource | null, id?: string) {
  const next = source && id ? slotKey(source, id) : null
  if (next === hidden) return
  hidden = next
  listeners.forEach((l) => l())
}

/** Records a photo's aspect ratio from an image's onLoad (thumbnails keep it too). */
export function rememberAspect(id: string, width?: number, height?: number) {
  if (width && height) aspects.set(id, width / height)
}

export function photoAspect(id: string) {
  return aspects.get(id)
}
