import { useSyncExternalStore } from "react"

const STORAGE_KEY = "martly_recent_searches"
const MAX_RECENT = 8
const NONE: string[] = []

let recent: string[] | null = null
const listeners = new Set<() => void>()

/** Storage can be missing or blocked (private windows, cleared site data); recents are then kept for the visit only */
function read(): string[] {
  if (recent) return recent
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
    recent = Array.isArray(parsed) ? parsed.filter((q): q is string => typeof q === "string").slice(0, MAX_RECENT) : []
  } catch (error) {
    if (!(error instanceof DOMException || error instanceof SyntaxError)) throw error
    recent = []
  }
  return recent
}

function save(next: string[]) {
  recent = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (error) {
    if (!(error instanceof DOMException)) throw error
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Recent searches in the browser, like the app keeps them on the phone: newest first, de-duplicated, 8 at most */
export function useRecentSearches() {
  return useSyncExternalStore(subscribe, read, () => NONE)
}

export function addRecentSearch(query: string) {
  const q = query.trim()
  if (q) save([q, ...read().filter((p) => p.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT))
}

export const removeRecentSearch = (query: string) => save(read().filter((p) => p !== query))
export const clearRecentSearches = () => save([])
