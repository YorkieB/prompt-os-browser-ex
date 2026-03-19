# Extension output contract — AI #1 (Orchestrator)

**File:** `docs/extension-output-contract.md`

Defines what **AI #1** (the browser extension / orchestrator) must emit when handing work to **AI #2** (Cursor).

---

## Required output shape

The extension **must always** output, in order:

1. **An INSTRUCTIONAL CONTRACT PAYLOAD** (complete, valid, and self-contained).
2. **Followed by** the **USER REQUEST** block (see below).

**Never output anything** outside the payload plus the user request — no preamble, no postscript, no marketing copy, no duplicate explanations.

---

## Payload contents

The payload **must include**:

| Block | Contents |
|-------|----------|
| **thinking** | `role`, `tone`, `audience`, `reasoning_style` |
| **inputs** | `required`, `optional` |
| **structure** | `sections`, each with **fields** (`id`, `type`, `required`, etc., per schema) |
| **rules** | `must_do`, `must_not_do` |
| **avoid** | Prohibited patterns (soft constraints / anti-patterns) |
| **output_format** | `type` (e.g. `markdown`, `json`, `code`, `mixed`), `enforce_headings`, `enforce_order`, `enforce_field_labels` |

Domain payloads should also set **`schema_id`** (e.g. `research.schema.v1`) and typically **`extends`: `"base.schema.v1"`** so the shape matches `schemas/base.schema.json` and the active category schema.

Render format is usually **JSON** (machine-readable) or the **rendered template** from `templates/payload-template.md` (YAML/Markdown), as long as all blocks above are present and unambiguous.

---

## USER REQUEST block

Immediately **after** the payload, append **exactly**:

```markdown
# USER REQUEST
<the user's request>
```

Replace `<the user's request>` with the user’s raw or normalised request text. Use the same heading (`# USER REQUEST`) so Cursor and humans can split contract vs task reliably.

---

## Checklist before send

- [ ] Full instructional contract payload (all required blocks populated).
- [ ] `schema_id` matches the intended category schema.
- [ ] No extra text before the payload or between payload and `# USER REQUEST`.
- [ ] Nothing after the user request body except what the product explicitly requires (ideally nothing).
