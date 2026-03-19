import { cn } from '@/lib/utils'
import {
  type ExecutionStatus,
  EXECUTION_STATUS_MESSAGES,
} from '@/lib/promptOs/executionStatus'

export interface StatusIndicatorProps {
  readonly status: ExecutionStatus
  readonly className?: string
}

export function StatusIndicator({ status, className }: StatusIndicatorProps) {
  if (status === 'idle') {
    return null
  }

  const message = EXECUTION_STATUS_MESSAGES[status]
  if (!message) {
    return null
  }

  return (
    <div
      className={cn(
        'mt-1 rounded-md border px-2 py-1.5 text-[11px] leading-snug',
        status === 'error' &&
          'border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100',
        status === 'complete' &&
          'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100',
        status !== 'error' &&
          status !== 'complete' &&
          'border-blue-100 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-100',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span className="italic opacity-90">{message}</span>
    </div>
  )
}
