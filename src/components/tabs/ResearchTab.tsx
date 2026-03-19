import { useState, useEffect, useCallback } from 'react'
import { FlaskConical, Trash2, Copy, ChevronDown, ChevronUp, Search, FileDown, Plus, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { callLLM, hasApiKey } from '@/lib/llm'

interface ResearchEntry {
  id: string
  query: string
  report: string
  depth: string
  focus: string
  savedAt: number
}

type Depth = 'quick' | 'standard' | 'deep' | 'extra-deep'
type Focus = 'general' | 'science' | 'business' | 'history' | 'health'

const STORAGE_KEY = 'prompt-os-research'

const DEPTHS: { id: Depth; label: string }[] = [
  { id: 'quick',      label: '⚡ Quick Summary'   },
  { id: 'standard',   label: '📄 Standard Report'  },
  { id: 'deep',       label: '🔬 Deep Analysis'    },
  { id: 'extra-deep', label: '🧬 Extra Deep'        },
]

const FOCUSES: { id: Focus; label: string }[] = [
  { id: 'general',  label: 'General'         },
  { id: 'science',  label: 'Science & Tech'  },
  { id: 'business', label: 'Business'        },
  { id: 'history',  label: 'History'         },
  { id: 'health',   label: 'Health & Medicine' },
]

function formatDepth(d: string) {
  return DEPTHS.find((x) => x.id === d)?.label ?? '📄 Standard'
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function buildSystemPrompt(depth: Depth, focus: Focus): string {
  const isExtraDeep = depth === 'extra-deep'
  const tokenMap: Record<string, string> = { quick: '400–600', standard: '900–1200', deep: '1800–2400', 'extra-deep': '3000–4000' }
  const tokenTarget = tokenMap[depth] ?? '900–1200'
  const extraSections = isExtraDeep
    ? '\n## Critical Analysis\n## Competing Perspectives\n## Future Implications\n## Knowledge Gaps\n## Recommended Further Reading'
    : ''
  return `You are an expert research analyst specialising in ${focus === 'general' ? 'broad interdisciplinary research' : focus}.
Produce a comprehensive, well-structured research report with clearly labelled ## sections.
Required sections: ## Executive Summary, ## Key Findings, ## Detailed Analysis, ## Evidence & Examples, ## Conclusion${extraSections}.
Target length: ${tokenTarget} tokens. Use British English. Be thorough and cite specific facts. No preamble.`
}

function openReportAsPdf(entry: ResearchEntry) {
  const lines = entry.report.split('\n')
  const bodyHtml = lines
    .map((l) => {
      if (l.startsWith('## ')) return `<h2>${l.slice(3)}</h2>`
      if (l.startsWith('# '))  return `<h1>${l.slice(2)}</h1>`
      if (l.trim() === '')     return '<br/>'
      return `<p>${l}</p>`
    })
    .join('\n')

  const depth = formatDepth(entry.depth)
  const date  = new Date(entry.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${entry.query}</title>
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #111; line-height: 1.7; }
  h1 { font-size: 22px; color: #1e1b4b; margin-bottom: 4px; }
  h2 { font-size: 17px; color: #4c1d95; margin-top: 28px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  p  { margin: 6px 0; }
  .meta { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
  @media print { body { margin: 20px; } }
</style>
</head><body>
<h1>${entry.query}</h1>
<div class="meta">${depth} · ${date} · Nexus Research</div>
${bodyHtml}
<script>window.onload=function(){window.print();}</script>
</body></html>`

  const blob = new Blob([html], { type: 'text/html' })
  window.open(URL.createObjectURL(blob), '_blank')
}

function saveEntry(entry: ResearchEntry, current: ResearchEntry[]): ResearchEntry[] {
  const updated = [entry, ...current].slice(0, 50)
  try { chrome.storage.local.set({ [STORAGE_KEY]: updated }) } catch { /* ignore */ }
  return updated
}

// ── Composer panel ────────────────────────────────────────────────────────────
function ResearchComposer({ onSaved }: Readonly<{ onSaved: (entry: ResearchEntry) => void }>) {
  const [query, setQuery]   = useState('')
  const [depth, setDepth]   = useState<Depth>('standard')
  const [focus, setFocus]   = useState<Focus>('general')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState('')
  const [error, setError]     = useState('')

  const handleResearch = async () => {
    if (!query.trim()) return
    if (!hasApiKey()) { setError('No API key set — go to Features → API Key Settings.'); return }
    setLoading(true); setError(''); setResult('')
    try {
      const report = await callLLM(`${buildSystemPrompt(depth, focus)}\n\n${query.trim()}`)
      setResult(report)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (!result) return
    const entry: ResearchEntry = {
      id: `research-${Date.now()}`,
      query: query.trim(),
      report: result,
      depth,
      focus,
      savedAt: Date.now(),
    }
    onSaved(entry)
    setResult('')
    setQuery('')
    toast.success('Research saved')
  }

  return (
    <div className="space-y-3">
      {/* Query */}
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="What do you want to research? e.g. Latest developments in quantum computing…"
        rows={3}
        className="w-full px-3 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none placeholder-slate-300"
      />

      {/* Depth + Focus */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="research-depth" className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Depth</label>
          <select
            id="research-depth"
            value={depth}
            onChange={(e) => setDepth(e.target.value as Depth)}
            className="w-full px-2 py-1.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-violet-400 appearance-none cursor-pointer"
          >
            {DEPTHS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="research-focus" className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Focus</label>
          <select
            id="research-focus"
            value={focus}
            onChange={(e) => setFocus(e.target.value as Focus)}
            className="w-full px-2 py-1.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-violet-400 appearance-none cursor-pointer"
          >
            {FOCUSES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {/* Research button */}
      <button
        onClick={handleResearch}
        disabled={loading || !query.trim()}
        className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-white bg-violet-600 rounded-xl hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Researching…</>
          : <><FlaskConical className="w-4 h-4" /> Research</>}
      </button>

      {/* Result */}
      {result && (
        <div className="space-y-2">
          <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-xl p-3 max-h-64 overflow-y-auto border border-slate-200">
            {result}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={() => { navigator.clipboard.writeText(result); toast.success('Copied') }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors"
            >
              <Plus className="w-3 h-3" /> Save Report
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export function ResearchTab() {
  const [entries, setEntries]   = useState<ResearchEntry[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch]     = useState('')
  const [composerOpen, setComposerOpen] = useState(false)

  const load = useCallback(() => {
    try {
      chrome.storage.local.get(STORAGE_KEY, (stored) => {
        setEntries((stored[STORAGE_KEY] as ResearchEntry[]) || [])
      })
    } catch {
      setEntries([])
    }
  }, [])

  useEffect(() => {
    load()
    try {
      const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
        if (changes[STORAGE_KEY]) setEntries((changes[STORAGE_KEY].newValue ?? []) as ResearchEntry[])
      }
      chrome.storage.onChanged.addListener(handler)
      return () => chrome.storage.onChanged.removeListener(handler)
    } catch {
      return undefined
    }
  }, [load])

  const handleSaved = (entry: ResearchEntry) => {
    setEntries((cur) => saveEntry(entry, cur))
    setComposerOpen(false)
  }

  const handleDelete = (id: string) => {
    const updated = entries.filter((e) => e.id !== id)
    try { chrome.storage.local.set({ [STORAGE_KEY]: updated }) } catch { /* ignore */ }
    setEntries(updated)
    toast.success('Research deleted')
  }

  const handleCopy = (entry: ResearchEntry) => {
    navigator.clipboard.writeText(`# ${entry.query}\n\n${entry.report}`)
    toast.success('Copied to clipboard')
  }

  const handleClearAll = () => {
    try { chrome.storage.local.set({ [STORAGE_KEY]: [] }) } catch { /* ignore */ }
    setEntries([])
    toast.success('All research cleared')
  }

  const filtered = search
    ? entries.filter((e) =>
        e.query.toLowerCase().includes(search.toLowerCase()) ||
        e.report.toLowerCase().includes(search.toLowerCase())
      )
    : entries

  return (
    <div className="flex flex-col h-full" style={{ background: '#f0f4f8' }}>
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-0.5">
          <h1 className="text-base font-semibold text-slate-900">Research</h1>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <button onClick={handleClearAll} className="text-xs text-slate-400 hover:text-red-500 transition-colors">
                Clear all
              </button>
            )}
            <button
              onClick={() => setComposerOpen((v) => !v)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                composerOpen
                  ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                  : 'bg-violet-600 text-white hover:bg-violet-700'
              }`}
            >
              {composerOpen ? <><X className="w-3 h-3" /> Close</> : <><Plus className="w-3 h-3" /> New</>}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-3">Research with AI · save full reports</p>

        {/* Composer */}
        {composerOpen && (
          <div className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <ResearchComposer onSaved={handleSaved} />
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search reports…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-100 rounded-lg border-0 outline-none focus:ring-2 focus:ring-blue-200 placeholder-slate-400"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <FlaskConical className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-sm font-medium">
              {entries.length === 0 ? 'No research saved yet' : 'No results found'}
            </p>
            <p className="text-xs mt-1 text-center text-slate-300">
              {entries.length === 0
                ? 'Click "+ New" above or use the 🔬 tab in the page composer'
                : 'Try a different search term'}
            </p>
          </div>
        ) : (
          filtered.map((entry) => {
            const isOpen = expanded === entry.id
            return (
              <div key={entry.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : entry.id)}
                  className="w-full flex items-start gap-2 px-3 pt-3 pb-2 text-left hover:bg-slate-50 transition-colors"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-violet-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{entry.query}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-400">{timeAgo(entry.savedAt)}</span>
                      <span className="text-[10px] bg-violet-50 text-violet-600 font-medium px-1.5 py-0.5 rounded">
                        {formatDepth(entry.depth)}
                      </span>
                      {entry.focus !== 'general' && (
                        <span className="text-[10px] bg-blue-50 text-blue-600 font-medium px-1.5 py-0.5 rounded capitalize">
                          {entry.focus}
                        </span>
                      )}
                    </div>
                  </div>
                  {isOpen
                    ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />}
                </button>

                {isOpen && (
                  <div className="px-3 pb-2">
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-lg p-3 max-h-72 overflow-y-auto border border-slate-100">
                      {entry.report}
                    </pre>
                  </div>
                )}

                <div className="flex items-center gap-1 px-2.5 py-2 border-t border-slate-50 bg-slate-50/60">
                  <button
                    onClick={() => handleCopy(entry)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                  <button
                    onClick={() => setExpanded(isOpen ? null : entry.id)}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    {isOpen ? 'Collapse' : 'View Report'}
                  </button>
                  <button
                    onClick={() => openReportAsPdf(entry)}
                    title="Download as PDF"
                    className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="ml-auto p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
