import { describe, expect, test } from 'vitest'

import {
  getTotalExecutionTime,
  inferTimelineKindFromMessage,
  timelineTotalDurationMs,
  withTimelineDelta,
} from '@/lib/promptOs/timeline'

describe('withTimelineDelta', () => {
  test('first entry has no elapsedMs; second derives delta', () => {
    const a = withTimelineDelta([], {
      timestamp: 1000,
      message: 'Built instructional contract.',
      kind: 'building',
    })
    expect(a.elapsedMs).toBeUndefined()

    const b = withTimelineDelta([a], {
      timestamp: 2500,
      message: 'Cursor loaded.',
      kind: 'waiting',
    })
    expect(b.elapsedMs).toBe(1500)
  })

  test('infers kind when omitted', () => {
    const e = withTimelineDelta([], {
      timestamp: 1,
      message: 'Execution completed successfully.',
    })
    expect(e.kind).toBe('complete')
  })
})

describe('inferTimelineKindFromMessage', () => {
  test('maps keywords', () => {
    expect(inferTimelineKindFromMessage('Built instructional contract.')).toBe('building')
    expect(inferTimelineKindFromMessage('Cursor did not acknowledge')).toBe('error')
    expect(inferTimelineKindFromMessage('Received final output')).toBe('sending')
  })
})

describe('timelineTotalDurationMs', () => {
  test('returns span for two or more entries', () => {
    expect(timelineTotalDurationMs([])).toBeUndefined()
    expect(
      timelineTotalDurationMs([
        { timestamp: 1000, message: 'a' },
        { timestamp: 3500, message: 'b' },
      ])
    ).toBe(2500)
  })
})

describe('getTotalExecutionTime', () => {
  test('matches wall-clock span or null', () => {
    expect(getTotalExecutionTime([])).toBeNull()
    expect(getTotalExecutionTime([{ timestamp: 1, message: 'only' }])).toBeNull()
    expect(
      getTotalExecutionTime([
        { timestamp: 1000, message: 'a' },
        { timestamp: 3500, message: 'b' },
      ])
    ).toBe(2500)
  })
})
