# Nexus

A schema-driven system for orchestrating a two-AI pipeline:

- **AI #1 (Extension)** generates structured instructional payloads.
- **AI #2 (Cursor)** executes the work exactly as defined.

## Components

In this repository, Nexus lives under **`prompt-os/`**:

| Path | Purpose |
|------|---------|
| `prompt-os/schemas/` | Category schemas (`base`, `research`, `coding`, `image`, `planning`, `agents`) |
| `prompt-os/templates/` | **`payload-template.md`** (Handlebars `?raw`) + **`payload-template.docs.md`** |
| `prompt-os/fixtures/` | **`TEST_PAYLOADS.md`** — human-readable copy of sample inputs |
| `prompt-os/docs/` | Cursor master prompt, extension contract, **end-to-end-flow.md**, **cursor-bridge.md**, **extension-integration-plan.md** |
| `prompt-os/OVERVIEW.md` | Full system overview for Cursor, contributors, and maintainers |
| `prompt-os/CHANGELOG.md` | History of spec changes under `prompt-os/` |

**Deep dive:** **[How it runs end-to-end](./docs/end-to-end-flow.md)** · **[OVERVIEW.md](./OVERVIEW.md)**.

**Using the Chrome extension UI:** see the repo **[User manual](../docs/USER_MANUAL.md)** (Contract tab, build & copy, optional bridge).

## Usage

1. Paste **`prompt-os/docs/cursor-master-prompt.md`** into Cursor → **Settings → Rules, Instructions, or AI Instructions** (or add it as a rule under `.cursor/rules/`).
2. Configure the extension to emit the contract using **`prompt-os/templates/payload-template.md`** (rendered from schema JSON + `user_request`) and follow **`prompt-os/docs/extension-output-contract.md`**.
3. Cursor loads the contract, replies **`Instructional contract loaded.`**, then runs the user’s next message under the schema.

In the extension side panel, open the **Contract** tab to pick a category, fill required inputs, and **Build & copy contract** (uses `buildInstructionalContract` in `src/lib/promptOs/`).

Run **`npm run test`** for Vitest smoke tests on `loadSchema` + `renderPayload`.

Output order from the extension is always: **instructional contract payload** → **`# USER REQUEST`** → task text. See the extension contract doc for the full checklist.
