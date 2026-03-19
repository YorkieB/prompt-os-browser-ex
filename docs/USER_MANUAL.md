# Nexus — User manual

**Nexus** is a Chrome extension (Manifest V3) that opens in the **side panel**. It bundles prompt tools, research helpers, planning features, and **Nexus** — a schema-driven **instructional contract** builder for use with **Cursor** (or any assistant that follows the same two-message pattern).

This guide focuses on **how to install, open, and use** the extension day to day. Technical specs for Nexus live under **`prompt-os/`**.

---

## 1. Install the extension (developers & testers)

1. **Dependencies**  
   - Node.js 20+ recommended  
   - Run from the project root:
     ```bash
     npm install
     ```

2. **Production build**  
   ```bash
   npm run build
   ```  
   Output goes to **`dist/`** (side panel UI, `background.js`, `content.js`, assets).

3. **Load in Chrome**  
   - Open **`chrome://extensions`**  
   - Enable **Developer mode**  
   - **Load unpacked** → select the **`dist`** folder (not the repo root).

4. **Open the side panel**  
   - Click the Nexus toolbar icon, or use Chrome’s side panel menu and choose **Nexus** (wording may match the name in `public/manifest.json`).

---

## 2. Side panel tabs (overview)

| Tab | Purpose |
|-----|--------|
| **Saved** | Your saved prompts, favorites, trash. |
| **Craft** | Build / enhance prompts. |
| **Export** | Export chat-related flows. |
| **Research** | Research-oriented tools. |
| **Plan** | Planning suite. |
| **Contract** | **Nexus** — build instructional contracts for Cursor (see §3). |
| **Diagnostics** | Internal checks / debugging aids. |
| **Features** | Feature overview. |

Use the bottom (or configured) navigation to switch tabs.

---

## 3. Nexus — **Contract** tab

The **Contract** tab runs the **Nexus – instructional contract builder**.

### 3.1 What you do there

1. Choose a **schema category** (e.g. research, coding, image, planning, agents).  
2. Fill **required** (and optional) inputs — labels come from the active schema.  
3. Optionally pick a **test payload** from the dropdown to preload sample values.  
4. Enter your **user request** (what Cursor should do *after* it accepts the contract).  
5. Either:  
   - **Build & copy contract** — validates inputs, renders the payload, copies it to the **clipboard**, and shows a **preview**; or  
   - **Send to Cursor (2-step)** — same build step, then talks to a **local HTTP bridge** (if configured) to run the handshake + “Go” flow (see §4).

### 3.2 Status and activity

- **Status** line: high-level phase (building, sending, waiting for handshake, executing, complete, error).  
- **Activity** timeline: short **past-tense** lines with **relative durations** between steps and **color** hints (build, network/wait, success, error).  
- After a **successful** automated run, **Total execution time** shows wall-clock time from first to last timeline row.  
- **Cursor reply (last run)** shows the last execution reply when using the bridge.

### 3.3 Using Cursor **without** the bridge (manual)

1. Click **Build & copy contract**.  
2. Paste into Cursor chat (or composer).  
3. With **`cursor-master-prompt.md`** installed as a Cursor rule, you should see: **`Instructional contract loaded.`**  
4. Send a **second message** (e.g. “Go — execute under the loaded contract.”) so Cursor performs the task under the contract.

Details: **`prompt-os/docs/cursor-master-prompt.md`**, **`prompt-os/docs/end-to-end-flow.md`**.

---

## 4. Optional: **Send to Cursor** (local bridge)

Chrome extensions **cannot** paste directly into Cursor. The wired flow uses a small **local server** that accepts HTTP POSTs from the side panel.

1. Read **`prompt-os/docs/cursor-bridge.md`** for the API (`POST /v1/send`, JSON body, CORS).  
2. For **local testing only**, you can run:
   ```bash
   npm run bridge:mock
   ```
3. Set in **`.env.local`** (project root):
   ```bash
   VITE_PROMPT_OS_CURSOR_BRIDGE_URL=http://127.0.0.1:17373
   ```
4. Rebuild / restart **`npm run dev`** or **`npm run build`** so the UI bundle picks up the variable.  
5. A **real** Cursor integration requires your own bridge that forwards messages to Cursor (automation or internal tooling).

---

## 5. Quality checks (for developers)

From the project root:

| Command | Purpose |
|---------|--------|
| `npm run lint` | ESLint (includes SonarJS rules). |
| `npm run test` | Vitest (Nexus unit tests). |
| `npm run build` | TypeScript + Vite builds for the extension. |

---

## 6. Troubleshooting

| Issue | What to try |
|-------|--------------|
| **Build & copy** fails with missing fields | Fill every **required** schema input; use a **test payload** to see valid examples. |
| **Send to Cursor** errors immediately | Set **`VITE_PROMPT_OS_CURSOR_BRIDGE_URL`** or run **`npm run bridge:mock`**; check the bridge URL and firewall. |
| Handshake errors | Cursor (or the mock) must return text containing **`Instructional contract loaded`** on the first turn. |
| Clipboard denied | Grant clipboard permission for the extension; or copy from the **Generated payload** textarea. |
| Stale UI after changing `.env` | Rebuild or restart the dev server; reload the extension on **`chrome://extensions`**. |

---

## 7. Related documentation

| Document | Audience |
|----------|----------|
| **`prompt-os/README.md`** | Nexus overview & Cursor setup |
| **`prompt-os/docs/end-to-end-flow.md`** | Full pipeline narrative |
| **`prompt-os/docs/cursor-bridge.md`** | HTTP bridge for automation |
| **`prompt-os/docs/extension-output-contract.md`** | Exact payload rules |
| **`prompt-os/OVERVIEW.md`** | Architecture & contracts |

---

*Extension name and version are defined in **`public/manifest.json`**. This manual describes behavior implemented in the repo at build time; after `npm run build`, always load the **`dist`** folder as the unpacked extension.*
