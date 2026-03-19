import type { Prompt, EnhancementMode } from './types'

// ── Key constants ──────────────────────────────────────────────────────────
const KEYS = {
  customPrompts:  'custom-prompts',
  favorites:      'favorites',
  history:        'prompt-os-history',
  versions:       'prompt-os-versions',
} as const

// ── Helpers ────────────────────────────────────────────────────────────────
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

// ── Custom prompts ─────────────────────────────────────────────────────────
export function getCustomPrompts(): Prompt[] {
  return load<Prompt[]>(KEYS.customPrompts, [])
}

export function saveCustomPrompt(prompt: Prompt): void {
  const prompts = getCustomPrompts()
  save(KEYS.customPrompts, [...prompts, prompt])
}

export function saveEdit(updated: Prompt): void {
  const prompts = getCustomPrompts()
  const idx = prompts.findIndex((p) => p.id === updated.id)
  if (idx >= 0) {
    prompts[idx] = { ...updated, updatedAt: Date.now() }
    save(KEYS.customPrompts, prompts)
  } else {
    save(KEYS.customPrompts, [...prompts, updated])
  }
}

export function deleteCustomPrompt(id: string): void {
  save(KEYS.customPrompts, getCustomPrompts().filter((p) => p.id !== id))
}

// ── Favorites ──────────────────────────────────────────────────────────────
export function getFavorites(): string[] {
  return load<string[]>(KEYS.favorites, [])
}

export function saveFavorite(id: string): void {
  const favs = getFavorites()
  if (!favs.includes(id)) save(KEYS.favorites, [...favs, id])
}

export function removeFavorite(id: string): void {
  save(KEYS.favorites, getFavorites().filter((f) => f !== id))
}

export function toggleFavorite(id: string): boolean {
  const favs = getFavorites()
  if (favs.includes(id)) {
    save(KEYS.favorites, favs.filter((f) => f !== id))
    return false
  }
  save(KEYS.favorites, [...favs, id])
  return true
}

// ── Version history ────────────────────────────────────────────────────────
export interface VersionSnapshot {
  promptId: string
  version: number
  content: string
  savedAt: number
}

export function getVersions(promptId: string): VersionSnapshot[] {
  const all = load<VersionSnapshot[]>(KEYS.versions, [])
  return all.filter((v) => v.promptId === promptId).sort((a, b) => b.savedAt - a.savedAt)
}

export function saveVersion(promptId: string, version: number, content: string): void {
  const all = load<VersionSnapshot[]>(KEYS.versions, [])
  // Keep max 10 versions per prompt
  const others = all.filter((v) => v.promptId !== promptId)
  const mine   = all.filter((v) => v.promptId === promptId)
  const trimmed = [...mine, { promptId, version, content, savedAt: Date.now() }]
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, 10)
  save(KEYS.versions, [...others, ...trimmed])
}

// ── Enhancement history ────────────────────────────────────────────────────
export interface HistoryEntry {
  id: string
  original: string
  enhanced: string
  mode: EnhancementMode
  model: string
  timestamp: number
}

export function getHistory(): HistoryEntry[] {
  return load<HistoryEntry[]>(KEYS.history, []).sort((a, b) => b.timestamp - a.timestamp)
}

export function saveToHistory(entry: Omit<HistoryEntry, 'id'>): void {
  const history = load<HistoryEntry[]>(KEYS.history, [])
  const id = `hist-${Date.now()}`
  // Keep max 50 entries
  const trimmed = [{ ...entry, id }, ...history].slice(0, 50)
  save(KEYS.history, trimmed)
}

export function clearHistory(): void {
  localStorage.removeItem(KEYS.history)
}

export function deleteHistoryEntry(id: string): void {
  save(KEYS.history, getHistory().filter((h) => h.id !== id))
}
