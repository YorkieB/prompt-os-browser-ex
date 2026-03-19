# Cursor bridge — HTTP API for the Nexus execution layer

Browser extensions **cannot** insert text into Cursor’s chat or read replies. The **execution layer** in this repo therefore uses a small **local HTTP bridge** that you (or your org) runs beside Cursor. The extension POSTs messages; the bridge forwards them to Cursor (or your automation) and returns the assistant text.

---

## Protocol

**Endpoint:** `POST {baseUrl}/v1/send` (configurable in `createHttpCursorDispatcher` via `path`).

**Request headers:** `Content-Type: application/json`

**Request body:**

```json
{
  "message": "string — user message (instructional contract or follow-up)"
}
```

**Success response:** HTTP 200, body:

```json
{
  "response": "string — full assistant reply text"
}
```

Errors should use non-2xx status codes; the client surfaces the response body in **`CursorDispatchHttpError`** (`src/lib/promptOs/cursorDispatcher.ts`).

---

## Extension configuration

1. **Vite env:** set `VITE_PROMPT_OS_CURSOR_BRIDGE_URL` (e.g. in `.env.local`):

   ```bash
   VITE_PROMPT_OS_CURSOR_BRIDGE_URL=http://127.0.0.1:17373
   ```

2. Rebuild / restart `npm run dev` so the side panel bundle picks up the variable.

3. **PromptOSPanel** also accepts `cursorBridgeBaseUrl` or `cursorDispatcher` props for tests or alternate wiring.

---

## CORS

The side panel runs as a Chrome extension page. The bridge must send CORS headers allowing your extension origin, e.g.:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Accept
```

For `OPTIONS` preflight, respond with `204`.

---

## Implementing the bridge

You own the integration between this HTTP surface and Cursor, for example:

- **Manual / semi-auto:** bridge forwards to a FIFO or file that a local script pastes into Cursor (fragile but simple).
- **Automation:** desktop automation or a Cursor/VS Code companion extension invoked via `cursor://` / `vscode://` (requires extra install).
- **Internal API:** if your org exposes a model gateway that mimics Cursor’s behaviour.

The repo ships a **mock bridge** for UI and handshake tests only:

```bash
node scripts/prompt-os-cursor-bridge.mjs
```

It returns `Instructional contract loaded.` when the message looks like a Nexus payload, and a stub reply for the second message. It is **not** a real Cursor connection.

---

## Related code

| Piece | Location |
|-------|----------|
| HTTP client | `src/lib/promptOs/cursorDispatcher.ts` |
| Two-message flow | `src/lib/promptOs/contractExecutor.ts` |
| UI + status | `src/components/promptOs/PromptOSPanel.tsx` — `ExecutionStatus`, `StatusIndicator`, `ExecutionTimeline` (`TimelineEntry` log), `cursorReply` preview |
| Status enum | `src/lib/promptOs/executionStatus.ts` — `EXECUTION_STATUS_MESSAGES`, `yieldForExecutionStatusPaint` |
| Timeline | `src/lib/promptOs/timeline.ts` — `TimelineEntry`, `withTimelineDelta`, `getTotalExecutionTime` / `timelineTotalDurationMs`; UI summary only when `executionComplete` |
| Worker handshake | `prompt-os/docs/cursor-master-prompt.md` |
