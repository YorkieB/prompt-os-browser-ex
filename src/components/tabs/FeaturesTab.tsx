import { useState, useEffect } from 'react'
import { Settings, Key, Sparkles, BarChart2, Info, Coins, RotateCcw } from 'lucide-react'
import { getUsage, clearUsage, type UsageRecord } from '@/lib/llm'
import { toast } from 'sonner'

const GBP_RATE_KEY = 'gbp-rate-cache'

function getCachedGbpRate(): number | null {
  const raw = localStorage.getItem(GBP_RATE_KEY)
  if (!raw) return null
  const { rate, ts } = JSON.parse(raw)
  if (Date.now() - ts < 2 * 60 * 60 * 1000) return rate as number
  return null
}

const CS_USAGE_KEY = 'prompt-os-usage-cs'

function mergeUsage(a: UsageRecord, b: UsageRecord): UsageRecord {
  return {
    totalPromptTokens: a.totalPromptTokens + b.totalPromptTokens,
    totalCompletionTokens: a.totalCompletionTokens + b.totalCompletionTokens,
    totalCostUsd: a.totalCostUsd + b.totalCostUsd,
    callCount: a.callCount + b.callCount,
  }
}

const EMPTY: UsageRecord = { totalPromptTokens: 0, totalCompletionTokens: 0, totalCostUsd: 0, callCount: 0 }

interface FeaturesTabProps {
  onOpenSettings: () => void
}

export function FeaturesTab({ onOpenSettings }: Readonly<FeaturesTabProps>) {
  const [sidePanelUsage, setSidePanelUsage] = useState<UsageRecord>(() => getUsage())
  const [csUsage, setCsUsage] = useState<UsageRecord>(EMPTY)
  const [gbpRate, setGbpRate] = useState<number | null>(getCachedGbpRate)

  useEffect(() => {
    const rate = getCachedGbpRate()
    if (rate) setGbpRate(rate)

    // Poll side-panel usage every 5 s
    const poll = setInterval(() => setSidePanelUsage(getUsage()), 5000)

    // Read content-script usage from chrome.storage.local immediately
    chrome.storage.local.get(CS_USAGE_KEY, (r) => {
      if (r[CS_USAGE_KEY]) setCsUsage(r[CS_USAGE_KEY] as UsageRecord)
    })

    // Live updates when background writes new content-script usage
    const onChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes[CS_USAGE_KEY]) setCsUsage(changes[CS_USAGE_KEY].newValue as UsageRecord ?? EMPTY)
    }
    chrome.storage.onChanged.addListener(onChange)

    return () => {
      clearInterval(poll)
      chrome.storage.onChanged.removeListener(onChange)
    }
  }, [])

  const usage = mergeUsage(sidePanelUsage, csUsage)
  const totalTokens = usage.totalPromptTokens + usage.totalCompletionTokens
  const costDisplay = gbpRate === null
    ? `$${usage.totalCostUsd.toFixed(4)}`
    : `£${(usage.totalCostUsd * gbpRate).toFixed(4)}`

  const handleClear = () => {
    clearUsage()
    chrome.storage.local.remove(CS_USAGE_KEY)
    setSidePanelUsage(EMPTY)
    setCsUsage(EMPTY)
    toast.success('Usage stats cleared')
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#f0f4f8' }}>
      <div className="bg-white px-4 pt-4 pb-3 border-b border-slate-100">
        <h1 className="text-base font-semibold text-slate-900">Features</h1>
        <p className="text-xs text-slate-400">Tools & settings</p>
      </div>

      <div className="p-3 space-y-2">
        {/* API Settings */}
        <button
          onClick={onOpenSettings}
          className="w-full bg-white rounded-xl p-3.5 shadow-sm border border-slate-100 flex items-center gap-3 hover:border-blue-200 hover:shadow-md transition-all text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <Key className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">API Key Settings</p>
            <p className="text-xs text-slate-400">Configure your DigitalOcean AI key</p>
          </div>
          <Settings className="w-4 h-4 text-slate-300 ml-auto" />
        </button>

        {/* Live usage card */}
        <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <Coins className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">Live Token Usage</p>
              <p className="text-xs text-slate-400">Side panel + browser chat input</p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-500 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          {usage.callCount === 0 ? (
            <p className="text-xs text-slate-400 italic">No API calls yet — use Enhance, Craft, or the browser toolbar to start tracking.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-slate-800 tabular-nums">{usage.callCount}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">API calls</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-slate-800 tabular-nums">
                  {totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Tokens</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-emerald-700 tabular-nums">{costDisplay}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Est. cost</p>
              </div>
            </div>
          )}
        </div>

        {/* AI Enhancement info */}
        <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">AI Enhancement</p>
              <p className="text-xs text-slate-400">Improve any prompt with AI</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Open any saved prompt and tap <strong>Enhance</strong> to get an AI-powered
            rewrite with structured sections, camera physics, and mode-specific schemas.
          </p>
        </div>

        {/* Optimizer info */}
        <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <BarChart2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Prompt Optimiser</p>
              <p className="text-xs text-slate-400">Score & improve prompt quality</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Tap <strong>Optimise</strong> on any prompt to get clarity, specificity,
            structure, completeness, and effectiveness scores with actionable improvements.
          </p>
        </div>

        {/* About */}
        <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <Info className="w-4 h-4 text-slate-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Nexus</p>
            <p className="text-xs text-slate-400">v1.0.0 · Powered by DigitalOcean AI</p>
          </div>
        </div>
      </div>
    </div>
  )
}
