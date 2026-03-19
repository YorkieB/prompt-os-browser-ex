import { useState, useCallback } from 'react'
import { Lightbulb, Smartphone, Stethoscope } from 'lucide-react'

interface DiagnosticIssue {
  severity: 'error' | 'warning' | 'info'
  title: string
  detail: string
  fix: string
}

interface DiagResult {
  timestamp: number
  issues: DiagnosticIssue[]
  panelChecks: DiagnosticIssue[]
}

const SEVERITY_DOT_BG: Record<string, string> = {
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
}

const SEVERITY_CLASS: Record<string, string> = {
  error: 'bg-red-50 border border-red-200',
  warning: 'bg-amber-50 border border-amber-200',
  info: 'bg-blue-50 border border-blue-200',
}
function severityClass(severity: string): string {
  return SEVERITY_CLASS[severity] ?? SEVERITY_CLASS.info
}

function runPanelChecks(): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = []
  const nav = document.querySelector('nav')
  if (nav) {
    const buttons = nav.querySelectorAll('button')
    const expectedTabs = ['Saved', 'Craft', 'Export', 'Research', 'Plan', 'Contract', 'Diagnostics', 'Features']
    const foundLabels = Array.from(buttons).map(b => b.textContent?.trim() ?? '')
    for (const tab of expectedTabs) {
      if (foundLabels.some(l => l.includes(tab))) {
        issues.push({ severity: 'info', title: `[Panel] Tab "${tab}" present`, detail: `Found in bottom navigation.`, fix: 'No action needed.' })
      } else {
        issues.push({ severity: 'warning', title: `[Panel] Tab "${tab}" not found`, detail: `Expected a "${tab}" button in the bottom nav.`, fix: 'The tab may not have been added yet.' })
      }
    }
  } else {
    issues.push({ severity: 'error', title: '[Panel] No navigation found', detail: 'Could not find a <nav> element.', fix: 'The side panel may not have rendered correctly.' })
  }

  const overflow = document.querySelector('.overflow-hidden')
  if (overflow) {
    issues.push({ severity: 'info', title: '[Panel] Main content container present', detail: 'The side panel layout is rendering.', fix: 'No action needed.' })
  } else {
    issues.push({ severity: 'warning', title: '[Panel] Main content container missing', detail: 'Could not find the expected layout container.', fix: 'Check that App.tsx renders correctly.' })
  }

  return issues
}

export function DiagnosticsTab() {
  const [result, setResult] = useState<DiagResult | null>(null)
  const [running, setRunning] = useState(false)
  const [panelRunning, setPanelRunning] = useState(false)

  const handleRunContentDiagnostics = useCallback(async () => {
    setRunning(true)
    try {
      await chrome.runtime.sendMessage({ type: 'RUN_SELF_DIAGNOSTICS' })
      setResult(prev => ({
        timestamp: Date.now(),
        issues: prev?.issues ?? [],
        panelChecks: prev?.panelChecks ?? [],
      }))
    } catch {
      setResult({
        timestamp: Date.now(),
        issues: [{ severity: 'error', title: 'Communication failed', detail: 'Could not reach the content script.', fix: 'Make sure you are on a web page with the content script injected.' }],
        panelChecks: [],
      })
    } finally {
      setRunning(false)
    }
  }, [])

  const handleRunPanelCheck = useCallback(() => {
    setPanelRunning(true)
    const checks = runPanelChecks()
    setResult(prev => ({
      timestamp: Date.now(),
      issues: prev?.issues ?? [],
      panelChecks: checks,
    }))
    setPanelRunning(false)
  }, [])

  const handleRunAll = useCallback(async () => {
    setRunning(true)
    setPanelRunning(true)
    const panelChecks = runPanelChecks()
    try {
      await chrome.runtime.sendMessage({ type: 'RUN_SELF_DIAGNOSTICS' })
    } catch { /* handled by content script sidebar */ }
    setResult({
      timestamp: Date.now(),
      issues: [],
      panelChecks,
    })
    setRunning(false)
    setPanelRunning(false)
  }, [])

  const allChecks = [...(result?.issues ?? []), ...(result?.panelChecks ?? [])]
  const errors = allChecks.filter(i => i.severity === 'error').length
  const warnings = allChecks.filter(i => i.severity === 'warning').length
  const passed = allChecks.filter(i => i.severity === 'info').length

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 bg-white">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Stethoscope className="h-5 w-5 shrink-0 text-slate-700" aria-hidden />
          Self-Diagnostics
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {'Check the extension\u2019s own components for issues'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleRunAll}
            disabled={running || panelRunning}
            className="flex-1 h-10 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {running ? 'Running…' : 'Run Full Check'}
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRunContentDiagnostics}
            disabled={running}
            className="flex-1 h-9 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 disabled:opacity-50 transition-colors"
          >
            Content Script Only
          </button>
          <button
            onClick={handleRunPanelCheck}
            disabled={panelRunning}
            className="flex-1 h-9 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 disabled:opacity-50 transition-colors"
          >
            Panel Check Only
          </button>
        </div>

        {/* Results */}
        {result && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="text-center p-3 rounded-lg bg-emerald-50 text-emerald-700">
                <div className="text-lg font-bold">{passed}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide">Passed</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-50 text-amber-700">
                <div className="text-lg font-bold">{warnings}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide">Warnings</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50 text-red-700">
                <div className="text-lg font-bold">{errors}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide">Errors</div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 text-right">
              Last run: {new Date(result.timestamp).toLocaleTimeString()}
            </p>

            {/* Panel checks */}
            {result.panelChecks.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Side Panel
                </h3>
                <div className="space-y-1.5">
                  {result.panelChecks.map((check, idx) => (
                    <div
                      key={`panel-${check.title}-${idx}`}
                      className={`p-2.5 rounded-lg text-xs leading-relaxed ${severityClass(check.severity)}`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT_BG[check.severity] ?? SEVERITY_DOT_BG.info}`}
                          aria-hidden
                        />
                        {check.title.replace(/^\[[^\]]+\]\s*/, '')}
                      </div>
                      <div className="text-slate-600 mt-0.5">{check.detail}</div>
                      {check.severity !== 'info' && (
                        <div className="text-slate-500 italic mt-0.5 flex items-start gap-1">
                          <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
                          {check.fix}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content script diagnostics note */}
            <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-700">
              <strong className="inline-flex items-center gap-1">
                <Lightbulb className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Content Script Results
              </strong>
              <p className="mt-1">
                {
                  'Content script diagnostics are displayed in the page\u2019s diagnostic sidebar overlay. Click "Content Script Only" or "Run Full Check" while on a page with the content script active.'
                }
              </p>
            </div>
          </>
        )}

        {!result && (
          <div className="text-center py-12 text-slate-400">
            <div className="flex justify-center mb-3 opacity-60">
              <Stethoscope className="h-14 w-14" aria-hidden />
            </div>
            <p className="text-sm">Run a self-check to diagnose the extension</p>
            <p className="text-xs mt-1">Checks toolbar, annotation bar, modal, runtime health, and side panel</p>
          </div>
        )}
      </div>
    </div>
  )
}
