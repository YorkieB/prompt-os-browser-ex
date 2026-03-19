import { defaultPrompts } from './lib/defaultPrompts'

// ── State ──────────────────────────────────────────────────────────────────
let activeInput:  HTMLElement | null = null
let toolbarEl:    HTMLElement | null = null
let modalHost:    HTMLElement | null = null
let focusOutTimer: ReturnType<typeof setTimeout> | null = null
let annotCanvas:  HTMLCanvasElement | null = null
let annotToolbar: HTMLElement | null = null
let diagSidebar:  HTMLElement | null = null

// ── Input detection ────────────────────────────────────────────────────────
function isChatInput(el: HTMLElement): boolean {
  if (el.closest('[data-prompt-os]')) return false
  if (el instanceof HTMLTextAreaElement && !el.readOnly && !el.disabled) return true
  if (
    (el.contentEditable === 'true' || el.getAttribute('role') === 'textbox') &&
    el.tagName !== 'BODY' && el.tagName !== 'HTML'
  ) return true
  return false
}

/** Shortest distance from point to outside of axis-aligned rectangle (0 if inside). */
function distOutsideRect(px: number, py: number, rx: number, ry: number, rw: number, rh: number): number {
  let dx = 0
  if (px < rx) dx = rx - px
  else if (px > rx + rw) dx = px - (rx + rw)
  let dy = 0
  if (py < ry) dy = ry - py
  else if (py > ry + rh) dy = py - (ry + rh)
  return Math.hypot(dx, dy)
}

function downloadPngDataUrl(dataUrl: string, baseName: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `${baseName}-${Date.now()}.png`
  a.click()
}

/** True when messaging/capture APIs are unusable (reload/update/unload of the extension). */
function extensionContextLikelyDead(): boolean {
  try {
    return typeof chrome === 'undefined' || !chrome.runtime?.id
  } catch {
    return true
  }
}

function isExtensionContextInvalidatedError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return (
    msg.includes('Extension context invalidated') ||
    msg.includes('The message port closed') ||
    msg.includes('Receiving end does not exist')
  )
}

/** Canvas anchor for typing inside a comic callout (geometry aligned with drawComicCloudCallout). */
function calloutBodyTextAnchor(x1: number, y1: number, x2: number, y2: number): { cx: number; cy: number } | null {
  const X = Math.min(x1, x2)
  const Y = Math.min(y1, y2)
  const W = Math.abs(x2 - x1)
  const H = Math.abs(y2 - y1)
  if (W < 40 || H < 40) return null
  const pad = 10
  const bx = X + pad
  const by = Y + pad
  const bw = W - pad * 2
  const bh = H - pad * 2
  const tailH = Math.min(Math.max(18, bh * 0.18), 36)
  const bodyH = bh - tailH
  return { cx: bx + bw / 2, cy: by + bodyH / 2 }
}

/** Hides toolbar, captures visible tab (page + overlays), falls back to drawing layer only. */
async function saveAnnotationScreenshot(bar: HTMLElement, canvas: HTMLCanvasElement): Promise<void> {
  const prevVis = bar.style.visibility
  bar.style.visibility = 'hidden'
  await new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
  const fallbackLayer = () => downloadPngDataUrl(canvas.toDataURL('image/png'), 'annotation-layer-only')

  try {
    if (extensionContextLikelyDead()) {
      // After a reload from chrome://extensions, sendMessage throws — skip and save drawings only.
      fallbackLayer()
      return
    }
    const resp = (await chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' })) as {
      dataUrl?: string
      error?: string
    }
    if (resp?.dataUrl && !resp.error) {
      downloadPngDataUrl(resp.dataUrl, 'page-screenshot')
      return
    }
    if (resp?.error) console.warn('[annotation] captureVisibleTab:', resp.error)
    fallbackLayer()
  } catch (e) {
    // Expected after extension update/reload while the tab stays open — avoid console.error noise.
    if (isExtensionContextInvalidatedError(e)) {
      console.info(
        '[annotation] Extension was reloaded or updated — saved annotations only. Reload this page to capture the full page (toolbar hidden).',
      )
    } else {
      console.warn('[annotation] save screenshot failed', e)
    }
    fallbackLayer()
  } finally {
    bar.style.visibility = prevVis
  }
}

// ── Text insertion ─────────────────────────────────────────────────────────
function insertText(input: HTMLElement, text: string) {
  if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
    const proto = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (nativeSetter) { nativeSetter.call(input, text) } else { input.value = text }
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.focus()
  } else {
    input.focus()
    const sel = globalThis.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      const node = document.createTextNode(text)
      range.insertNode(node)
      range.setStartAfter(node)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    } else {
      input.textContent = text
    }
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }))
  }
  closeModal()
}

// ── Toolbar ────────────────────────────────────────────────────────────────
const TOOLBAR_BUTTONS = [
  { emoji: '🎨', label: 'Image Prompt', cat: 'Image' },
  { emoji: '🎥', label: 'Video Prompt', cat: 'Video' },
  { emoji: '✨', label: 'Generate',     cat: 'General' },
  { emoji: '📚', label: 'Browse',       cat: 'browse' },
  { emoji: '✏️', label: 'Annotate',     cat: 'annotate' },
  { emoji: '🔍', label: 'Diagnose',     cat: 'diagnose' },
] as const

