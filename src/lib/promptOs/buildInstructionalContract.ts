import { loadSchema } from '@/lib/promptOs/schemaLoader'
import { renderPayload } from '@/lib/promptOs/payloadRenderer'
import type { InstructionalContractSchema } from '@/lib/promptOs/types'

export class MissingRequiredInputsError extends Error {
  constructor(readonly missing: readonly string[]) {
    super(`Missing required inputs: ${missing.join(', ')}`)
    this.name = 'MissingRequiredInputsError'
  }
}

function requiredInputKeys(required: readonly unknown[]): string[] {
  return required.filter((k): k is string => typeof k === 'string' && k.trim() !== '')
}

function hasUserInputValue(userInputs: Record<string, unknown>, key: string): boolean {
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
 * Returns input keys from the schema that are required but missing or empty in `userInputs`.
 */
export function listMissingRequiredInputs(
  schema: InstructionalContractSchema,
  userInputs: Record<string, unknown>
): string[] {
  const keys = requiredInputKeys(schema.inputs.required)
  return keys.filter((key) => !hasUserInputValue(userInputs, key))
}

/**
 * Validates `schema.inputs.required` against `userInputs` (string keys with non-empty values).
 */
export function validateRequiredInputs(
  schema: InstructionalContractSchema,
  userInputs: Record<string, unknown>
): void {
  const missing = listMissingRequiredInputs(schema, userInputs)
  if (missing.length > 0) {
    throw new MissingRequiredInputsError(missing)
  }
}

/**
 * Loads the category schema, ensures required declarative inputs are present, then renders the
 * instructional contract + `# USER REQUEST` block for Cursor.
 *
 * `userInputs` keys must match entries in `schema.inputs.required` (e.g. `topic`, `goal`).
 */
export function buildInstructionalContract(
  category: string,
  userInputs: Record<string, unknown>,
  userRequest: string
): string {
  const schema = loadSchema(category)
  validateRequiredInputs(schema, userInputs)
  return renderPayload(schema, userRequest, userInputs)
}
