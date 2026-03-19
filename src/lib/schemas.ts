export const GLOBAL_STRUCTURED_CONTRACT = `You must ALWAYS produce output in a strict, multi-section structure. 
Never deviate from this structure, never merge sections, never omit sections, 
and never reorder them. This rule applies to ALL prompt types.

The required global structure is:

1. Title  
2. Summary  
3. Inputs  
4. Output Requirements  
5. Constraints  
6. Hidden Reasoning (never reveal)  
7. Final Answer Format  
8. Length Rules  
9. Safety Rules  
10. Final Output

If the user's request is ambiguous, ask ONE clarifying question, then proceed.`

export const CODING_SCHEMA = `CODING MODE — OUTPUT EVERY SECTION IN ORDER, USING THESE EXACT HEADERS:
## 1. Title
## 2. Summary
## 3. Inputs
## 4. Output Requirements
## 5. Constraints
## 6. Hidden Reasoning
## 7. Final Answer Format
## 8. Code Implementation
## 9. Tests
## 10. Edge Cases
## 11. File Paths
## 12. Dependencies
## 13. Final Notes

Never skip, merge, or reorder any section.`

export const IMAGE_SCHEMA = `IMAGE MODE — YOU MUST OUTPUT EVERY SECTION BELOW, IN THIS EXACT ORDER, USING THESE EXACT HEADERS:

## 1. Title
## 2. Summary
## 3. Extracted Attributes
## 4. Enhanced Prompt
## 5. Minimal Prompt
## 6. Negative Prompt
## 7. Model Variants
### Midjourney:
### DALL-E:
### Stable Diffusion:
## 8. Suggestions
(list exactly 10 numbered creative variations)
## 9. Real Camera Physics Applied
(include: lens, aperture, focal length, shutter speed, ISO, sensor, lighting setup, colour temperature)
## 10. Final Notes

Never skip, merge, or reorder any section. If Extracted Attributes has no reference image, write "No reference provided."`

export const VIDEO_SCHEMA = `VIDEO MODE — YOU MUST OUTPUT EVERY SECTION BELOW, IN THIS EXACT ORDER, USING THESE EXACT HEADERS:

## 1. Title
## 2. Summary
## 3. Extracted Attributes
## 4. Enhanced Prompt
## 5. Minimal Prompt
## 6. Negative Prompt
## 7. Model Variants
### Midjourney:
### DALL-E:
### Stable Diffusion:
## 8. Suggestions
(list exactly 10 numbered creative variations)
## 9. Real Camera Physics Applied
(include: lens, aperture, focal length, shutter speed, ISO, sensor, lighting setup, colour temperature, motion physics)
## 10. Final Notes
## 11. Video Version
(camera movement, motion direction, speed, temporal elements, scene transitions)

Never skip, merge, or reorder any section. If Extracted Attributes has no reference image, write "No reference provided."`

// Keep alias so any old import still works
export const IMAGE_VIDEO_SCHEMA = IMAGE_SCHEMA

export const RESEARCH_SCHEMA = `RESEARCH MODE — OUTPUT EVERY SECTION IN ORDER, USING THESE EXACT HEADERS:
## 1. Title
## 2. Summary
## 3. Research Questions
## 4. Methodology
## 5. Findings
## 6. Limitations
## 7. Sources
## 8. Final Notes

Never skip, merge, or reorder any section.`

export const PLANNING_SCHEMA = `PLANNING MODE — OUTPUT EVERY SECTION IN ORDER, USING THESE EXACT HEADERS:
## 1. Title
## 2. Summary
## 3. Objectives
## 4. Tasks
## 5. Dependencies
## 6. Risks
## 7. Timeline
## 8. Final Notes

Never skip, merge, or reorder any section.`

export const AGENT_SCHEMA = `AGENT MODE — OUTPUT EVERY SECTION IN ORDER, USING THESE EXACT HEADERS:
## 1. Title
## 2. Summary
## 3. Role
## 4. Responsibilities
## 5. Inputs
## 6. Outputs
## 7. Boundaries
## 8. Escalation Rules
## 9. Final Notes

Never skip, merge, or reorder any section.`
