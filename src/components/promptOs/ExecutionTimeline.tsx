import { cn } from '@/lib/utils'
import {
  type TimelineEntry,
  type TimelineVisualKind,
  getTotalExecutionTime,
} from '@/lib/promptOs/timeline'

export interface ExecutionTimelineProps {
  readonly entries: readonly TimelineEntry[]
  readonly className?: string
  readonly maxVisible?: number
  readonly title?: string
  /** When true with {@link executionComplete}, show the total execution summary. Default true. */
  readonly showExecutionSummary?: boolean
  /** Successful end of the automated run — summary is hidden while in-flight or on error. */
  readonly executionComplete?: boolean
}

const KIND_TEXT: Record<TimelineVisualKind, string> = {
  building: 'text-blue-600 dark:text-blue-400',
  sending: 'text-violet-600 dark:text-violet-400',
  waiting: 'text-orange-600 dark:text-orange-400',
  complete: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-red-600 dark:text-red-400',
  neutral: 'text-slate-600 dark:text-slate-400',
}

const KIND_BORDER: Record<TimelineVisualKind, string> = {
  building: 'border-l-blue-500',
  sending: 'border-l-violet-500',
  waiting: 'border-l-orange-500',
  complete: 'border-l-emerald-500',
  error: 'border-l-red-500',
  neutral: 'border-l-slate-300 dark:border-l-slate-600',
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    return ''
  }
}

function formatElapsed(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * Compact vertical activity log (newest last), synchronized with {@link executeInstructionalContract}.
 */
export function ExecutionTimeline(props: ExecutionTimelineProps) {
  const {
    entries,
    className,
    maxVisible = 16,
    title = 'Activity',
    showExecutionSummary,
    executionComplete = false,
  } = props
  const visible = entries.slice(-maxVisible)

  if (visible.length === 0) {
    return null
  }

  const summaryEnabled = showExecutionSummary ?? true
  const totalMs =
    summaryEnabled && executionComplete ? getTotalExecutionTime(entries) : null

  return (
    <div
      className={cn(
        'rounded-md border border-slate-200 bg-white/80 px-2 py-1.5 text-[10px] dark:border-slate-700 dark:bg-slate-900/40',
        className
      )}
    >
      <div className="mb-1 font-medium uppercase tracking-wide text-slate-500">{title}</div>
      <ul className="max-h-36 space-y-1.5 overflow-y-auto leading-snug">
        {visible.map((entry, i) => {
          const kind = entry.kind ?? 'neutral'
          const elapsed =
            entry.elapsedMs === undefined ? '' : ` (${formatElapsed(entry.elapsedMs)})`

          return (
            <li
              key={`${entry.timestamp}-${i}`}
              className={cn(
                'border-l-2 pl-2',
                KIND_BORDER[kind],
                KIND_TEXT[kind]
              )}
            >
              <span className="mr-1 font-mono text-slate-500 dark:text-slate-500">
                {formatTime(entry.timestamp)}
              </span>
              <span>
                — {entry.message}
                {elapsed}
              </span>
            </li>
          )
        })}
      </ul>
      {totalMs === null ? null : (
        <div
          className="mt-1.5 border-t border-slate-200 pt-1 font-mono text-[10px] font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
          aria-label="Total execution time"
        >
          Total execution time: {(totalMs / 1000).toFixed(2)}s
        </div>
      )}
    </div>
  )
}

/** @deprecated Prefer {@link ExecutionTimeline} */
export const ExecutionActivityTimeline = ExecutionTimeline
