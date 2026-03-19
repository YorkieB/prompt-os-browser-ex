import { useCallback, useMemo, useState } from 'react'
import { ClipboardCopy, FileText, Send } from 'lucide-react'
import { toast } from 'sonner'

import { FormGenerator } from '@/components/promptOs/FormGenerator'
import { ExecutionTimeline } from '@/components/promptOs/ExecutionTimeline'
import { StatusIndicator } from '@/components/promptOs/StatusIndicator'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  buildInstructionalContract,
  CursorDispatchHttpError,
  CursorDispatchUnavailableError,
  executeInstructionalContract,
  executionStatusIsInFlight,
  HandshakeNotAcknowledgedError,
  loadSchema,
  MissingRequiredInputsError,
  listPromptOsSchemaCategories,
  PROMPT_OS_TEST_FIXTURES,
  getPromptOsTestFixture,
  type CursorDispatcher,
  type ExecutionStatus,
  type PromptOsSchemaCategory,
  type TimelineEntry,
  withTimelineDelta,
} from '@/lib/promptOs'

const EXAMPLE_NONE = '__none__'

export interface PromptOSPanelProps {
  /** Main heading (matches reference: “Nexus – Instructional Contract Builder”). */
  readonly title?: string
  readonly description?: React.ReactNode
  readonly showHeader?: boolean
  /** Sample payloads from `testFixtures.ts` */
  readonly showTestFixtures?: boolean
  readonly buildButtonLabel?: string
  readonly copyOnBuild?: boolean
  readonly className?: string
  /**
   * Two-message execution: build payload → POST to local Cursor bridge → handshake → “Go”.
   * Requires `VITE_PROMPT_OS_CURSOR_BRIDGE_URL`, `cursorBridgeBaseUrl`, or `cursorDispatcher`.
   */
  readonly showSendToCursor?: boolean
  readonly sendToCursorLabel?: string
  /** Overrides `VITE_PROMPT_OS_CURSOR_BRIDGE_URL` for HTTP bridge base URL. */
  readonly cursorBridgeBaseUrl?: string
  /** Custom transport (e.g. tests). Overrides `cursorBridgeBaseUrl`. */
  readonly cursorDispatcher?: CursorDispatcher
  /** Second user message sent after handshake (default: execute-under-contract line). */
  readonly goMessage?: string
  /** Compact log of execution status transitions for the current run. */
  readonly showExecutionActivityLog?: boolean
  /**
   * When the activity log is shown, allow a **total execution time** summary after a **successful** run
   * (`executionStatus === 'complete'`). Default true.
   */
  readonly showExecutionTimelineTotal?: boolean
}

const DEFAULT_TITLE = 'Nexus – instructional contract builder'

