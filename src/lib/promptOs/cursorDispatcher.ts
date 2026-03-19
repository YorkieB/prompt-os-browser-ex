/**
 * Abstraction for sending chat messages to Cursor (or a stand-in) and receiving the assistant reply.
 *
 * Chrome extensions cannot call Cursor’s UI directly; production setups typically run a small **local bridge**
 * (HTTP) that forwards messages via automation or internal tooling. See `prompt-os/docs/cursor-bridge.md`.
 */

/** Sends one user message; returns the assistant’s text response. */
export type CursorDispatcher = (message: string) => Promise<string>

export class CursorDispatchUnavailableError extends Error {
  constructor() {
    super(
      'Cursor bridge is not configured. Set VITE_PROMPT_OS_CURSOR_BRIDGE_URL (e.g. http://127.0.0.1:17373) or pass cursorBridgeBaseUrl / cursorDispatcher to PromptOSPanel. See prompt-os/docs/cursor-bridge.md'
    )
    this.name = 'CursorDispatchUnavailableError'
  }
}

export class CursorDispatchHttpError extends Error {
  constructor(
    readonly status: number,
    readonly bodyPreview: string
  ) {
    super(`Cursor bridge HTTP ${status}: ${bodyPreview.slice(0, 200)}`)
    this.name = 'CursorDispatchHttpError'
  }
}

export interface HttpCursorDispatcherOptions {
  /** Path appended to base URL. Default: `/v1/send` */
  readonly path?: string
  /** Request timeout in ms. Default: 120_000 */
  readonly timeoutMs?: number
}

function joinBaseAndPath(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

/**
 * Creates a dispatcher that POSTs JSON `{ "message": string }` and reads `{ "response": string }`.
 */
export function createHttpCursorDispatcher(
  baseUrl: string,
  options: HttpCursorDispatcherOptions = {}
): CursorDispatcher {
  const path = options.path ?? '/v1/send'
  const timeoutMs = options.timeoutMs ?? 120_000
  const url = joinBaseAndPath(baseUrl, path)

  return async (message: string) => {
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message }),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new CursorDispatchHttpError(0, msg || 'Network error')
    }

    const rawText = await response.text()
    if (!response.ok) {
      throw new CursorDispatchHttpError(response.status, rawText || response.statusText)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawText) as unknown
    } catch {
      throw new CursorDispatchHttpError(response.status, `Invalid JSON: ${rawText.slice(0, 120)}`)
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('response' in parsed) ||
      typeof (parsed as { response: unknown }).response !== 'string'
    ) {
      throw new CursorDispatchHttpError(
        response.status,
        'Bridge must return JSON { "response": string }'
      )
    }

    return (parsed as { response: string }).response
  }
}

/** Throws {@link CursorDispatchUnavailableError} on every call (forces explicit configuration). */
export function createUnconfiguredCursorDispatcher(): CursorDispatcher {
  return async () => {
    throw new CursorDispatchUnavailableError()
  }
}

function readViteBridgeUrl(): string | undefined {
  try {
    const v = import.meta.env.VITE_PROMPT_OS_CURSOR_BRIDGE_URL
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined
  } catch {
    return undefined
  }
}

/**
 * Resolves a dispatcher from env (`VITE_PROMPT_OS_CURSOR_BRIDGE_URL`) or returns an unconfigured stub.
 */
export function getDefaultCursorDispatcher(): CursorDispatcher {
  const url = readViteBridgeUrl()
  if (url) {
    return createHttpCursorDispatcher(url)
  }
  return createUnconfiguredCursorDispatcher()
}

/**
 * Resolves dispatcher: explicit override → `baseUrl` → Vite env → unconfigured stub.
 */
export function resolveCursorDispatcher(
  options: {
    readonly cursorDispatcher?: CursorDispatcher
    readonly cursorBridgeBaseUrl?: string
  } = {}
): CursorDispatcher {
  if (options.cursorDispatcher) {
    return options.cursorDispatcher
  }
  if (options.cursorBridgeBaseUrl?.trim()) {
    return createHttpCursorDispatcher(options.cursorBridgeBaseUrl.trim())
  }
  return getDefaultCursorDispatcher()
}
