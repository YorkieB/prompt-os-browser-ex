import { useCallback, useEffect, useState } from 'react'
import {
  ListTodo,
  Loader2,
  Copy,
  FileDown,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { callLLM, hasApiKey } from '@/lib/llm'
import {
  type PlanningDocument,
  type PlanningPhase,
  type PlanningTask,
  type PlanningSubtask,
  parsePlanningDocument,
} from '@/lib/planningSchema'
import {
  PLANNING_SKILLS,
  type PlanningSkillId,
  type PlanningGranularity,
  buildPlanningGeneratePrompt,
  buildPlanningRevisionPrompt,
} from '@/lib/planningPrompts'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

/** Skills shown A→Z by label in the dropdown (canonical order stays in `planningPrompts`). */
const PLANNING_SKILLS_SORTED = [...PLANNING_SKILLS].sort((a, b) =>
  a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
)

const STORAGE_KEY = 'prompt-os-planning-library'

export interface SavedPlanEntry {
  id: string
  title: string
  skillId: PlanningSkillId
  granularity: PlanningGranularity
  document: PlanningDocument
  savedAt: number
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function hasEstimateMinutes(st: PlanningSubtask): boolean {
  return typeof st.estimateMinutes === 'number' && !Number.isNaN(st.estimateMinutes)
}

function formatSubtaskText(st: PlanningSubtask): string[] {
  const est = hasEstimateMinutes(st) ? ` (~${st.estimateMinutes}m)` : ''
  const tags = st.skillTags?.length ? ` [${st.skillTags.join(', ')}]` : ''
  const lines = [`    • ${st.title}${est}${tags}`]
  if (st.description) lines.push(`      ${st.description}`)
  return lines
}

function formatTaskText(task: PlanningTask, pi: number, ti: number): string[] {
  const pri = task.priority ? ` [${task.priority}]` : ''
  const lines = [`  ${pi + 1}.${ti + 1} ${task.title}${pri}`]
  if (task.rationale) lines.push(`      Why: ${task.rationale}`)
  for (const st of task.subtasks) lines.push(...formatSubtaskText(st))
  lines.push('')
  return lines
}

function formatPhaseText(phase: PlanningPhase, pi: number): string[] {
  const goalSuffix = phase.goal ? ` — ${phase.goal}` : ''
  const lines = [`Phase ${pi + 1}: ${phase.name}${goalSuffix}`, '-'.repeat(40)]
  for (let ti = 0; ti < phase.tasks.length; ti++) {
    lines.push(...formatTaskText(phase.tasks[ti], pi, ti))
  }
  return lines
}

function formatPlanAsText(doc: PlanningDocument): string {
  const blocks: string[][] = [
    [doc.title, '='.repeat(Math.min(doc.title.length, 60)), ''],
    [`Summary: ${doc.summary}`, `Goal: ${doc.goal}`, '', 'Success criteria:'],
    doc.successCriteria.map((c, i) => `  ${i + 1}. ${c}`),
  ]

  if (doc.assumptions?.length) {
    blocks.push(['', 'Assumptions:', ...doc.assumptions.map((a, i) => `  ${i + 1}. ${a}`)])
  }

  if (doc.risks?.length) {
    blocks.push([
      '', 'Risks:',
      ...doc.risks.map((r, i) => {
        const mit = r.mitigation ? ` — Mitigation: ${r.mitigation}` : ''
        return `  ${i + 1}. ${r.risk}${mit}`
      }),
    ])
  }

  blocks.push([''])
  for (let pi = 0; pi < doc.phases.length; pi++) {
    blocks.push(formatPhaseText(doc.phases[pi], pi))
  }

  if (doc.nextInstructionsSlot) {
    blocks.push(['—', `Follow-up slot: ${doc.nextInstructionsSlot}`])
  }

  blocks.push(['', '(JSON schema: planning v1 — paste new instructions in Nexus Planning Suite to merge.)'])

  return blocks.flat().join('\n')
}

function pdfRiskLine(r: { risk: string; mitigation?: string }): string {
  const mit = r.mitigation ? ` — <em>${escapeHtml(r.mitigation)}</em>` : ''
  return `<li>${escapeHtml(r.risk)}${mit}</li>`
}

function pdfSubtaskLines(st: PlanningSubtask): string {
  const minutes = hasEstimateMinutes(st) ? st.estimateMinutes : undefined
  const est = minutes === undefined ? '' : ` <span class="est">~${minutes}m</span>`
  const desc = st.description ? `<br/><span class="desc">${escapeHtml(st.description)}</span>` : ''
  const tags =
    st.skillTags?.length ? `<br/><span class="tags">${escapeHtml(st.skillTags.join(', '))}</span>` : ''
  return `<li><strong>${escapeHtml(st.title)}</strong>${est}${desc}${tags}</li>`
}

function buildPlanPdfBody(doc: PlanningDocument, skillLabel: string): string {
  const dateStr = escapeHtml(new Date().toLocaleDateString('en-GB'))
  const skillEsc = escapeHtml(skillLabel)
  const chunks: string[] = [
    `<h1>${escapeHtml(doc.title)}</h1>`,
    `<div class="meta">${skillEsc} · ${dateStr} · Nexus Planning Suite</div>`,
    `<p><strong>Summary</strong><br/>${escapeHtml(doc.summary)}</p>`,
    `<p><strong>Goal</strong><br/>${escapeHtml(doc.goal)}</p>`,
    '<h2>Success criteria</h2><ol>',
    ...doc.successCriteria.map((c) => `<li>${escapeHtml(c)}</li>`),
    '</ol>',
  ]

  if (doc.assumptions?.length) {
    chunks.push('<h2>Assumptions</h2><ul>', ...doc.assumptions.map((a) => `<li>${escapeHtml(a)}</li>`), '</ul>')
  }

  if (doc.risks?.length) {
    chunks.push('<h2>Risks</h2><ul>', ...doc.risks.map(pdfRiskLine), '</ul>')
  }

  for (let pi = 0; pi < doc.phases.length; pi++) {
    const phase = doc.phases[pi]
    chunks.push(`<h2>Phase ${pi + 1}: ${escapeHtml(phase.name)}</h2>`)
    if (phase.goal) {
      chunks.push(`<p class="phase-goal">${escapeHtml(phase.goal)}</p>`)
    }
    for (let ti = 0; ti < phase.tasks.length; ti++) {
      const task = phase.tasks[ti]
      const pri = task.priority ? ` <span class="pri">${escapeHtml(task.priority)}</span>` : ''
      chunks.push(`<h3>${pi + 1}.${ti + 1} ${escapeHtml(task.title)}${pri}</h3>`)
      if (task.rationale) {
        chunks.push(`<p class="rationale">${escapeHtml(task.rationale)}</p>`)
      }
      chunks.push('<ul class="subs">', ...task.subtasks.map(pdfSubtaskLines), '</ul>')
    }
  }

  if (doc.nextInstructionsSlot) {
    chunks.push(`<h2>Follow-up instructions</h2><p>${escapeHtml(doc.nextInstructionsSlot)}</p>`)
  }

  return chunks.join('\n')
}

function openPlanAsPdf(doc: PlanningDocument, skillLabel: string) {
  const bodyInner = buildPlanPdfBody(doc, skillLabel)
  const printScript = '<script>window.onload=function(){window.print();}</script>'
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${escapeHtml(doc.title)}</title>
<style>
  body { font-family: system-ui, Segoe UI, sans-serif; max-width: 820px; margin: 36px auto; padding: 0 28px; color: #0f172a; line-height: 1.55; font-size: 13px; }
  h1 { font-size: 22px; color: #1e1b4b; margin-bottom: 6px; }
  h2 { font-size: 15px; color: #4c1d95; margin-top: 26px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  h3 { font-size: 13px; color: #334155; margin-top: 14px; margin-bottom: 6px; }
  .meta { font-size: 11px; color: #64748b; margin-bottom: 20px; }
  .phase-goal { color: #475569; font-size: 12px; margin-top: -4px; }
  .rationale { color: #64748b; font-size: 11px; margin: 4px 0 8px; }
  ul.subs { margin: 6px 0 12px 18px; }
  ul.subs li { margin: 6px 0; }
  .est { color: #6366f1; font-size: 11px; }
  .desc { color: #475569; font-size: 11px; }
  .tags { color: #0d9488; font-size: 10px; }
  .pri { display: inline-block; background: #eef2ff; color: #4338ca; padding: 1px 6px; border-radius: 4px; font-size: 10px; }
  @media print { body { margin: 16px; } }
</style></head><body>
${bodyInner}
${printScript}
</body></html>`

  const blob = new Blob([html], { type: 'text/html' })
  window.open(URL.createObjectURL(blob), '_blank')
}

function saveLibrary(entries: SavedPlanEntry[]) {
  const sliced = entries.slice(0, 40)
  try {
    chrome.storage.local.set({ [STORAGE_KEY]: sliced })
  } catch {
    /* outside extension */
  }
}

function TaskBlock({ task, phaseIndex, taskIndex }: Readonly<{ task: PlanningTask; phaseIndex: number; taskIndex: number }>) {
  const [open, setOpen] = useState(true)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-left py-1.5 rounded-lg hover:bg-slate-50 px-1 -mx-1">
        {open ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" /> : <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />}
        <span className="text-xs font-semibold text-slate-800">
          {phaseIndex + 1}.{taskIndex + 1} {task.title}
        </span>
        {task.priority && (
          <Badge variant="secondary" className="text-[10px] h-5">
            {task.priority}
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        {task.rationale && <p className="text-[11px] text-slate-500 pl-6 mb-1">{task.rationale}</p>}
        <ul className="pl-6 space-y-1.5 mb-3 border-l-2 border-violet-100 ml-2">
          {task.subtasks.map((st) => (
            <li key={st.id} className="text-xs text-slate-700">
              <span className="font-medium text-slate-800">{st.title}</span>
              {hasEstimateMinutes(st) ? (
                <span className="text-violet-600 ml-1">~{st.estimateMinutes}m</span>
              ) : null}
              {st.skillTags?.length ? (
                <span className="text-emerald-600 ml-1 text-[10px]">({st.skillTags.join(', ')})</span>
              ) : null}
              {st.description && <p className="text-[11px] text-slate-500 mt-0.5">{st.description}</p>}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function PlanningSuiteTab() {
  const [goal, setGoal] = useState('')
  const [extra, setExtra] = useState('')
  const [skillId, setSkillId] = useState<PlanningSkillId>('project')
  const [granularity, setGranularity] = useState<PlanningGranularity>('micro')
  const [loading, setLoading] = useState(false)
  const [revLoading, setRevLoading] = useState(false)
  const [error, setError] = useState('')
  const [doc, setDoc] = useState<PlanningDocument | null>(null)
  const [revision, setRevision] = useState('')
  const [library, setLibrary] = useState<SavedPlanEntry[]>([])
  const [search, setSearch] = useState('')
  const [composerOpen, setComposerOpen] = useState(true)

  const loadLibrary = useCallback(() => {
    try {
      chrome.storage.local.get(STORAGE_KEY, (stored) => {
        setLibrary((stored[STORAGE_KEY] as SavedPlanEntry[]) || [])
      })
    } catch {
      setLibrary([])
    }
  }, [])

  useEffect(() => {
    loadLibrary()
    try {
      const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
        if (changes[STORAGE_KEY]) setLibrary((changes[STORAGE_KEY].newValue ?? []) as SavedPlanEntry[])
      }
      chrome.storage.onChanged.addListener(handler)
      return () => chrome.storage.onChanged.removeListener(handler)
    } catch {
      return undefined
    }
  }, [loadLibrary])

  const skillLabel = PLANNING_SKILLS.find((s) => s.id === skillId)?.label ?? 'Planning'

  const handleGenerate = async () => {
    if (!goal.trim()) return
    if (!hasApiKey()) {
      setError('No API key — open Features → API Key Settings.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const prompt = buildPlanningGeneratePrompt({
        goal: goal.trim(),
        skillId,
        granularity,
        extraInstructions: extra.trim() || undefined,
      })
      const raw = await callLLM(prompt, true, { maxCompletionTokens: 8192 })
      const parsed = parsePlanningDocument(raw)
      setDoc(parsed)
      toast.success('Plan generated')
    } catch (e) {
      const msg = (e as Error).message
      setError(msg)
      toast.error('Could not parse plan — try a smaller goal or another model')
    } finally {
      setLoading(false)
    }
  }

  const handleRevision = async () => {
    if (!doc || !revision.trim()) return
    if (!hasApiKey()) {
      setError('No API key — open Features → API Key Settings.')
      return
    }
    setRevLoading(true)
    setError('')
    try {
      const prompt = buildPlanningRevisionPrompt(doc, revision.trim())
      const raw = await callLLM(prompt, true, { maxCompletionTokens: 8192 })
      const parsed = parsePlanningDocument(raw)
      setDoc(parsed)
      setRevision('')
      toast.success('Plan updated')
    } catch (e) {
      setError((e as Error).message)
      toast.error('Revision failed — check JSON or shorten instructions')
    } finally {
      setRevLoading(false)
    }
  }

  const copyJson = () => {
    if (!doc) return
    navigator.clipboard.writeText(JSON.stringify(doc, null, 2)).catch(() => { /* ignore */ })
    toast.success('JSON copied')
  }

  const copyText = () => {
    if (!doc) return
    navigator.clipboard.writeText(formatPlanAsText(doc)).catch(() => { /* ignore */ })
    toast.success('Outline copied')
  }

  const saveToLibrary = () => {
    if (!doc) return
    const entry: SavedPlanEntry = {
      id: `plan-${Date.now()}`,
      title: doc.title,
      skillId,
      granularity,
      document: doc,
      savedAt: Date.now(),
    }
    const next = [entry, ...library].slice(0, 40)
    setLibrary(next)
    saveLibrary(next)
    toast.success('Saved to library')
  }

  const loadEntry = (e: SavedPlanEntry) => {
    setDoc(e.document)
    setSkillId(e.skillId)
    setGranularity(e.granularity)
    toast.success('Loaded plan')
  }

  const deleteEntry = (id: string) => {
    const next = library.filter((e) => e.id !== id)
    setLibrary(next)
    saveLibrary(next)
    toast.success('Removed')
  }

  const filteredLib = search
    ? library.filter(
        (e) =>
          e.title.toLowerCase().includes(search.toLowerCase()) ||
          e.document.goal.toLowerCase().includes(search.toLowerCase())
      )
    : library

  return (
    <div className="flex flex-col h-full bg-slate-100">
      <div className="bg-white px-4 pt-4 pb-3 border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-violet-600" />
            Planning Suite
          </h1>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setComposerOpen((v) => !v)}
          >
            {composerOpen ? 'Hide composer' : 'New plan'}
          </Button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Task breakdown with micro-steps, skill-styled dialogue, JSON schema, PDF &amp; copy.
        </p>

        {composerOpen && (
          <Card className="border-slate-200 shadow-sm mb-3 min-w-0">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                Generate plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 min-w-0 overflow-x-hidden">
              <div>
                <Label htmlFor="plan-goal" className="text-xs text-slate-600">
                  Goal / outcome
                </Label>
                <Textarea
                  id="plan-goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Ship v2 of the checkout flow with A/B test and rollback plan…"
                  rows={3}
                  className="mt-1 text-sm resize-none"
                />
              </div>
              <div>
                <Label htmlFor="plan-extra" className="text-xs text-slate-600">
                  Extra constraints (optional)
                </Label>
                <Textarea
                  id="plan-extra"
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder="Deadlines, people, tools, non-goals…"
                  rows={2}
                  className="mt-1 text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 min-w-0 mb-3 [grid-template-columns:minmax(0,1fr)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <Label className="text-xs text-slate-600">Planning skill</Label>
                  <Select value={skillId} onValueChange={(v) => setSkillId(v as PlanningSkillId)}>
                    <SelectTrigger className="mt-1 h-9 text-xs !w-full min-w-0 overflow-hidden">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="top"
                      align="start"
                      sideOffset={6}
                      collisionPadding={16}
                      className="max-h-52"
                    >
                      {PLANNING_SKILLS_SORTED.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <Label className="text-xs text-slate-600">Granularity</Label>
                  <Select
                    value={granularity}
                    onValueChange={(v) => setGranularity(v as PlanningGranularity)}
                  >
                    <SelectTrigger className="mt-1 h-9 text-xs !w-full min-w-0 overflow-hidden">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      side="top"
                      align="start"
                      sideOffset={6}
                      collisionPadding={16}
                      className="max-h-52"
                    >
                      <SelectItem value="micro" className="text-xs">
                        Micro-manage (5–25 min steps)
                      </SelectItem>
                      <SelectItem value="standard" className="text-xs">
                        Standard (2–6 subtasks / task)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 rounded-md px-2 py-1.5">{error}</p>}
              <Button
                className="w-full bg-violet-600 hover:bg-violet-700"
                disabled={loading || !goal.trim()}
                onClick={() => void handleGenerate()}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate task plan
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search saved plans…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-100 rounded-lg border-0 outline-none focus:ring-2 focus:ring-violet-200 placeholder-slate-400"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-3 space-y-3 pb-24">
          {doc && (
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-100">
                <div className="flex flex-col gap-2">
                  <CardTitle className="text-sm leading-snug">{doc.title}</CardTitle>
                  <p className="text-xs text-slate-600 font-normal">{doc.summary}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={copyText}>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy outline
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={copyJson}>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy JSON
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => openPlanAsPdf(doc, skillLabel)}
                    >
                      <FileDown className="w-3 h-3 mr-1" />
                      PDF
                    </Button>
                    <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={saveToLibrary}>
                      <Plus className="w-3 h-3 mr-1" />
                      Save to library
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 py-3 space-y-3">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Goal</h4>
                  <p className="text-xs text-slate-800">{doc.goal}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Success criteria
                  </h4>
                  <ul className="list-decimal list-inside text-xs text-slate-700 space-y-0.5">
                    {doc.successCriteria.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
                {doc.phases.map((phase, pi) => (
                  <div key={phase.id} className="rounded-xl border border-slate-100 bg-white p-3">
                    <h4 className="text-sm font-semibold text-violet-900">
                      {pi + 1}. {phase.name}
                    </h4>
                    {phase.goal && <p className="text-[11px] text-slate-500 mt-0.5 mb-2">{phase.goal}</p>}
                    <div className="space-y-1">
                      {phase.tasks.map((task, ti) => (
                        <TaskBlock key={task.id} task={task} phaseIndex={pi} taskIndex={ti} />
                      ))}
                    </div>
                  </div>
                ))}
                {doc.nextInstructionsSlot && (
                  <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-950">
                    <strong className="block text-[10px] uppercase text-amber-800 mb-1">
                      Schema slot — new instructions
                    </strong>
                    {doc.nextInstructionsSlot}
                  </div>
                )}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <Label className="text-xs text-slate-600">Merge new instructions into this plan</Label>
                  <Textarea
                    value={revision}
                    onChange={(e) => setRevision(e.target.value)}
                    placeholder="e.g. Move analytics to phase 2; add a legal review gate; split deployment into canary then full…"
                    rows={3}
                    className="text-sm resize-none"
                  />
                  <Button
                    className="w-full bg-slate-800 hover:bg-slate-900"
                    disabled={revLoading || !revision.trim()}
                    onClick={() => void handleRevision()}
                  >
                    {revLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Merging…
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Apply revision (JSON)
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {filteredLib.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
                Library
              </h3>
              <div className="space-y-2">
                {filteredLib.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-start gap-2 bg-white rounded-xl border border-slate-200 p-3 shadow-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{e.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {PLANNING_SKILLS.find((s) => s.id === e.skillId)?.shortLabel ?? e.skillId} ·{' '}
                        {new Date(e.savedAt).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 text-xs shrink-0" onClick={() => loadEntry(e)}>
                      Load
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                      onClick={() => deleteEntry(e.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!doc && filteredLib.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 px-4 text-center">
              <ListTodo className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm font-medium text-slate-500">No plan yet</p>
              <p className="text-xs mt-1 text-slate-400 max-w-xs">
                Describe your goal, pick a planning skill, and generate a structured task list with micro-tasks.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
