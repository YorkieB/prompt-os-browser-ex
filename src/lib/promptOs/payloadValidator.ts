import type { InstructionalContractSchema, PromptOsSection } from '@/lib/promptOs/types'

/**
 * User-provided values for each structure section, keyed by `section.id`, then `field.id`.
 * Optional sections may be omitted entirely.
 */
export type InstructionalPayloadData = Record<string, unknown>

export class InvalidInstructionalPayloadError extends Error {
  constructor(readonly errors: readonly string[]) {
    super(errors.join('\n'))
    this.name = 'InvalidInstructionalPayloadError'
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** True if a required field should be considered absent. */
function isMissingRequiredValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true
  }
  if (typeof value === 'string' && value.trim() === '') {
    return true
  }
  if (Array.isArray(value) && value.length === 0) {
    return true
  }
  return false
}

function validateSectionFields(
  section: PromptOsSection,
  fieldsObject: Record<string, unknown>,
  errors: string[]
): void {
  for (const field of section.fields) {
    if (!field.required) {
      continue
    }
    const value = fieldsObject[field.id]
    if (isMissingRequiredValue(value)) {
      errors.push(`Missing required field: ${section.id}.${field.id}`)
    }
  }
}

function validateSection(
  section: PromptOsSection,
  payload: InstructionalPayloadData,
  errors: string[]
): void {
  const raw = payload[section.id]

  if (section.required) {
    if (!isPlainObject(raw)) {
      errors.push(`Missing required section: ${section.id}`)
      return
    }
    validateSectionFields(section, raw, errors)
    return
  }

  if (raw === undefined || raw === null) {
    return
  }

  if (!isPlainObject(raw)) {
    errors.push(`Section ${section.id} must be an object with field keys when present`)
    return
  }

  validateSectionFields(section, raw, errors)
}

/**
 * Validates user-filled payload data against `schema.structure` (required sections and fields).
 * Returns a list of human-readable errors; empty means valid.
 */
export function validatePayload(
  schema: InstructionalContractSchema,
  payload: InstructionalPayloadData
): string[] {
  const errors: string[] = []

  if (!schema.structure?.sections) {
    errors.push('Schema has no structure.sections')
    return errors
  }

  for (const section of schema.structure.sections) {
    validateSection(section, payload, errors)
  }

  return errors
}

/**
 * Runs {@link validatePayload}; throws {@link InvalidInstructionalPayloadError} if any errors.
 */
export function validatePayloadOrThrow(
  schema: InstructionalContractSchema,
  payload: InstructionalPayloadData
): void {
  const errors = validatePayload(schema, payload)
  if (errors.length > 0) {
    throw new InvalidInstructionalPayloadError(errors)
  }
}
