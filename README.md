# Nexus (browser extension)

Chrome **Manifest V3** side-panel extension: prompt tooling, research/planning tabs, and **Nexus** (instructional contracts for **Cursor**).

## User guide

→ **[docs/USER_MANUAL.md](./docs/USER_MANUAL.md)** — install, tabs overview, **Contract** / Nexus flow, optional Cursor bridge, troubleshooting.

## Developer quick start

```bash
npm install
npm run lint    # ESLint (+ SonarJS rules)
npm run test    # Vitest
npm run build   # output → dist/
```

Load **`dist/`** as an **unpacked** extension in `chrome://extensions` (Developer mode).

## Nexus (spec + implementation)

Schemas, templates, and Cursor worker docs live under **`prompt-os/`**. Start with **[prompt-os/README.md](./prompt-os/README.md)**.

## Environment (optional)

For the **Send to Cursor** HTTP flow, copy **`.env.example`** to **`.env.local`** and set `VITE_PROMPT_OS_CURSOR_BRIDGE_URL`. See **[prompt-os/docs/cursor-bridge.md](./prompt-os/docs/cursor-bridge.md)**.

---

## Spark template attribution

This repository began from the GitHub **Spark Template** (MIT). Nexus-specific features (Nexus, tabs, etc.) are layered on top; see **`docs/USER_MANUAL.md`** and **`prompt-os/`** for product behavior.