function showToolbar() {
  if (toolbarEl) return
  const toolbar = document.createElement('div')
  toolbar.dataset.promptOs = 'toolbar'
  Object.assign(toolbar.style, {
    position: 'fixed', zIndex: '2147483646',
    bottom: '24px', right: '24px',
    display: 'flex', gap: '3px', alignItems: 'center',
    background: 'rgba(255,255,255,0.97)',
    border: '1px solid #e5e7eb', borderRadius: '8px',
    padding: '3px', boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
    backdropFilter: 'blur(8px)',
    userSelect: 'none',
  })

  // Drag handle
  const handle = document.createElement('div')
  handle.dataset.promptOs = 'toolbar-handle'
  handle.title = 'Drag to move'
  handle.textContent = '⠿'
  Object.assign(handle.style, {
    cursor: 'grab', padding: '0 4px', color: 'rgba(0,0,0,0.25)',
    fontSize: '14px', lineHeight: '1', flexShrink: '0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  })

  let tbDragging = false
  let tbGrabX = 0
  let tbGrabY = 0

  handle.addEventListener('mousedown', (e) => {
    tbDragging = true
    tbGrabX = e.clientX - toolbar.getBoundingClientRect().left
    tbGrabY = e.clientY - toolbar.getBoundingClientRect().top
    handle.style.cursor = 'grabbing'
    e.preventDefault()
    e.stopPropagation()
  })
  document.addEventListener('mousemove', (e) => {
    if (!tbDragging) return
    const x = Math.max(0, Math.min(e.clientX - tbGrabX, globalThis.innerWidth - toolbar.offsetWidth))
    const y = Math.max(0, Math.min(e.clientY - tbGrabY, globalThis.innerHeight - toolbar.offsetHeight))
    toolbar.style.left = `${x}px`
    toolbar.style.top = `${y}px`
    toolbar.style.right = 'auto'
    toolbar.style.bottom = 'auto'
  })
  document.addEventListener('mouseup', () => {
    if (tbDragging) {
      tbDragging = false
      handle.style.cursor = 'grab'
    }
  })

  toolbar.appendChild(handle)

  TOOLBAR_BUTTONS.forEach(({ emoji, label, cat }) => {
    const btn = document.createElement('button')
    btn.dataset.promptOs = 'toolbar-btn'
    btn.title = label
    btn.textContent = emoji
    Object.assign(btn.style, {
      width: '28px', height: '28px', borderRadius: '5px', border: 'none',
      background: 'transparent', cursor: 'pointer', fontSize: '15px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background 0.1s', padding: '0', lineHeight: '1',
    })
    btn.addEventListener('mouseenter', () => { btn.style.background = '#f3f0ff' })
    btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent' })
    btn.addEventListener('mousedown', (e) => {
      if (tbDragging) return
      e.preventDefault(); e.stopPropagation()
      if (cat === 'annotate') {
        closeModal()
        openAnnotation()
      } else if (cat === 'diagnose') {
        closeModal()
        showDiagnoseMenu(btn)
      } else if (modalHost) {
        closeModal()
      } else {
        openModal(activeInput, cat)
      }
    })
    toolbar.appendChild(btn)
  })
  document.body.appendChild(toolbar)
  toolbarEl = toolbar
}

// ── Modal styles ───────────────────────────────────────────────────────────
const MODAL_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:host{all:initial}
.overlay{
  position:fixed;inset:0;z-index:2147483647;
  display:flex;align-items:center;justify-content:center;
  background:rgba(10,8,20,.5);backdrop-filter:blur(6px);
  padding:16px;
}
.modal{
  background:#fff;border-radius:16px;
  box-shadow:0 24px 64px rgba(0,0,0,.22),0 4px 16px rgba(0,0,0,.08);
  width:100%;max-width:480px;max-height:90vh;
  display:flex;flex-direction:column;overflow:hidden;
  border:1px solid #e5e3dc;
  animation:slideUp .22s cubic-bezier(.34,1.56,.64,1);
}
@keyframes slideUp{from{transform:translateY(20px) scale(.97);opacity:0}to{transform:none;opacity:1}}
.hd{
  display:flex;align-items:center;gap:10px;
  padding:13px 14px 0;flex-shrink:0;
}
.hd-icon{font-size:18px;line-height:1}
.hd-title{font:700 14px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;flex:1}
.hd-sub{font-size:11px;color:#9a9890;margin-top:2px}
.close-btn{
  width:26px;height:26px;border-radius:6px;border:none;
  background:transparent;cursor:pointer;color:#9a9890;
  display:flex;align-items:center;justify-content:center;font-size:16px;
  transition:background .1s,color .1s;flex-shrink:0;
}
.close-btn:hover{background:#f3f1ea;color:#111}
.tabs{
  display:flex;gap:2px;padding:10px 14px 0;flex-shrink:0;
}
.tab{
  flex:1;padding:7px 0;border:none;border-radius:8px;
  font:600 12px/1 -apple-system,sans-serif;cursor:pointer;
  transition:background .12s,color .12s;
  background:transparent;color:#9a9890;
}
.tab.active{background:#f3f0ff;color:#7c3aed}
.tab:hover:not(.active){background:#f9f8f5;color:#444}
.body{padding:12px 14px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:11px;scrollbar-width:thin}
.lbl{font:700 10px/1 -apple-system,sans-serif;letter-spacing:.07em;color:#9a9890;text-transform:uppercase;margin-bottom:5px}
textarea.desc{
  width:100%;min-height:60px;max-height:110px;padding:9px 11px;
  font:13.5px/1.5 -apple-system,sans-serif;color:#111;
  background:#fafaf8;border:1.5px solid #e5e3dc;border-radius:10px;
  outline:none;resize:none;transition:border-color .15s,box-shadow .15s;
}
textarea.desc:focus{border-color:#7c3aed;background:#fff;box-shadow:0 0 0 3px rgba(124,58,237,.09)}
textarea.desc::placeholder{color:#bbb9b2}
.chips{display:flex;gap:5px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none;flex-wrap:nowrap}
.chips::-webkit-scrollbar{display:none}
.chip{
  padding:4px 11px;border-radius:999px;border:1.5px solid #e5e3dc;
  background:#fff;font:500 12px/1 -apple-system,sans-serif;
  cursor:pointer;white-space:nowrap;color:#6b7280;transition:all .12s;flex-shrink:0;
}
.chip:hover{border-color:#7c3aed;color:#7c3aed;background:#f3f0ff}
.chip.on{background:#7c3aed;color:#fff;border-color:#7c3aed}
.sel-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sel-wrap{display:flex;flex-direction:column;gap:5px}
.sel{
  width:100%;height:34px;padding:0 30px 0 10px;
  border:1.5px solid #e5e3dc;border-radius:10px;
  background-color:#fafaf8;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239a9890' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 10px center;
  font:500 13px/1 -apple-system,sans-serif;color:#111;
  outline:none;cursor:pointer;appearance:none;-webkit-appearance:none;
  transition:border-color .15s,box-shadow .15s;
}
.sel:focus{border-color:#7c3aed;background-color:#fff;box-shadow:0 0 0 3px rgba(124,58,237,.09)}
.sel:hover{border-color:#c4b5fd}
.gen-btn{
  width:100%;height:38px;border-radius:10px;border:none;
  background:#7c3aed;color:#fff;font:600 13.5px/1 -apple-system,sans-serif;
  cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;
  transition:background .15s,transform .15s,box-shadow .15s;
}
.gen-btn:hover:not(:disabled){background:#6d28d9;box-shadow:0 4px 14px rgba(124,58,237,.35);transform:translateY(-1px)}
.gen-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.spinner{width:13px;height:13px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.result{display:none;flex-direction:column;gap:7px;animation:fadeIn .2s ease}
.result.show{display:flex}
@keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
.result-hd{display:flex;align-items:center;justify-content:space-between}
.result-lbl{font:700 10px/1 -apple-system,sans-serif;letter-spacing:.07em;color:#9a9890;text-transform:uppercase}
.result-meta{font-size:10px;color:#ccc}
.result-box{
  background:#fafaf8;border:1.5px solid #e8e5f0;border-radius:10px;
  padding:11px;font:13px/1.65 -apple-system,sans-serif;color:#111;
  max-height:180px;overflow-y:auto;white-space:pre-wrap;
  outline:none;scrollbar-width:thin;
}
.result-box:focus{border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.09)}
.acts{display:flex;gap:6px}
.act{
  flex:1;height:34px;border-radius:8px;border:1.5px solid #e5e3dc;
  background:#fff;font:600 12px/1 -apple-system,sans-serif;
  cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;
  transition:all .12s;color:#374151;
}
.act:hover{border-color:#d1d5db;background:#f9f9f7}
.act:disabled{opacity:.5;cursor:not-allowed}
.act.primary{background:#7c3aed;color:#fff;border-color:#7c3aed}
.act.primary:hover{background:#6d28d9;box-shadow:0 4px 12px rgba(124,58,237,.3)}
.search{
  width:100%;padding:8px 11px;border:1.5px solid #e5e3dc;border-radius:10px;
  font:13px/1 -apple-system,sans-serif;color:#111;background:#fafaf8;
  outline:none;transition:border-color .15s,box-shadow .15s;
}
.search:focus{border-color:#7c3aed;background:#fff;box-shadow:0 0 0 3px rgba(124,58,237,.09)}
.search::placeholder{color:#bbb9b2}
.list{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px;min-height:0;scrollbar-width:thin;padding-right:2px}
.item{
  padding:10px 11px;border-radius:9px;cursor:pointer;
  border:1px solid transparent;transition:background .1s;
  display:flex;flex-direction:column;gap:3px;
}
.item:hover{background:#f5f3ff;border-color:#ddd6fe}
.item-name{font:600 13px/1 -apple-system,sans-serif;color:#1f2937}
.item-prev{font-size:11.5px;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.item-tags{display:flex;gap:3px;flex-wrap:wrap}
.tag{background:#f3f4f6;color:#6b7280;font-size:10px;padding:2px 6px;border-radius:999px}
.empty{text-align:center;color:#9ca3af;padding:28px 16px;font-size:13px}
.api-row{
  display:flex;align-items:center;gap:7px;padding:9px 14px;
  background:#fafaf8;border-top:1px solid #f3f1ea;flex-shrink:0;
}
.api-label{font-size:11px;color:#9a9890;white-space:nowrap;flex-shrink:0}
.api-input{
  flex:1;height:26px;padding:0 8px;font:12px/1 'SF Mono',monospace;
  border:1px solid #e5e3dc;border-radius:6px;outline:none;
  background:#fff;color:#111;transition:border-color .15s;
}
.api-input:focus{border-color:#7c3aed;box-shadow:0 0 0 2px rgba(124,58,237,.08)}
.api-save{
  height:26px;padding:0 10px;font:600 11px/1 -apple-system,sans-serif;
  background:#7c3aed;color:#fff;border:none;border-radius:6px;cursor:pointer;
  transition:background .12s;white-space:nowrap;
}
.api-save:hover{background:#6d28d9}
.err{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;font-size:12px;color:#dc2626}
`

// ── Modal open/close ───────────────────────────────────────────────────────
const CATEGORIES = ['General','Coding','Image','Video','Research','Planning','Agents','Personal'] as const
type Category = typeof CATEGORIES[number]

const TONES = [
  { id:'formal',       emoji:'😊', label:'Formal'       },
  { id:'casual',       emoji:'😄', label:'Casual'       },
  { id:'persuasive',   emoji:'🎯', label:'Persuasive'   },
  { id:'enthusiastic', emoji:'🤩', label:'Enthusiastic' },
  { id:'analytical',   emoji:'🔍', label:'Analytical'   },
  { id:'creative',     emoji:'🎨', label:'Creative'     },
]

const SCHEMA_MODES: Partial<Record<Category,'image'|'video'|'coding'|'research'|'planning'|'agent'>> = {
  Image:'image', Video:'video', Coding:'coding', Research:'research', Planning:'planning', Agents:'agent',
}

interface ModalState {
  category: Category
  tone: string
  length: 'short'|'medium'|'long'
  level: 'beginner'|'intermediate'|'advanced'
  tab: 'generate'|'browse'|'research'|'annotate'
  browseQuery: string
  browseCat: string
}

interface ModalCtx {
  body: HTMLElement
  s: ModalState
  generating: boolean
  lastResult: string
}

function openModal(_input: HTMLElement | null, initCat: string) {
  closeModal()

  const host = document.createElement('div')
  host.dataset.promptOs = 'modal'
  const shadow = host.attachShadow({ mode: 'open' })
  Object.assign(host.style, { position: 'fixed', inset: '0', zIndex: '2147483647', pointerEvents: 'none' })
  document.body.appendChild(host)
  modalHost = host

  // Inject styles
  const styleEl = document.createElement('style')
  styleEl.textContent = MODAL_CSS
  shadow.appendChild(styleEl)

  const s: ModalState = {
    category: (CATEGORIES.includes(initCat as Category) ? initCat : 'General') as Category,
    tone: 'formal', length: 'medium', level: 'intermediate',
    tab: initCat === 'browse' ? 'browse' : 'generate',
    browseQuery: '', browseCat: 'all',
  }

  // ── Overlay ────────────────────────────────────────────────────────────
  const overlay = document.createElement('div')
  overlay.className = 'overlay'
  overlay.style.pointerEvents = 'all'
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal() })
  shadow.appendChild(overlay)

  // ── Modal card ─────────────────────────────────────────────────────────
  const modal = document.createElement('div')
  modal.className = 'modal'
  overlay.appendChild(modal)

  // ── Header ─────────────────────────────────────────────────────────────
  const hd = document.createElement('div')
  hd.className = 'hd'
  hd.innerHTML = `
    <span class="hd-icon">✨</span>
    <div style="flex:1"><div class="hd-title">Nexus</div><div class="hd-sub">Generate or browse prompts, then insert into chat</div></div>
    <button class="close-btn" title="Close">✕</button>`
  hd.querySelector('.close-btn')!.addEventListener('click', closeModal)
  modal.appendChild(hd)

  // ── Tabs ───────────────────────────────────────────────────────────────
  const tabsEl = document.createElement('div')
  tabsEl.className = 'tabs'
  tabsEl.innerHTML = `<button class="tab ${s.tab==='generate'?'active':''}" data-tab="generate">✨ Generate</button><button class="tab ${s.tab==='browse'?'active':''}" data-tab="browse">📚 Browse</button><button class="tab ${s.tab==='research'?'active':''}" data-tab="research">🔬 Research</button><button class="tab ${s.tab==='annotate'?'active':''}" data-tab="annotate">✏️ Annotate</button>`
  tabsEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]')
    if (!btn) return
    s.tab = btn.dataset.tab as 'generate'|'browse'|'research'|'annotate'
    tabsEl.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
    btn.classList.add('active')
    renderBody()
  })
  modal.appendChild(tabsEl)

  // ── Body ───────────────────────────────────────────────────────────────
  const body = document.createElement('div')
  body.className = 'body'
  modal.appendChild(body)

  // ── API row (always visible) ───────────────────────────────────────────
  const apiRow = document.createElement('div')
  apiRow.className = 'api-row'
  apiRow.innerHTML = `<span class="api-label">🔑 API Key:</span><input type="password" class="api-input" placeholder="dop_v1_… DigitalOcean model access key"/><button class="api-save">Save</button>`
  // Pre-fill from storage
  try {
    chrome?.storage?.local?.get('do-api-key', (r) => {
      const inp = apiRow.querySelector('.api-input') as HTMLInputElement
      if (r['do-api-key']) inp.value = r['do-api-key'] as string
    })
  } catch { /* extension context invalidated — ignore */ }
  apiRow.querySelector('.api-save')!.addEventListener('click', () => {
    const val = (apiRow.querySelector('.api-input') as HTMLInputElement).value.trim()
    if (!val) return
    try { chrome?.storage?.local?.set({ 'do-api-key': val }) } catch { /* ignore */ }
    const btn = apiRow.querySelector('.api-save') as HTMLButtonElement
    const prev = btn.textContent
    btn.textContent = '✓ Saved'
    setTimeout(() => { btn.textContent = prev }, 1800)
  })
  modal.appendChild(apiRow)

  // ── Tab builder delegation ─────────────────────────────────────────────
  const ctx: ModalCtx = { body, s, generating: false, lastResult: '' }

  function renderBody() {
    if (s.tab === 'generate') _buildGenerateTab(ctx)
    else if (s.tab === 'browse') _buildBrowseTab(ctx)
    else if (s.tab === 'research') _buildResearchTab(ctx)
    else { closeModal(); openAnnotation() }
  }

  renderBody()

  // Close on Escape
  document.addEventListener('keydown', handleEsc)
}

function handleEsc(e: KeyboardEvent) { if (e.key === 'Escape') closeModal() }

function closeModal() {
  modalHost?.remove()
  modalHost = null
  document.removeEventListener('keydown', handleEsc)
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getCatEmoji(cat: string): string {
  const map: Record<string, string> = {
    Coding:'💻 ', Image:'🎨 ', Video:'🎥 ', Research:'🔍 ', Planning:'📋 ', Agents:'🤖 ', Personal:'👤 ',
  }
  return map[cat] ?? ''
}

function buildSystemPrompt(s: ModalState): string {
  const mode = SCHEMA_MODES[s.category]
  if (mode === 'image' || mode === 'video') {
    return `You are an expert AI ${mode} prompt engineer.
Generate a ready-to-use ${mode} generation prompt.
Output these labelled sections with ## headers:
## Enhanced Prompt
## Minimal Prompt
## Negative Prompt
## Camera / Technical Settings
## Model Variants (Midjourney · DALL-E · Stable Diffusion)
${mode === 'video' ? '## Video Version (motion, camera movement, temporal elements)' : ''}
Tone: ${s.tone}. Be concise but detailed. No preamble.`
  }
  if (mode === 'coding') {
    return `You are an expert coding prompt engineer.
Generate a ready-to-use coding prompt with these ## sections:
## Task
## Inputs
## Output Requirements
## Constraints
## Code Implementation Notes
## Testing Guidance
Tone: ${s.tone} · Length: ${s.length} · Complexity: ${s.level}. No preamble.`
  }
  return `You are an expert prompt engineer.
Generate a single high-quality ready-to-use prompt for the ${s.category} category.
Tone: ${s.tone} · Length: ${s.length} · Complexity: ${s.level}.
Output ONLY the prompt — clear, structured, immediately usable. No labels, no preamble.`
}

function buildDropdown(label: string, options: [string, string][], active: string, onChange: (v: string) => void): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'sel-wrap'
  wrap.innerHTML = `<div class="lbl">${label}</div>`
  const sel = document.createElement('select')
  sel.className = 'sel'
  options.forEach(([value, text]) => {
    const opt = document.createElement('option')
    opt.value = value
    opt.textContent = text
    if (value === active) opt.selected = true
    sel.appendChild(opt)
  })
  sel.addEventListener('change', () => onChange(sel.value))
  wrap.appendChild(sel)
  return wrap
}

// ── Tab builders (module-level to keep nesting ≤ 4) ─────────────────────────

function _buildGenerateTab(ctx: ModalCtx) {
  const { body, s } = ctx
  body.innerHTML = ''

  const descWrap = document.createElement('div')
  descWrap.innerHTML = `<div class="lbl">What do you need?</div>`
  const desc = document.createElement('textarea')
  desc.className = 'desc'
  desc.placeholder = 'e.g. A cinematic portrait of a woman in golden hour light…'
  descWrap.appendChild(desc)
  body.appendChild(descWrap)

  const row1 = document.createElement('div')
  row1.className = 'sel-row'

  const catWrap = document.createElement('div')
  catWrap.className = 'sel-wrap'
  catWrap.innerHTML = `<div class="lbl">Category</div>`
  const catSel = document.createElement('select')
  catSel.className = 'sel'
  CATEGORIES.forEach(cat => {
    const opt = document.createElement('option')
    opt.value = cat
    opt.textContent = getCatEmoji(cat) + cat
    if (cat === s.category) opt.selected = true
    catSel.appendChild(opt)
  })
  catSel.addEventListener('change', () => { s.category = catSel.value as Category })
  catWrap.appendChild(catSel)
  row1.appendChild(catWrap)

  const toneWrap = document.createElement('div')
  toneWrap.className = 'sel-wrap'
  toneWrap.innerHTML = `<div class="lbl">Tone</div>`
  const toneSel = document.createElement('select')
  toneSel.className = 'sel'
  TONES.forEach(t => {
    const opt = document.createElement('option')
    opt.value = t.id
    opt.textContent = `${t.emoji} ${t.label}`
    if (t.id === s.tone) opt.selected = true
    toneSel.appendChild(opt)
  })
  toneSel.addEventListener('change', () => { s.tone = toneSel.value })
  toneWrap.appendChild(toneSel)
  row1.appendChild(toneWrap)
  body.appendChild(row1)

  const row2 = document.createElement('div')
  row2.className = 'sel-row'
  row2.appendChild(buildDropdown('Length',
    [['short','Short'],['medium','Medium'],['long','Long']],
    s.length, (v) => { s.length = v as typeof s.length }
  ))
  row2.appendChild(buildDropdown('Complexity',
    [['beginner','Basic'],['intermediate','Mid'],['advanced','Expert']],
    s.level, (v) => { s.level = v as typeof s.level }
  ))
  body.appendChild(row2)

  let refImageDescription = ''
  const isImgVid = () => s.category === 'Image' || s.category === 'Video'

  const refWrap = document.createElement('div')
  refWrap.style.display = isImgVid() ? 'block' : 'none'

  const refLbl = document.createElement('div')
  refLbl.className = 'lbl'
  refLbl.textContent = 'Reference Image'
  refWrap.appendChild(refLbl)

  const dropZone = document.createElement('div')
  Object.assign(dropZone.style, {
    border: '2px dashed #d4d0f5', borderRadius: '10px',
    padding: '12px', textAlign: 'center', cursor: 'pointer',
    background: '#faf9ff', transition: 'border-color .15s',
    fontSize: '12px', color: '#9ca3af',
  })
  dropZone.innerHTML = `<div style="font-size:22px;margin-bottom:4px">🖼️</div><div>Drop an image or <span style="color:#7c3aed;font-weight:600">click to upload</span></div><div style="font-size:10px;margin-top:2px;color:#c4b5fd">JPG, PNG, WebP · max 10 MB — AI will analyse it</div>`

  const fileInput = document.createElement('input')
  fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.style.display = 'none'
  refWrap.appendChild(fileInput)

  let imgPreview: HTMLImageElement | null = null
  let analyseBtn: HTMLButtonElement | null = null
  let refErrEl: HTMLDivElement | null = null
  let refResultEl: HTMLDivElement | null = null

  const analyseImage = async (base64: string, mimeType: string) => {
    if (analyseBtn) { analyseBtn.disabled = true; analyseBtn.textContent = '⏳ Analysing…' }
    const VISION_PROMPT = `Analyse this reference image in comprehensive detail for AI image/video generation. Describe: subject, pose, clothing, expression; composition and camera angle; lighting type/direction/quality; colour palette; environment and background; artistic style and mood; technical characteristics. Be specific — your analysis feeds directly into an AI prompt generator.`
    try {
      const resp = await chrome.runtime.sendMessage(
        { type: 'ANALYSE_IMAGE', base64, mimeType, prompt: VISION_PROMPT }
      ) as { text?: string; error?: string }
      if (chrome?.runtime?.lastError || resp?.error) {
        const msg = chrome?.runtime?.lastError?.message ?? resp?.error ?? 'Analysis failed'
        if (refErrEl) { refErrEl.textContent = msg; refErrEl.style.display = 'block' }
        if (analyseBtn) { analyseBtn.disabled = false; analyseBtn.textContent = '🔍 Analyse Image' }
        return
      }
      refImageDescription = resp?.text ?? ''
      if (refResultEl) {
        refResultEl.textContent = refImageDescription.slice(0, 200) + (refImageDescription.length > 200 ? '…' : '')
        refResultEl.style.display = 'block'
      }
      if (analyseBtn) { analyseBtn.textContent = '✓ Analysed — included in prompt'; analyseBtn.disabled = true }
    } catch (e) {
      if (refErrEl) { refErrEl.textContent = (e as Error).message; refErrEl.style.display = 'block' }
      if (analyseBtn) { analyseBtn.disabled = false; analyseBtn.textContent = '🔍 Analyse Image' }
    }
  }

  const loadFile = (file: File) => {
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      const base64 = dataUrl.split(',')[1]
      dropZone.style.display = 'none'
      if (!imgPreview) {
        imgPreview = document.createElement('img')
        Object.assign(imgPreview.style, { width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '6px' })
        fileInput.before(imgPreview)
      }
      imgPreview.src = dataUrl
      if (analyseBtn) {
        analyseBtn.disabled = false
        analyseBtn.textContent = '🔍 Analyse Image'
        analyseBtn.addEventListener('click', () => analyseImage(base64, file.type))
      } else {
        analyseBtn = document.createElement('button')
        analyseBtn.className = 'gen-btn'
        Object.assign(analyseBtn.style, { height: '30px', fontSize: '12px', marginBottom: '6px' })
        analyseBtn.textContent = '🔍 Analyse Image'
        analyseBtn.addEventListener('click', () => analyseImage(base64, file.type))
        fileInput.before(analyseBtn)
      }
      if (!refErrEl) {
        refErrEl = document.createElement('div')
        refErrEl.className = 'err'; refErrEl.style.display = 'none'
        fileInput.before(refErrEl)
      }
      if (!refResultEl) {
        refResultEl = document.createElement('div')
        Object.assign(refResultEl.style, { fontSize: '10px', color: '#7c3aed', background: '#f3f0ff', padding: '6px 8px', borderRadius: '6px', display: 'none', marginBottom: '4px' })
        fileInput.before(refResultEl)
      }
      refImageDescription = ''; refErrEl.style.display = 'none'
    }
    reader.readAsDataURL(file)
  }

  dropZone.addEventListener('click', () => fileInput.click())
  dropZone.addEventListener('dragover', (ev) => { ev.preventDefault(); dropZone.style.borderColor = '#7c3aed' })
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#d4d0f5' })
  dropZone.addEventListener('drop', (ev) => { ev.preventDefault(); dropZone.style.borderColor = '#d4d0f5'; const f = ev.dataTransfer?.files[0]; if (f) loadFile(f) })
  fileInput.addEventListener('change', () => { const f = fileInput.files?.[0]; if (f) loadFile(f) })

  refWrap.appendChild(dropZone)
  body.appendChild(refWrap)
  catSel.addEventListener('change', () => { refWrap.style.display = isImgVid() ? 'block' : 'none' })

  const errEl = document.createElement('div')
  errEl.className = 'err'
  errEl.style.display = 'none'
  body.appendChild(errEl)

  const genBtn = document.createElement('button')
  genBtn.className = 'gen-btn'
  genBtn.innerHTML = '<span>⚡</span><span>Generate Prompt</span>'
  body.appendChild(genBtn)

  const resultEl = document.createElement('div')
  resultEl.className = 'result'
  resultEl.innerHTML = `
    <div class="result-hd"><span class="result-lbl">Generated Prompt</span><span class="result-meta"></span></div>
    <div class="result-box" contenteditable="true" spellcheck="false"></div>
    <div class="acts">
      <button class="act copy-btn">📋 Copy</button>
      <button class="act regen-btn">🔄 Regenerate</button>
      <button class="act primary insert-btn">↓ Insert into chat</button>
    </div>`
  body.appendChild(resultEl)

  const resultBox  = resultEl.querySelector('.result-box') as HTMLElement
  const resultMeta = resultEl.querySelector('.result-meta') as HTMLElement
  const copyBtn    = resultEl.querySelector('.copy-btn') as HTMLButtonElement
  const regenBtn   = resultEl.querySelector('.regen-btn') as HTMLButtonElement
  const insertBtn  = resultEl.querySelector('.insert-btn') as HTMLButtonElement

  async function doGenerate() {
    const basePrompt = desc.value.trim()
    if (!basePrompt) { desc.focus(); return }
    const userPrompt = refImageDescription
      ? `${basePrompt}\n\nReference image analysis:\n${refImageDescription}`
      : basePrompt
    if (!userPrompt) { desc.focus(); return }
    if (ctx.generating) return
    ctx.generating = true
    errEl.style.display = 'none'
    genBtn.disabled = true
    regenBtn.disabled = true
    genBtn.innerHTML = '<div class="spinner"></div><span>Generating…</span>'
    resultEl.classList.remove('show')

    const resetGenBtn = () => {
      ctx.generating = false
      genBtn.disabled = false
      regenBtn.disabled = false
      genBtn.innerHTML = '<span>⚡</span><span>Generate Prompt</span>'
    }

    const safetyTimer = setTimeout(() => {
      if (ctx.generating) {
        resetGenBtn()
        errEl.textContent = 'Request timed out. Please try again.'
        errEl.style.display = 'block'
      }
    }, 30_000)

    try {
      const resp = await chrome.runtime.sendMessage(
        { type: 'GENERATE_PROMPT', systemPrompt: buildSystemPrompt(s), userPrompt }
      ) as { text?: string; usage?: { total_tokens?: number }; error?: string }
      clearTimeout(safetyTimer)
      if (chrome.runtime.lastError) {
        resetGenBtn()
        errEl.textContent = chrome.runtime.lastError.message ?? 'Extension error. Please reload the page.'
        errEl.style.display = 'block'
        return
      }
      resetGenBtn()
      if (resp?.error) {
        errEl.textContent = resp.error
        errEl.style.display = 'block'
        return
      }
      ctx.lastResult = resp?.text ?? ''
      resultBox.textContent = ctx.lastResult
      resultMeta.textContent = resp?.usage?.total_tokens ? `${resp.usage.total_tokens} tokens` : ''
      resultEl.classList.add('show')
      resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } catch (err) {
      clearTimeout(safetyTimer)
      resetGenBtn()
      errEl.textContent = (err as Error).message ?? 'Extension error. Please reload the page.'
      errEl.style.display = 'block'
    }
  }

  genBtn.addEventListener('click', doGenerate)
  regenBtn.addEventListener('click', doGenerate)
  desc.addEventListener('keydown', (ev) => { if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') doGenerate() })

  copyBtn.addEventListener('click', () => {
    const text = resultBox.innerText || resultBox.textContent || ''
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = '✓ Copied!'
      setTimeout(() => { copyBtn.innerHTML = '📋 Copy' }, 2000)
    })
  })

  insertBtn.addEventListener('click', () => {
    const text = resultBox.innerText || resultBox.textContent || ''
    if (text && activeInput) insertText(activeInput, text)
  })

  if (ctx.lastResult) {
    resultBox.textContent = ctx.lastResult
    resultEl.classList.add('show')
  }
}

function _buildBrowseTab(ctx: ModalCtx) {
  const { body, s } = ctx
  body.innerHTML = ''
  body.style.minHeight = '320px'

  const search = document.createElement('input')
  search.className = 'search'
  search.placeholder = 'Search prompts…'
  search.value = s.browseQuery
  body.appendChild(search)

  const catWrap = document.createElement('div')
  catWrap.innerHTML = `<div class="lbl">Category</div>`
  const chips = document.createElement('div')
  chips.className = 'chips'
  const browseCategories = ['all', ...Array.from(new Set(defaultPrompts.map(p => p.category)))]
  browseCategories.forEach(cat => {
    const c = document.createElement('button')
    c.className = 'chip' + (cat === s.browseCat ? ' on' : '')
    c.textContent = cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)
    c.addEventListener('click', () => {
      s.browseCat = cat
      chips.querySelectorAll('.chip').forEach(x => x.className = 'chip')
      c.className = 'chip on'
      renderList()
    })
    chips.appendChild(c)
  })
  catWrap.appendChild(chips)
  body.appendChild(catWrap)

  const list = document.createElement('div')
  list.className = 'list'
  body.appendChild(list)

  function renderList() {
    const q = search.value.toLowerCase()
    s.browseQuery = search.value
    const filtered = defaultPrompts.filter(p => {
      const catOk = s.browseCat === 'all' || p.category === s.browseCat
      const textOk = !q || p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q))
      return catOk && textOk
    })
    list.innerHTML = ''
    if (filtered.length === 0) {
      const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = 'No prompts found'; list.appendChild(empty); return
    }
    filtered.forEach(p => {
      const item = document.createElement('div')
      item.className = 'item'
      const tagsHtml = p.tags.slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('')
      item.innerHTML = `<div class="item-name">${p.icon ? p.icon + ' ' : ''}${p.title}</div><div class="item-prev">${p.content.slice(0, 80)}…</div><div class="item-tags">${tagsHtml}</div>`
      item.addEventListener('mousedown', (ev) => {
        ev.preventDefault()
        if (activeInput) insertText(activeInput, `${p.role ? p.role + '\n\n' : ''}${p.content}`)
      })
      list.appendChild(item)
    })
  }
  search.addEventListener('input', renderList)
  renderList()
  setTimeout(() => search.focus(), 50)
}

function _buildResearchTab(ctx: ModalCtx) {
  const { body } = ctx
  body.innerHTML = ''
  body.style.minHeight = '340px'

  const queryWrap = document.createElement('div')
  queryWrap.innerHTML = `<div class="lbl">Research Topic / Question</div>`
  const queryEl = document.createElement('textarea')
  queryEl.className = 'desc'
  queryEl.placeholder = 'e.g. What are the latest developments in quantum computing for 2026?'
  queryEl.style.minHeight = '72px'
  queryWrap.appendChild(queryEl)
  body.appendChild(queryWrap)

  const depthRow = document.createElement('div')
  depthRow.className = 'sel-row'
  depthRow.appendChild(buildDropdown('Depth',
    [['quick','⚡ Quick Summary'],['standard','📄 Standard Report'],['deep','🔬 Deep Analysis'],['extra-deep','🧬 Extra Deep']],
    'standard', () => {}
  ))
  depthRow.appendChild(buildDropdown('Focus Area',
    [['general','General'],['science','Science & Tech'],['business','Business'],['history','History'],['health','Health & Medicine']],
    'general', () => {}
  ))

  const depthSel = depthRow.querySelectorAll<HTMLSelectElement>('select')[0]
  const focusSel = depthRow.querySelectorAll<HTMLSelectElement>('select')[1]
  body.appendChild(depthRow)

  const errEl = document.createElement('div')
  errEl.className = 'err'
  errEl.style.display = 'none'
  body.appendChild(errEl)

  const resBtn = document.createElement('button')
  resBtn.className = 'gen-btn'
  resBtn.innerHTML = '<span>🔬</span><span>Research</span>'
  body.appendChild(resBtn)

  const resultEl = document.createElement('div')
  resultEl.className = 'result'
  resultEl.innerHTML = `
    <div class="result-hd"><span class="result-lbl">Research Report</span><span class="result-meta"></span></div>
    <div class="result-box" contenteditable="true" spellcheck="false" style="max-height:220px"></div>
    <div class="acts">
      <button class="act copy-res-btn">📋 Copy</button>
      <button class="act primary save-panel-btn">📌 Save to Panel</button>
    </div>`
  body.appendChild(resultEl)

  const resultBox  = resultEl.querySelector('.result-box') as HTMLElement
  const resultMeta = resultEl.querySelector('.result-meta') as HTMLElement
  const copyResBtn = resultEl.querySelector('.copy-res-btn') as HTMLButtonElement
  const savePanelBtn = resultEl.querySelector('.save-panel-btn') as HTMLButtonElement

  let researchBusy = false
  let lastReport = ''

  function makeResearchPrompt(): { system: string; user: string; maxTokens: number } {
    const depth = depthSel.value
    const focus = focusSel.value
    const isExtraDeep = depth === 'extra-deep'
    const tokenMap: Record<string, string> = { quick: '400–600', standard: '900–1200', deep: '1800–2400', 'extra-deep': '3000–4000' }
    const maxMap: Record<string, number> = { quick: 800, standard: 1600, deep: 3000, 'extra-deep': 5000 }
    const tokenTarget = tokenMap[depth] ?? '900–1200'
    const maxTokens   = maxMap[depth] ?? 1600
    const extraSections = isExtraDeep
      ? '\n## Critical Analysis\n## Competing Perspectives\n## Future Implications\n## Knowledge Gaps\n## Recommended Further Reading'
      : ''
    const system = `You are an expert research analyst specialising in ${focus === 'general' ? 'broad interdisciplinary research' : focus}.
Produce a comprehensive, well-structured research report with clearly labelled ## sections.
Required sections: ## Executive Summary, ## Key Findings, ## Detailed Analysis, ## Evidence & Examples, ## Conclusion${extraSections}.
Target length: ${tokenTarget} tokens. Use British English. Be thorough and cite specific facts. No preamble.`
    const user = queryEl.value.trim()
    return { system, user, maxTokens }
  }

  resBtn.addEventListener('click', async () => {
    const query = queryEl.value.trim()
    if (!query) { queryEl.focus(); return }
    if (researchBusy) return
    researchBusy = true
    errEl.style.display = 'none'
    resBtn.disabled = true
    resBtn.innerHTML = '<div class="spinner"></div><span>Researching…</span>'
    resultEl.classList.remove('show')

    const resetResBtn = () => {
      researchBusy = false
      resBtn.disabled = false
      resBtn.innerHTML = '<span>🔬</span><span>Research</span>'
    }

    const safetyTimer = setTimeout(() => {
      if (researchBusy) {
        resetResBtn()
        errEl.textContent = 'Request timed out. Please try again.'
        errEl.style.display = 'block'
      }
    }, 60_000)

    const { system, user, maxTokens } = makeResearchPrompt()

    try {
      const resp = await chrome.runtime.sendMessage(
        { type: 'GENERATE_PROMPT', systemPrompt: system, userPrompt: user, maxTokens }
      ) as { text?: string; usage?: { total_tokens?: number }; error?: string }
      clearTimeout(safetyTimer)
      if (chrome?.runtime?.lastError) {
        resetResBtn()
        errEl.textContent = chrome.runtime.lastError.message ?? 'Extension error. Please reload the page.'
        errEl.style.display = 'block'
        return
      }
      resetResBtn()
      if (resp?.error) {
        errEl.textContent = resp.error
        errEl.style.display = 'block'
        return
      }
      lastReport = resp?.text ?? ''
      resultBox.textContent = lastReport
      resultMeta.textContent = resp?.usage?.total_tokens ? `${resp.usage.total_tokens} tokens` : ''
      resultEl.classList.add('show')
      resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } catch (err) {
      clearTimeout(safetyTimer)
      resetResBtn()
      errEl.textContent = (err as Error).message ?? 'Extension error. Please reload the page.'
      errEl.style.display = 'block'
    }
  })

  copyResBtn.addEventListener('click', () => {
    const text = resultBox.innerText || resultBox.textContent || ''
    navigator.clipboard.writeText(text).then(() => {
      copyResBtn.textContent = '✓ Copied!'
      setTimeout(() => { copyResBtn.innerHTML = '📋 Copy' }, 2000)
    })
  })

  savePanelBtn.addEventListener('click', () => {
    const text = resultBox.innerText || resultBox.textContent || ''
    if (!text) return
    const entry = {
      id: `research-${Date.now()}`,
      query: queryEl.value.trim(),
      report: text,
      depth: depthSel.value,
      focus: focusSel.value,
      savedAt: Date.now(),
    }
    try {
      chrome?.storage?.local?.get('prompt-os-research', (stored) => {
        const existing = (stored['prompt-os-research'] as typeof entry[]) || []
        chrome?.storage?.local?.set({ 'prompt-os-research': [entry, ...existing].slice(0, 50) })
      })
    } catch { /* ignore */ }
    savePanelBtn.textContent = '✓ Saved!'
    setTimeout(() => { savePanelBtn.innerHTML = '📌 Save to Panel' }, 2000)
  })

  setTimeout(() => queryEl.focus(), 50)
}

// ── Annotation overlay ──────────────────────────────────────────────────────

const ANNOT_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#ffffff','#000000']

function openAnnotation() {
  if (annotCanvas) return

  // ── Canvas ──────────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas')
  canvas.dataset.promptOs = 'annotation-canvas'
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', zIndex: '2147483645',
    pointerEvents: 'all', cursor: 'crosshair', touchAction: 'none',
  })
  document.body.appendChild(canvas)
  annotCanvas = canvas
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  // ── Drawing state ────────────────────────────────────────────────────────
  type ATool = 'cursor'|'pen'|'highlight'|'rect'|'filled-rect'|'ellipse'|'circle'|'arrow'|'line'|'text'|'eraser'|'callout'
  let tool: ATool = 'pen'
  let color       = '#ef4444'
  let strokeW     = 3
  let drawing     = false
  let startX = 0, startY = 0
  let history: ImageData[] = []
  let histIdx = -1
  let previewSnap: ImageData | null = null
  let highlightPoints: { x: number; y: number }[] = []
  let textActive = false
  type LastCalloutState = {
    x1: number
    y1: number
    x2: number
    y2: number
    color: string
    strokeW: number
    historyIdxBefore: number
    historyIdxAfter: number
  }
  /** Last placed callout — movable while this still matches history top (see `histIdx`). */
  let lastCallout: LastCalloutState | null = null
  let movingCallout = false
  let moveCalloutBase: ImageData | null = null
  let moveCalloutLc: LastCalloutState | null = null
  let moveCalloutGrabX = 0
  let moveCalloutGrabY = 0
  let moveCalloutW = 0
  let moveCalloutH = 0
  let lastCanvasX = 0
  let lastCanvasY = 0

  /** Padding around drag-rect so scallops / halftone / tail stay easy to grab */
  const CALLOUT_HIT_SLOP = 72
  const CALLOUT_TOP_EXTRA = 28

  function pointInCalloutBounds(px: number, py: number, x1: number, y1: number, x2: number, y2: number): boolean {
    const L = Math.min(x1, x2) - CALLOUT_HIT_SLOP
    const T = Math.min(y1, y2) - CALLOUT_HIT_SLOP - CALLOUT_TOP_EXTRA
    const R = Math.max(x1, x2) + CALLOUT_HIT_SLOP
    const B = Math.max(y1, y2) + CALLOUT_HIT_SLOP
    return px >= L && px <= R && py >= T && py <= B
  }

  function invalidateLastCallout() {
    lastCallout = null
  }

  function snap() {
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height)
    history = history.slice(0, histIdx + 1)
    history.push(d)
    histIdx++
    if (history.length > 80) { history.shift(); histIdx-- }
  }
  snap() // blank initial state

  function undo() {
    invalidateLastCallout()
    if (histIdx <= 0) { ctx.clearRect(0, 0, canvas.width, canvas.height); histIdx = -1; return }
    histIdx--; ctx.putImageData(history[histIdx], 0, 0)
  }
  function redo() {
    invalidateLastCallout()
    if (histIdx >= history.length - 1) return
    histIdx++; ctx.putImageData(history[histIdx], 0, 0)
  }

  /**
   * Comic-strip speech bubble: ~5 scallops on top, rounded lower body, centred V tail,
   * white fill, outline in current stroke colour; light halftone dots outside the bubble.
   */
  function drawComicCloudCallout(x1: number, y1: number, x2: number, y2: number) {
    const X = Math.min(x1, x2)
    const Y = Math.min(y1, y2)
    const W = Math.abs(x2 - x1)
    const H = Math.abs(y2 - y1)
    if (W < 40 || H < 40) return

    const pad = 10
    const bx = X + pad
    const by = Y + pad
    const bw = W - pad * 2
    const bh = H - pad * 2
    const tailH = Math.min(Math.max(18, bh * 0.18), 36)
    const tailW = Math.min(Math.max(14, bw * 0.1), 28)
    const bodyH = bh - tailH
    const bodyBottom = by + bodyH
    const bodyCx = bx + bw / 2
    const lw = Math.max(2.5, Math.min(5, strokeW))

    // Halftone dots behind the bubble
    ctx.save()
    const band = 44
    for (let gy = by - band; gy < bodyBottom + band; gy += 5) {
      for (let gx = bx - band; gx < bx + bw + band; gx += 5) {
        const d = distOutsideRect(gx, gy, bx, by, bw, bodyH)
        if (d <= 0 || d > band) continue
        const t = 1 - d / band
        ctx.fillStyle = `rgba(0,0,0,${0.1 * t * t})`
        ctx.beginPath()
        ctx.arc(gx + (gy % 10) * 0.3, gy, 1 + t * 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()

    // Cloud puffs: overlapping circles along the perimeter
    const puffR = Math.min(bw / 7, bodyH / 5, 22)
    const puffs: { px: number; py: number; r: number }[] = []

    const topN = Math.max(4, Math.round(bw / (puffR * 1.4)))
    for (let i = 0; i < topN; i++) {
      puffs.push({ px: bx + ((i + 0.5) / topN) * bw, py: by + puffR * 0.15, r: puffR })
    }
    const sideN = Math.max(2, Math.round(bodyH / (puffR * 1.5)))
    for (let i = 0; i < sideN; i++) {
      puffs.push({ px: bx + bw - puffR * 0.15, py: by + ((i + 0.5) / sideN) * bodyH, r: puffR * 0.9 })
    }
    const botN = Math.max(4, Math.round(bw / (puffR * 1.4)))
    for (let i = 0; i < botN; i++) {
      const px = bx + bw - ((i + 0.5) / botN) * bw
      if (Math.abs(px - bodyCx) < tailW) continue
      puffs.push({ px, py: bodyBottom - puffR * 0.15, r: puffR })
    }
    for (let i = 0; i < sideN; i++) {
      puffs.push({ px: bx + puffR * 0.15, py: bodyBottom - ((i + 0.5) / sideN) * bodyH, r: puffR * 0.9 })
    }

    ctx.save()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = lw

    // White body fill behind puffs
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(bx + puffR * 0.3, by + puffR * 0.3, bw - puffR * 0.6, bodyH - puffR * 0.3)

    // Fill each puff white, then stroke
    for (const p of puffs) {
      ctx.beginPath()
      ctx.arc(p.px, p.py, p.r, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
    }
    for (const p of puffs) {
      ctx.beginPath()
      ctx.arc(p.px, p.py, p.r, 0, Math.PI * 2)
      ctx.strokeStyle = color
      ctx.stroke()
    }

    // White-out interior stroke overlaps
    const inset = puffR * 0.55
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(bx + inset, by + inset, bw - inset * 2, bodyH - inset * 1.5)

    // Tail triangle
    ctx.beginPath()
    ctx.moveTo(bodyCx - tailW * 0.6, bodyBottom - 2)
    ctx.lineTo(bodyCx, by + bh)
    ctx.lineTo(bodyCx + tailW * 0.6, bodyBottom - 2)
    ctx.closePath()
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = color
    ctx.stroke()

    // White-out tail base
    ctx.beginPath()
    ctx.moveTo(bodyCx - tailW * 0.5, bodyBottom - 1)
    ctx.lineTo(bodyCx + tailW * 0.5, bodyBottom - 1)
    ctx.lineWidth = lw + 2
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()

    ctx.restore()
  }

  function applyTool(x: number, y: number) {
    ctx.strokeStyle = color
    ctx.fillStyle   = color
    ctx.lineWidth   = strokeW
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'

    if (tool === 'pen') {
      ctx.globalAlpha = 1
      ctx.lineTo(x, y); ctx.stroke()
    } else if (tool === 'highlight') {
      // Restore snapshot each frame and redraw full path in one pass
      // so alpha never accumulates — text beneath stays visible
      highlightPoints.push({ x, y })
      if (previewSnap) ctx.putImageData(previewSnap, 0, 0)
      ctx.globalAlpha = 0.38
      ctx.lineWidth   = strokeW * 6
      ctx.lineCap     = 'square'
      ctx.lineJoin    = 'round'
      ctx.beginPath()
      ctx.moveTo(highlightPoints[0].x, highlightPoints[0].y)
      for (const p of highlightPoints) ctx.lineTo(p.x, p.y)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.lineCap = 'round'
    } else if (tool === 'eraser') {
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = strokeW * 7
      ctx.lineTo(x, y); ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
    } else if (previewSnap) {
      ctx.putImageData(previewSnap, 0, 0)
      ctx.globalAlpha = 1
      ctx.beginPath()
      if (tool === 'rect') {
        ctx.strokeRect(startX, startY, x - startX, y - startY)
      } else if (tool === 'filled-rect') {
        ctx.globalAlpha = 0.55; ctx.fillRect(startX, startY, x - startX, y - startY)
      } else if (tool === 'ellipse') {
        const rx = Math.abs(x - startX) / 2, ry = Math.abs(y - startY) / 2
        ctx.ellipse(startX + (x - startX) / 2, startY + (y - startY) / 2, rx || 1, ry || 1, 0, 0, Math.PI * 2)
        ctx.stroke()
      } else if (tool === 'circle') {
        const r = Math.hypot(x - startX, y - startY)
        ctx.arc(startX, startY, r, 0, Math.PI * 2); ctx.stroke()
      } else if (tool === 'line') {
        ctx.moveTo(startX, startY); ctx.lineTo(x, y); ctx.stroke()
      } else if (tool === 'arrow') {
        const ang = Math.atan2(y - startY, x - startX)
        const hl  = Math.max(14, strokeW * 4)
        ctx.moveTo(startX, startY); ctx.lineTo(x, y)
        ctx.lineTo(x - hl * Math.cos(ang - Math.PI / 6), y - hl * Math.sin(ang - Math.PI / 6))
        ctx.moveTo(x, y)
        ctx.lineTo(x - hl * Math.cos(ang + Math.PI / 6), y - hl * Math.sin(ang + Math.PI / 6))
        ctx.stroke()
      } else if (tool === 'callout') {
        drawComicCloudCallout(startX, startY, x, y)
      }
    }
  }

  canvas.addEventListener('mousedown', (e) => {
    if (textActive || tool === 'cursor') return
    if (e.button !== 0) return
    const r = canvas.getBoundingClientRect()
    const cx = e.clientX - r.left
    const cy = e.clientY - r.top
    startX = cx
    startY = cy
    lastCanvasX = cx
    lastCanvasY = cy

    const lcMove = lastCallout
    if (
      tool === 'callout' &&
      histIdx === lcMove?.historyIdxAfter &&
      pointInCalloutBounds(cx, cy, lcMove.x1, lcMove.y1, lcMove.x2, lcMove.y2)
    ) {
      const lc = lcMove
      movingCallout = true
      drawing = true
      moveCalloutLc = lc
      lastCallout = null
      // Restore canvas to the state before the callout was drawn
      if (lc.historyIdxBefore >= 0 && lc.historyIdxBefore < history.length) {
        histIdx = lc.historyIdxBefore
        ctx.putImageData(history[histIdx], 0, 0)
      } else {
        undo()
      }
      moveCalloutBase = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const minX = Math.min(lc.x1, lc.x2)
      const minY = Math.min(lc.y1, lc.y2)
      moveCalloutW = Math.abs(lc.x2 - lc.x1)
      moveCalloutH = Math.abs(lc.y2 - lc.y1)
      moveCalloutGrabX = cx - minX
      moveCalloutGrabY = cy - minY
      previewSnap = null
      highlightPoints = []
      const nx1 = minX
      const ny1 = minY
      const nx2 = nx1 + (lc.x2 >= lc.x1 ? moveCalloutW : -moveCalloutW)
      const ny2 = ny1 + (lc.y2 >= lc.y1 ? moveCalloutH : -moveCalloutH)
      const prevC = color
      const prevW = strokeW
      color = lc.color
      strokeW = lc.strokeW
      ctx.putImageData(moveCalloutBase, 0, 0)
      drawComicCloudCallout(nx1, ny1, nx2, ny2)
      color = prevC
      strokeW = prevW
      return
    }

    if (tool === 'callout' && lastCallout && histIdx !== lastCallout.historyIdxAfter) {
      invalidateLastCallout()
    }

    drawing = true
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    if (tool === 'text') {
      e.preventDefault()
      e.stopPropagation()
      spawnText(startX, startY, e.clientX, e.clientY)
      drawing = false
      return
    }
    if (['rect','filled-rect','ellipse','circle','arrow','line','callout','highlight'].includes(tool)) {
      previewSnap = ctx.getImageData(0, 0, canvas.width, canvas.height)
      if (tool === 'highlight') highlightPoints = [{ x: startX, y: startY }]
    } else {
      ctx.beginPath(); ctx.moveTo(startX, startY)
    }
  })

  canvas.addEventListener('touchstart', (e) => {
    if (tool !== 'text' || textActive || e.touches.length !== 1) return
    e.preventDefault()
    const touch = e.touches[0]
    const r = canvas.getBoundingClientRect()
    const cx = touch.clientX - r.left
    const cy = touch.clientY - r.top
    spawnText(cx, cy, touch.clientX, touch.clientY)
  }, { passive: false })

  canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return
    const r = canvas.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    lastCanvasX = x
    lastCanvasY = y

    if (movingCallout && moveCalloutBase && moveCalloutLc) {
      const lc = moveCalloutLc
      const minX = x - moveCalloutGrabX
      const minY = y - moveCalloutGrabY
      const nx1 = minX
      const ny1 = minY
      const nx2 = nx1 + (lc.x2 >= lc.x1 ? moveCalloutW : -moveCalloutW)
      const ny2 = ny1 + (lc.y2 >= lc.y1 ? moveCalloutH : -moveCalloutH)
      ctx.putImageData(moveCalloutBase, 0, 0)
      const prevC = color
      const prevW = strokeW
      color = lc.color
      strokeW = lc.strokeW
      drawComicCloudCallout(nx1, ny1, nx2, ny2)
      color = prevC
      strokeW = prevW
      return
    }

    applyTool(x, y)
  })

  const endDraw = () => {
    if (!drawing) return

    if (movingCallout && moveCalloutBase && moveCalloutLc) {
      const lc = moveCalloutLc
      const minX = lastCanvasX - moveCalloutGrabX
      const minY = lastCanvasY - moveCalloutGrabY
      const nx1 = minX
      const ny1 = minY
      const nx2 = nx1 + (lc.x2 >= lc.x1 ? moveCalloutW : -moveCalloutW)
      const ny2 = ny1 + (lc.y2 >= lc.y1 ? moveCalloutH : -moveCalloutH)
      ctx.putImageData(moveCalloutBase, 0, 0)
      const prevC = color
      const prevW = strokeW
      color = lc.color
      strokeW = lc.strokeW
      drawComicCloudCallout(nx1, ny1, nx2, ny2)
      color = prevC
      strokeW = prevW
      movingCallout = false
      moveCalloutBase = null
      moveCalloutLc = null
      drawing = false
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      previewSnap = null
      highlightPoints = []
      const idxBeforeSnap = histIdx
      snap()
      if (Math.abs(nx2 - nx1) >= 40 && Math.abs(ny2 - ny1) >= 40) {
        lastCallout = {
          x1: nx1,
          y1: ny1,
          x2: nx2,
          y2: ny2,
          color: lc.color,
          strokeW: lc.strokeW,
          historyIdxBefore: idxBeforeSnap,
          historyIdxAfter: histIdx,
        }
      }
      return
    }

    const wasCalloutDraw = tool === 'callout' && previewSnap !== null
    drawing = false
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    previewSnap = null
    highlightPoints = []
    const idxBeforeCalloutSnap = histIdx
    snap()
    if (wasCalloutDraw) {
      const x1 = startX
      const y1 = startY
      const x2 = lastCanvasX
      const y2 = lastCanvasY
      if (Math.abs(x2 - x1) >= 40 && Math.abs(y2 - y1) >= 40) {
        lastCallout = {
          x1,
          y1,
          x2,
          y2,
          color,
          strokeW,
          historyIdxBefore: idxBeforeCalloutSnap,
          historyIdxAfter: histIdx,
        }
        const anchor = calloutBodyTextAnchor(x1, y1, x2, y2)
        if (anchor && !textActive) {
          requestAnimationFrame(() => {
            tool = 'text'
            bar.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((el) => {
              el.dataset.active = '0'
            })
            const tb = bar.querySelector<HTMLButtonElement>('[data-tool="text"]')
            if (tb) tb.dataset.active = '1'
            canvas.style.pointerEvents = 'all'
            canvas.style.cursor = 'text'
            const r = canvas.getBoundingClientRect()
            spawnText(anchor.cx, anchor.cy, r.left + anchor.cx, r.top + anchor.cy)
          })
        }
      }
    }
  }
  canvas.addEventListener('mouseup', endDraw)
  canvas.addEventListener('mouseleave', endDraw)

  function spawnText(canvasX: number, canvasY: number, clientX: number, clientY: number) {
    textActive = true
    const inp = document.createElement('input')
    inp.type = 'text'
    inp.placeholder = 'Type annotation…'
    inp.setAttribute('aria-label', 'Annotation text')
    inp.dataset.promptOs = 'annot-text-input'
    const fontPx = Math.max(14, strokeW * 4)
    const vw = globalThis.innerWidth
    const vh = globalThis.innerHeight
    const leftPx = Math.min(Math.max(8, clientX - 72), vw - 180)
    const topPx = Math.min(Math.max(48, clientY - 18), vh - 56)
    Object.assign(inp.style, {
      position: 'fixed', left: `${leftPx}px`, top: `${topPx}px`,
      zIndex: '2147483647', background: '#ffffff',
      border: `2px solid ${color}`, borderRadius: '8px',
      outline: 'none', color: '#111827', padding: '8px 12px',
      font: `bold ${fontPx}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`,
      minWidth: '160px', boxShadow: '0 8px 28px rgba(0,0,0,.22)',
    })
    document.body.appendChild(inp)

    let blurTimer: ReturnType<typeof globalThis.setTimeout> | null = null
    const finish = () => {
      if (blurTimer !== null) {
        globalThis.clearTimeout(blurTimer)
        blurTimer = null
      }
    }
    const commit = () => {
      finish()
      if (!inp.parentNode) {
        textActive = false
        return
      }
      const txt = inp.value.trim()
      if (txt) {
        ctx.save()
        ctx.globalAlpha = 1
        ctx.fillStyle = color
        ctx.font = `bold ${fontPx}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'center'
        ctx.fillText(txt, canvasX, canvasY)
        ctx.restore()
        snap()
        if (lastCallout) {
          lastCallout = { ...lastCallout, historyIdxAfter: histIdx }
        }
      }
      if (inp.parentNode) inp.remove()
      textActive = false
    }
    const cancel = () => {
      finish()
      inp.remove()
      textActive = false
    }

    inp.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); commit() }
      if (ev.key === 'Escape') { ev.preventDefault(); cancel() }
    })
    inp.addEventListener('focus', () => {
      if (blurTimer !== null) {
        globalThis.clearTimeout(blurTimer)
        blurTimer = null
      }
    })
    inp.addEventListener('blur', () => {
      blurTimer = globalThis.setTimeout(() => {
        if (!document.body.contains(inp)) return
        commit()
      }, 150)
    })

    globalThis.requestAnimationFrame(() => {
      globalThis.requestAnimationFrame(() => {
        inp.focus({ preventScroll: true })
      })
    })
  }

  // ── Toolbar (pure inline styles — no shadow DOM for maximum site compatibility) ──
  const bar = document.createElement('div')
  bar.dataset.promptOs = 'annotation-toolbar'
  // setAttribute lets us use !important, overriding any page CSS
  bar.setAttribute('style', [
    'position:fixed!important','top:12px!important','left:50%!important',
    'transform:translateX(-50%)!important','z-index:2147483647!important',
    'pointer-events:all!important','display:flex!important',
    'align-items:center!important','gap:4px!important',
    'visibility:visible!important','opacity:1!important',
    'background:rgba(15,12,30,.93)!important',
    'backdrop-filter:blur(10px)!important','-webkit-backdrop-filter:blur(10px)!important',
    'border-radius:14px!important','padding:6px 8px!important',
    'box-shadow:0 8px 32px rgba(0,0,0,.4)!important',
    'max-width:calc(100vw - 24px)!important','overflow-x:auto!important',
    'user-select:none!important','box-sizing:border-box!important',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important',
  ].join(';'))
  document.body.appendChild(bar)
  annotToolbar = bar

  // Shared styles (avoids huge per-button inline CSS + fixes WCAG contrast on hover)
  const ANNOT_TBAR_STYLE_ID = 'prompt-os-annot-toolbar-styles'
  if (!document.getElementById(ANNOT_TBAR_STYLE_ID)) {
    const st = document.createElement('style')
    st.id = ANNOT_TBAR_STYLE_ID
    st.textContent = `
[data-prompt-os="annotation-toolbar"] > button[data-tool],
[data-prompt-os="annotation-toolbar"] > button[data-annot="action"],
[data-prompt-os="annotation-toolbar"] > button[data-annot="close"]{
  min-width:44px!important;min-height:44px!important;width:44px!important;height:44px!important;
  border-radius:8px!important;border:none!important;background:transparent!important;
  cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;
  font-size:17px!important;padding:0!important;line-height:1!important;color:#e8e8ef!important;
  flex-shrink:0!important;box-sizing:border-box!important;font-family:inherit!important;outline:none!important;
}
[data-prompt-os="annotation-toolbar"] > button[data-tool]:hover:not([data-active="1"]),
[data-prompt-os="annotation-toolbar"] > button[data-annot="action"]:hover{
  background:rgba(124,58,237,.45)!important;
}
[data-prompt-os="annotation-toolbar"] > button[data-tool][data-active="1"]{
  background:rgba(124,58,237,.85)!important;
}
[data-prompt-os="annotation-toolbar"] > button[data-annot="close"]{
  color:#fca5a5!important;font-size:15px!important;
}
[data-prompt-os="annotation-toolbar"] > button[data-annot="close"]:hover{
  background:rgba(239,68,68,.35)!important;
}
[data-prompt-os="annotation-toolbar"] > button[data-annot="width"]{
  min-width:44px!important;min-height:36px!important;height:auto!important;width:auto!important;
  border-radius:6px!important;cursor:pointer!important;font-size:11px!important;padding:8px 12px!important;
  flex-shrink:0!important;box-sizing:border-box!important;font-family:inherit!important;outline:none!important;
  color:#e8e8ef!important;background:transparent!important;border:1px solid rgba(255,255,255,.28)!important;
}
[data-prompt-os="annotation-toolbar"] > button[data-annot="width"]:hover:not([data-active="1"]){
  background:rgba(124,58,237,.35)!important;
}
[data-prompt-os="annotation-toolbar"] > button[data-annot="width"][data-active="1"]{
  background:rgba(124,58,237,.55)!important;border-color:rgba(255,255,255,.55)!important;
}
`
    document.documentElement.appendChild(st)
  }

  function mkBtn(emoji: string, label: string, id: string): HTMLButtonElement {
    const b = document.createElement('button')
    b.textContent = emoji; b.title = label; b.dataset.tool = id
    b.addEventListener('click', () => {
      tool = id as ATool
      bar.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(el => {
        el.dataset.active = '0'
      })
      b.dataset.active = '1'
      if (id === 'cursor') {
        canvas.style.pointerEvents = 'none'
        canvas.style.cursor = 'default'
      } else {
        canvas.style.pointerEvents = 'all'
        const cursorMap: Record<string, string> = { text: 'text', eraser: 'cell' }
        canvas.style.cursor = cursorMap[id] ?? 'crosshair'
      }
    })
    return b
  }

  // Drag handle
  let dragX = 0, dragY = 0, dragging = false
  const drag = document.createElement('div')
  Object.assign(drag.style, { cursor:'grab', padding:'0 6px', color:'rgba(255,255,255,.5)',
    fontSize:'16px', flexShrink:'0', boxSizing:'border-box', userSelect:'none' })
  drag.textContent = '⠿'
  drag.addEventListener('mousedown', (e) => {
    dragging = true
    dragX = e.clientX - bar.getBoundingClientRect().left
    dragY = e.clientY - bar.getBoundingClientRect().top
    e.preventDefault()
  })
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return
    bar.setAttribute('style', bar.getAttribute('style')!
      .replace(/left:[^!]+!important/, `left:${e.clientX - dragX}px!important`)
      .replace(/top:[^!]+!important/, `top:${e.clientY - dragY}px!important`)
      .replace(/transform:[^!]+!important/, 'transform:none!important'))
  })
  document.addEventListener('mouseup', () => { dragging = false })
  bar.appendChild(drag)

  const sep = () => {
    const s = document.createElement('div')
    Object.assign(s.style, { width:'1px', height:'24px', background:'rgba(255,255,255,.15)',
      margin:'0 2px', flexShrink:'0', boxSizing:'border-box' })
    return s
  }

  // Cursor tool (pass-through mode)
  bar.appendChild(mkBtn('🖱️', 'Navigate (pass-through)', 'cursor'))

  bar.appendChild(sep())
  // Drawing tools
  const tools: [string, string, ATool][] = [
    ['✏️','Pen','pen'],['🖌️','Highlighter','highlight'],['T','Text','text'],['⎚','Eraser','eraser'],
  ]
  tools.forEach(([e, l, id]) => {
    const b = mkBtn(e, l, id)
    if (id === 'pen') b.dataset.active = '1'
    bar.appendChild(b)
  })

  bar.appendChild(sep())
  // Shape tools
  const shapes: [string, string, ATool][] = [
    ['▭','Rectangle','rect'],['▬','Filled Box','filled-rect'],['⬭','Ellipse','ellipse'],
    ['◎','Circle','circle'],['╱','Line','line'],['→','Arrow','arrow'],['💬','Callout — drag to draw; type after; 💬+drag on bubble to move','callout'],
  ]
  shapes.forEach(([e, l, id]) => bar.appendChild(mkBtn(e, l, id)))

  bar.appendChild(sep())
  // Color swatches
  const swatches: HTMLElement[] = []
  ANNOT_COLORS.forEach(c => {
    const sw = document.createElement('div')
    Object.assign(sw.style, {
      width:'20px', height:'20px', borderRadius:'50%', cursor:'pointer',
      background:c, flexShrink:'0', boxSizing:'border-box',
      border: c === color ? '2px solid #fff' : '2px solid transparent',
      outline: c === '#ffffff' ? '1px solid rgba(255,255,255,.4)' : 'none',
    })
    sw.addEventListener('click', () => {
      color = c
      swatches.forEach(s => { s.style.border = '2px solid transparent' })
      sw.style.border = '2px solid #fff'
    })
    swatches.push(sw)
    bar.appendChild(sw)
  })
  // Custom colour picker
  const ccWrap = document.createElement('div')
  Object.assign(ccWrap.style, { position:'relative', width:'20px', height:'20px',
    borderRadius:'50%', overflow:'hidden', flexShrink:'0', cursor:'pointer', boxSizing:'border-box' })
  const ccInner = document.createElement('div')
  Object.assign(ccInner.style, { position:'absolute', inset:'0', background:color, borderRadius:'50%' })
  const ccInput = document.createElement('input')
  ccInput.type = 'color'; ccInput.value = color
  Object.assign(ccInput.style, { position:'absolute', inset:'0', opacity:'0', cursor:'pointer',
    width:'100%', height:'100%', border:'none', padding:'0' })
  ccInput.addEventListener('input', () => {
    color = ccInput.value; ccInner.style.background = color
    swatches.forEach(s => { s.style.border = '2px solid transparent' })
  })
  ccWrap.appendChild(ccInner); ccWrap.appendChild(ccInput)
  bar.appendChild(ccWrap)

  bar.appendChild(sep())
  // Stroke widths
  const widthBtns: HTMLButtonElement[] = []
  const widths: [number, string][] = [[2,'Thin'],[4,'Medium'],[8,'Thick'],[14,'Extra Thick']]
  widths.forEach(([w, label]) => {
    const b = document.createElement('button')
    b.title = label; b.textContent = `${w}px`
    b.dataset.annot = 'width'
    if (w === strokeW) b.dataset.active = '1'
    b.addEventListener('click', () => {
      strokeW = w
      widthBtns.forEach(wb => { wb.dataset.active = '0' })
      b.dataset.active = '1'
    })
    widthBtns.push(b)
    bar.appendChild(b)
  })

  bar.appendChild(sep())
  // Undo/Redo/Clear/Save
  const mkAction = (emoji: string, label: string, fn: () => void | Promise<void>) => {
    const b = document.createElement('button')
    b.textContent = emoji; b.title = label
    b.dataset.annot = 'action'
    b.addEventListener('click', () => { void fn() })
    return b
  }
  bar.appendChild(mkAction('↩','Undo', undo))
  bar.appendChild(mkAction('↪','Redo', redo))
  bar.appendChild(mkAction('🗑','Clear All', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    invalidateLastCallout()
    snap()
  }))
  bar.appendChild(mkAction('💾','Save PNG (page + drawings, visible area)', () => saveAnnotationScreenshot(bar, canvas)))

  bar.appendChild(sep())
  const closeBtn = document.createElement('button')
  closeBtn.textContent = '✕'; closeBtn.title = 'Exit Annotation (Esc)'
  closeBtn.dataset.annot = 'close'
  closeBtn.addEventListener('click', closeAnnotation)
  bar.appendChild(closeBtn)

  // Resize handler
  const onResize = () => {
    const snap2 = ctx.getImageData(0, 0, canvas.width, canvas.height)
    canvas.width = window.innerWidth; canvas.height = window.innerHeight
    ctx.putImageData(snap2, 0, 0)
  }
  window.addEventListener('resize', onResize)
  ;(canvas as HTMLCanvasElement & { _annotResizeCleanup?: () => void })._annotResizeCleanup = () => window.removeEventListener('resize', onResize)

  // Escape to close
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAnnotation() }
  document.addEventListener('keydown', onKey)
  ;(bar as HTMLElement & { _annotKeyCleanup?: () => void })._annotKeyCleanup = () => document.removeEventListener('keydown', onKey)
}

function closeAnnotation() {
  if (annotCanvas) {
    ;(annotCanvas as HTMLCanvasElement & { _annotResizeCleanup?: () => void })._annotResizeCleanup?.()
    annotCanvas.remove(); annotCanvas = null
  }
  if (annotToolbar) {
    ;(annotToolbar as HTMLElement & { _annotKeyCleanup?: () => void })._annotKeyCleanup?.()
    annotToolbar.remove(); annotToolbar = null
  }
}

// ── Diagnostic Mode ─────────────────────────────────────────────────────────

const DIAG_SIDEBAR_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:host{all:initial}
.sidebar{
  position:fixed;top:0;right:0;width:420px;height:100vh;
  background:#fff;border-left:1px solid #e5e7eb;
  box-shadow:-8px 0 32px rgba(0,0,0,.12);
  display:flex;flex-direction:column;overflow:hidden;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  font-size:13px;color:#111827;z-index:2147483647;
  animation:slideIn .22s cubic-bezier(.34,1.56,.64,1);
}
@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:none;opacity:1}}
.sb-hd{
  display:flex;align-items:center;gap:10px;
  padding:14px 16px;border-bottom:1px solid #f3f4f6;flex-shrink:0;
  background:linear-gradient(135deg,#faf5ff,#eff6ff);
}
.sb-hd-icon{font-size:22px;line-height:1}
.sb-hd-title{font:700 15px/1.2 -apple-system,sans-serif;color:#111;flex:1}
.sb-hd-sub{font-size:11px;color:#6b7280;margin-top:2px}
.sb-close{
  width:30px;height:30px;border-radius:8px;border:none;
  background:transparent;cursor:pointer;color:#9ca3af;
  display:flex;align-items:center;justify-content:center;font-size:18px;
  transition:background .1s,color .1s;flex-shrink:0;
}
.sb-close:hover{background:#fef2f2;color:#ef4444}
.sb-body{flex:1;overflow-y:auto;padding:14px 16px;scrollbar-width:thin}
.sb-section{margin-bottom:16px}
.sb-lbl{
  font:700 10px/1 -apple-system,sans-serif;letter-spacing:.08em;
  color:#6b7280;text-transform:uppercase;margin-bottom:8px;
  display:flex;align-items:center;gap:6px;
}
.sb-lbl-icon{font-size:13px}
.sb-card{
  background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;
  padding:10px 12px;font-size:12px;line-height:1.6;
}
.sb-card code{
  background:#e0e7ff;color:#4338ca;padding:1px 5px;
  border-radius:4px;font:11.5px/1 'SF Mono',Menlo,monospace;
}
.sb-tag{
  display:inline-block;background:#dbeafe;color:#1d4ed8;
  font-size:10px;font-weight:600;padding:2px 7px;
  border-radius:999px;margin:2px 2px 2px 0;
}
.sb-tag.warn{background:#fef3c7;color:#92400e}
.sb-tag.err{background:#fee2e2;color:#991b1b}
.sb-tag.ok{background:#d1fae5;color:#065f46}
.sb-grid{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:12px}
.sb-grid-key{color:#6b7280;font-weight:600;white-space:nowrap}
.sb-grid-val{color:#111827;word-break:break-all}
.sb-issues{display:flex;flex-direction:column;gap:6px}
.sb-issue{
  padding:8px 10px;border-radius:8px;font-size:12px;line-height:1.5;
}
.sb-issue.warn{background:#fffbeb;border:1px solid #fde68a}
.sb-issue.err{background:#fef2f2;border:1px solid #fecaca}
.sb-issue.info{background:#eff6ff;border:1px solid #bfdbfe}
.sb-issue-title{font-weight:700;margin-bottom:2px}
.sb-issue-fix{color:#4b5563;font-style:italic;margin-top:3px}
.sb-prompt-box{
  background:#1e1b4b;color:#e0e7ff;border-radius:10px;
  padding:12px;font:12px/1.6 'SF Mono',Menlo,monospace;
  max-height:240px;overflow-y:auto;white-space:pre-wrap;
  scrollbar-width:thin;user-select:all;
}
.sb-actions{
  display:flex;gap:8px;padding:12px 16px;border-top:1px solid #f3f4f6;flex-shrink:0;
}
.sb-btn{
  flex:1;height:36px;border-radius:8px;border:none;
  font:600 12px/1 -apple-system,sans-serif;cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:6px;
  transition:all .12s;
}
.sb-btn.primary{background:#7c3aed;color:#fff}
.sb-btn.primary:hover{background:#6d28d9;box-shadow:0 4px 14px rgba(124,58,237,.3)}
.sb-btn.secondary{background:#f3f4f6;color:#374151;border:1px solid #e5e7eb}
.sb-btn.secondary:hover{background:#e5e7eb}
.sb-empty{text-align:center;color:#9ca3af;padding:40px 16px;font-size:13px}
.sb-empty-icon{font-size:40px;margin-bottom:8px;opacity:.6}
`

interface DiagnosticData {
  tagName: string
  id: string
  classes: string[]
  rect: { width: number; height: number; top: number; left: number }
  computedStyles: Record<string, string>
  attributes: Record<string, string>
  textContent: string
  childCount: number
  parentChain: string[]
  issues: DiagnosticIssue[]
  selector: string
  outerHTML: string
}

interface DiagnosticIssue {
  severity: 'error' | 'warning' | 'info'
  title: string
  detail: string
  fix: string
}

function gatherDiagnostics(el: HTMLElement): DiagnosticData {
  const rect = el.getBoundingClientRect()
  const cs = globalThis.getComputedStyle(el)

  const styleKeys = [
    'display', 'position', 'width', 'height', 'margin', 'padding',
    'color', 'backgroundColor', 'fontSize', 'fontFamily', 'fontWeight',
    'lineHeight', 'overflow', 'visibility', 'opacity', 'zIndex',
    'flexDirection', 'justifyContent', 'alignItems', 'gridTemplateColumns',
    'borderRadius', 'boxShadow', 'transform',
  ]
  const computedStyles: Record<string, string> = {}
  for (const k of styleKeys) {
    const v = cs.getPropertyValue(k.replaceAll(/[A-Z]/g, m => `-${m.toLowerCase()}`))
    if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px') {
      computedStyles[k] = v
    }
  }

  const attributes: Record<string, string> = {}
  for (const attr of Array.from(el.attributes)) {
    if (attr.name !== 'style') attributes[attr.name] = attr.value
  }

  const parentChain: string[] = []
  let p = el.parentElement
  let depth = 0
  while (p && depth < 5) {
    const id = p.id ? `#${p.id}` : ''
    const cls = p.classList.length ? `.${Array.from(p.classList).slice(0, 2).join('.')}` : ''
    parentChain.push(`${p.tagName.toLowerCase()}${id}${cls}`)
    p = p.parentElement
    depth++
  }

  const issues = diagnoseIssues(el, cs, rect, attributes)

  const id = el.id ? `#${el.id}` : ''
  const cls = el.classList.length ? `.${Array.from(el.classList).slice(0, 3).join('.')}` : ''
  const selector = `${el.tagName.toLowerCase()}${id}${cls}`

  let outerHTML = el.outerHTML
  if (outerHTML.length > 800) {
    outerHTML = outerHTML.slice(0, 800) + '…'
  }

  return {
    tagName: el.tagName.toLowerCase(),
    id: el.id,
    classes: Array.from(el.classList),
    rect: { width: Math.round(rect.width), height: Math.round(rect.height), top: Math.round(rect.top), left: Math.round(rect.left) },
    computedStyles,
    attributes,
    textContent: (el.textContent || '').trim().slice(0, 200),
    childCount: el.children.length,
    parentChain,
    issues,
    selector,
    outerHTML,
  }
}

function diagnoseIssues(
  el: HTMLElement,
  cs: CSSStyleDeclaration,
  rect: DOMRect,
  attrs: Record<string, string>,
): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = []

  // Zero-size elements
  if (rect.width === 0 || rect.height === 0) {
    issues.push({
      severity: 'error',
      title: 'Element has zero dimensions',
      detail: `Width: ${rect.width}px, Height: ${rect.height}px. The element is invisible.`,
      fix: 'Check if the element has content, or set explicit width/height. Verify display is not "none" and parent has dimensions.',
    })
  }

  // Off-screen
  if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
    issues.push({
      severity: 'warning',
      title: 'Element is off-screen',
      detail: `Position: top=${Math.round(rect.top)}, left=${Math.round(rect.left)}. Not visible in viewport.`,
      fix: 'Check position/transform values. If intentional (e.g., off-screen for animation), ignore.',
    })
  }

  // Hidden visibility
  if (cs.visibility === 'hidden') {
    issues.push({
      severity: 'warning',
      title: 'Element has visibility: hidden',
      detail: 'The element is in the DOM and takes up space but is not visible.',
      fix: 'Use visibility: visible, or display: none if you want to remove it from layout.',
    })
  }

  // Zero opacity
  if (Number.parseFloat(cs.opacity) === 0) {
    issues.push({
      severity: 'warning',
      title: 'Element has opacity: 0',
      detail: 'The element is fully transparent and invisible to users.',
      fix: 'Set opacity > 0 or remove the element if unused.',
    })
  }

  // Images without alt text
  if (el.tagName === 'IMG' && !attrs['alt']) {
    issues.push({
      severity: 'error',
      title: 'Image missing alt attribute',
      detail: 'Screen readers cannot describe this image. Fails WCAG 2.1 Level A (1.1.1).',
      fix: 'Add a descriptive alt attribute: <img alt="Description of image" />',
    })
  }

  // Interactive elements without accessible names
  const interactive = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'])
  if (interactive.has(el.tagName)) {
    const hasLabel = attrs['aria-label'] || attrs['aria-labelledby'] || attrs['title']
    const hasText = (el.textContent || '').trim().length > 0
    if (!hasLabel && !hasText) {
      issues.push({
        severity: 'error',
        title: 'Interactive element has no accessible name',
        detail: `<${el.tagName.toLowerCase()}> has no text content, aria-label, or title attribute.`,
        fix: 'Add aria-label="description" or visible text content for screen readers.',
      })
    }
  }

  // Missing lang on <html>
  if (el.tagName === 'HTML' && !attrs['lang']) {
    issues.push({
      severity: 'warning',
      title: 'Missing lang attribute on <html>',
      detail: 'Screen readers need the language to pronounce content correctly.',
      fix: 'Add lang="en" (or appropriate language code) to the <html> element.',
    })
  }

  // Links without href
  if (el.tagName === 'A' && !attrs['href']) {
    issues.push({
      severity: 'warning',
      title: 'Anchor element missing href',
      detail: '<a> without href is not keyboard-focusable and behaves differently from a proper link.',
      fix: 'Add an href attribute, or use a <button> if this is an action trigger.',
    })
  }

  // Inline styles (code smell)
  if (el.getAttribute('style') && el.getAttribute('style')!.length > 20) {
    issues.push({
      severity: 'info',
      title: 'Inline styles detected',
      detail: `${el.getAttribute('style')!.length} characters of inline CSS found.`,
      fix: 'Consider moving inline styles to a CSS class for maintainability.',
    })
  }

  // Overflow hidden clipping content
  if (cs.overflow === 'hidden' && el.scrollHeight > el.clientHeight + 2) {
    issues.push({
      severity: 'warning',
      title: 'Content clipped by overflow: hidden',
      detail: `Element height: ${el.clientHeight}px, content height: ${el.scrollHeight}px. ${el.scrollHeight - el.clientHeight}px of content is hidden.`,
      fix: 'Use overflow: auto/scroll, increase element height, or truncate content intentionally with text-overflow.',
    })
  }

  // Tiny touch target
  if (interactive.has(el.tagName) && (rect.width < 44 || rect.height < 44)) {
    issues.push({
      severity: 'warning',
      title: 'Touch target too small',
      detail: `Size: ${Math.round(rect.width)}×${Math.round(rect.height)}px. Minimum recommended: 44×44px (WCAG 2.5.5).`,
      fix: 'Increase padding or min-width/min-height to at least 44px for touch accessibility.',
    })
  }

  // Contrast check (simplified — text on background)
  if (el.textContent && el.textContent.trim().length > 0 && el.children.length === 0) {
    const fg = cs.color
    const bg = cs.backgroundColor
    if (fg && bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      const fgL = luminance(parseColor(fg))
      const bgL = luminance(parseColor(bg))
      const ratio = contrastRatio(fgL, bgL)
      const fontSize = Number.parseFloat(cs.fontSize)
      const isLarge = fontSize >= 18 || (fontSize >= 14 && cs.fontWeight >= '700')
      const threshold = isLarge ? 3 : 4.5
      if (ratio < threshold) {
        issues.push({
          severity: 'warning',
          title: `Low contrast ratio: ${ratio.toFixed(1)}:1`,
          detail: `Text color: ${fg}, Background: ${bg}. ${isLarge ? 'Large text' : 'Normal text'} requires ${threshold}:1 (WCAG AA).`,
          fix: 'Darken the text or lighten the background to meet minimum contrast requirements.',
        })
      }
    }
  }

  if (issues.length === 0) {
    issues.push({
      severity: 'info',
      title: 'No issues detected',
      detail: 'This element passes basic diagnostic checks.',
      fix: 'Element looks healthy — no accessibility, layout, or visibility problems found.',
    })
  }

  return issues
}

function formatTextContent(text: string): string {
  if (!text) return '(empty)'
  const truncated = text.slice(0, 100)
  const suffix = text.length > 100 ? '…' : ''
  return `"${truncated}${suffix}"`
}

function parseColor(c: string): [number, number, number] {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c)
  if (m) return [+m[1], +m[2], +m[3]]
  return [0, 0, 0]
}

function luminance([r, g, b]: [number, number, number]): number {
  const a = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) })
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function generateIDEPrompt(data: DiagnosticData): string {
  const issueLines = data.issues
    .filter(i => i.severity !== 'info' || !i.title.includes('No issues'))
    .map(i => `- [${i.severity.toUpperCase()}] ${i.title}\n  Detail: ${i.detail}\n  Fix: ${i.fix}`)
    .join('\n')

  const styleLines = Object.entries(data.computedStyles)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n')

  return `## Element Diagnostic Report
Generated by Nexus · ${new Date().toLocaleString()}

### Element
- Tag: <${data.tagName}>
- Selector: ${data.selector}
- ID: ${data.id || '(none)'}
- Classes: ${data.classes.length ? data.classes.join(', ') : '(none)'}

### Dimensions & Position
- Width: ${data.rect.width}px
- Height: ${data.rect.height}px
- Top: ${data.rect.top}px
- Left: ${data.rect.left}px

### Parent Chain
${data.parentChain.map((p, i) => `${'  '.repeat(i)}└─ ${p}`).join('\n')}

### Computed Styles
${styleLines || '  (none captured)'}

### Attributes
${Object.entries(data.attributes).map(([k, v]) => `  ${k}="${v}"`).join('\n') || '  (none)'}

### Children
- Direct child elements: ${data.childCount}
- Text content: ${formatTextContent(data.textContent)}

### Issues Found (${data.issues.length})
${issueLines || '- No issues detected'}

### HTML Snippet
\`\`\`html
${data.outerHTML}
\`\`\`

### Suggested Actions
Please review the issues above and apply the suggested fixes. Focus on:
1. Any errors (accessibility violations, zero-size elements)
2. Warnings (contrast, touch targets, clipped content)
3. Consider the element's purpose and whether its current implementation serves that purpose efficiently.
`
}

function showDiagnoseMenu(anchor: HTMLElement) {
  const existing = document.querySelector('[data-prompt-os="diag-menu"]')
  if (existing) { existing.remove(); return }

  const menu = document.createElement('div')
  menu.dataset.promptOs = 'diag-menu'
  Object.assign(menu.style, {
    position: 'fixed', zIndex: '2147483647',
    background: '#fff', borderRadius: '10px', padding: '4px',
    boxShadow: '0 8px 28px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.06)',
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    fontSize: '13px', minWidth: '180px',
  })
  const rect = anchor.getBoundingClientRect()
  const menuH = 120
  const spaceAbove = rect.top
  if (spaceAbove >= menuH) {
    menu.style.bottom = `${globalThis.innerHeight - rect.top + 6}px`
  } else {
    menu.style.top = `${rect.bottom + 6}px`
  }
  menu.style.right = `${globalThis.innerWidth - rect.right}px`

  function startInspect() {
    menu.remove()
    closeDiagnosticSidebar()
    closeAnnotation()
    if (toolbarEl) toolbarEl.style.display = 'none'
    openDiagnosticMode()
  }
  function startSelfDiagnose() {
    menu.remove()
    runSelfDiagnostics()
  }
  function startExtInspect() {
    menu.remove()
    closeDiagnosticSidebar()
    openExtensionInspectMode()
  }
  const options = [
    { emoji: '🔍', label: 'Inspect Element',     action: startInspect },
    { emoji: '🧩', label: 'Inspect Extension UI', action: startExtInspect },
    { emoji: '🩺', label: 'Self-Diagnose',        action: startSelfDiagnose },
  ]
  for (const opt of options) {
    const item = document.createElement('button')
    Object.assign(item.style, {
      display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
      padding: '8px 12px', border: 'none', background: 'transparent',
      borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#111',
      textAlign: 'left', fontFamily: 'inherit',
    })
    item.innerHTML = `<span style="font-size:15px">${opt.emoji}</span>${opt.label}`
    item.addEventListener('mouseenter', () => { item.style.background = '#f3f0ff' })
    item.addEventListener('mouseleave', () => { item.style.background = 'transparent' })
    item.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); opt.action() })
    menu.appendChild(item)
  }

  document.body.appendChild(menu)
  const dismiss = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node) && !anchor.contains(e.target as Node)) {
      menu.remove()
      document.removeEventListener('mousedown', dismiss, true)
    }
  }
  setTimeout(() => document.addEventListener('mousedown', dismiss, true), 10)
}

// ── Self-diagnostic checks ──────────────────────────────────────────────────

function checkContentToolbar(): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = []
  const toolbar = document.querySelector<HTMLElement>('[data-prompt-os="toolbar"]')
  if (!toolbar) {
    issues.push({ severity: 'error', title: '[Toolbar] Not found in DOM', detail: 'The global toolbar should be present on every page.', fix: 'Reload the page to re-inject the content script.' })
    return issues
  }
  const buttons = toolbar.querySelectorAll('button')
  if (buttons.length === TOOLBAR_BUTTONS.length) {
    issues.push({ severity: 'info', title: `[Toolbar] All ${TOOLBAR_BUTTONS.length} buttons present`, detail: 'Every toolbar button rendered correctly.', fix: 'No action needed.' })
  } else {
    issues.push({ severity: 'error', title: '[Toolbar] Button count mismatch', detail: `Expected ${TOOLBAR_BUTTONS.length} buttons, found ${buttons.length}.`, fix: 'Reload the extension or the page.' })
  }
  TOOLBAR_BUTTONS.forEach(({ emoji, label }, i) => {
    const btn = buttons[i]
    if (!btn) {
      issues.push({ severity: 'error', title: `[Toolbar] Missing button: ${label}`, detail: `Button at index ${i} (${emoji} ${label}) was not found.`, fix: 'Reload the extension.' })
    } else if (btn.textContent?.trim() !== emoji) {
      issues.push({ severity: 'warning', title: `[Toolbar] Wrong content for "${label}"`, detail: `Expected "${emoji}", got "${btn.textContent?.trim()}".`, fix: 'Content script may be out of date — reload the page.' })
    }
  })
  const rect = toolbar.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    issues.push({ severity: 'error', title: '[Toolbar] Zero dimensions', detail: `Toolbar has size ${rect.width}x${rect.height}px.`, fix: 'Toolbar may be hidden or has no layout. Check CSS.' })
  } else if (rect.top < 0 || rect.left < 0 || rect.bottom > globalThis.innerHeight || rect.right > globalThis.innerWidth) {
    issues.push({ severity: 'warning', title: '[Toolbar] Partially off-screen', detail: `Toolbar rect: top=${Math.round(rect.top)}, left=${Math.round(rect.left)}, bottom=${Math.round(rect.bottom)}, right=${Math.round(rect.right)}.`, fix: 'The toolbar may be clipped. Try scrolling or resizing.' })
  } else {
    issues.push({ severity: 'info', title: '[Toolbar] Visible and positioned correctly', detail: `At (${Math.round(rect.left)}, ${Math.round(rect.top)}) — ${Math.round(rect.width)}x${Math.round(rect.height)}px.`, fix: 'No action needed.' })
  }
  return issues
}

function checkAnnotationBar(): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = []
  const bar = document.querySelector<HTMLElement>('[data-prompt-os="annotation-toolbar"]')
  const canvas = document.querySelector<HTMLCanvasElement>('[data-prompt-os="annotation-canvas"]')
  if (!bar && !canvas) {
    issues.push({ severity: 'info', title: '[Annotation] Not currently active', detail: 'Open annotation mode to run full checks.', fix: 'Click the Annotate button in the toolbar.' })
    return issues
  }
  if (bar) {
    const toolBtns = bar.querySelectorAll('[data-tool]')
    issues.push({ severity: 'info', title: `[Annotation] Toolbar present with ${toolBtns.length} tools`, detail: 'Annotation toolbar is rendered in the DOM.', fix: 'No action needed.' })
    if (toolBtns.length < 10) {
      issues.push({ severity: 'warning', title: '[Annotation] Fewer tools than expected', detail: `Found ${toolBtns.length} tool buttons; expected at least 10 (pen, highlighter, text, eraser, shapes, etc.).`, fix: 'Some tool buttons may have failed to render.' })
    }
    const barRect = bar.getBoundingClientRect()
    if (barRect.width === 0 || barRect.height === 0) {
      issues.push({ severity: 'error', title: '[Annotation] Toolbar has zero size', detail: 'The toolbar element exists but has no visible dimensions.', fix: 'Check if CSS is being overridden by the host page.' })
    }
  } else {
    issues.push({ severity: 'warning', title: '[Annotation] Canvas present but no toolbar', detail: 'The annotation canvas exists but the toolbar is missing.', fix: 'Try closing and reopening annotation mode.' })
  }
  if (canvas) {
    if (canvas.width > 0 && canvas.height > 0) {
      issues.push({ severity: 'info', title: `[Annotation] Canvas active (${canvas.width}x${canvas.height})`, detail: 'Canvas is sized and ready for drawing.', fix: 'No action needed.' })
    } else {
      issues.push({ severity: 'error', title: '[Annotation] Canvas has zero dimensions', detail: `Canvas size: ${canvas.width}x${canvas.height}.`, fix: 'The canvas failed to initialise. Try reopening annotation.' })
    }
    const ctx = canvas.getContext('2d')
    if (ctx) {
      issues.push({ severity: 'info', title: '[Annotation] 2D context valid', detail: 'Canvas rendering context is accessible.', fix: 'No action needed.' })
    } else {
      issues.push({ severity: 'error', title: '[Annotation] Cannot obtain 2D context', detail: 'canvas.getContext("2d") returned null.', fix: 'GPU or browser issue. Try restarting the browser.' })
    }
  }
  return issues
}

function checkModalTabs(): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = []
  const modal = document.querySelector<HTMLElement>('[data-prompt-os="modal"]')
  if (!modal) {
    issues.push({ severity: 'info', title: '[Modal] Not currently open', detail: 'Open the prompt modal to run full checks.', fix: 'Click a toolbar button (Image, Video, Generate, Browse) to open the modal.' })
    return issues
  }
  const shadow = modal.shadowRoot
  if (!shadow) {
    issues.push({ severity: 'error', title: '[Modal] No shadow root', detail: 'The modal host exists but its shadow DOM is missing.', fix: 'This indicates a rendering failure. Reload the page.' })
    return issues
  }
  const expectedTabs = ['generate', 'browse', 'research', 'annotate']
  const tabBtns = shadow.querySelectorAll('[data-tab]')
  const foundTabs = new Set(Array.from(tabBtns).map(t => (t as HTMLElement).dataset.tab))
  for (const tab of expectedTabs) {
    if (foundTabs.has(tab)) {
      issues.push({ severity: 'info', title: `[Modal] Tab "${tab}" present`, detail: `The ${tab} tab button is rendered.`, fix: 'No action needed.' })
    } else {
      issues.push({ severity: 'error', title: `[Modal] Tab "${tab}" missing`, detail: `Expected a [data-tab="${tab}"] button but it was not found.`, fix: 'Modal may have rendered incorrectly. Close and reopen.' })
    }
  }
  const bodyEl = shadow.querySelector('.body')
  if (bodyEl) {
    issues.push({ severity: 'info', title: '[Modal] Body container renders', detail: 'The modal body element is present in the shadow DOM.', fix: 'No action needed.' })
  } else {
    issues.push({ severity: 'warning', title: '[Modal] Body container missing', detail: 'Could not find .body element inside the modal shadow DOM.', fix: 'Tab content may not have rendered. Try switching tabs.' })
  }
  return issues
}

async function checkRuntimeHealth(): Promise<DiagnosticIssue[]> {
  const issues: DiagnosticIssue[] = []

  if (typeof chrome === 'undefined' || !chrome.runtime) {
    issues.push({ severity: 'error', title: '[Runtime] chrome.runtime unavailable', detail: 'The Chrome Extension API is not accessible.', fix: 'The extension context may have been invalidated. Reload the page.' })
    return issues
  }
  issues.push({ severity: 'info', title: '[Runtime] chrome.runtime available', detail: 'Extension APIs are accessible.', fix: 'No action needed.' })

  if (chrome.runtime.id) {
    issues.push({ severity: 'info', title: '[Runtime] Extension ID present', detail: `ID: ${chrome.runtime.id}`, fix: 'No action needed.' })
  } else {
    issues.push({ severity: 'error', title: '[Runtime] Extension context invalidated', detail: 'chrome.runtime.id is falsy — the extension was likely updated or unloaded.', fix: 'Reload the page to re-inject the content script.' })
    return issues
  }

  try {
    const stored = await new Promise<Record<string, unknown>>((resolve, reject) => {
      chrome.storage.local.get('do-api-key', (result) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
        else resolve(result)
      })
    })
    issues.push({ severity: 'info', title: '[Runtime] chrome.storage.local accessible', detail: 'Storage read succeeded.', fix: 'No action needed.' })
    const apiKey = stored['do-api-key'] as string | undefined
    if (apiKey && apiKey.length > 4) {
      issues.push({ severity: 'info', title: '[Runtime] API key is set', detail: `Key starts with "${apiKey.slice(0, 6)}…" (${apiKey.length} chars).`, fix: 'No action needed.' })
    } else {
      issues.push({ severity: 'warning', title: '[Runtime] No API key configured', detail: 'LLM features (generate, research, enhance) will not work.', fix: 'Open the side panel → Features → API Key Settings and add your key.' })
    }
  } catch (e) {
    issues.push({ severity: 'error', title: '[Runtime] Storage access failed', detail: (e as Error).message, fix: 'Extension context may be invalidated. Reload the page.' })
  }

  try {
    const resp = await chrome.runtime.sendMessage({ type: 'PING' }) as { pong?: boolean }
    if (resp?.pong) {
      issues.push({ severity: 'info', title: '[Runtime] Background script responsive', detail: 'PING/PONG round-trip succeeded.', fix: 'No action needed.' })
    } else {
      issues.push({ severity: 'warning', title: '[Runtime] Background script returned unexpected response', detail: `Got: ${JSON.stringify(resp)}`, fix: 'The background script may need updating.' })
    }
  } catch (e) {
    issues.push({ severity: 'error', title: '[Runtime] Cannot reach background script', detail: (e as Error).message, fix: 'Reload the extension from chrome://extensions.' })
  }

  return issues
}

async function checkSidePanelTabs(): Promise<DiagnosticIssue[]> {
  const issues: DiagnosticIssue[] = []
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'SELF_DIAGNOSE_PANEL' }) as { checks?: DiagnosticIssue[]; error?: string }
    if (resp?.error) {
      issues.push({ severity: 'warning', title: '[Panel] Could not diagnose side panel', detail: resp.error, fix: 'Open the side panel and try again.' })
    } else if (resp?.checks) {
      issues.push(...resp.checks)
    } else {
      issues.push({ severity: 'info', title: '[Panel] Side panel did not respond', detail: 'The panel may not be open or the handler is not registered.', fix: 'Open the side panel and try again.' })
    }
  } catch (e) {
    issues.push({ severity: 'warning', title: '[Panel] Side panel communication failed', detail: (e as Error).message, fix: 'Make sure the side panel is open, then retry.' })
  }
  return issues
}

async function runSelfDiagnostics() {
  closeDiagnosticSidebar()

  const allIssues: DiagnosticIssue[] = [
    ...checkContentToolbar(),
    ...checkAnnotationBar(),
    ...checkModalTabs(),
    ...await checkRuntimeHealth(),
    ...await checkSidePanelTabs(),
  ]

  const errors = allIssues.filter(i => i.severity === 'error').length
  const warnings = allIssues.filter(i => i.severity === 'warning').length
  const passed = allIssues.filter(i => i.severity === 'info').length

  const data: DiagnosticData = {
    tagName: 'SELF-DIAGNOSTIC',
    id: '',
    classes: [],
    rect: { width: 0, height: 0, top: 0, left: 0 },
    computedStyles: {},
    attributes: {},
    textContent: '',
    childCount: 0,
    parentChain: [],
    issues: allIssues,
    selector: `${allIssues.length} checks: ${passed} passed, ${errors} errors, ${warnings} warnings`,
    outerHTML: '',
  }

  openDiagnosticSidebar(data)
}

// Listen for self-diagnostic requests from the side panel
chrome.runtime?.onMessage?.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'RUN_SELF_DIAGNOSTICS') {
    runSelfDiagnostics().then(() => sendResponse({ ok: true })).catch(e => sendResponse({ error: (e as Error).message }))
    return true
  }
  return false
})

// ── Extension UI Inspect Mode ─────────────────────────────────────────────

const EXT_COMPONENT_MAP: Record<string, { role: string; expectedProps: string[] }> = {
  'toolbar':            { role: 'Global toolbar container', expectedProps: ['display:flex', 'position:fixed'] },
  'toolbar-btn':        { role: 'Toolbar action button',   expectedProps: ['width', 'height', 'cursor:pointer'] },
  'modal':              { role: 'Prompt modal host',       expectedProps: ['position:fixed'] },
  'annotation-canvas':  { role: 'Drawing canvas overlay',  expectedProps: ['position:fixed', 'pointer-events:all'] },
  'annotation-toolbar': { role: 'Annotation tool bar',     expectedProps: ['position:fixed', 'display:flex'] },
  'diag-sidebar':       { role: 'Diagnostic sidebar host', expectedProps: ['position:fixed'] },
  'diag-highlight':     { role: 'Inspect highlight box',   expectedProps: ['pointer-events:none'] },
  'diag-badge':         { role: 'Inspect element badge',   expectedProps: ['pointer-events:none'] },
  'diag-status':        { role: 'Diagnostic mode status bar', expectedProps: ['position:fixed'] },
  'diag-menu':          { role: 'Diagnose sub-menu',       expectedProps: ['position:fixed'] },
  'annot-text-input':   { role: 'Temporary text entry for annotation canvas', expectedProps: ['position:fixed'] },
}

function gatherExtensionDiagnostics(el: HTMLElement): DiagnosticData {
  const base = gatherDiagnostics(el)

  const promptOsValue = el.dataset.promptOs ?? el.closest<HTMLElement>('[data-prompt-os]')?.dataset.promptOs ?? 'unknown'
  const componentInfo = EXT_COMPONENT_MAP[promptOsValue]
  const cs = globalThis.getComputedStyle(el)
  const rect = el.getBoundingClientRect()

  const extIssues: DiagnosticIssue[] = []

  // ── Component identification ──
  if (componentInfo) {
    extIssues.push({ severity: 'info', title: `Extension component: ${promptOsValue}`, detail: componentInfo.role, fix: 'No action needed.' })
  } else {
    extIssues.push({ severity: 'info', title: `Extension element (child of ${promptOsValue})`, detail: `Tag: <${el.tagName.toLowerCase()}>. Parent component: ${promptOsValue}.`, fix: 'No action needed.' })
  }

  const inAnnotBar = el.closest<HTMLElement>('[data-prompt-os="annotation-toolbar"]')
  if (inAnnotBar && el.tagName === 'BUTTON' && el.dataset.tool) {
    const t = el.dataset.tool
    extIssues.push({
      severity: 'info',
      title: `[Annotation] Canvas tool "${t}"`,
      detail: 'Toolbar only selects the tool; drawing happens on the full-screen canvas. Clicks on the canvas run the tool handler.',
      fix: 'Click the page (canvas area), not the toolbar, to use the tool.',
    })
    if (t === 'text') {
      extIssues.push({
        severity: 'warning',
        title: '[Annotation] Text tool — failure checklist',
        detail: 'Typical breaks: (1) floating input positioned with canvas coords instead of viewport (fixed left/top), (2) blur fires before focus and commits empty, (3) canvas pointer-events:none while Text active, (4) host overlay stealing pointer.',
        fix: 'This build uses clientX/clientY for the input, double requestAnimationFrame focus, and 150ms debounced blur. If it still fails, reload the tab to clear stuck textActive.',
      })
    }
  }

  // ── Visibility checks ──
  if (cs.display === 'none') {
    extIssues.push({ severity: 'error', title: 'Element is hidden (display:none)', detail: 'Not visible and takes no space. Users cannot interact with it.', fix: 'Remove display:none or check the show/hide logic.' })
  }
  if (cs.visibility === 'hidden') {
    extIssues.push({ severity: 'error', title: 'Element is invisible (visibility:hidden)', detail: 'Takes up space but is completely invisible. May block clicks on elements behind it.', fix: 'Set visibility:visible or remove the element.' })
  }
  const opacity = Number.parseFloat(cs.opacity)
  if (opacity === 0) {
    extIssues.push({ severity: 'error', title: 'Fully transparent (opacity:0)', detail: 'Element exists but is invisible. May intercept clicks from visible elements underneath.', fix: 'Set opacity > 0 or use display:none if it should be hidden.' })
  } else if (opacity < 0.3) {
    extIssues.push({ severity: 'warning', title: `Very low opacity (${cs.opacity})`, detail: 'Barely visible. Users may not notice this element.', fix: 'Increase opacity or indicate disabled state explicitly.' })
  }

  // ── Pointer/click blocking checks ──
  if (cs.pointerEvents === 'none') {
    extIssues.push({ severity: 'error', title: 'Clicks disabled (pointer-events:none)', detail: 'This element cannot receive any mouse/touch events. All clicks pass through it.', fix: 'Remove pointer-events:none if this element should be interactive.' })
  }

  // ── Covered by another element (elementFromPoint) ──
  if (rect.width > 0 && rect.height > 0) {
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const topEl = document.elementFromPoint(cx, cy)
    if (topEl && topEl !== el && !el.contains(topEl) && !topEl.closest('[data-prompt-os="diag-highlight"]')) {
      const blocker = topEl.tagName.toLowerCase()
      const blockerId = topEl.id ? `#${topEl.id}` : ''
      const blockerClass = topEl.classList.length ? `.${Array.from(topEl.classList).slice(0, 2).join('.')}` : ''
      extIssues.push({ severity: 'error', title: 'Blocked by overlapping element', detail: `<${blocker}${blockerId}${blockerClass}> is covering this element's center point. Clicks will hit the overlapping element instead.`, fix: 'Adjust z-index, positioning, or remove the overlapping element.' })
    }
  }

  // ── Off-screen / clipped ──
  if (rect.width > 0 && rect.height > 0) {
    const vw = globalThis.innerWidth
    const vh = globalThis.innerHeight
    if (rect.right < 0 || rect.bottom < 0 || rect.left > vw || rect.top > vh) {
      extIssues.push({ severity: 'error', title: 'Completely off-screen', detail: `Position: (${Math.round(rect.left)}, ${Math.round(rect.top)}). Not visible or clickable.`, fix: 'Fix positioning so the element is within the viewport.' })
    } else if (rect.left < 0 || rect.top < 0 || rect.right > vw || rect.bottom > vh) {
      extIssues.push({ severity: 'warning', title: 'Partially off-screen', detail: `Rect: (${Math.round(rect.left)}, ${Math.round(rect.top)}) to (${Math.round(rect.right)}, ${Math.round(rect.bottom)}). Part of the element is clipped.`, fix: 'Adjust positioning to keep fully within viewport.' })
    }
  }

  // ── Zero dimensions ──
  if (rect.width === 0 || rect.height === 0) {
    extIssues.push({ severity: 'error', title: 'Zero-size element', detail: `Size: ${rect.width}×${rect.height}px. Not visible or clickable.`, fix: 'Set explicit width/height or check if content is rendering.' })
  }

  // ── Overflow clipping ──
  if (cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.overflowY === 'hidden') {
    const scrollW = el.scrollWidth
    const scrollH = el.scrollHeight
    if (scrollW > rect.width + 2 || scrollH > rect.height + 2) {
      extIssues.push({ severity: 'warning', title: 'Content clipped by overflow:hidden', detail: `Scroll size ${scrollW}×${scrollH}px exceeds visible size ${Math.round(rect.width)}×${Math.round(rect.height)}px.`, fix: 'Content is being cut off. Increase size or use overflow:auto.' })
    }
  }

  // ── Interactive element checks (buttons, inputs, links) ──
  const isInteractive = el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.getAttribute('role') === 'button'

  if (isInteractive) {
    // Disabled state
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
      extIssues.push({ severity: 'warning', title: 'Element is disabled', detail: `${el.hasAttribute('disabled') ? 'disabled attribute' : 'aria-disabled="true"'} is set. Users cannot interact.`, fix: 'If this should be usable, remove the disabled state.' })
    }

    // Cursor check
    if (cs.cursor !== 'pointer' && !el.hasAttribute('disabled')) {
      extIssues.push({ severity: 'warning', title: 'Missing pointer cursor', detail: `Cursor is "${cs.cursor}". Interactive elements should show a pointer.`, fix: 'Add cursor:pointer for click affordance.' })
    }

    // No visible label
    const hasText = !!el.textContent?.trim()
    const hasIcon = !!el.querySelector('svg, img')
    const hasAriaLabel = !!el.getAttribute('aria-label') || !!el.getAttribute('title')
    if (!hasText && !hasIcon && !hasAriaLabel) {
      extIssues.push({ severity: 'error', title: 'No accessible label', detail: 'No text, icon, aria-label, or title. Screen readers and users cannot identify this element.', fix: 'Add text content, an icon, or aria-label.' })
    } else if (!hasText && !hasAriaLabel) {
      extIssues.push({ severity: 'warning', title: 'Icon-only without accessible label', detail: 'Has an icon but no aria-label or title for screen readers.', fix: 'Add aria-label or title attribute.' })
    }

    // Tabindex removal
    if (el.getAttribute('tabindex') === '-1') {
      extIssues.push({ severity: 'warning', title: 'Removed from tab order (tabindex=-1)', detail: 'Users cannot reach this element via keyboard navigation.', fix: 'Remove tabindex=-1 if this should be keyboard-accessible.' })
    }

    // Touch target size (WCAG 2.5.5 — 44×44px minimum)
    if (rect.width < 44 || rect.height < 44) {
      if (rect.width < 24 || rect.height < 24) {
        extIssues.push({ severity: 'error', title: `Critically small touch target (${Math.round(rect.width)}×${Math.round(rect.height)}px)`, detail: 'Far below 44×44px minimum. Very difficult to tap on mobile.', fix: 'Increase min-width and min-height to at least 44px.' })
      } else {
        extIssues.push({ severity: 'warning', title: `Small touch target (${Math.round(rect.width)}×${Math.round(rect.height)}px)`, detail: 'Below 44×44px WCAG 2.5.5 minimum recommendation.', fix: 'Consider increasing to 44×44px for accessibility.' })
      }
    }
  }

  // ── Inline style bloat ──
  const inlineLen = el.style.cssText.length
  if (inlineLen > 200) {
    extIssues.push({ severity: 'warning', title: `Inline styles detected (${inlineLen} chars)`, detail: 'Heavy inline styling makes maintenance harder.', fix: 'Consider moving inline styles to a CSS class.' })
  } else if (inlineLen > 0) {
    extIssues.push({ severity: 'info', title: `Inline styles (${inlineLen} chars)`, detail: el.style.cssText.slice(0, 120) + (inlineLen > 120 ? '…' : ''), fix: 'Acceptable for dynamic positioning.' })
  }

  // ── Inline event handlers ──
  const inlineEvents = Array.from(el.attributes).filter(a => a.name.startsWith('on'))
  if (inlineEvents.length > 0) {
    extIssues.push({ severity: 'warning', title: 'Inline event handlers', detail: `Found: ${inlineEvents.map(a => a.name).join(', ')}. These are harder to debug.`, fix: 'Use addEventListener instead.' })
  }

  // ── Z-index stacking ──
  const zIndex = cs.zIndex
  if (zIndex !== 'auto' && Number(zIndex) > 2147483640) {
    extIssues.push({ severity: 'info', title: `High z-index: ${zIndex}`, detail: 'Near max z-index. Expected for extension overlays.', fix: 'No action needed.' })
  }

  // ── DOM structure ──
  const childElements = el.children.length
  const childText = el.childNodes.length - childElements
  extIssues.push({
    severity: 'info',
    title: 'DOM structure',
    detail: `${childElements} child elements, ${childText} text nodes. Tag: <${el.tagName.toLowerCase()}>. ` +
      `Data attributes: ${Object.keys(el.dataset).join(', ') || 'none'}.`,
    fix: 'Structural overview.',
  })

  // ── Shadow DOM check ──
  if (el.shadowRoot) {
    const shadowChildren = el.shadowRoot.children.length
    extIssues.push({ severity: 'info', title: 'Has Shadow DOM', detail: `Shadow root with ${shadowChildren} children. Mode: open.`, fix: 'Styles and DOM are encapsulated.' })
  }

  // ── Contrast check on text ──
  if (hasVisibleText(el)) {
    const fg = cs.color
    const bg = cs.backgroundColor
    if (fg && bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      const fgL = luminance(parseColor(fg))
      const bgL = luminance(parseColor(bg))
      const ratio = contrastRatio(fgL, bgL)
      if (ratio < 3) {
        extIssues.push({ severity: 'error', title: `Very low contrast ratio: ${ratio.toFixed(1)}:1`, detail: `Foreground: ${fg}, Background: ${bg}. Minimum 4.5:1 for normal text.`, fix: 'Increase contrast between text and background colors.' })
      } else if (ratio < 4.5) {
        extIssues.push({ severity: 'warning', title: `Low contrast ratio: ${ratio.toFixed(1)}:1`, detail: `Foreground: ${fg}, Background: ${bg}. WCAG AA requires 4.5:1 for normal text.`, fix: 'Darken the text or lighten the background.' })
      }
    }
  }

  return {
    ...base,
    issues: [...extIssues, ...base.issues],
  }
}

function hasVisibleText(el: HTMLElement): boolean {
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && (node.textContent?.trim().length ?? 0) > 0) return true
  }
  return false
}

function registerDiagCleanup(
  handlers: { move: (e: MouseEvent) => void; click: (e: MouseEvent) => void; key: (e: KeyboardEvent) => void },
  elements: { highlight: HTMLElement | null; badge: HTMLElement; statusBar: HTMLElement },
) {
  document.addEventListener('mousemove', handlers.move, true)
  document.addEventListener('click', handlers.click, true)
  document.addEventListener('keydown', handlers.key, true)

  const cleanup = () => {
    document.removeEventListener('mousemove', handlers.move, true)
    document.removeEventListener('click', handlers.click, true)
    document.removeEventListener('keydown', handlers.key, true)
    elements.highlight?.remove()
    elements.badge.remove()
    elements.statusBar.remove()
  }
  elements.statusBar.dataset.promptOsCleanup = 'true'
  ;(elements.statusBar as HTMLElement & { _cleanup?: () => void })._cleanup = cleanup
}

function openExtensionInspectMode() {
  const existingStatus = document.querySelector<HTMLElement>('[data-prompt-os="diag-status"]')
  const existingCleanup = (existingStatus as unknown as { _cleanup?: () => void } | undefined)?._cleanup
  existingCleanup?.()

  let highlightBox: HTMLElement | null = null

  highlightBox = document.createElement('div')
  highlightBox.dataset.promptOs = 'diag-highlight'
  Object.assign(highlightBox.style, {
    position: 'fixed', pointerEvents: 'none', zIndex: '2147483647',
    border: '2px solid #f59e0b', borderRadius: '4px',
    background: 'rgba(245,158,11,.12)',
    boxShadow: '0 0 0 2px rgba(245,158,11,.25)',
    transition: 'all .08s ease-out',
    display: 'none',
  })
  document.body.appendChild(highlightBox)

  const badge = document.createElement('div')
  badge.dataset.promptOs = 'diag-badge'
  Object.assign(badge.style, {
    position: 'fixed', pointerEvents: 'none', zIndex: '2147483647',
    background: '#78350f', color: '#fef3c7', padding: '3px 8px',
    borderRadius: '6px', fontSize: '11px', fontWeight: '600',
    fontFamily: "'SF Mono',Menlo,monospace",
    boxShadow: '0 2px 8px rgba(0,0,0,.3)',
    whiteSpace: 'nowrap', display: 'none',
  })
  document.body.appendChild(badge)

  const statusBar = document.createElement('div')
  statusBar.dataset.promptOs = 'diag-status'
  Object.assign(statusBar.style, {
    position: 'fixed', top: '0', left: '0', right: '0', zIndex: '2147483647',
    height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '12px', background: 'linear-gradient(135deg,#78350f,#92400e)',
    color: '#fef3c7', fontSize: '12px', fontWeight: '600',
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    boxShadow: '0 2px 12px rgba(0,0,0,.2)',
  })
  statusBar.innerHTML = `<span>🧩 Extension UI Inspect — Click any extension element</span>`
  const exitBtn = document.createElement('button')
  Object.assign(exitBtn.style, {
    background: 'rgba(239,68,68,.3)', color: '#fca5a5', border: 'none',
    borderRadius: '6px', padding: '4px 12px', cursor: 'pointer',
    fontSize: '11px', fontWeight: '600', fontFamily: 'inherit',
  })
  exitBtn.textContent = 'Exit (Esc)'
  exitBtn.addEventListener('click', closeDiagnosticMode)
  statusBar.appendChild(exitBtn)
  document.body.appendChild(statusBar)

  const DIAG_INTERNAL = new Set(['diag-highlight', 'diag-badge', 'diag-status'])

  function findExtEl(target: HTMLElement): HTMLElement | null {
    if (target.dataset.promptOs) {
      if (DIAG_INTERNAL.has(target.dataset.promptOs)) return null
      return target
    }
    // If the target is inside an extension component, return the target itself
    // so individual buttons/tools can be inspected rather than the whole container
    const closest = target.closest<HTMLElement>('[data-prompt-os]')
    if (closest && !DIAG_INTERNAL.has(closest.dataset.promptOs ?? '')) {
      return target
    }
    return null
  }

  function onMouseMove(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target) return

    // For shadow DOM elements, check if they're inside an extension host
    const extEl = findExtEl(target)
    if (!extEl) {
      if (highlightBox) highlightBox.style.display = 'none'
      badge.style.display = 'none'
      return
    }

    const rect = extEl.getBoundingClientRect()
    if (highlightBox) {
      highlightBox.style.display = 'block'
      highlightBox.style.top = `${rect.top}px`
      highlightBox.style.left = `${rect.left}px`
      highlightBox.style.width = `${rect.width}px`
      highlightBox.style.height = `${rect.height}px`
    }

    const role = extEl.dataset.promptOs ?? 'child'
    badge.textContent = `🧩 ${extEl.tagName.toLowerCase()}[data-prompt-os="${role}"]  ${Math.round(rect.width)}×${Math.round(rect.height)}`
    badge.style.display = 'block'
    badge.style.top = `${Math.max(40, rect.top - 28)}px`
    badge.style.left = `${rect.left}px`
  }

  function onClick(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target) return

    // Skip the diagnostic mode's own UI
    if (target.closest('[data-prompt-os="diag-status"]')) return
    if (target.closest('[data-prompt-os="diag-highlight"]')) return

    const extEl = findExtEl(target)
    if (!extEl) return

    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()

    const data = gatherExtensionDiagnostics(extEl)
    openDiagnosticSidebar(data)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeDiagnosticMode()
  }

  registerDiagCleanup(
    { move: onMouseMove, click: onClick, key: onKeyDown },
    { highlight: highlightBox, badge, statusBar },
  )
}

function openDiagnosticMode() {
  // Clean up any previous diagnostic mode without restoring toolbar (caller handles visibility)
  const existingStatus = document.querySelector<HTMLElement>('[data-prompt-os="diag-status"]')
  const existingCleanup = (existingStatus as unknown as { _cleanup?: () => void } | undefined)?._cleanup
  existingCleanup?.()

  let highlightBox: HTMLElement | null = null

  // Highlight overlay (follows hovered elements)
  highlightBox = document.createElement('div')
  highlightBox.dataset.promptOs = 'diag-highlight'
  Object.assign(highlightBox.style, {
    position: 'fixed', pointerEvents: 'none', zIndex: '2147483644',
    border: '2px solid #7c3aed', borderRadius: '4px',
    background: 'rgba(124,58,237,.08)',
    boxShadow: '0 0 0 2px rgba(124,58,237,.2)',
    transition: 'all .08s ease-out',
    display: 'none',
  })
  document.body.appendChild(highlightBox)

  // Floating badge
  const badge = document.createElement('div')
  badge.dataset.promptOs = 'diag-badge'
  Object.assign(badge.style, {
    position: 'fixed', pointerEvents: 'none', zIndex: '2147483645',
    background: '#1e1b4b', color: '#e0e7ff', padding: '3px 8px',
    borderRadius: '6px', fontSize: '11px', fontWeight: '600',
    fontFamily: "'SF Mono',Menlo,monospace",
    boxShadow: '0 2px 8px rgba(0,0,0,.3)',
    whiteSpace: 'nowrap', display: 'none',
  })
  document.body.appendChild(badge)

  // Status bar at top
  const statusBar = document.createElement('div')
  statusBar.dataset.promptOs = 'diag-status'
  Object.assign(statusBar.style, {
    position: 'fixed', top: '0', left: '0', right: '0', zIndex: '2147483646',
    height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '12px', background: 'linear-gradient(135deg,#1e1b4b,#312e81)',
    color: '#e0e7ff', fontSize: '12px', fontWeight: '600',
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    boxShadow: '0 2px 12px rgba(0,0,0,.2)',
  })
  statusBar.innerHTML = `<span>🔍 Diagnostic Mode — Click any element to inspect</span>`
  const exitBtn = document.createElement('button')
  Object.assign(exitBtn.style, {
    background: 'rgba(239,68,68,.3)', color: '#fca5a5', border: 'none',
    borderRadius: '6px', padding: '4px 12px', cursor: 'pointer',
    fontSize: '11px', fontWeight: '600', fontFamily: 'inherit',
  })
  exitBtn.textContent = 'Exit (Esc)'
  exitBtn.addEventListener('click', closeDiagnosticMode)
  statusBar.appendChild(exitBtn)
  document.body.appendChild(statusBar)

  function onMouseMove(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target || target.closest('[data-prompt-os]')) return

    const rect = target.getBoundingClientRect()

    if (highlightBox) {
      highlightBox.style.display = 'block'
      highlightBox.style.top = `${rect.top}px`
      highlightBox.style.left = `${rect.left}px`
      highlightBox.style.width = `${rect.width}px`
      highlightBox.style.height = `${rect.height}px`
    }

    const id = target.id ? `#${target.id}` : ''
    const cls = target.classList.length ? `.${Array.from(target.classList).slice(0, 2).join('.')}` : ''
    badge.textContent = `${target.tagName.toLowerCase()}${id}${cls}  ${Math.round(rect.width)}×${Math.round(rect.height)}`
    badge.style.display = 'block'
    badge.style.top = `${Math.max(40, rect.top - 28)}px`
    badge.style.left = `${rect.left}px`
  }

  function onClick(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target || target.closest('[data-prompt-os]')) return

    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()

    const data = gatherDiagnostics(target)
    openDiagnosticSidebar(data)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeDiagnosticMode()
  }

  registerDiagCleanup(
    { move: onMouseMove, click: onClick, key: onKeyDown },
    { highlight: highlightBox, badge, statusBar },
  )
}

function openDiagnosticSidebar(data: DiagnosticData) {
  closeDiagnosticSidebar()

  // Shift the global toolbar left so it isn't hidden behind the sidebar
  if (toolbarEl) toolbarEl.style.right = '444px'

  const isSelf = data.tagName === 'SELF-DIAGNOSTIC'

  const host = document.createElement('div')
  host.dataset.promptOs = 'diag-sidebar'
  const shadow = host.attachShadow({ mode: 'open' })
  Object.assign(host.style, { position: 'fixed', top: '0', right: '0', zIndex: '2147483647', pointerEvents: 'all' })
  document.body.appendChild(host)
  diagSidebar = host

  const styleEl = document.createElement('style')
  styleEl.textContent = DIAG_SIDEBAR_CSS + `
    .sb-group-hd{font:700 12px/1.3 -apple-system,sans-serif;color:#374151;padding:6px 0 4px;margin-top:10px;border-bottom:1px solid #e5e7eb}
    .sb-summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:6px}
    .sb-summary-stat{text-align:center;padding:10px 6px;border-radius:10px;font-weight:700;font-size:18px;line-height:1.2}
    .sb-summary-stat small{display:block;font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;margin-top:2px}
    .sb-summary-stat.pass{background:#d1fae5;color:#065f46}
    .sb-summary-stat.warn{background:#fef3c7;color:#92400e}
    .sb-summary-stat.err{background:#fee2e2;color:#991b1b}
  `
  shadow.appendChild(styleEl)

  const sidebar = document.createElement('div')
  sidebar.className = 'sidebar'
  shadow.appendChild(sidebar)

  // Header
  const hd = document.createElement('div')
  hd.className = 'sb-hd'
  if (isSelf) {
    hd.innerHTML = `
      <span class="sb-hd-icon">🩺</span>
      <div style="flex:1">
        <div class="sb-hd-title">Self-Diagnostics</div>
        <div class="sb-hd-sub">${data.selector}</div>
      </div>`
  } else {
    hd.innerHTML = `
      <span class="sb-hd-icon">🔍</span>
      <div style="flex:1">
        <div class="sb-hd-title">Element Diagnostics</div>
        <div class="sb-hd-sub">&lt;${data.tagName}&gt; · ${data.rect.width}×${data.rect.height}px</div>
      </div>`
  }
  const closeBtn = document.createElement('button')
  closeBtn.className = 'sb-close'
  closeBtn.textContent = '✕'
  closeBtn.title = 'Close sidebar'
  closeBtn.addEventListener('click', closeDiagnosticSidebar)
  hd.appendChild(closeBtn)
  sidebar.appendChild(hd)

  // Body
  const body = document.createElement('div')
  body.className = 'sb-body'

  if (isSelf) {
    _buildSelfDiagBody(body, data)
  } else {
    _buildElementDiagBody(body, data)
  }

  sidebar.appendChild(body)

  // Action buttons
  const actions = document.createElement('div')
  actions.className = 'sb-actions'

  const idePrompt = isSelf ? _generateSelfDiagPrompt(data) : generateIDEPrompt(data)

  const copyPromptBtn = document.createElement('button')
  copyPromptBtn.className = 'sb-btn primary'
  copyPromptBtn.innerHTML = '📋 Copy Report'
  copyPromptBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(idePrompt).then(() => {
      copyPromptBtn.innerHTML = '✓ Copied!'
      setTimeout(() => { copyPromptBtn.innerHTML = '📋 Copy Report' }, 2000)
    })
  })
  actions.appendChild(copyPromptBtn)

  if (isSelf) {
    const rerunBtn = document.createElement('button')
    rerunBtn.className = 'sb-btn secondary'
    rerunBtn.innerHTML = '🔄 Re-run'
    rerunBtn.addEventListener('click', () => { runSelfDiagnostics() })
    actions.appendChild(rerunBtn)
  } else {
    const copyHTMLBtn = document.createElement('button')
    copyHTMLBtn.className = 'sb-btn secondary'
    copyHTMLBtn.innerHTML = '&lt;/&gt; Copy HTML'
    copyHTMLBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(data.outerHTML).then(() => {
        copyHTMLBtn.innerHTML = '✓ Copied!'
        setTimeout(() => { copyHTMLBtn.innerHTML = '&lt;/&gt; Copy HTML' }, 2000)
      })
    })
    actions.appendChild(copyHTMLBtn)

    const inspectAgainBtn = document.createElement('button')
    inspectAgainBtn.className = 'sb-btn secondary'
    inspectAgainBtn.innerHTML = '🔍 Inspect Another'
    inspectAgainBtn.addEventListener('click', closeDiagnosticSidebar)
    actions.appendChild(inspectAgainBtn)
  }

  sidebar.appendChild(actions)
}

