/**
 * Hands data between a screen and the sheet route it opens. Routes can only
 * receive strings, so the opener parks a request (with its callbacks) here and
 * the sheet picks it up by kind. One sheet at a time, so one slot per kind.
 */

export interface PlacePickRequest {
  title?: string
  selectedId?: string | null
  /** A place can't move into itself or its own sub-places. */
  excludeId?: string
  /** Offer a "Top level" choice (for places). */
  allowTopLevel?: boolean
  onSelect: (place: { id: string | null; name: string }) => void
}

export interface TagsPickRequest {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

/** Picks the tag a tag sits under (or none: top level). */
export interface TagParentPickRequest {
  selectedId: string | null
  /** The tag being edited: it can't sit under itself or its own sub-tags. */
  excludeId?: string
  onSelect: (tag: { id: string | null; name: string }) => void
}

export interface TextEditRequest {
  title: string
  value: string
  kind?: 'text' | 'multiline' | 'integer' | 'decimal'
  placeholder?: string
  /** Rejects empty values (names). */
  required?: boolean
  onSave: (value: string) => void
}

/** Photos taken before there's an entity to attach them to (e.g. while adding an item). */
export interface CaptureRequest {
  onDone: (photos: { uri: string; name: string }[]) => void
}

export interface SheetRequests {
  place: PlacePickRequest
  tags: TagsPickRequest
  tagParent: TagParentPickRequest
  text: TextEditRequest
  capture: CaptureRequest
}

const slots: Partial<SheetRequests> = {}

export function setSheetRequest<K extends keyof SheetRequests>(kind: K, request: SheetRequests[K]) {
  slots[kind] = request
}

export function getSheetRequest<K extends keyof SheetRequests>(kind: K): SheetRequests[K] | undefined {
  return slots[kind]
}
