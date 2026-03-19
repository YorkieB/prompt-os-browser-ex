import { callLLM } from './llm'

/**
 * Extracts structured visual attributes from a reference image description.
 * Attributes: subject, pose, clothing, lighting, environment, camera angle,
 * background depth, colour palette, mood, style, identity features.
 */
export async function extractImageAttributes(description: string): Promise<string> {
  const prompt = `Extract detailed visual attributes from this image description for use in AI image generation prompts.

Extract and format the following attributes:
- Subject: Main focus/subject matter
- Pose: Body position, gesture, stance
- Clothing: Attire, accessories, style
- Lighting: Light direction, quality, shadows
- Environment: Setting, location, context
- Camera Angle: Viewpoint, perspective
- Background Depth: Depth of field, focus
- Colour Palette: Dominant colours, tones
- Mood: Emotional atmosphere
- Style: Artistic style, aesthetic
- Identity Features: Distinctive characteristics

Image description:
${description}

Provide a structured breakdown of each attribute.`

  return callLLM(prompt)
}