function _buildSelfDiagBody(body: HTMLElement, data: DiagnosticData) {
  const errorCount = data.issues.filter(i => i.severity === 'error').length
  const warnCount = data.issues.filter(i => i.severity === 'warning').length
  const passCount = data.issues.filter(i => i.severity === 'info').length

  // Summary stats
  const summarySec = document.createElement('div')
  summarySec.className = 'sb-section'
  summarySec.innerHTML = `
    <div class="sb-summary-grid">
      <div class="sb-summary-stat pass">${passCount}<small>Passed</small></div>
      <div class="sb-summary-stat warn">${warnCount}<small>Warnings</small></div>
      <div class="sb-summary-stat err">${errorCount}<small>Errors</small></div>
    </div>`
  body.appendChild(summarySec)

  // Group issues by category prefix like [Toolbar], [Annotation], etc.
  const groups = new Map<string, DiagnosticIssue[]>()
  for (const issue of data.issues) {
    const bracketMatch = /^\[([^\]]+)\]/.exec(issue.title)
    const group = bracketMatch ? bracketMatch[1] : 'Other'
    const list = groups.get(group) ?? []
    list.push(issue)
    groups.set(group, list)
  }

  const groupIcons: Record<string, string> = {
    Toolbar: '🔧', Annotation: '✏️', Modal: '📦', Runtime: '⚙️', Panel: '📱',
  }

  for (const [group, issues] of groups) {
    const sec = document.createElement('div')
    sec.className = 'sb-section'

    const groupErrors = issues.filter(i => i.severity === 'error').length
    const groupWarns = issues.filter(i => i.severity === 'warning').length
    let groupTag = '<span class="sb-tag ok">OK</span>'
    if (groupErrors > 0) {
      groupTag = `<span class="sb-tag err">${groupErrors} errors</span>`
    } else if (groupWarns > 0) {
      groupTag = `<span class="sb-tag warn">${groupWarns} warnings</span>`
    }

    sec.innerHTML = `<div class="sb-lbl"><span class="sb-lbl-icon">${groupIcons[group] ?? '📋'}</span> ${group} ${groupTag}</div>`

    const list = document.createElement('div')
    list.className = 'sb-issues'
    const severityIcon: Record<string, string> = { error: '🔴', warning: '🟡', info: '🔵' }
    for (const issue of issues) {
      const el = document.createElement('div')
      el.className = `sb-issue ${issue.severity}`
      const cleanTitle = issue.title.replace(/^\[[^\]]+\]\s*/, '')
      const icon = severityIcon[issue.severity] ?? '🔵'
      el.innerHTML = `
        <div class="sb-issue-title">${icon} ${cleanTitle}</div>
        <div>${issue.detail}</div>
        <div class="sb-issue-fix">💡 ${issue.fix}</div>`
      list.appendChild(el)
    }
    sec.appendChild(list)
    body.appendChild(sec)
  }
}

