/**
 * Chronological activity log for the Nexus execution pipeline.
 * Prefer short, past-tense entries (what just completed).
 */

/** Drives timeline row color (execution-trace semantics). */
export type TimelineVisualKind =
  | 'building'
  | 'sending'
  | 'waiting'
  | 'complete'
  | 'error'
  | 'neutral'

export type TimelineEntry = {
  readonly timestamp: number
  readonly message: string
  /** Milliseconds since the previous entry’s `timestamp` (first row has none). */
  readonly elapsedMs?: number
  readonly kind?: TimelineVisualKind
}

/** Payload for a new row before `elapsedMs` is computed from the prior entry. */
export type TimelineEntryInput = Omit<TimelineEntry, 'elapsedMs'>

const MSG = (s: string) => s.toLowerCase()

/**
 * Fallback when callers omit `kind` — keyword heuristics (prefer explicit `kind` from producers).
 */
export function inferTimelineKindFromMessage(message: string): TimelineVisualKind {
  const m = MSG(message)
  if (
    m.includes('built instructional') ||
    m.includes('building instructional') ||
    m.startsWith('built ')
  ) {
    return 'building'
  }
  if (
    m.includes('could not build') ||
    m.includes('validation error') ||
    m.includes('did not acknowledge') ||
    m.includes('execution failed') ||
    m.includes('failed.')
  ) {
    return 'error'
  }
  if (
    m.includes('completed successfully') ||
    m.includes('execution complete') ||
    (m.includes('complete') && !m.includes('instructional'))
  ) {
    return 'complete'
  }
  if (
    m.includes('loaded the instructional') ||
    m.includes('waiting for cursor') ||
    m.includes('handshake')
  ) {
    return 'waiting'
  }
  if (m.includes('received final') || m.includes('sending contract') || m.includes(' sent ')) {
    return 'sending'
  }
  return 'neutral'
}

/**
 * Append one entry with `elapsedMs` derived from the previous row’s timestamp.
 */
export function withTimelineDelta(
  previousEntries: readonly TimelineEntry[],
  partial: TimelineEntryInput
): TimelineEntry {
  const now = partial.timestamp
  const last = previousEntries.at(-1)
  const elapsedMs = last === undefined ? undefined : now - last.timestamp
  const kind = partial.kind ?? inferTimelineKindFromMessage(partial.message)
  return { timestamp: now, message: partial.message, elapsedMs, kind }
}

/** Wall-clock span from first to last entry (ms), if at least two points exist. */
export function timelineTotalDurationMs(entries: readonly TimelineEntry[]): number | undefined {
  if (entries.length < 2) {
    return undefined
  }
  const first = entries.at(0)
  const last = entries.at(-1)
  if (first === undefined || last === undefined) {
    return undefined
  }
  return last.timestamp - first.timestamp
}

/**
 * Total wall-clock duration from the first to the last timeline row (ms), or `null` if not computable.
 * Prefer showing a UI summary only after a successful run (see {@link ExecutionTimeline} `executionComplete`).
 */
export function getTotalExecutionTime(entries: readonly TimelineEntry[]): number | null {
  const ms = timelineTotalDurationMs(entries)
  return ms ?? null
}
