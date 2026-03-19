# Instructional contract payload template — documentation

The **Handlebars source** bundled by the extension is **`payload-template.md`** (same folder).  
Vite imports it as **`payload-template.md?raw`** in `src/lib/promptOs/payloadRenderer.ts`.

Do not add Markdown headings or prose **inside** `payload-template.md` — that file must stay valid Handlebars so `Handlebars.compile` works.

---

## Bindings (render context)

The renderer passes a **flat** root context (aligned with integration examples):

| Key | Source |
|-----|--------|
| `schema_id` | `schema.schema_id` |
| `role`, `tone`, `audience`, `reasoning_style` | `schema.thinking.*` |
| `inputs` | `schema.inputs` |
| `structure` | `schema.structure` (used as `structure.sections` in template) |
| `rules` | `schema.rules` |
| `avoid` | `schema.avoid` |
| `output_format` | `schema.output_format` |
| `user_request` | Trimmed string; triple-mustache in template + `noEscape` on compile |

---

## Example JSON context (conceptual)

```json
{
  "schema_id": "research.schema.v1",
  "role": "expert_researcher",
  "tone": "analytical",
  "audience": "informed_non_expert",
  "reasoning_style": ["summarize_before_detail", "evidence_first"],
  "inputs": { "required": ["topic", "goal"], "optional": ["scope"] },
  "structure": { "sections": [] },
  "rules": { "must_do": [], "must_not_do": [] },
  "avoid": [],
  "output_format": {
    "type": "markdown",
    "enforce_headings": true,
    "enforce_order": true,
    "enforce_field_labels": true
  },
  "user_request": "…"
}
```

---

## Related

- `src/lib/promptOs/payloadRenderer.ts` — `renderPayload` / `renderInstructionalContract`
- `prompt-os/docs/extension-output-contract.md` — output order (payload + `# USER REQUEST`)
