# Extension-side integration plan — Nexus

This document describes how the **browser extension** integrates instructional contracts end-to-end, and maps each step to **this repo’s implementation** (or a suggested next refactor).

**User-journey narrative (Cursor handshake + “Go” message):** see **[end-to-end-flow.md](./end-to-end-flow.md)**.

**Execution layer (HTTP bridge):** see **[cursor-bridge.md](./cursor-bridge.md)** — **`cursorDispatcher.ts`**, **`contractExecutor.ts`**, **Send to Cursor (2-step)** in **`PromptOSPanel`**.

---

## Goal

When a user works with Nexus in the extension, they should be able to:

1. **Pick** a schema category (`research` | `coding` | `image` | `planning` | `agents`).
2. See a **schema-driven form** for `inputs.required` and `inputs.optional`.
3. Enter a **free-form user request** (post-contract task for Cursor).
4. **Build** the instructional contract (rendered payload + `# USER REQUEST`).
5. **Validate** before emit (required inputs; optional structure preflight).
6. **Output** for Cursor: today this is **copy to clipboard** + preview (see *Cursor output* below).

---

## High-level flow

| Step | Responsibility | Implementation in this repo |
|------|----------------|------------------------------|
| Load merged schema | Versioning + base envelope | **`src/lib/promptOs/schemaLoader.ts`** → `loadSchema(category)` |
| Render form labels / fields | From `schema.inputs` | **`src/components/promptOs/FormGenerator.tsx`** — `FormGenerator`; used by **`InstructionalContractTab`** |
| Assemble + render contract | Handlebars over schema + request | **`src/lib/promptOs/buildInstructionalContract.ts`** → `buildInstructionalContract` → **`payloadRenderer.ts`** → `renderPayload` |
| Preflight validation | Required keys, schema shape, optional user payload | **`validateSchemaStructure`** / **`validateSchemaStructureOrThrow`** (`schemaStructureValidator.ts`) — `schema_id` + `structure.sections` + field `id`/`type` (also runs inside **`loadSchema`**); **`buildInstructionalContract`** (required inputs); **`validatePayload`** (user-filled section/field map when you collect it) |
| Test data | Regression / manual Cursor checks | **`testFixtures.ts`** + Contract tab **Test payload** |
| UI glue | Category → form → preview → copy / send | **`PromptOSPanel.tsx`**; **`InstructionalContractTab.tsx`**; **`App.tsx`** **Contract** tab |
| Cursor execution (optional) | HTTP transport + handshake + second message | **`cursorDispatcher.ts`** (`createHttpCursorDispatcher`, env **`VITE_PROMPT_OS_CURSOR_BRIDGE_URL`**), **`contractExecutor.ts`** (`executeInstructionalContract`), mock **`npm run bridge:mock`** |

### Suggested future refactors (optional)

| Doc name | Purpose |
|----------|---------|
| **`FormGenerator.tsx`** | Implemented at **`src/components/promptOs/FormGenerator.tsx`**; reuse in popups or other panels via `idPrefix`. |
| **`ContractBuilder.ts`** | Thin wrapper name only: today `buildInstructionalContract` already composes validate + `renderPayload`. |
| **`Validator.ts`** | Could re-export `validateRequiredInputs` + `validatePayload` from one module if you prefer a single import. |
| **`PromptOsPanel.tsx`** | Top-level glue if you split the tab into smaller pieces. |

---

## Schema loader (extension-ready)

The integration doc you may have seen uses **relative JSON imports** from `prompt-os/schemas/`. In this monorepo, the loader lives at:

**`src/lib/promptOs/schemaLoader.ts`**

- Imports **`../../../prompt-os/schemas/*.schema.json`** (Vite bundles them into the extension UI build).
- Merges **`base.schema.json`** with the domain file: shallow spread + **`mergeThinking`** + merged **`output_format`**.
- Throws **`UnknownPromptOsSchemaCategoryError`** for invalid categories.
- **`SchemaCategory`** is exported as an alias of **`PromptOsSchemaCategory`** (`'research' | 'coding' | 'image' | 'planning' | 'agents'`).

API:

```ts
import { loadSchema, type SchemaCategory, listPromptOsSchemaCategories } from '@/lib/promptOs'

const schema = loadSchema('coding' satisfies SchemaCategory)
```

Equivalent to your reference pattern:

```ts
return {
  ...baseSchema,
  ...schema,
  thinking: mergeThinking(baseSchema.thinking, schema.thinking),
  output_format: { ...baseSchema.output_format, ...schema.output_format },
}
```

(`structure`, `rules`, `avoid` come from the domain via `...domain`.)

---

## Cursor output

- **Cursor** (desktop) does not expose a stable API for a **Chrome extension** to “insert into the editor” directly.
- **Current behaviour:** **Build & copy contract** copies the full rendered string (contract + `# USER REQUEST`) to the clipboard; the user pastes into Cursor chat.
- **Alternatives:** “Open Cursor” deep link (platform-dependent), or a **VS Code**/**Cursor** extension that reads from a shared channel — out of scope for this Chrome extension unless you add a companion.

Document this limitation in UX copy where you mention “Insert into Cursor”.

---

## Validation layers

1. **Required declarative inputs** — `schema.inputs.required` keys must have non-empty values → **`MissingRequiredInputsError`** from **`buildInstructionalContract`**.
2. **Structure payload** (optional today) — when the UI collects `section.id` / `field.id` data, call **`validatePayload(schema, payload)`** before build or append structured data to the exported text.
3. **Test fixtures** — **`PROMPT_OS_TEST_FIXTURES`** for smoke checks and manual Cursor runs.

---

## Checklist for contributors

- [ ] Category select uses **`listPromptOsSchemaCategories()`** or **`PROMPT_OS_SCHEMA_CATEGORIES`** (single source of truth).
- [ ] New domain schema: add JSON under **`prompt-os/schemas/`**, register in **`schemaLoader.ts`**, extend **`types.ts`** union if needed.
- [ ] Template changes: edit **`prompt-os/templates/payload-template.md`** (Handlebars only) and **`payload-template.docs.md`** notes.
- [ ] Cursor worker rules: keep **`docs/cursor-master-prompt.md`** in sync with handshake + validation steps.

---

## Related files

| Path | Role |
|------|------|
| `src/lib/promptOs/index.ts` | Barrel exports |
| `prompt-os/docs/extension-output-contract.md` | What AI #1 must emit |
| `prompt-os/docs/cursor-master-prompt.md` | What AI #2 does with the payload |
| `prompt-os/OVERVIEW.md` | System overview |
| `prompt-os/fixtures/TEST_PAYLOADS.md` | Human-readable test payloads |
