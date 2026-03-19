import { useState, type Dispatch, type SetStateAction } from 'react'
import { Share2, Download, Copy, FileText, FileDown, Loader2, AlertCircle, Trash2, RotateCcw, X, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { useStorage } from '@/hooks/useStorage'
import type { ExportedChat } from '@/lib/types'

interface ScrapeResult {
  title: string
  source: ExportedChat['source']
  messages: { role: string; text: string }[]
}

function sourceLabel(source: ExportedChat['source']): string {
  if (source === 'chatgpt')    return 'ChatGPT'
  if (source === 'claude')     return 'Claude'
  if (source === 'gemini')     return 'Gemini'
  if (source === 'perplexity') return 'Perplexity'
  if (source === 'copilot')    return 'Copilot'
  return 'Unknown'
}

function sourceColour(source: ExportedChat['source']): string {
  if (source === 'chatgpt')    return 'bg-emerald-50 text-emerald-700'
  if (source === 'claude')     return 'bg-orange-50 text-orange-700'
  if (source === 'gemini')     return 'bg-blue-50 text-blue-700'
  if (source === 'perplexity') return 'bg-teal-50 text-teal-700'
  if (source === 'copilot')    return 'bg-sky-50 text-sky-700'
  return 'bg-slate-100 text-slate-500'
}

function formatRoleMd(role: string): string {
  if (role === 'user') return '**You**'
  if (role === 'assistant') return '**AI**'
  return `**${role}**`
}

function formatRolePlain(role: string): string {
  if (role === 'user') return 'You'
  if (role === 'assistant') return 'AI'
  return role
}

function toMarkdown(chat: ExportedChat): string {
  const lines = [
    `# ${chat.title}`,
    '',
    `*Source: ${sourceLabel(chat.source)} · Exported ${new Date(chat.exportedAt).toLocaleString()}*`,
    '',
  ]
  for (const msg of chat.messages) {
    const role = formatRoleMd(msg.role)
    lines.push(role, '', msg.text, '')
  }
  return lines.join('\n')
}

function toPlainText(chat: ExportedChat): string {
  const lines = [
    chat.title,
    `Source: ${sourceLabel(chat.source)}`,
    `Exported: ${new Date(chat.exportedAt).toLocaleString()}`,
    '---',
    '',
  ]
  for (const msg of chat.messages) {
    const role = formatRolePlain(msg.role)
    lines.push(`[${role}]`, msg.text, '')
  }
  return lines.join('\n')
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function escapeChatMessageForHtml(text: string): string {
  return text.replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', '<br/>')
}

function makeUndoTrashHandler(
  id: string,
  setTrashedChatIds: Dispatch<SetStateAction<string[] | undefined>>
): () => void {
  return () => {
    setTrashedChatIds((cur) => (cur || []).filter((t) => t !== id))
  }
}

function openAsPdf(chat: ExportedChat) {
  const rows = chat.messages.map(m => {
    const label = formatRolePlain(m.role)
    const bg = m.role === 'user' ? '#eff6ff' : '#f8fafc'
    const color = m.role === 'user' ? '#1e40af' : '#334155'
    return `<div style="margin-bottom:12px;padding:10px 14px;background:${bg};border-radius:8px;color:${color};font-size:13px;line-height:1.6"><strong style="text-transform:capitalize">${label}:</strong><br/>${escapeChatMessageForHtml(m.text)}</div>`
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${chat.title}</title><style>
    body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#111}
    h1{font-size:20px;font-weight:700;margin-bottom:4px}
    .meta{font-size:12px;color:#64748b;margin-bottom:24px}
    @media print{body{margin:20px}}
  </style></head><body>
    <h1>${chat.title}</h1>
    <div class="meta">Source: ${sourceLabel(chat.source)} · ${chat.messages.length} messages · ${new Date(chat.exportedAt).toLocaleString()}</div>
    ${rows}
    <script>window.onload=()=>window.print()</script>
  </body></html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  chrome.tabs.create({ url })
}

export function ExportChatTab() {
  const [loading, setLoading] = useState(false)
  const [scraped, setScraped] = useState<ScrapeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [view, setView] = useState<'history' | 'trash'>('history')

  const [savedChats, setSavedChats] = useStorage<ExportedChat[]>('exported-chats', [])
  const [trashedChatIds, setTrashedChatIds] = useStorage<string[]>('trashed-chat-ids', [])

  const activeChats = (savedChats || []).filter(c => !(trashedChatIds || []).includes(c.id))
  const trashedChats = (savedChats || []).filter(c => (trashedChatIds || []).includes(c.id))

  const scrape = async () => {
    setLoading(true)
    setError(null)
    setScraped(null)
    try {
      type ScrapeResponse = {
        data?: { title: string; source?: string; messages: { role: string; text: string }[] } | null
        error?: string
      }

      // Try Copilot API first (richer data) then fall back to generic DOM scraper
      let response: ScrapeResponse = {}
      try {
        const copilotResp = await chrome.runtime.sendMessage({ type: 'EXPORT_COPILOT_API' }) as ScrapeResponse
        if (copilotResp?.data && copilotResp.data.messages.length > 0) {
          response = copilotResp
        }
      } catch { /* not on Copilot, or API failed */ }

      if (!response.data) {
        response = await chrome.runtime.sendMessage({ type: 'EXPORT_CHAT' }) as ScrapeResponse
      }

      if (response.error) {
        setError(response.error)
      } else if (!response.data || response.data.messages.length === 0) {
        setError('No chat messages found. Make sure a ChatGPT, Claude, Gemini, Copilot, or Perplexity tab is open and active.')
      } else {
        const result: ScrapeResult = {
          title: response.data.title,
          source: (response.data.source as ExportedChat['source']) ?? 'unknown',
          messages: response.data.messages,
        }
        setScraped(result)
        toast.success(`Captured ${result.messages.length} messages from ${sourceLabel(result.source)}`)
      }
    } catch {
      setError('Could not connect to the active tab.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (!scraped) return
    const chat: ExportedChat = {
      id: `chat-${Date.now()}`,
      title: scraped.title || `Chat ${new Date().toLocaleDateString()}`,
      source: scraped.source,
      messages: scraped.messages,
      exportedAt: Date.now(),
    }
    setSavedChats(cur => [chat, ...(cur || [])])
    setScraped(null)
    toast.success('Saved to history')
  }

  const handleTrash = (id: string) => {
    setTrashedChatIds((cur) => [...(cur || []), id])
    toast('Moved to Trash', {
      icon: '🗑️',
      action: { label: 'Undo', onClick: makeUndoTrashHandler(id, setTrashedChatIds) },
    })
  }

  const handleRestore = (id: string) => {
    setTrashedChatIds(cur => (cur || []).filter(t => t !== id))
    toast.success('Restored')
  }

  const handlePermanentDelete = (id: string) => {
    setSavedChats(cur => (cur || []).filter(c => c.id !== id))
    setTrashedChatIds(cur => (cur || []).filter(t => t !== id))
    toast.success('Permanently deleted')
  }

  const handleEmptyTrash = () => {
    const ids = trashedChatIds || []
    setSavedChats(cur => (cur || []).filter(c => !ids.includes(c.id)))
    setTrashedChatIds([])
    toast.success('Trash emptied')
  }

  // ── Trash view ──────────────────────────────────────────────────────────
  if (view === 'trash') {
    return (
      <div className="flex flex-col h-full" style={{ background: '#f0f4f8' }}>
        <div className="bg-white px-4 pt-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <button onClick={() => setView('history')} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
            <div className="flex-1">
              <h1 className="text-base font-semibold text-slate-900">Trash</h1>
              <p className="text-xs text-slate-400">{trashedChats.length} chat{trashedChats.length === 1 ? '' : 's'}</p>
            </div>
            {trashedChats.length > 0 && (
              <button onClick={handleEmptyTrash} className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors">
                Empty Trash
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {trashedChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <Trash2 className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm font-medium">Trash is empty</p>
            </div>
          ) : (
            trashedChats.map(chat => (
              <div key={chat.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden opacity-75">
                <div className="px-3 pt-3 pb-2">
                  <p className="text-sm font-semibold text-slate-800 truncate">{chat.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sourceColour(chat.source)}`}>{sourceLabel(chat.source)}</span>
                    <span className="text-[10px] text-slate-400">{chat.messages.length} messages · {new Date(chat.exportedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-2 border-t border-slate-50 bg-slate-50/60">
                  <button onClick={() => handleRestore(chat.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:border-blue-300 hover:text-blue-600 transition-colors">
                    <RotateCcw className="w-3 h-3" /> Restore
                  </button>
                  <button onClick={() => handlePermanentDelete(chat.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-400 text-xs font-semibold rounded-lg hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-auto">
                    <X className="w-3 h-3" /> Delete forever
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // ── History view ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ background: '#f0f4f8' }}>
      <div className="bg-white px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-0.5">
          <h1 className="text-base font-semibold text-slate-900">Export Chat</h1>
          {trashedChats.length > 0 && (
            <button onClick={() => setView('trash')} className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
              Trash ({trashedChats.length})
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400">Capture and save your AI conversations</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Capture button */}
        <button
          onClick={scrape}
          disabled={loading}
          className="w-full bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center gap-3 hover:border-blue-200 hover:shadow-md transition-all disabled:opacity-60"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            {loading ? <Loader2 className="w-4 h-4 text-blue-600 animate-spin" /> : <Share2 className="w-4 h-4 text-blue-600" />}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-800">{loading ? 'Reading chat…' : 'Capture Active Chat Tab'}</p>
            <p className="text-xs text-slate-400">Supports ChatGPT, Claude, Gemini</p>
          </div>
        </button>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* Freshly scraped — preview + save */}
        {scraped && (
          <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sourceColour(scraped.source)}`}>{sourceLabel(scraped.source)}</span>
              <p className="flex-1 text-xs font-semibold text-slate-700 truncate">{scraped.title}</p>
              <span className="text-[10px] text-slate-400 shrink-0">{scraped.messages.length} messages</span>
            </div>
            {/* Message preview */}
            <div className="p-3 space-y-1.5 max-h-52 overflow-y-auto">
              {scraped.messages.slice(0, 6).map((msg, i) => (
                <div key={`${msg.role}-${i}`} className={`rounded-lg px-2.5 py-2 text-xs ${msg.role === 'user' ? 'bg-blue-50 text-blue-800' : 'bg-slate-50 text-slate-700'}`}>
                  <span className="font-semibold capitalize">{msg.role === 'assistant' ? 'AI' : msg.role}: </span>
                  {msg.text.slice(0, 140)}{msg.text.length > 140 ? '…' : ''}
                </div>
              ))}
              {scraped.messages.length > 6 && (
                <p className="text-xs text-slate-400 text-center">+{scraped.messages.length - 6} more messages</p>
              )}
            </div>
            {/* Actions */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-100 bg-slate-50/60">
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save to History
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(toMarkdown({ id: '', title: scraped.title, source: scraped.source, messages: scraped.messages, exportedAt: Date.now() })); toast.success('Copied as Markdown') }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:border-slate-300 transition-colors"
                title="Copy as Markdown"
              >
                <Copy className="w-3 h-3" /> Copy MD
              </button>
              <button
                onClick={() => { downloadFile(toMarkdown({ id: '', title: scraped.title, source: scraped.source, messages: scraped.messages, exportedAt: Date.now() }), `${scraped.title || 'chat'}.md`, 'text/markdown'); toast.success('Downloaded') }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:border-slate-300 transition-colors"
                title="Download Markdown"
              >
                <Download className="w-3 h-3" />
              </button>
              <button
                onClick={() => { openAsPdf({ id: '', title: scraped.title, source: scraped.source, messages: scraped.messages, exportedAt: Date.now() }); toast('Opening print dialog…', { icon: '📄' }) }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:border-slate-300 transition-colors"
                title="Export as PDF"
              >
                <FileDown className="w-3 h-3" />
              </button>
              <button
                onClick={() => setScraped(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors ml-auto"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Saved history */}
        {activeChats.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">Saved History</p>
            <div className="space-y-2">
              {activeChats.map(chat => {
                const isExpanded = expandedId === chat.id
                return (
                  <div key={chat.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    {/* Header row */}
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{chat.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sourceColour(chat.source)}`}>{sourceLabel(chat.source)}</span>
                          <span className="text-[10px] text-slate-400">{chat.messages.length} msgs · {new Date(chat.exportedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : chat.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Expanded preview */}
                    {isExpanded && (
                      <div className="border-t border-slate-50 px-3 py-2.5 space-y-1.5 max-h-52 overflow-y-auto bg-slate-50/40">
                        {chat.messages.slice(0, 8).map((msg, i) => (
                          <div key={`${msg.role}-${i}`} className={`rounded-lg px-2.5 py-2 text-xs ${msg.role === 'user' ? 'bg-blue-50 text-blue-800' : 'bg-white text-slate-700'}`}>
                            <span className="font-semibold capitalize">{msg.role === 'assistant' ? 'AI' : msg.role}: </span>
                            {msg.text.slice(0, 160)}{msg.text.length > 160 ? '…' : ''}
                          </div>
                        ))}
                        {chat.messages.length > 8 && (
                          <p className="text-xs text-slate-400 text-center">+{chat.messages.length - 8} more</p>
                        )}
                      </div>
                    )}

                    {/* Action bar */}
                    <div className="flex items-center gap-1 px-2.5 py-2 border-t border-slate-50 bg-slate-50/60">
                      <button
                        onClick={() => { navigator.clipboard.writeText(toMarkdown(chat)); toast.success('Copied as Markdown') }}
                        title="Copy as Markdown"
                        className="flex items-center gap-1 px-2 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                      <button
                        onClick={() => { downloadFile(toMarkdown(chat), `${chat.title || 'chat'}.md`, 'text/markdown'); toast.success('Downloaded Markdown') }}
                        title="Download as Markdown"
                        className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { downloadFile(toPlainText(chat), `${chat.title || 'chat'}.txt`, 'text/plain'); toast.success('Downloaded plain text') }}
                        title="Download as plain text"
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { openAsPdf(chat); toast('Opening print dialog…', { icon: '📄' }) }}
                        title="Export as PDF"
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleTrash(chat.id)}
                        title="Move to Trash"
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {activeChats.length === 0 && !scraped && !error && (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-sm font-medium">No saved chats yet</p>
            <p className="text-xs mt-1">Capture a chat above to save it here</p>
          </div>
        )}
      </div>
    </div>
  )
}