function _buildElementDiagBody(body: HTMLElement, data: DiagnosticData) {
  // Identity section
  const identSec = document.createElement('div')
  identSec.className = 'sb-section'
  identSec.innerHTML = `<div class="sb-lbl"><span class="sb-lbl-icon">🏷️</span> Identity</div>`
  const identCard = document.createElement('div')
  identCard.className = 'sb-card'
  identCard.innerHTML = `
    <div class="sb-grid">
      <span class="sb-grid-key">Tag</span><span class="sb-grid-val"><code>&lt;${data.tagName}&gt;</code></span>
      <span class="sb-grid-key">Selector</span><span class="sb-grid-val"><code>${data.selector}</code></span>
      <span class="sb-grid-key">ID</span><span class="sb-grid-val">${data.id ? `<code>${data.id}</code>` : '<em style="color:#9ca3af">none</em>'}</span>
      <span class="sb-grid-key">Classes</span><span class="sb-grid-val">${data.classes.length ? data.classes.map(c => `<span class="sb-tag">${c}</span>`).join('') : '<em style="color:#9ca3af">none</em>'}</span>
      <span class="sb-grid-key">Children</span><span class="sb-grid-val">${data.childCount} elements</span>
    </div>`
  identSec.appendChild(identCard)
  body.appendChild(identSec)

  // Dimensions section
  const dimSec = document.createElement('div')
  dimSec.className = 'sb-section'
  dimSec.innerHTML = `<div class="sb-lbl"><span class="sb-lbl-icon">📐</span> Dimensions & Position</div>`
  const dimCard = document.createElement('div')
  dimCard.className = 'sb-card'
  dimCard.innerHTML = `
    <div class="sb-grid">
      <span class="sb-grid-key">Size</span><span class="sb-grid-val">${data.rect.width}px × ${data.rect.height}px</span>
      <span class="sb-grid-key">Position</span><span class="sb-grid-val">top: ${data.rect.top}px, left: ${data.rect.left}px</span>
    </div>`
  dimSec.appendChild(dimCard)
  body.appendChild(dimSec)

  // Styles section
  const stylesSec = document.createElement('div')
  stylesSec.className = 'sb-section'
  stylesSec.innerHTML = `<div class="sb-lbl"><span class="sb-lbl-icon">🎨</span> Computed Styles</div>`
  const stylesCard = document.createElement('div')
  stylesCard.className = 'sb-card'
  const styleEntries = Object.entries(data.computedStyles)
  if (styleEntries.length) {
    const grid = document.createElement('div')
    grid.className = 'sb-grid'
    for (const [k, v] of styleEntries) {
      grid.innerHTML += `<span class="sb-grid-key">${k}</span><span class="sb-grid-val">${v}</span>`
    }
    stylesCard.appendChild(grid)
  } else {
    stylesCard.innerHTML = '<em style="color:#9ca3af">No notable computed styles</em>'
  }
  stylesSec.appendChild(stylesCard)
  body.appendChild(stylesSec)

  // Parent chain
  if (data.parentChain.length) {
    const parentSec = document.createElement('div')
    parentSec.className = 'sb-section'
    parentSec.innerHTML = `<div class="sb-lbl"><span class="sb-lbl-icon">🌳</span> Parent Chain</div>`
    const parentCard = document.createElement('div')
    parentCard.className = 'sb-card'
    parentCard.style.fontFamily = "'SF Mono',Menlo,monospace"
    parentCard.style.fontSize = '11px'
    const NBSP2 = '&nbsp;&nbsp;'
    parentCard.innerHTML = data.parentChain.map((p, i) => NBSP2.repeat(i) + `└─ <code>${p}</code>`).join('<br>')
    parentSec.appendChild(parentCard)
    body.appendChild(parentSec)
  }

  // Issues section
  const issuesSec = document.createElement('div')
  issuesSec.className = 'sb-section'
  const errorCount = data.issues.filter(i => i.severity === 'error').length
  const warnCount = data.issues.filter(i => i.severity === 'warning').length
  const tags: string[] = []
  if (errorCount > 0) tags.push(`<span class="sb-tag err">${errorCount} errors</span>`)
  if (warnCount > 0) tags.push(`<span class="sb-tag warn">${warnCount} warnings</span>`)
  if (errorCount === 0 && warnCount === 0) tags.push('<span class="sb-tag ok">All clear</span>')
  issuesSec.innerHTML = `<div class="sb-lbl"><span class="sb-lbl-icon">⚠️</span> Issues (${tags.join('')})</div>`
  const issuesList = document.createElement('div')
  issuesList.className = 'sb-issues'
  for (const issue of data.issues) {
    const issueEl = document.createElement('div')
    issueEl.className = `sb-issue ${issue.severity}`
    const severityIcon: Record<string, string> = { error: '🔴', warning: '🟡', info: '🔵' }
    const icon = severityIcon[issue.severity] ?? '🔵'
    issueEl.innerHTML = `
      <div class="sb-issue-title">${icon} ${issue.title}</div>
      <div>${issue.detail}</div>
      <div class="sb-issue-fix">💡 ${issue.fix}</div>`
    issuesList.appendChild(issueEl)
  }
  issuesSec.appendChild(issuesList)
  body.appendChild(issuesSec)

  // IDE Prompt section
  const promptSec = document.createElement('div')
  promptSec.className = 'sb-section'
  promptSec.innerHTML = `<div class="sb-lbl"><span class="sb-lbl-icon">📋</span> IDE Prompt (copy to paste in Cursor / VS Code)</div>`
  const promptBox = document.createElement('div')
  promptBox.className = 'sb-prompt-box'
  promptBox.textContent = generateIDEPrompt(data)
  promptSec.appendChild(promptBox)
  body.appendChild(promptSec)
}

