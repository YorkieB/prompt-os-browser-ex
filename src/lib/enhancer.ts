import { EnhancementMode } from './types'
import {
  GLOBAL_STRUCTURED_CONTRACT,
  CODING_SCHEMA,
  IMAGE_VIDEO_SCHEMA,
  RESEARCH_SCHEMA,
  PLANNING_SCHEMA,
  AGENT_SCHEMA,
} from './schemas'
import { applyCameraPhysics, formatCameraPhysics } from './cameraPhysics'

interface EnhanceOptions {
  prompt: string
  mode: EnhancementMode
  referenceImage?: string
}

export async function enhancePrompt(options: EnhanceOptions): Promise<string> {
  const { prompt, mode, referenceImage } = options

  const schema = getSchemaForMode(mode)
  
  let systemMessage = `You are an expert prompt engineer. Your task is to enhance the following user prompt according to the strict requirements below.

${GLOBAL_STRUCTURED_CONTRACT}

${schema}`

  if (mode === 'image' || mode === 'video') {
    if (referenceImage) {
      systemMessage += `\n\nThe user has provided this reference image description: ${referenceImage}

Extract detailed attributes including: subject, pose, clothing, lighting, environment, camera angle, background depth, color palette, mood, style, and identity features. Include these in the "Extracted Attributes" section.`
    }

    systemMessage += `\n\nYou must also apply real camera physics to make the output photorealistic. Include camera specifications (lens, aperture, focal length, shutter speed, ISO, sensor type, lighting setup, and color temperature).

Generate:
1. An enhanced, detailed version of the prompt
2. A minimal version (concise but effective)
3. A negative prompt (things to avoid)
4. Model-specific variants (optimized for Midjourney, DALL-E, and Stable Diffusion)
5. 10 creative suggestions for variations`

    if (mode === 'video') {
      systemMessage += `\n6. A video-specific version with motion, camera movement, and temporal elements`
    }
  }

  systemMessage += `\n\nUser's original prompt:
${prompt}

Now enhance this prompt following the ${mode.toUpperCase()} MODE structure exactly. Be comprehensive, detailed, and follow every section requirement.`

  const enhanced = await window.spark.llm(systemMessage, 'gpt-4o')

  if ((mode === 'image' || mode === 'video') && !referenceImage) {
    const cameraPhysics = applyCameraPhysics(prompt)
    const physicsFormatted = formatCameraPhysics(cameraPhysics)
    return `${enhanced}\n\n${physicsFormatted}`
  }

  return enhanced
}

function getSchemaForMode(mode: EnhancementMode): string {
  switch (mode) {
    case 'coding':
      return CODING_SCHEMA
    case 'image':
    case 'video':
      return IMAGE_VIDEO_SCHEMA
    case 'research':
      return RESEARCH_SCHEMA
    case 'planning':
      return PLANNING_SCHEMA
    case 'agent':
      return AGENT_SCHEMA
    default:
      return CODING_SCHEMA
  }
}

export async function extractImageAttributes(description: string): Promise<string> {
  const extractionMessage = `Extract detailed visual attributes from this image description for use in AI image generation prompts.

Extract and format the following attributes:
- Subject: Main focus/subject matter
- Pose: Body position, gesture, stance
- Clothing: Attire, accessories, style
- Lighting: Light direction, quality, shadows
- Environment: Setting, location, context
- Camera Angle: Viewpoint, perspective
- Background Depth: Depth of field, focus
- Color Palette: Dominant colors, tones
- Mood: Emotional atmosphere
- Style: Artistic style, aesthetic
- Identity Features: Distinctive characteristics

Image description:
${description}

Provide a structured breakdown of each attribute.`

  return await window.spark.llm(extractionMessage, 'gpt-4o')
}
