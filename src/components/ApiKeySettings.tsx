import { useState, useEffect } from 'react'
import {
  getApiKey,
  setApiKey,
  getModel,
  setModel as persistModel,
  DO_MODELS,
  DEFAULT_MODEL,
  getUsage,
  clearUsage,
} from '@/lib/llm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Eye, EyeOff, RotateCcw } from 'lucide-react'
import type { ModelTier, UsageRecord } from '@/lib/llm'

const GBP_RATE_KEY = 'gbp-rate-cache'
const GBP_RATE_TTL = 60 * 60 * 1000 // 1 hour

async function fetchGbpRate(): Promise<number> {
  const cached = localStorage.getItem(GBP_RATE_KEY)
  if (cached) {
    const { rate, ts } = JSON.parse(cached)
    if (Date.now() - ts < GBP_RATE_TTL) return rate as number
  }
  const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=GBP')
  const data = await res.json()
  const rate = data.rates.GBP as number
  localStorage.setItem(GBP_RATE_KEY, JSON.stringify({ rate, ts: Date.now() }))
  return rate
}

function TierBadge({ tier }: { readonly tier: ModelTier }) {
  const styles: Record<ModelTier, string> = {
    budget:   'bg-emerald-100 text-emerald-700',
    standard: 'bg-blue-100 text-blue-700',
    premium:  'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${styles[tier]}`}>
      {tier}
    </span>
  )
}

interface ApiKeySettingsProps {
  open: boolean
  onClose: () => void
}

export function ApiKeySettings({ open, onClose }: Readonly<ApiKeySettingsProps>) {
  const [key, setKey] = useState(() => getApiKey())
  const [model, setModel] = useState(() => getModel() || DEFAULT_MODEL)
  const [showKey, setShowKey] = useState(false)
  const [gbpRate, setGbpRate] = useState<number | null>(null)
  const [usage, setUsage] = useState<UsageRecord>(() => getUsage())

  // Fetch GBP rate once on mount
  useEffect(() => {
    fetchGbpRate().then(setGbpRate).catch(() => {})
  }, [])

  // Poll usage every 3 s while dialog is open
  useEffect(() => {
    if (!open) return
    setUsage(getUsage())
    const id = setInterval(() => setUsage(getUsage()), 3000)
    return () => clearInterval(id)
  }, [open])

  const handleSave = () => {
    const trimmed = key.trim()
    if (!trimmed) {
      toast.error('Please enter an API key')
      return
    }
    setApiKey(trimmed)
    persistModel(model)
    toast.success('Settings saved!')
    onClose()
  }

  const handleClearUsage = () => {
    clearUsage()
    setUsage(getUsage())
    toast.success('Usage stats cleared')
  }

  const totalTokens = usage.totalPromptTokens + usage.totalCompletionTokens
  const costDisplay = gbpRate === null
    ? `$${usage.totalCostUsd.toFixed(4)}`
    : `£${(usage.totalCostUsd * gbpRate).toFixed(4)}`

  const formatPrice = (priceUsd: number) =>
    gbpRate === null ? '…' : `£${(priceUsd * gbpRate).toFixed(2)}/M`

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your DigitalOcean Gradient AI credentials. Your key is stored locally in the
            browser only.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* API Key */}
          <div className="space-y-2">
            <label htmlFor="api-key-input" className="text-sm font-medium">Model Access Key</label>
            <div className="relative">
              <Input
                id="api-key-input"
                type={showKey ? 'text' : 'password'}
                placeholder="Your DigitalOcean model access key..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="pr-10"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Create a Model Access Key in the DigitalOcean Control Panel under{' '}
              <span className="font-mono">Gradient AI → Serverless Inference</span>
            </p>
          </div>

          {/* Model selector */}
          <div className="space-y-2">
            <label htmlFor="model-select" className="text-sm font-medium">Model</label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="model-select">
                <SelectValue placeholder="Select a model">
                  {(() => {
                    const m = DO_MODELS.find((m) => m.id === model)
                    if (!m) return null
                    return (
                      <span className="flex items-center gap-2">
                        {m.label}
                        <TierBadge tier={m.tier} />
                      </span>
                    )
                  })()}
                </SelectValue>
              </SelectTrigger>
              {/* Fixed-width dropdown so columns align */}
              <SelectContent className="w-[400px] max-h-72">
                {DO_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {/* 3-column grid: name | price (fixed right-aligned) | badge (fixed) */}
                    <span className="grid grid-cols-[1fr_72px_68px] items-center gap-1 w-full">
                      <span className="truncate">{m.label}</span>
                      <span className="text-xs text-muted-foreground text-right tabular-nums">
                        {formatPrice(m.priceUsd)}
                      </span>
                      <span className="flex justify-end">
                        <TierBadge tier={m.tier} />
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Live usage stats */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Live token usage</span>
              <button
                type="button"
                onClick={handleClearUsage}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">API calls</span>
              <span className="text-right font-mono font-medium">{usage.callCount}</span>
              <span className="text-muted-foreground">Tokens used</span>
              <span className="text-right font-mono font-medium">{totalTokens.toLocaleString()}</span>
              <span className="text-muted-foreground">Est. cost</span>
              <span className="text-right font-mono font-semibold text-emerald-600">{costDisplay}</span>
            </div>
            {usage.callCount === 0 && (
              <p className="text-[11px] text-muted-foreground italic">No usage recorded yet — make an API call to start tracking.</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
