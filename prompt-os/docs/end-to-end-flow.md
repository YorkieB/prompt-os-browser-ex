# How Nexus runs end-to-end

This is the **full path** from the browser extension to Cursor executing work under an instructional contract.

---

## 1. User opens the extension panel

The Chrome side panel opens the extension UI. In this project, the user switches to the **Contract** tab (bottom nav: **Contract** / `FileText` icon).

**End-user steps (install, tabs, troubleshooting):** see **[User manual](../../docs/USER_MANUAL.md)**.

Component stack: **`InstructionalContractTab`** → **`PromptOSPanel`**.

---

## 2. User picks a schema category

**Schema category** is one of: `research`, `coding`, `image`, `planning`, `agents`.

Behind the scenes:

- **`loadMerge`:** not a separate file — **`loadSchema(category)`** in **`src/lib/promptOs/schemaLoader.ts`** merges **`base.schema.json`** with the domain schema, runs **`validateSchemaStructureOrThrow`**, and returns an **`InstructionalContractSchema`**.

---

## 3. User fills schema-driven inputs

**`FormGenerator`** renders fields from **`schema.inputs.required`** and **`schema.inputs.optional`** (string keys only today).

Optional: **Test payload** dropdown loads **`PROMPT_OS_TEST_FIXTURES`** from **`src/lib/promptOs/testFixtures.ts`** for quick manual checks.

---

## 4. User types their freeform request

The **User request** textarea is the task Cursor should perform **after** it has loaded the contract — it becomes the body under **`# USER REQUEST`** in the rendered output (see **`prompt-os/templates/payload-template.md`**).

---

## 5. User clicks build (instructional contract)

The primary button is labelled **“Build & copy contract”** in **`PromptOSPanel`**. It calls **`buildInstructionalContract(category, userInputs, userRequest)`** in **`src/lib/promptOs/buildInstructionalContract.ts`**, which:

1. **`validateRequiredInputs`** — ensures every **`inputs.required`** key has a non-empty value (otherwise **`MissingRequiredInputsError`** → toast).
2. **`renderPayload` / `renderInstructionalContract`** — Handlebars over **`payload-template.md?raw`** (**`payloadRenderer.ts`**).

Output = **instructional contract block** + **`# USER REQUEST`** + the user’s text (matches **`extension-output-contract.md`**).

The same string is **copied to the clipboard** (with a success/error toast).

**Optional — execution layer:** **`PromptOSPanel`** also offers **Send to Cursor (2-step)**, which calls **`executeInstructionalContract`** (**`contractExecutor.ts`**): POST the payload through **`createHttpCursorDispatcher`** (**`cursorDispatcher.ts`**), verify the assistant reply contains **`Instructional contract loaded`**, then POST the follow-up (default **Go** line). This needs a **local HTTP bridge** — extensions cannot talk to Cursor’s chat directly. See **`cursor-bridge.md`**. For local dev you can run **`npm run bridge:mock`** and set **`VITE_PROMPT_OS_CURSOR_BRIDGE_URL=http://127.0.0.1:17373`**.

**Manual path (no bridge):** user **pastes** the clipboard into Cursor (chat or composer), waits for the handshake, then sends **Go** in a second message.

---

## 6. User (or extension) sends the payload to Cursor

- **Automated (implemented):** HTTP **`POST {bridge}/v1/send`** with **`{ "message": string }`** → **`{ "response": string }`**. You provide a bridge that forwards to Cursor or your tooling.
- **Manual:** paste into Cursor; same two-message contract as in **`cursor-master-prompt.md`**.
- **Future:** **cursor://** / **vscode://** + companion extension, desktop automation, etc.

---

## 7. Cursor loads the master prompt

The worker behaviour is defined in **`prompt-os/docs/cursor-master-prompt.md`**. User installs it via **Cursor rules / AI instructions** (see **`prompt-os/README.md`**).

On **first message** containing the instructional contract, Cursor should reply **exactly**:

```text
Instructional contract loaded.
```

…then **wait** for the **next** user message before producing the main deliverable.

---

## 8. Next message: user says “Go” (or similar)

The **second** message is the explicit **execution trigger**, e.g.:

- `Go — execute under the loaded contract.`
- `Proceed with the user request above.`
- Or the user repeats/clarifies the task; what matters is a **clear new turn** so Cursor treats it as “execute now” rather than editing the contract.

Cursor should then:

- Apply **thinking** (role, tone, audience, reasoning style).
- Honour **structure**, **rules**, **avoid**, and **output_format**.
- Execute the instructions implied by the contract + **`# USER REQUEST`** text.

---

## Quick reference

| Step | Where in code / docs |
|------|----------------------|
| Panel + form + build | **`PromptOSPanel.tsx`**, **`FormGenerator.tsx`**, **`buildInstructionalContract.ts`**, **`payloadRenderer.ts`** |
| Schema files | **`prompt-os/schemas/*.schema.json`** |
| Template | **`prompt-os/templates/payload-template.md`** |
| Extension output rules | **`extension-output-contract.md`** |
| Cursor worker rules | **`cursor-master-prompt.md`** |
| HTTP bridge + env | **`cursor-bridge.md`**, **`cursorDispatcher.ts`**, **`contractExecutor.ts`** |
| Integration map | **`extension-integration-plan.md`** |

---

## Tests

**`npm run test`** runs Vitest smoke tests on **`renderPayload`** (see **`src/lib/promptOs/payloadRenderer.test.ts`**).
