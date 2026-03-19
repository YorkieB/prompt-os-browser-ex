import type { InstructionalContractSchema, PromptOsField, PromptOsSection } from '@/lib/promptOs/types'

export class InvalidSchemaStructureError extends Error {
  constructor(readonly errors: readonly string[]) {
    super(errors.join('\n'))
    this.name = 'InvalidSchemaStructureError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Validates that a loaded instructional contract schema has a usable `structure` tree
 * (`schema_id`, sections with `id`/`label`, fields with `id`/`type`).
 */
export function validateSchemaStructure(schema: unknown): string[] {
  const errors: string[] = []

  if (!isRecord(schema)) {
    errors.push('Schema is not an object')
    return errors
  }

  const s = schema as Partial<InstructionalContractSchema>

  if (!s.schema_id || typeof s.schema_id !== 'string' || s.schema_id.trim() === '') {
    errors.push('Missing schema_id')
  }

  const sections = s.structure?.sections
  if (!sections || sections.length === 0) {
    errors.push('No sections defined')
    return errors
  }

  for (const section of sections as PromptOsSection[]) {
    if (!section.id || !section.label) {
      errors.push(`Section missing id/label: ${JSON.stringify(section)}`)
    }

    const fields = section.fields
    if (!Array.isArray(fields)) {
      errors.push(`Section ${section.id ?? '(unknown)'} missing fields array`)
      continue
    }

    for (const field of fields as PromptOsField[]) {
      if (!field.id || !field.type) {
        errors.push(`Field missing id/type in section ${section.id}`)
      }
    }
  }

  return errors
}

/** Throws {@link InvalidSchemaStructureError} if {@link validateSchemaStructure} returns any errors. */
export function validateSchemaStructureOrThrow(schema: unknown): void {
  const errors = validateSchemaStructure(schema)
  if (errors.length > 0) {
    throw new InvalidSchemaStructureError(errors)
  }
}