const DEFAULT_DESCRIPTION = (
  <>
    Choose a schema, fill required inputs, then build the contract for Cursor (payload +{' '}
    <code className="text-[10px] bg-slate-100 px-1 rounded"># USER REQUEST</code>).
  </>
)

function sendToCursorErrorMessage(error: unknown): string {
  if (error instanceof HandshakeNotAcknowledgedError) {
    return error.message
  }
  if (error instanceof CursorDispatchUnavailableError) {
    return error.message
  }
  if (error instanceof CursorDispatchHttpError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Send to Cursor failed'
}

/**
 * Main Nexus flow: category → `loadSchema` → {@link FormGenerator} → user request →
 * {@link buildInstructionalContract} / preview / clipboard.
 */
export function PromptOSPanel({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  showHeader = true,
  showTestFixtures = true,
  buildButtonLabel = 'Build & copy contract',
  copyOnBuild = true,
  className,
  showSendToCursor = true,
  sendToCursorLabel = 'Send to Cursor (2-step)',
  cursorBridgeBaseUrl,
  cursorDispatcher,
  goMessage,
  showExecutionActivityLog = true,
  showExecutionTimelineTotal = true,
}: PromptOSPanelProps) {
  const categories = useMemo(() => [...listPromptOsSchemaCategories()], [])
  const [category, setCategory] = useState<PromptOsSchemaCategory>('research')
  const schema = useMemo(() => loadSchema(category), [category])

  const [values, setValues] = useState<Record<string, string>>({})
  const [userRequest, setUserRequest] = useState('')
  const [output, setOutput] = useState('')
  const [cursorReply, setCursorReply] = useState('')
  const [selectedExampleId, setSelectedExampleId] = useState<string>(EXAMPLE_NONE)
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>('idle')
  const [executionTimeline, setExecutionTimeline] = useState<TimelineEntry[]>([])

  const runInFlight = executionStatusIsInFlight(executionStatus)

  const setPipelineStatus = useCallback((status: ExecutionStatus) => {
    setExecutionStatus(status)
  }, [])

  const appendTimeline = useCallback(
    (partial: Parameters<typeof withTimelineDelta>[1]) => {
      setExecutionTimeline((prev) => [...prev, withTimelineDelta(prev, partial)])
    },
    []
  )

  const setField = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleCategoryChange = useCallback(
    (value: string) => {
      if (!categories.includes(value as PromptOsSchemaCategory)) {
        return
      }
      setCategory(value as PromptOsSchemaCategory)
      setValues({})
      setOutput('')
      setCursorReply('')
      setExecutionStatus('idle')
      setExecutionTimeline([])
      setSelectedExampleId(EXAMPLE_NONE)
    },
    [categories]
  )

  const handleExampleChange = useCallback((id: string) => {
    if (id === EXAMPLE_NONE) {
      setSelectedExampleId(EXAMPLE_NONE)
      return
    }
    const fixture = getPromptOsTestFixture(id)
    if (!fixture) {
      setSelectedExampleId(EXAMPLE_NONE)
      return
    }
    setCategory(fixture.category)
    setValues({ ...fixture.userInputs })
    setUserRequest(fixture.userRequest)
    setOutput('')
    setCursorReply('')
    setExecutionStatus('idle')
    setExecutionTimeline([])
    setSelectedExampleId(fixture.id)
  }, [])

  const handleBuild = useCallback(() => {
    if (runInFlight) {
      return
    }
    const userInputs: Record<string, unknown> = { ...values }
    try {
      const payload = buildInstructionalContract(category, userInputs, userRequest)
      setOutput(payload)
      if (copyOnBuild) {
        navigator.clipboard
          .writeText(payload)
          .then(
            () => toast.success('Instructional contract copied to clipboard'),
            () => toast.error('Could not copy — copy from preview manually')
          )
          .catch(() => toast.error('Could not copy — copy from preview manually'))
      }
    } catch (e) {
      if (e instanceof MissingRequiredInputsError) {
        toast.error(e.message)
        return
      }
      throw e
    }
  }, [category, copyOnBuild, runInFlight, userRequest, values])

  const handleSendToCursor = useCallback(async () => {
    const userInputs: Record<string, unknown> = { ...values }
    setExecutionTimeline([])
    setCursorReply('')

    let payload: string
    try {
      setPipelineStatus('building')
      payload = buildInstructionalContract(category, userInputs, userRequest)
      setOutput(payload)
      appendTimeline({
        timestamp: Date.now(),
        message: 'Built instructional contract.',
        kind: 'building',
      })
    } catch (e) {
      setPipelineStatus('error')
      appendTimeline({
        timestamp: Date.now(),
        message: 'Could not build instructional contract (validation error).',
        kind: 'error',
      })
      if (e instanceof MissingRequiredInputsError) {
        toast.error(e.message)
        return
      }
      throw e
    }

    try {
      const { executionReply } = await executeInstructionalContract(payload, {
        dispatcher: cursorDispatcher,
        cursorBridgeBaseUrl,
        goMessage,
        setExecutionStatus: setPipelineStatus,
        addTimeline: appendTimeline,
      })
      setCursorReply(executionReply)
      const preview =
        executionReply.length > 480 ? `${executionReply.slice(0, 480)}…` : executionReply
      toast.success('Two-message Cursor run completed.', { description: preview })
    } catch (e) {
      toast.error(sendToCursorErrorMessage(e))
    }
  }, [
    appendTimeline,
    category,
    cursorBridgeBaseUrl,
    cursorDispatcher,
    goMessage,
    setPipelineStatus,
    userRequest,
    values,
  ])

  return (
    <div className={cn('flex flex-col h-full min-h-0 bg-slate-50', className)}>
      {showHeader ? (
        <div className="shrink-0 px-4 pt-4 pb-2 border-b border-slate-200 bg-white">
          <h2 className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <FileText className="w-4 h-4 text-blue-600 shrink-0" aria-hidden />
            {title}
          </h2>
          {description ? <p className="text-xs text-slate-500 mt-1">{description}</p> : null}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
        <div className="space-y-2">
          <Label htmlFor="prompt-os-panel-category">Schema category</Label>
          <Select value={category} onValueChange={handleCategoryChange}>
            <SelectTrigger id="prompt-os-panel-category" className="w-full bg-white">
              <SelectValue placeholder="Schema" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-slate-500">
            Active: <span className="font-mono">{schema.schema_id}</span>
          </p>
        </div>

        {showTestFixtures ? (
          <div className="space-y-2">
            <Label htmlFor="prompt-os-panel-example">Test payload (optional)</Label>
            <Select value={selectedExampleId} onValueChange={handleExampleChange}>
              <SelectTrigger id="prompt-os-panel-example" className="w-full bg-white">
                <SelectValue placeholder="Load sample…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EXAMPLE_NONE}>Custom (blank)</SelectItem>
                {PROMPT_OS_TEST_FIXTURES.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-500">
              Fills inputs + user request for manual Cursor checks. From{' '}
              <code className="text-[10px] bg-slate-100 px-1 rounded">testFixtures.ts</code> /{' '}
              <code className="text-[10px] bg-slate-100 px-1 rounded">payload-template.md</code>.
            </p>
          </div>
        ) : null}

        <FormGenerator
          schema={schema}
          values={values}
          onChange={setField}
          idPrefix="prompt-os-panel"
        />

        <div className="space-y-1">
          <Label htmlFor="prompt-os-panel-user-request">User request</Label>
          <Textarea
            id="prompt-os-panel-user-request"
            value={userRequest}
            onChange={(ev) => setUserRequest(ev.target.value)}
            placeholder="Describe what you want Cursor to do after it loads the contract…"
            rows={4}
            className="bg-white resize-y min-h-[88px] text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="w-full gap-2"
            onClick={handleBuild}
            disabled={runInFlight}
          >
            <ClipboardCopy className="w-4 h-4" />
            {buildButtonLabel}
          </Button>
          {showSendToCursor ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full gap-2"
              onClick={() => {
                handleSendToCursor().catch(() => {
                  /* Errors are toasted inside handleSendToCursor */
                })
              }}
              disabled={runInFlight}
            >
              <Send className="w-4 h-4" />
              {sendToCursorLabel}
            </Button>
          ) : null}
        </div>

        {showSendToCursor ? (
          <>
            <StatusIndicator status={executionStatus} />
            {showExecutionActivityLog ? (
              <ExecutionTimeline
                entries={executionTimeline}
                showExecutionSummary={showExecutionTimelineTotal}
                executionComplete={executionStatus === 'complete'}
              />
            ) : null}
          </>
        ) : null}

        {showSendToCursor ? (
          <p className="text-[11px] text-slate-500">
            <strong className="font-medium text-slate-600">Execution layer:</strong>{' '}
            requires a local bridge (see{' '}
            <code className="text-[10px] bg-slate-100 px-1 rounded">prompt-os/docs/cursor-bridge.md</code>
            ). Set{' '}
            <code className="text-[10px] bg-slate-100 px-1 rounded">VITE_PROMPT_OS_CURSOR_BRIDGE_URL</code>
            {' '}or run{' '}
            <code className="text-[10px] bg-slate-100 px-1 rounded">npm run bridge:mock</code>
            {' '}for a stub server.
          </p>
        ) : null}

        {output ? (
          <div className="space-y-1 pb-6">
            <Label htmlFor="prompt-os-panel-output">Generated payload</Label>
            <Textarea
              id="prompt-os-panel-output"
              readOnly
              value={output}
              rows={14}
              className="font-mono text-[11px] bg-white border-slate-200"
            />
          </div>
        ) : null}

        {showSendToCursor && cursorReply ? (
          <div className="space-y-1 pb-6">
            <Label htmlFor="prompt-os-panel-cursor-reply">Cursor reply (last run)</Label>
            <Textarea
              id="prompt-os-panel-cursor-reply"
              readOnly
              value={cursorReply}
              rows={12}
              className="font-mono text-[11px] bg-white border-slate-200"
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
