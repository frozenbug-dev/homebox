import { File, Paths } from 'expo-file-system'
import { useSyncExternalStore } from 'react'

const MAX = 8
const file = new File(Paths.document, 'recent-searches.json')

function load(): string[] {
  try {
    if (!file.exists) return []
    const parsed: unknown = JSON.parse(file.textSync())
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

let recent: string[] | null = null
const listeners = new Set<() => void>()

function get() {
  recent ??= load()
  return recent
}

function set(next: string[]) {
  recent = next
  listeners.forEach((l) => l())
  try {
    if (!next.length) {
      if (file.exists) file.delete()
    } else {
      file.write(JSON.stringify(next))
    }
  } catch {
    // Only a convenience: losing the list is fine.
  }
}

/** Searches the user ran (submitted or acted on), newest first. Kept on this device only. */
export function useRecentSearches() {
  return useSyncExternalStore((l) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }, get)
}

export const recentSearches = {
  add(query: string) {
    const q = query.trim()
    if (!q) return
    set([q, ...get().filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, MAX))
  },
  remove(query: string) {
    set(get().filter((s) => s !== query))
  },
  clear() {
    set([])
  },
}
