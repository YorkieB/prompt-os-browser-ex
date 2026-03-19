import { validateSchemaStructureOrThrow } from '@/lib/promptOs/schemaStructureValidator'
import type {
  InstructionalContractSchema,
  PromptOsSchemaCategory,
  PromptOsThinking,
} from '@/lib/promptOs/types'
import { isPromptOsSchemaCategory, PROMPT_OS_SCHEMA_CATEGORIES } from '@/lib/promptOs/types'

/** Alias for integration docs / external APIs — same as {@link PromptOsSchemaCategory}. */
export type SchemaCategory = PromptOsSchemaCategory

import baseSchemaJson from '../../../prompt-os/schemas/base.schema.json'
import agentsSchemaJson from '../../../prompt-os/schemas/agents.schema.json'
import codingSchemaJson from '../../../prompt-os/schemas/coding.schema.json'
import imageSchemaJson from '../../../prompt-os/schemas/image.schema.json'
import planningSchemaJson from '../../../prompt-os/schemas/planning.schema.json'
import researchSchemaJson from '../../../prompt-os/schemas/research.schema.json'

const baseSchema = baseSchemaJson as InstructionalContractSchema

const registry: Record<PromptOsSchemaCategory, InstructionalContractSchema> = {
  research: researchSchemaJson as InstructionalContractSchema,
  coding: codingSchemaJson as InstructionalContractSchema,
  image: imageSchemaJson as InstructionalContractSchema,
  planning: planningSchemaJson as InstructionalContractSchema,
  agents: agentsSchemaJson as InstructionalContractSchema,
}

export class UnknownPromptOsSchemaCategoryError extends Error {
  constructor(readonly category: string) {
    super(`Unknown Nexus schema category: ${category}`)
    this.name = 'UnknownPromptOsSchemaCategoryError'
  }
}

function mergeThinking(
  base: PromptOsThinking,
  domain: PromptOsThinking
): PromptOsThinking {
  return {
    role: domain.role || base.role,
    tone: domain.tone || base.tone,
    audience: domain.audience || base.audience,
    reasoning_style:
      domain.reasoning_style.length > 0 ? domain.reasoning_style : base.reasoning_style,
  }
}

/**
 * Load a domain schema merged on top of {@link baseSchema}.
 * Domain wins for structure, rules, avoid, and output_format; thinking merges field-by-field
 * so empty base placeholders do not overwrite a filled domain.
 */
export function loadSchema(category: SchemaCategory): InstructionalContractSchema
export function loadSchema(category: string): InstructionalContractSchema
export function loadSchema(category: string): InstructionalContractSchema {
  if (!isPromptOsSchemaCategory(category)) {
    throw new UnknownPromptOsSchemaCategoryError(category)
  }

  const domain = registry[category]

  const merged: InstructionalContractSchema = {
    ...baseSchema,
    ...domain,
    thinking: mergeThinking(baseSchema.thinking, domain.thinking),
    output_format: {
      ...baseSchema.output_format,
      ...domain.output_format,
    },
  }

  validateSchemaStructureOrThrow(merged)
  return merged
}

/** Categories available to the UI / registry (stable ordering). */
export function listPromptOsSchemaCategories(): readonly PromptOsSchemaCategory[] {
  return PROMPT_OS_SCHEMA_CATEGORIES
}
