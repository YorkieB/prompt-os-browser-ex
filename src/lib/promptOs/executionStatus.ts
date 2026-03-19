/**
 * Observable pipeline states for the two-message Cursor execution layer.
 */

export type ExecutionStatus =
  | 'idle'
  | 'building'
  | 'sending'
  | 'waiting_handshake'
  | 'executing'
  | 'complete'
  | 'error'

export const EXECUTION_STATUS_MESSAGES: Record<ExecutionStatus, string> = {
  idle: '',
  building: 'Building instructional contract…',
  sending: 'Sending contract to Cursor…',
  waiting_handshake: 'Waiting for Cursor to load the contract…',
  executing: 'Executing under schema rules…',
  complete: 'Execution complete.',
  error: 'An error occurred.',
}

/** True while the user should wait before starting another automated run. */
export function executionStatusIsInFlight(status: ExecutionStatus): boolean {
  return (
    status === 'building' ||
    status === 'sending' ||
    status === 'waiting_handshake' ||
    status === 'executing'
  )
}

/**
 * Yield so the host can paint `sending` before `waiting_handshake` (same bridge await).
 */
export function yieldForExecutionStatusPaint(): Promise<void> {
  const raf =
    typeof globalThis.requestAnimationFrame === 'function'
      ? globalThis.requestAnimationFrame.bind(globalThis)
      : (cb: (time: number) => void) => globalThis.setTimeout(() => cb(0), 0)

  return new Promise((resolve) => {
    raf(() => {
      raf(() => resolve())
    })
  })
}