function _generateSelfDiagPrompt(data: DiagnosticData): string {
  const lines = data.issues
    .filter(i => i.severity !== 'info')
    .map(i => `- [${i.severity.toUpperCase()}] ${i.title}\n  Detail: ${i.detail}\n  Fix: ${i.fix}`)
    .join('\n')

  return `## Self-Diagnostic Report
Generated by Nexus · ${new Date().toLocaleString()}

### Summary
${data.selector}

### Issues Requiring Attention
${lines || '- No issues found — all checks passed.'}

### Recommended Actions
${data.issues.some(i => i.severity === 'error') ? '1. Fix all errors first (red items above)\n2. Address warnings next\n3. Re-run self-diagnostics to verify' : 'All checks passed. No action needed.'}
`
}

function closeDiagnosticSidebar() {
  diagSidebar?.remove()
  diagSidebar = null
  // Restore toolbar to its default position
  if (toolbarEl) toolbarEl.style.right = '24px'
}

function closeDiagnosticMode() {
  // Run cleanup from status bar
  const statusBar = document.querySelector<HTMLElement>('[data-prompt-os="diag-status"]')
  const cleanup = (statusBar as unknown as { _cleanup?: () => void } | undefined)?._cleanup
  cleanup?.()

  closeDiagnosticSidebar()

  // Restore the global toolbar if it was hidden for inspect mode
  if (toolbarEl) {
    toolbarEl.style.display = 'flex'
  } else {
    showToolbar()
  }
}

// ── Event listeners ────────────────────────────────────────────────────────

// Track which chat input is focused for text insertion
document.addEventListener('focusin', (e) => {
  const target = e.target as HTMLElement
  if (isChatInput(target)) {
    if (focusOutTimer) { clearTimeout(focusOutTimer); focusOutTimer = null }
    activeInput = target
  }
}, true)

document.addEventListener('focusout', () => {
  focusOutTimer = setTimeout(() => {
    const focused = document.activeElement as HTMLElement | null
    if (!toolbarEl?.contains(focused) && !modalHost) {
      activeInput = null
    }
  }, 200)
}, true)

// Show the global toolbar immediately on every page
showToolbar()
