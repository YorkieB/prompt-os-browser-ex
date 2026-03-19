import type { EnhancementMode } from './types'
import { callLLM } from './llm'
import {
  GLOBAL_STRUCTURED_CONTRACT,
  CODING_SCHEMA,
  RESEARCH_SCHEMA,
  PLANNING_SCHEMA,
  AGENT_SCHEMA,
} from './schemas'
import { enhanceImageVideoPrompt } from './imageVideoEnhancer'

// Re-export so callers that previously imported extractImageAttributes
// from enhancer.ts continue to work.
export { extractImageAttributes } from './referenceExtractor'

interface EnhanceOptions {
  prompt: string
  mode: EnhancementMode
  referenceImage?: string
}

export async function enhancePrompt(options: EnhanceOptions): Promise<string> {
  const { prompt, mode, referenceImage } = options

  if (mode === 'image' || mode === 'video') {
    return enhanceImageVideoPrompt({ prompt, mode, referenceImage })
  }

  const schema = getSchemaForMode(mode)
  const systemMessage = `You are an expert prompt engineer.

GLOBAL CONTRACT (policy):
${GLOBAL_STRUCTURED_CONTRACT}

MODE-SPECIFIC SCHEMA — OUTPUT EVERY SECTION IN ORDER, USING EXACT ## HEADERS:
${schema}

RULES:
- Every section must appear in the numbered order above.
- Use ## headers exactly as written in the schema.
- Never skip, merge, abbreviate, or reorder sections.
- Do not output any additional sections beyond the mode schema section list.

User's prompt to enhance:
${prompt}

Produce the full structured output now. Every section must be present.`

  return callLLM(systemMessage)
}

function getSchemaForMode(mode: EnhancementMode): string {
  switch (mode) {
    case 'coding':   return CODING_SCHEMA
    case 'research': return RESEARCH_SCHEMA
    case 'planning': return PLANNING_SCHEMA
    case 'agent':    return AGENT_SCHEMA
    default:         return CODING_SCHEMA
  }
}
