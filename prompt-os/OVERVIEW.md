# Nexus — system overview

This repository implements a **schema-driven instructional contract** system for a two-AI workflow:

- **AI #1 (Extension / orchestrator)** — generates structured payloads from schemas.
- **AI #2 (Cursor / worker)** — interprets those payloads and executes the work deterministically.

The design is **modular**, **domain-specific**, and **declarative**.

---

## Folder layout

```text
prompt-os/
├── schemas/
│   ├── base.schema.json
│   ├── research.schema.json
│   ├── coding.schema.json
│   ├── image.schema.json
│   ├── planning.schema.json
│   └── agents.schema.json
│
├── templates/
│   ├── payload-template.md       # Handlebars source (?raw import)
│   └── payload-template.docs.md  # Bindings / examples (not compiled)
├── fixtures/
│   └── TEST_PAYLOADS.md
│
├── docs/
│   ├── cursor-master-prompt.md
│   ├── extension-output-contract.md
│   ├── end-to-end-flow.md
│   └── extension-integration-plan.md
│
├── README.md
├── OVERVIEW.md
└── CHANGELOG.md
```

| Path | Responsibility |
|------|----------------|
| `schemas/` | Declarative domain schemas |
| `templates/` | Rendering templates for payload generation |
| `docs/` | Operational rules; **[end-to-end-flow.md](./docs/end-to-end-flow.md)**; **[cursor-bridge.md](./docs/cursor-bridge.md)** — HTTP execution layer |
| `README.md` | High-level usage and quick start |
| `OVERVIEW.md` | This document — architecture and contracts |
| `CHANGELOG.md` | What changed and when |

---

## Schema system

Every payload follows the same **envelope**:

| Block | Purpose |
|-------|---------|
| `schema_id` | Active domain + version (e.g. `research.schema.v1`) |
| `thinking` | `role`, `tone`, `audience`, `reasoning_style[]` |
| `inputs` | `required[]`, `optional[]` |
| `structure` | `sections[]`, each with `fields[]` (`id`, `type`, `required`, …) |
| `rules` | `must_do[]`, `must_not_do[]` |
| `avoid` | Prohibited patterns / soft anti-patterns |
| `output_format` | `type` + `enforce_headings`, `enforce_order`, `enforce_field_labels` |

### Base schema

`schemas/base.schema.json` defines the **canonical shape**. Domain schemas **`extends`** it (conceptually; files may duplicate the envelope for standalone use).

### Domain schemas

Each file is versioned (`*.schema.v1`) and sets **thinking**, **inputs**, **section layout**, **field types**, **rules**, **avoid**, and **output_format**.

| Schema | Role (thinking) | Inputs (required + typical optional) | Sections | Rules emphasis |
|--------|-----------------|--------------------------------------|----------|----------------|
| **Research** | `expert_researcher` | `topic`, `goal` · `scope`, `timeframe` | Overview, Key Points, Evidence & Sources | Cite sources; fact vs interpretation |
| **Coding** | `senior_software_engineer` | `language`, `goal` · `framework`, `constraints` | Problem, Solution (code + explanation) | Runnable code; explain design |
| **Image** | `art_director` | `subject` · `style`, `lighting`, `camera` | Main Prompt, Negative Prompt | Clear subject; no conflicting modifiers |
| **Planning** | `project_planner` | `goal` · `timeline`, `resources` | Goal, Steps, Risks | Ordered tasks; don’t mix goals and tasks |
| **Agents** | `multi_agent_system_designer` | `overall_goal` · `environment`, `tools_available` | System Overview, Agents (JSON), Coordination | Single mandate per agent; explicit protocols |

---

## Payload template

`templates/payload-template.md` is the **Handlebars source** (`?raw`) for AI #1; see `payload-template.docs.md` for binding notes.

It includes:

- `schema_active` flag  
- `schema_type` (from `schema_id`)  
- `thinking`, `inputs`, `structure.sections`, `rules`, `avoid`, `output_format`  
- `# USER REQUEST` appended at the end  

