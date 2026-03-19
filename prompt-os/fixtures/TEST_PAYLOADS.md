# Nexus — test payloads (manual / Cursor checks)

Canonical definitions live in **`src/lib/promptOs/testFixtures.ts`** (`PROMPT_OS_TEST_FIXTURES`).  
The extension **Contract** tab can load these via **Test payload (optional)**.

Use each row with `buildInstructionalContract(category, userInputs, userRequest)` (see `src/lib/promptOs/buildInstructionalContract.ts`).

---

## Research

| Key   | Value |
|-------|--------|
| topic | quantum networking |
| goal  | explain current limitations |

**userRequest (example):**  
Summarise the current limitations of quantum networking for an informed non-expert. Cite sources where possible.

---

## Coding

| Key       | Value |
|-----------|--------|
| language  | Python |
| goal      | build a CLI tool |
| framework | Click |

**userRequest (example):**  
Design a small Python CLI using Click with one subcommand that reads a file path and prints a line count. Include runnable code and brief explanation of design choices.

---

## Image

| Key       | Value |
|-----------|--------|
| subject   | a cyberpunk street at night |
| style     | neon noir |
| lighting  | volumetric fog |
| camera    | 35mm lens |

**userRequest (example):**  
Produce a detailed image-generation prompt (main + negative) suitable for an image model, following the contract structure.

---

## Planning

| Key        | Value |
|------------|--------|
| goal       | launch a new SaaS product |
| timeline   | 6 months |
| resources  | 3 engineers, 1 designer |

**userRequest (example):**  
Break the goal into ordered steps with clear tasks. Call out major risks and dependencies.

---

## Agents

| Key              | Value |
|------------------|--------|
| overall_goal     | automate research synthesis |
| environment      | browser + local filesystem |
| tools_available  | search, summarizer, classifier |

**userRequest (example):**  
Define a small multi-agent system: system overview, agent list (JSON) with single mandate per agent, and coordination protocols.

---

## Automated tests

Run **`npm run test`** (Vitest). See **`src/lib/promptOs/payloadRenderer.test.ts`** for Jest-style checks on `loadSchema` + `renderPayload`.

Suggested extra cases:

1. For each `PROMPT_OS_TEST_FIXTURES` entry, `buildInstructionalContract(...)` does not throw.  
2. Output contains `# INSTRUCTIONAL CONTRACT PAYLOAD` and `# USER REQUEST`.  
3. Output contains `schema_type:` matching `loadSchema(fixture.category).schema_id`.
