import type { CursorDispatcher } from '@/lib/promptOs/cursorDispatcher'
import { resolveCursorDispatcher } from '@/lib/promptOs/cursorDispatcher'
import {
  type ExecutionStatus,
  yieldForExecutionStatusPaint,
} from '@/lib/promptOs/executionStatus'
import type { TimelineEntryInput, TimelineVisualKind } from '@/lib/promptOs/timeline'

/** Substring Cursor must return per `cursor-master-prompt.md` (exact line may include trailing punctuation). */
export const INSTRUCTIONAL_CONTRACT_HANDSHAKE_SNIPPET = 'Instructional contract loaded'

export class HandshakeNotAcknowledgedError extends Error {
  constructor(readonly assistantPreview: string) {
    super(
      `Cursor did not acknowledge the instructional contract (expected assistant text to include "${INSTRUCTIONAL_CONTRACT_HANDSHAKE_SNIPPET}").`
    )
    this.name = 'HandshakeNotAcknowledgedError'
  }
}

export interface ExecuteInstructionalContractOptions {
  readonly dispatcher?: CursorDispatcher
  readonly cursorBridgeBaseUrl?: string
  /** Second user message; default asks Cursor to execute under the loaded contract. */
  readonly goMessage?: string
  /**
   * Drives the observable pipeline (`idle` → `sending` → … → `complete` | `error`).
   * Does not receive `building` (set in the UI before payload build).
   */
  readonly setExecutionStatus?: (status: ExecutionStatus) => void
  /**
   * Timeline rows (caller merges `elapsedMs` via {@link withTimelineDelta}).
   * Use `timestamp: Date.now()` at emit time; pass `kind` for stable coloring.
   */
  readonly addTimeline?: (entry: TimelineEntryInput) => void
  /**
   * When true (default), yields one frame between `sending` and `waiting_handshake` so both can paint
   * before the first bridge round-trip.
   */
  readonly paintBetweenSendingAndHandshake?: boolean
}

const DEFAULT_GO_MESSAGE = 'Go — execute under the loaded contract.'

function handshakeOk(assistantText: string): boolean {
  return assistantText.includes(INSTRUCTIONAL_CONTRACT_HANDSHAKE_SNIPPET)
}

/**
 * Two-turn pipeline: send instructional contract payload, verify handshake, send follow-up (usually “Go”).
 *
 * @returns Assistant text from both turns (`handshakeReply`, `executionReply`).
 */
export async function executeInstructionalContract(
  payload: string,
  options: ExecuteInstructionalContractOptions = {}
): Promise<{ handshakeReply: string; executionReply: string }> {
  const setSt = options.setExecutionStatus ?? (() => {})
  const paint = options.paintBetweenSendingAndHandshake !== false
  const addTimeline = options.addTimeline
  const log = (message: string, kind: TimelineVisualKind) => {
    addTimeline?.({ timestamp: Date.now(), message, kind })
  }

  const dispatcher = resolveCursorDispatcher({
    cursorDispatcher: options.dispatcher,
    cursorBridgeBaseUrl: options.cursorBridgeBaseUrl,
  })

  try {
    setSt('sending')
    if (paint) {
      await yieldForExecutionStatusPaint()
    }
    setSt('waiting_handshake')
    const handshakeReply = await dispatcher(payload)

    if (!handshakeOk(handshakeReply)) {
      log('Cursor did not acknowledge the instructional contract.', 'error')
      throw new HandshakeNotAcknowledgedError(
        handshakeReply.length > 600 ? `${handshakeReply.slice(0, 600)}…` : handshakeReply
      )
    }

    log('Cursor loaded the instructional contract.', 'waiting')

    setSt('executing')
    const go = (options.goMessage?.trim() || DEFAULT_GO_MESSAGE).trim()
    const executionReply = await dispatcher(go)
    log('Received final output from Cursor.', 'sending')
    setSt('complete')
    log('Execution completed successfully.', 'complete')

    return { handshakeReply, executionReply }
  } catch (e) {
    setSt('error')
    if (!(e instanceof HandshakeNotAcknowledgedError)) {
      log('Execution failed.', 'error')
    }
    throw e
  }
}
