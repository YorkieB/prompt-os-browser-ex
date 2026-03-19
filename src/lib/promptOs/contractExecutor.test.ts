import { describe, expect, test, vi } from 'vitest'

import {
  executeInstructionalContract,
  HandshakeNotAcknowledgedError,
  INSTRUCTIONAL_CONTRACT_HANDSHAKE_SNIPPET,
} from '@/lib/promptOs/contractExecutor'
import type { CursorDispatcher } from '@/lib/promptOs/cursorDispatcher'
import type { ExecutionStatus } from '@/lib/promptOs/executionStatus'
import type { TimelineEntry, TimelineEntryInput } from '@/lib/promptOs/timeline'
import { withTimelineDelta } from '@/lib/promptOs/timeline'

function createTimelineSink(): {
  readonly entries: TimelineEntry[]
  readonly addTimeline: (entry: TimelineEntryInput) => void
} {
  const entries: TimelineEntry[] = []
  return {
    entries,
    addTimeline: (partial) => {
      entries.push(withTimelineDelta(entries, partial))
    },
  }
}

describe('executeInstructionalContract', () => {
  test('sends payload then go message and returns both assistant replies', async () => {
    const dispatcher = vi.fn<CursorDispatcher>()
    dispatcher
      .mockResolvedValueOnce('Instructional contract loaded.')
      .mockResolvedValueOnce('Mock execution complete.')

    const result = await executeInstructionalContract('- payload -\n# USER REQUEST\nDo X', {
      dispatcher,
    })

    expect(dispatcher).toHaveBeenCalledTimes(2)
    expect(dispatcher.mock.calls[0]?.[0]).toContain('# USER REQUEST')
    expect(dispatcher.mock.calls[1]?.[0]).toContain('Go')
    expect(result.handshakeReply).toContain(INSTRUCTIONAL_CONTRACT_HANDSHAKE_SNIPPET)
    expect(result.executionReply).toBe('Mock execution complete.')
  })

  test('uses custom go message for the second turn', async () => {
    const dispatcher = vi.fn<CursorDispatcher>()
    dispatcher
      .mockResolvedValueOnce('Instructional contract loaded.')
      .mockResolvedValueOnce('ok')

    await executeInstructionalContract('payload', {
      dispatcher,
      goMessage: 'Proceed with implementation only.',
    })

    expect(dispatcher.mock.calls[1]?.[0]).toBe('Proceed with implementation only.')
  })

  test('throws when handshake text does not contain expected snippet', async () => {
    const dispatcher = vi.fn<CursorDispatcher>().mockResolvedValue('Sorry, cannot load that.')

    await expect(executeInstructionalContract('payload', { dispatcher })).rejects.toBeInstanceOf(
      HandshakeNotAcknowledgedError
    )
    expect(dispatcher).toHaveBeenCalledTimes(1)
  })

  test('emits ExecutionStatus transitions (happy path + error)', async () => {
    const statuses: ExecutionStatus[] = []
    const dispatcher = vi.fn<CursorDispatcher>()
    dispatcher
      .mockResolvedValueOnce('Instructional contract loaded.')
      .mockResolvedValueOnce('final')

    await executeInstructionalContract('payload', {
      dispatcher,
      setExecutionStatus: (s) => statuses.push(s),
      paintBetweenSendingAndHandshake: false,
    })

    expect(statuses).toEqual(['sending', 'waiting_handshake', 'executing', 'complete'])

    statuses.length = 0
    dispatcher.mockReset().mockResolvedValueOnce('no handshake here')

    await expect(
      executeInstructionalContract('payload', {
        dispatcher,
        setExecutionStatus: (s) => statuses.push(s),
        paintBetweenSendingAndHandshake: false,
      })
    ).rejects.toBeInstanceOf(HandshakeNotAcknowledgedError)

    expect(statuses.slice(-1)).toEqual(['error'])
  })

  test('adds past-tense timeline entries on success', async () => {
    const sink = createTimelineSink()
    const dispatcher = vi.fn<CursorDispatcher>()
    dispatcher
      .mockResolvedValueOnce('Instructional contract loaded.')
      .mockResolvedValueOnce('done')

    await executeInstructionalContract('payload', {
      dispatcher,
      addTimeline: sink.addTimeline,
      paintBetweenSendingAndHandshake: false,
    })

    expect(sink.entries.map((t) => t.message)).toEqual([
      'Cursor loaded the instructional contract.',
      'Received final output from Cursor.',
      'Execution completed successfully.',
    ])
    expect(sink.entries.map((t) => t.kind)).toEqual(['waiting', 'sending', 'complete'])
  })

  test('timeline on handshake failure omits generic Execution failed', async () => {
    const sink = createTimelineSink()
    const dispatcher = vi.fn<CursorDispatcher>().mockResolvedValueOnce('nope')

    await expect(
      executeInstructionalContract('payload', {
        dispatcher,
        addTimeline: sink.addTimeline,
        paintBetweenSendingAndHandshake: false,
      })
    ).rejects.toBeInstanceOf(HandshakeNotAcknowledgedError)

    expect(sink.entries.map((t) => t.message)).toEqual([
      'Cursor did not acknowledge the instructional contract.',
    ])
    expect(sink.entries[0]?.kind).toBe('error')
  })

  test('timeline records Execution failed on dispatcher errors', async () => {
    const sink = createTimelineSink()
    const dispatcher = vi
      .fn<CursorDispatcher>()
      .mockRejectedValueOnce(new Error('network down'))

    await expect(
      executeInstructionalContract('payload', {
        dispatcher,
        addTimeline: sink.addTimeline,
        paintBetweenSendingAndHandshake: false,
      })
    ).rejects.toThrow('network down')

    expect(sink.entries.map((t) => t.message)).toEqual(['Execution failed.'])
    expect(sink.entries[0]?.kind).toBe('error')
  })
})
