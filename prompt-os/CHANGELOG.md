# Changelog

All notable changes to **Nexus** (`prompt-os/`) are documented here.

The format is loosely [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added

- **`docs/USER_MANUAL.md`** (repo **docs/**) — install, tab tour, Nexus Contract tab, Cursor manual + bridge, troubleshooting; root **`README.md`** points here.
- **`docs/cursor-bridge.md`** — HTTP API for the execution layer (`POST /v1/send`), CORS, **`VITE_PROMPT_OS_CURSOR_BRIDGE_URL`**, mock bridge **`npm run bridge:mock`**.
- **`src/lib/promptOs/cursorDispatcher.ts`** — `CursorDispatcher`, `createHttpCursorDispatcher`, `getDefaultCursorDispatcher` / env resolution, typed errors.
- **`src/lib/promptOs/contractExecutor.ts`** — **`executeInstructionalContract`**: handshake check vs **`cursor-master-prompt.md`**, second message (configurable **Go**), **`setExecutionStatus`** (`ExecutionStatus` state machine).
- **`src/lib/promptOs/executionStatus.ts`** — pipeline enum + **`EXECUTION_STATUS_MESSAGES`**, **`executionStatusIsInFlight`**, **`yieldForExecutionStatusPaint`**.
- **`StatusIndicator.tsx`** / **`ExecutionTimeline.tsx`** — **`elapsedMs`**, **`TimelineVisualKind`** colors, **`getTotalExecutionTime`** summary (**`Total execution time: X.XXs`**) only when **`executionComplete`**; **`timeline.ts`** (**`withTimelineDelta`**, **`inferTimelineKindFromMessage`**); **`PromptOSPanel`** **`cursorReply`**; **`showExecutionActivityLog`**.
- **`PromptOSPanel`** — **Send to Cursor (2-step)** button, status line (building / sending / handshake / executing), Vitest **`contractExecutor.test.ts`**.
- **`OVERVIEW.md`** — system architecture, schema summary, contracts, and roadmap gaps.
- **`src/lib/promptOs/`** — schema loader: `loadSchema(category)`, `listPromptOsSchemaCategories()`, typed `InstructionalContractSchema`, JSON imports from `prompt-os/schemas/`.
- **`payloadRenderer.ts`** + **`prompt-os/templates/payload-template.md`** (`?raw`) — Handlebars render; flat `thinking` on root context; **`handlebars`** dependency. Prose moved to **`payload-template.docs.md`** (replaces separate `.hbs`).
- **`payloadValidator.ts`** — `validatePayload` / `validatePayloadOrThrow` against `schema.structure` (nested payload by section + field id).
- **`schemaStructureValidator.ts`** — `validateSchemaStructure` / `validateSchemaStructureOrThrow` / `InvalidSchemaStructureError`; invoked from **`loadSchema`** after merge.
- **`buildInstructionalContract.ts`** + **`InstructionalContractTab`** — end-to-end flow: category → required inputs → build/copy rendered contract; new **Contract** nav tab.
- **`src/components/promptOs/FormGenerator.tsx`** — reusable declarative-input form; **`InstructionalContractTab`** refactored to use it.
- **`PromptOSPanel.tsx`** — instructional-contract builder (**Build & copy**, **Send to Cursor (2-step)** + status line); **`InstructionalContractTab`** thin wrapper. Vitest **`contractExecutor.test.ts`**.
- **`testFixtures.ts`** + **`prompt-os/fixtures/TEST_PAYLOADS.md`** — five test payloads; Contract tab **Test payload** selector.
- **`docs/end-to-end-flow.md`** — numbered user journey: Contract tab → schema inputs → build & copy → paste to Cursor → **`Instructional contract loaded.`** → second message (e.g. **Go**); optional **Send to Cursor** notes.
- **`docs/extension-integration-plan.md`** — end-to-end extension flow mapped to `src/lib/promptOs/*` + Contract tab; **`SchemaCategory`** type alias on `schemaLoader`.
- **Vitest** — `vitest.config.ts`, **`npm run test`**, **`src/lib/promptOs/payloadRenderer.test.ts`** (Jest-style `describe` / `test` / `expect`).

### Changed

- ESLint/SonarJS fixes: clipboard promise handling (**`PromptOSPanel`**), mock bridge **`eslint-disable sonarjs/cors`**, Handlebars **`noEscape`** block disable in **`payloadRenderer.ts`**.

---

## [1.0.0-spec] — 2026-03-19

Initial **instructional contract** specification and documentation (schemas + template + worker/extension contracts).

### Added

- **`schemas/base.schema.json`** — canonical envelope (`thinking`, `inputs`, `structure`, `rules`, `avoid`, `output_format`).
- **`schemas/research.schema.v1`** — researcher persona; overview / key points / evidence; string-array inputs.
- **`schemas/coding.schema.v1`** — engineer persona; problem + solution with `code` field type.
- **`schemas/image.schema.v1`** — art director persona; main + negative prompt sections.
- **`schemas/planning.schema.v1`** — planner persona; goal, steps, optional risks.
- **`schemas/agents.schema.v1`** — multi-agent designer; overview, `agent_list` (`json`), coordination.
- **`templates/payload-template.md`** — Handlebars instructional contract + bindings + example JSON context.
- **`docs/cursor-master-prompt.md`** — worker steps, validation, handshake (`Instructional contract loaded.` + wait).
- **`docs/extension-output-contract.md`** — payload then `# USER REQUEST`; no extra wrapper text.
- **`README.md`** — two-AI pipeline, paths, usage.

### Notes

- Domain schemas include `output_format` for alignment with the base envelope.
- Extension **application code** does not yet auto-generate or export these payloads; spec lives under `prompt-os/` only.

---

## Tag meaning

- **`1.0.0-spec`** — first complete *specification* drop (not tied to npm or extension semver).
