import { callLLM } from './llm'
import { IMAGE_SCHEMA, VIDEO_SCHEMA, GLOBAL_STRUCTURED_CONTRACT } from './schemas'
import { applyCameraPhysics, formatCameraPhysics } from './cameraPhysics'
import { extractImageAttributes } from './referenceExtractor'

export interface ImageVideoEnhancerOptions {
  prompt: string
  mode: 'image' | 'video'
  referenceImage?: string
}

/**
 * Full image/video prompt enhancer.
 * Strictly follows the IMAGE or VIDEO mode schema from the spec.
 * Sections are enforced via the system prompt headers.
 */
export async function enhanceImageVideoPrompt(
  options: ImageVideoEnhancerOptions
): Promise<string> {
  const { prompt, mode, referenceImage } = options
  const schema = mode === 'video' ? VIDEO_SCHEMA : IMAGE_SCHEMA

  let attributesBlock = ''
  if (referenceImage) {
    const attrs = await extractImageAttributes(referenceImage)
    attributesBlock = `\n\nReference image attributes already extracted for section 3:\n${attrs}`
  }

  // Pre-compute camera physics so it can be embedded in section 9
  const physics = applyCameraPhysics(prompt)
  const physicsText = formatCameraPhysics(physics)

  const systemMessage = `You are an expert AI ${mode} prompt engineer.

GLOBAL CONTRACT (policy):
${GLOBAL_STRUCTURED_CONTRACT}

MODE-SPECIFIC SCHEMA — FOLLOW THIS EXACTLY:
${schema}

RULES:
- Output all sections in the exact numbered order shown above.
- Use the exact ## header labels as written.
- Never skip, merge, abbreviate, or reorder sections.
- Do not output any additional sections beyond the mode schema section list.
- Section 9 (Real Camera Physics Applied) MUST include the pre-computed values below unless you can provide better ones.
- Section 8 (Suggestions) MUST contain exactly 10 numbered items.
${mode === 'video' ? '- Section 11 (Video Version) MUST include camera movement, motion direction, speed, temporal transitions.' : ''}

Pre-computed camera physics for section 9:
${physicsText}
${attributesBlock}

User's ${mode} prompt to enhance:
${prompt}

Now produce the full structured output. Every section must be present.`

  return callLLM(systemMessage)
}