The extension (when implemented) should render this for Cursor to consume.

---

## Cursor worker contract

`docs/cursor-master-prompt.md` defines worker behaviour:

1. Load / interpret the schema.  
2. Adopt **thinking** (role, tone, audience, reasoning style).  
3. Follow **structure** exactly — order, labels, required fields.  
4. Apply **`must_do`** / **`must_not_do`**.  
5. Apply **`avoid`**.  
6. Enforce **`output_format`**.  
7. Treat **field contents** as instructions to execute.  
8. **Validate** before finalizing.  

**Handshake:** on receiving a payload, Cursor replies with exactly:

`Instructional contract loaded.`

Then **waits for the next user message** before producing the deliverable — so execution stays schema-driven and ordered.

---

## Extension output contract

`docs/extension-output-contract.md` defines AI #1 behaviour:

- Always emit the **full** instructional contract payload.  
- Immediately follow with **`# USER REQUEST`** and the user’s text.  
- **No** surrounding commentary, wrappers, or extra text.  
- All required blocks and fields must be present and match the schema.  

This keeps the handoff to Cursor **clean and parseable**.

---

## README

`README.md` summarises:

- What Nexus is  
- The two-AI pipeline  
- Directory map under `prompt-os/`  
- Usage: install Cursor rules / instructions, configure extension output, deterministic execution  

---

## Implemented in `src/` (partial)

- **`src/lib/promptOs/schemaLoader.ts`** — `loadSchema('research' | 'coding' | …)` merges `base.schema.json` with the domain file (thinking field-merge + `output_format` merge). Throws `UnknownPromptOsSchemaCategoryError` for bad categories.
- **`src/lib/promptOs/payloadRenderer.ts`** — `renderPayload` compiles `prompt-os/templates/payload-template.md?raw`; flat `thinking` fields on the Handlebars root context. See `src/lib/promptOs/index.ts` for exports.
- **`src/lib/promptOs/payloadValidator.ts`** — `validatePayload(schema, payload)` returns error strings for missing required sections/fields (`payload` keyed by `section.id` then `field.id`); `validatePayloadOrThrow` / `InvalidInstructionalPayloadError` for strict flows.
- **`src/lib/promptOs/schemaStructureValidator.ts`** — `validateSchemaStructure(schema)` checks `schema_id`, non-empty `structure.sections`, each section `id`/`label`, each field `id`/`type`. **`loadSchema`** calls `validateSchemaStructureOrThrow` on the merged schema.
- **`src/lib/promptOs/buildInstructionalContract.ts`** — `buildInstructionalContract(category, userInputs, userRequest)` validates `schema.inputs.required` then `renderPayload`; `MissingRequiredInputsError` if keys missing.
- **`src/components/promptOs/FormGenerator.tsx`** — schema-driven inputs from `schema.inputs.required` / `optional` (string keys).
- **`src/components/promptOs/PromptOSPanel.tsx`** — main UI: category, test fixtures, **`FormGenerator`**, user request, **buildInstructionalContract**, preview, clipboard.
- **`src/components/tabs/InstructionalContractTab.tsx`** — renders **`PromptOSPanel`** inside the **Contract** tab.
- **`src/lib/promptOs/testFixtures.ts`** — one sample per schema (`research` … `agents`) for manual Cursor verification; mirrored in **`prompt-os/fixtures/TEST_PAYLOADS.md`**.

## Tests

- **`npm run test`** — Vitest (`vitest.config.ts`), **`src/lib/promptOs/payloadRenderer.test.ts`** (research + coding render smoke tests).

## Not implemented yet

- Optional: loop **`PROMPT_OS_TEST_FIXTURES`** in tests; **`validatePayload`** integration tests.

---

## Possible follow-ups

- Expand Vitest coverage (fixtures loop, `validatePayload`, `validateSchemaStructure`)  
- JSON Schema validation against `schemas/*.json` in CI or the extension  
- Auto-loader that maps `schema_id` → schema file + default thinking overrides  

See `CHANGELOG.md` for recorded changes to this specification.
