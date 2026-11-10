/**
 * Where the search bar sat on screen when it was tapped, so the search view
 * (`/find`) can expand out of it and shrink back into it (Material 3 search
 * bar → search view container transform).
 */
export interface SearchOrigin {
  x: number
  y: number
  width: number
  height: number
}

let origin: SearchOrigin | null = null

export function setSearchOrigin(next: SearchOrigin | null) {
  origin = next
}

export function getSearchOrigin() {
  return origin
}
