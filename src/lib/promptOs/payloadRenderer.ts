import Handlebars from 'handlebars'

import type { InstructionalContractSchema } from '@/lib/promptOs/types'

import templateSource from '../../../prompt-os/templates/payload-template.md?raw'

/**
 * Root context passed to Handlebars — `thinking` is flattened to `role` / `tone` / `audience` / `reasoning_style`.
 */
export interface InstructionalContractRenderContext {
  readonly schema_id: string
  readonly role: string
  readonly tone: string
  readonly audience: string
  readonly reasoning_style: readonly string[]
  readonly inputs: InstructionalContractSchema['inputs']
  /** Declarative keys with non-empty user-provided values (required + optional), schema order. */
  readonly input_values: readonly { readonly key: string; readonly yaml: string }[]
  readonly structure: InstructionalContractSchema['structure']
  readonly rules: InstructionalContractSchema['rules']
  readonly avoid: InstructionalContractSchema['avoid']
  readonly output_format: InstructionalContractSchema['output_format']
  readonly user_request: string
}

function stringInputKeysFromSchema(list: readonly unknown[]): string[] {
  return list.filter((k): k is string => typeof k === 'string' && k.trim() !== '')
}

function hasNonEmptyUserValue(userInputs: Record<string, unknown>, key: string): boolean {
  const value = userInputs[key]
  if (value === undefined || value === null) {
    return false
  }
  if (typeof value === 'string' && value.trim() === '') {
    return false
  }
  return true
}

/**
 * Produces a YAML scalar token (already safe for `key: {{{yaml}}}` in the template — use triple-stash).
 */
export function formatUserInputValueForYamlScalar(value: unknown): string {
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  const text =
    typeof value === 'string'
      ? value
      : (() => {
          try {
            return JSON.stringify(value)
          } catch {
            return '[unserializable]'
          }
        })()
  return JSON.stringify(text)
}

function buildInputValueEntries(
  schema: InstructionalContractSchema,
  userInputs: Record<string, unknown>
): readonly { readonly key: string; readonly yaml: string }[] {
  const required = stringInputKeysFromSchema(schema.inputs.required)
  const optional = stringInputKeysFromSchema(schema.inputs.optional)
  const entries: { key: string; yaml: string }[] = []

  for (const key of required) {
    if (hasNonEmptyUserValue(userInputs, key)) {
      entries.push({ key, yaml: formatUserInputValueForYamlScalar(userInputs[key]) })
    }
  }
  for (const key of optional) {
    if (hasNonEmptyUserValue(userInputs, key)) {
      entries.push({ key, yaml: formatUserInputValueForYamlScalar(userInputs[key]) })
    }
  }
  return entries
}

function buildRenderContext(
  schema: InstructionalContractSchema,
  userRequest: string,
  userInputs: Record<string, unknown>
): InstructionalContractRenderContext {
  const t = schema.thinking
  return {
    schema_id: schema.schema_id,
    role: t.role,
    tone: t.tone,
    audience: t.audience,
    reasoning_style: t.reasoning_style,
    inputs: schema.inputs,
    input_values: buildInputValueEntries(schema, userInputs),
    structure: schema.structure,
    rules: schema.rules,
    avoid: schema.avoid,
    output_format: schema.output_format,
    user_request: userRequest.trim(),
  }
}

let compiledTemplate: Handlebars.TemplateDelegate | undefined

function getCompiledTemplate(): Handlebars.TemplateDelegate {
  // Output is Markdown / structured text for Cursor, not HTML. HTML-escaping would corrupt code and YAML-like blocks.
  /* eslint-disable sonarjs/disabled-auto-escaping -- `noEscape` required: template emits Markdown + code, not HTML */
  compiledTemplate ??= Handlebars.compile(templateSource, {
    strict: false,
    noEscape: true,
  })
  /* eslint-enable sonarjs/disabled-auto-escaping */
  return compiledTemplate
}

/**
 * Renders the instructional contract (YAML-style body + `# USER REQUEST`) from a loaded schema,
 * optional structured `userInputs` (schema `inputs.required` / `inputs.optional` keys), and the
 * user's free-text request. Template: `prompt-os/templates/payload-template.md` (`?raw`).
 */
export function renderInstructionalContract(
  schema: InstructionalContractSchema,
  userRequest: string,
  userInputs: Record<string, unknown> = {}
): string {
  const template = getCompiledTemplate()
  return template(buildRenderContext(schema, userRequest, userInputs)).trimEnd()
}

/** Alias matching the Nexus naming used in docs. */
export const renderPayload = renderInstructionalContract
