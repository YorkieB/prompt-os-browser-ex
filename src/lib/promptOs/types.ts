/** Single field inside a structure section (text, list, code, json, …). */
export interface PromptOsField {
  readonly id: string
  readonly type: string
  readonly required: boolean
}

/** Section in the instructional contract structure. */
export interface PromptOsSection {
  readonly id: string
  readonly label: string
  readonly required: boolean
  readonly fields: readonly PromptOsField[]
}

export interface PromptOsThinking {
  readonly role: string
  readonly tone: string
  readonly audience: string
  readonly reasoning_style: readonly string[]
}

export interface PromptOsInputs {
  /** Input keys or descriptor objects, depending on schema. */
  readonly required: readonly unknown[]
  readonly optional: readonly unknown[]
}

export interface PromptOsRules {
  readonly must_do: readonly string[]
  readonly must_not_do: readonly string[]
}

export interface PromptOsOutputFormat {
  readonly type: string
  readonly enforce_headings: boolean
  readonly enforce_order: boolean
  readonly enforce_field_labels: boolean
}

/**
 * Full instructional contract shape after {@link loadSchema} merges base + domain.
 */
export interface InstructionalContractSchema {
  readonly schema_id: string
  readonly extends?: string
  readonly thinking: PromptOsThinking
  readonly inputs: PromptOsInputs
  readonly structure: { readonly sections: readonly PromptOsSection[] }
  readonly rules: PromptOsRules
  readonly avoid: readonly string[]
  readonly output_format: PromptOsOutputFormat
}

export const PROMPT_OS_SCHEMA_CATEGORIES = [
  'research',
  'coding',
  'image',
  'planning',
  'agents',
] as const

export type PromptOsSchemaCategory = (typeof PROMPT_OS_SCHEMA_CATEGORIES)[number]

export function isPromptOsSchemaCategory(value: string): value is PromptOsSchemaCategory {
  return (PROMPT_OS_SCHEMA_CATEGORIES as readonly string[]).includes(value)
}
