// Open the side panel when the extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => { /* ignore */ }) // NOSONAR - top-level await is disallowed in MV3 service workers

const DO_BASE_URL = 'https://inference.do-ai.run/v1'
const API_KEY_KEY = 'do-api-key'
const MODEL_KEY   = 'do-model'
const DEFAULT_MODEL = 'llama3.3-70b-instruct'

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // ── Generate prompt via DO API ──
  if (msg.type === 'GENERATE_PROMPT') {
    chrome.storage.local.get([API_KEY_KEY, MODEL_KEY], async (stored) => {
      const apiKey = stored[API_KEY_KEY] as string | undefined
      const model  = (stored[MODEL_KEY] as string | undefined) ?? DEFAULT_MODEL

      if (!apiKey) {
        sendResponse({ error: 'No API key set. Open the Nexus side panel → Features → API Key Settings.' })
        return
      }
      try {
        const res = await fetch(`${DO_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: msg.systemPrompt },
              { role: 'user',   content: msg.userPrompt   },
            ],
            max_completion_tokens: (msg.maxTokens as number | undefined) ?? 1024,
          }),
        })
        if (!res.ok) {
          let errMsg = `API error ${res.status}`
          try { const e = await res.json(); errMsg = e?.error?.message ?? errMsg } catch { /* ignore */ }
          sendResponse({ error: errMsg })
          return
        }
        const data = await res.json()
        // Track usage in chrome.storage.local so content-script calls also count
        if (data.usage) {
          const USAGE_KEY = 'prompt-os-usage-cs'
          const PRICES: Record<string, number> = {
            'llama3.3-70b-instruct': 0.65, 'llama3-8b-instruct': 0.198,
            'anthropic-claude-4.6-sonnet': 3, 'anthropic-claude-4.5-sonnet': 3,
            'openai-gpt-4o': 2.5, 'openai-gpt-4o-mini': 0.15,
          }
          const pricePerM = PRICES[model] ?? 1
          const costUsd = ((data.usage.prompt_tokens ?? 0) + (data.usage.completion_tokens ?? 0)) / 1_000_000 * pricePerM
          chrome.storage.local.get(USAGE_KEY, (stored) => {
            const cur = (stored[USAGE_KEY] as { totalPromptTokens: number; totalCompletionTokens: number; totalCostUsd: number; callCount: number }) ?? { totalPromptTokens: 0, totalCompletionTokens: 0, totalCostUsd: 0, callCount: 0 }
            chrome.storage.local.set({
              [USAGE_KEY]: {
                totalPromptTokens: cur.totalPromptTokens + (data.usage.prompt_tokens ?? 0),
                totalCompletionTokens: cur.totalCompletionTokens + (data.usage.completion_tokens ?? 0),
                totalCostUsd: cur.totalCostUsd + costUsd,
                callCount: cur.callCount + 1,
              }
            })
          })
        }
        sendResponse({ text: data.choices[0].message.content as string, usage: data.usage })
      } catch (e) {
        sendResponse({ error: (e as Error).message })
      }
    })
    return true // keep channel open
  }

  // ── Analyse image via vision model ──
  if (msg.type === 'ANALYSE_IMAGE') {
    chrome.storage.local.get([API_KEY_KEY, MODEL_KEY], async (stored) => {
      const apiKey = stored[API_KEY_KEY] as string | undefined
      const model  = (stored[MODEL_KEY] as string | undefined) ?? DEFAULT_MODEL
      if (!apiKey) { sendResponse({ error: 'No API key set.' }); return }
      try {
        const res = await fetch(`${DO_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [{
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:${msg.mimeType};base64,${msg.base64}` } },
                { type: 'text', text: msg.prompt },
              ],
            }],
            max_completion_tokens: 2048,
          }),
        })
        if (!res.ok) {
          let errMsg = `API error ${res.status}`
          try { const e = await res.json(); errMsg = e?.error?.message ?? errMsg } catch { /* ignore */ }
          sendResponse({ error: errMsg }); return
        }
        const data = await res.json()
        sendResponse({ text: data.choices[0].message.content as string })
      } catch (e) {
        sendResponse({ error: (e as Error).message })
      }
    })
    return true
  }

  // ── Ping/pong for health checks ──
  if (msg.type === 'PING') {
    sendResponse({ pong: true })
    return false
  }

  // ── Self-diagnostics: relay to content script on active tab ──
  if (msg.type === 'RUN_SELF_DIAGNOSTICS') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      if (!tab?.id) {
        sendResponse({ error: 'No active tab found' })
        return
      }
      chrome.tabs.sendMessage(tab.id, { type: 'RUN_SELF_DIAGNOSTICS' }, (resp) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message })
          return
        }
        sendResponse(resp)
      })
    })
    return true
  }

  // ── Self-diagnostics: side panel health check ──
  if (msg.type === 'SELF_DIAGNOSE_PANEL') {
    sendResponse({ checks: [], error: 'Panel diagnostics handled by side panel directly' })
    return false
  }

  // ── Visible tab screenshot (page + overlays as the user sees them) ──
  if (msg.type === 'CAPTURE_VISIBLE_TAB') {
    chrome.tabs.captureVisibleTab(undefined, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message ?? 'captureVisibleTab failed' })
        return
      }
      sendResponse({ dataUrl })
    })
    return true
  }

  // ── Copilot API-based chat export (richer than DOM scraping) ──
  if (msg.type === 'EXPORT_COPILOT_API') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      if (!tab?.id || !tab.url) {
        sendResponse({ error: 'No active tab found' })
        return
      }
      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, func: scrapeCopilotViaApi },
        (results) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message })
            return
          }
          sendResponse({ data: results?.[0]?.result ?? null })
        }
      )
    })
    return true
  }

  // ── Export chat message handler ──
  if (msg.type !== 'EXPORT_CHAT') return false

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0]
    if (!tab?.id) {
      sendResponse({ error: 'No active tab found' })
      return
    }

    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: scrapeChatPage,
      },
      (results) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message })
          return
        }
        const result = results?.[0]?.result as { title: string; source: string; messages: { role: string; text: string }[] } | null
        sendResponse({ data: result })
      }
    )
  })

  return true // keep channel open for async response
})

// ── Injected into the active tab to scrape chat messages ────────────────────
function scrapeChatPage() {
  const title = document.title
  const host = globalThis.location.hostname

  type Msg = { role: string; text: string }
  type Result = { title: string; source: string; messages: Msg[] }

  function msgs(els: NodeListOf<Element>, roleOf: (el: Element) => string): Msg[] {
    return Array.from(els)
      .map(el => ({ role: roleOf(el), text: (el.textContent ?? '').trim() }))
      .filter(m => m.text.length > 0)
  }

  // ChatGPT
  const gpt = document.querySelectorAll('[data-message-author-role]')
  if (gpt.length > 0) {
    return { title, source: 'chatgpt', messages: msgs(gpt, el => (el as HTMLElement).dataset.messageAuthorRole ?? 'unknown') } satisfies Result
  }

  // Claude
  const claude = document.querySelectorAll('[data-testid="human-turn"], [data-testid="ai-turn"]')
  if (claude.length > 0) {
    return { title, source: 'claude', messages: msgs(claude, el => (el as HTMLElement).dataset.testid === 'human-turn' ? 'user' : 'assistant') } satisfies Result
  }

  // Gemini — try multiple selector patterns
  const geminiA = document.querySelectorAll('user-query, model-response')
  if (geminiA.length > 0) {
    return { title, source: 'gemini', messages: msgs(geminiA, el => el.tagName.toLowerCase() === 'user-query' ? 'user' : 'assistant') } satisfies Result
  }
  const geminiB = document.querySelectorAll('.conversation-container .query-text, .conversation-container .response-content')
  if (geminiB.length > 0) {
    return { title, source: 'gemini', messages: msgs(geminiB, el => el.classList.contains('query-text') ? 'user' : 'assistant') } satisfies Result
  }

  // Perplexity
  const perp = document.querySelectorAll('[data-testid="user-message"], [data-testid="answer"]')
  if (perp.length > 0) {
    return { title, source: 'perplexity', messages: msgs(perp, el => (el as HTMLElement).dataset.testid === 'user-message' ? 'user' : 'assistant') } satisfies Result
  }

  // Microsoft Copilot — delegate to a dedicated helper
  if (host.includes('copilot.microsoft') || host.includes('bing.com')) {
    const copilotResult = scrapeCopilotDom(title, msgs)
    if (copilotResult) return copilotResult
  }

  // Detect source from hostname even for generic fallback
  let source = 'unknown'
  if (host.includes('openai') || host.includes('chatgpt')) source = 'chatgpt'
  else if (host.includes('claude')) source = 'claude'
  else if (host.includes('gemini') || host.includes('bard')) source = 'gemini'
  else if (host.includes('perplexity')) source = 'perplexity'
  else if (host.includes('copilot') || host.includes('bing')) source = 'copilot'

  // Generic fallback
  const paras = Array.from(document.querySelectorAll('main p, article p'))
    .map(el => ({ role: 'unknown', text: (el.textContent ?? '').trim() }))
    .filter(m => m.text.length > 10)

  return { title, source, messages: paras } satisfies Result
}

/** DOM-based Copilot scraper — tries several selector strategies. */
function scrapeCopilotDom(
  title: string,
  msgs: (els: NodeListOf<Element>, roleOf: (el: Element) => string) => { role: string; text: string }[],
): { title: string; source: string; messages: { role: string; text: string }[] } | null {
  type Msg = { role: string; text: string }

  // Strategy 1: data-content attribute
  const byData = document.querySelectorAll('[data-content="user"], [data-content="ai"], [data-content="bot"]')
  if (byData.length > 0) {
    return {
      title, source: 'copilot',
      messages: msgs(byData, el => (el as HTMLElement).dataset.content === 'user' ? 'user' : 'assistant'),
    }
  }

  // Strategy 2: "You said" heading pattern
  const turns: Msg[] = []
  document.querySelectorAll('[data-tabster]').forEach(el => {
    const text = (el.textContent ?? '').trim()
    if (!text || text.length < 2) return
    if (text.includes('You said')) {
      const cleaned = text.replace(/^You said\s*/, '').trim()
      if (cleaned) turns.push({ role: 'user', text: cleaned })
    } else if (turns.at(-1)?.role === 'user' && text.length > 5) {
      turns.push({ role: 'assistant', text })
    }
  })
  if (turns.length > 0) return { title, source: 'copilot', messages: turns }

  // Strategy 3: h5 heading-based parsing
  const headingTurns: Msg[] = []
  document.querySelectorAll('h5').forEach(h5 => {
    if (!(h5.textContent ?? '').includes('You said')) return
    const parent = h5.closest('[class]')?.parentElement
    if (!parent) return
    const userEl = parent.querySelector('p, [class*="content"], [class*="message"]')
    if (userEl) headingTurns.push({ role: 'user', text: (userEl.textContent ?? '').trim() })
    const next = parent.nextElementSibling
    if (next) headingTurns.push({ role: 'assistant', text: (next.textContent ?? '').trim() })
  })
  const filtered = headingTurns.filter(m => m.text.length > 0)
  if (filtered.length > 0) return { title, source: 'copilot', messages: filtered }

  // Strategy 4: broad conversation block selectors
  const blocks = document.querySelectorAll(
    '[class*="message"], [class*="turn"], [class*="chat-turn"], [class*="response"], [role="article"]',
  )
  if (blocks.length > 1) {
    const blockMsgs: Msg[] = []
    blocks.forEach((el, i) => {
      const text = (el.textContent ?? '').trim()
      if (text.length > 2) blockMsgs.push({ role: i % 2 === 0 ? 'user' : 'assistant', text })
    })
    if (blockMsgs.length > 0) return { title, source: 'copilot', messages: blockMsgs }
  }

  return null
}

function copilotAuthorRole(authorType: string): string {
  if (authorType === 'human') return 'user'
  if (authorType === 'ai') return 'assistant'
  return authorType
}

function copilotExtractText(parts: unknown[]): string {
  return parts
    .filter((p): p is { type: string; text: string } => {
      const o = p as Record<string, unknown> | null
      return o?.type === 'text' && typeof o.text === 'string' && String(o.text).trim().length > 0
    })
    .map(p => p.text.trim())
    .join('\n\n')
}

function copilotChatIdFromUrl(): string | null {
  const re = /\/chats\/([A-Za-z0-9_-]+)/
  const m = re.exec(globalThis.location.pathname)
  return m ? m[1] : null
}

/**
 * Injected into the active Copilot tab — uses the Copilot conversation API
 * to fetch structured messages (more reliable than DOM scraping).
 */
async function scrapeCopilotViaApi() {
  type Msg = { role: string; text: string }
  type Result = { title: string; source: string; messages: Msg[] }

  const host = globalThis.location.hostname
  if (!host.includes('copilot.microsoft') && !host.includes('bing.com')) return null

  const chatId = copilotChatIdFromUrl()
  if (!chatId) return null

  const apiUrl = `${globalThis.location.origin}/c/api/conversations/${encodeURIComponent(chatId)}/history?api-version=2`

  try {
    const res = await fetch(apiUrl, { credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json()
    const entries = Array.isArray(data?.results) ? data.results : []

    const messages: Msg[] = entries
      .map((entry: Record<string, unknown>) => {
        const author = entry?.author as Record<string, unknown> | undefined
        return {
          role: copilotAuthorRole((author?.type as string) ?? 'unknown'),
          text: copilotExtractText(Array.isArray(entry?.content) ? entry.content as unknown[] : []),
        }
      })
      .filter((m: Msg) => m.text.length > 0)

    return { title: document.title || 'Copilot Conversation', source: 'copilot', messages } satisfies Result
  } catch {
    return null
  }
}
