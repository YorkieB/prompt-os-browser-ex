import { useMemo } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { InstructionalContractSchema } from '@/lib/promptOs/types'

function stringInputKeys(list: readonly unknown[]): string[] {
  return list.filter((k): k is string => typeof k === 'string' && k.trim() !== '')
}

function formatInputKeyLabel(key: string): string {
  return key
    .replaceAll('_', ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
}

export interface PromptOsFormGeneratorProps {
  readonly schema: InstructionalContractSchema
  readonly values: Record<string, string>
  readonly onChange: (key: string, value: string) => void
  /** Prefix for stable `id` / `htmlFor` when multiple generators exist on a page */
  readonly idPrefix?: string
  readonly className?: string
}

/**
 * Renders text inputs for `schema.inputs.required` and `schema.inputs.optional` (string keys only).
 */
export function FormGenerator({
  schema,
  values,
  onChange,
  idPrefix = 'prompt-os-form',
  className,
}: PromptOsFormGeneratorProps) {
  const requiredKeys = useMemo(
    () => stringInputKeys(schema.inputs.required),
    [schema.inputs.required]
  )
  const optionalKeys = useMemo(
    () => stringInputKeys(schema.inputs.optional),
    [schema.inputs.optional]
  )

  if (requiredKeys.length === 0 && optionalKeys.length === 0) {
    return null
  }

  return (
    <div className={className}>
      <h3 className="text-xs font-semibold text-slate-800 mb-2">Inputs</h3>

      {requiredKeys.length > 0 ? (
        <div className="space-y-3 mb-4">
          <p className="text-xs font-medium text-slate-700">Required</p>
          {requiredKeys.map((key) => {
            const inputId = `${idPrefix}-req-${key}`
            return (
              <div key={key} className="space-y-1">
                <Label htmlFor={inputId}>
                  {formatInputKeyLabel(key)}
                  <span className="text-destructive" aria-hidden>
                    {' '}
                    *
                  </span>
                </Label>
                <Input
                  id={inputId}
                  value={values[key] ?? ''}
                  onChange={(ev) => onChange(key, ev.target.value)}
                  placeholder={key}
                  className="bg-white"
                  aria-required
                />
              </div>
            )
          })}
        </div>
      ) : null}

      {optionalKeys.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-600">Optional</p>
          {optionalKeys.map((key) => {
            const inputId = `${idPrefix}-opt-${key}`
            return (
              <div key={key} className="space-y-1">
                <Label htmlFor={inputId}>{formatInputKeyLabel(key)}</Label>
                <Input
                  id={inputId}
                  value={values[key] ?? ''}
                  onChange={(ev) => onChange(key, ev.target.value)}
                  placeholder={`Optional — ${key}`}
                  className="bg-white"
                />
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
