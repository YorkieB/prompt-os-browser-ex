import { useState, useCallback } from 'react'

/**
 * Drop-in replacement for @github/spark's useKV hook.
 * Persists state to localStorage.
 */
export function useStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const newValue =
          typeof value === 'function'
            ? (value as (prev: T) => T)(prev)
            : value
        try {
          localStorage.setItem(key, JSON.stringify(newValue))
        } catch {
          // Storage quota exceeded or unavailable — still update in-memory state
        }
        return newValue
      })
    },
    [key]
  )

  return [state, setValue]
}
