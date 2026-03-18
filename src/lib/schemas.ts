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

export const CODING_SCHEMA = `CODING MODE STRUCTURE:
1. Title
2. Summary
3. Inputs
4. Output Requirements
5. Constraints
6. Hidden Reasoning
7. Final Answer Format
8. Code Implementation
9. Tests
10. Edge Cases
11. File Paths
12. Dependencies
13. Final Notes`

export const IMAGE_VIDEO_SCHEMA = `IMAGE/VIDEO MODE STRUCTURE:
1. Title
2. Summary
3. Extracted Attributes (if reference provided)
4. Enhanced Prompt
5. Minimal Prompt
6. Negative Prompt
7. Model Variants (Midjourney, DALL-E, Stable Diffusion optimized versions)
8. Suggestions (10 creative variations)
9. Real Camera Physics Applied
10. Final Notes`

export const RESEARCH_SCHEMA = `RESEARCH MODE STRUCTURE:
1. Title
2. Summary
3. Research Questions
4. Methodology
5. Findings
6. Limitations
7. Sources
8. Final Notes`

export const PLANNING_SCHEMA = `PLANNING MODE STRUCTURE:
1. Title
2. Summary
3. Objectives
4. Tasks
5. Dependencies
6. Risks
7. Timeline
8. Final Notes`

export const AGENT_SCHEMA = `AGENT MODE STRUCTURE:
1. Title
2. Summary
3. Role
4. Responsibilities
5. Inputs
6. Outputs
7. Boundaries
8. Escalation Rules
9. Final Notes`
