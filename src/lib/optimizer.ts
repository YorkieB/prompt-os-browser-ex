export interface PromptAnalysis {
  overallScore: number
  clarity: {
    score: number
    issues: string[]
    suggestions: string[]
  }
  specificity: {
    score: number
    issues: string[]
    suggestions: string[]
  }
  structure: {
    score: number
    issues: string[]
    suggestions: string[]
  }
  completeness: {
    score: number
    issues: string[]
    suggestions: string[]
  }
  effectiveness: {
    score: number
    issues: string[]
    suggestions: string[]
  }
  improvements: string[]
  optimizedVersion: string
}

interface OptimizeRequest {
  prompt: string
  role?: string
  category?: string
}

const OPTIMIZATION_SYSTEM_PROMPT = `You are a professional prompt optimization expert. Your role is to analyze prompts for AI systems and provide detailed, actionable feedback on how to improve them.

Analyze prompts across these dimensions:
1. CLARITY - Is the prompt clear and unambiguous?
2. SPECIFICITY - Does it provide enough specific details and constraints?
3. STRUCTURE - Is it well-organized with logical flow?
4. COMPLETENESS - Does it include all necessary context and requirements?
5. EFFECTIVENESS - Will it produce the desired results consistently?

For each dimension:
- Assign a score from 0-100
- Identify specific issues
- Provide concrete, actionable suggestions

Then provide:
- An overall effectiveness score (0-100)
- A list of top improvement recommendations
- An optimized version of the prompt that addresses all issues

Return your analysis as valid JSON matching this exact structure:
{
  "overallScore": number,
  "clarity": {
    "score": number,
    "issues": ["string"],
    "suggestions": ["string"]
  },
  "specificity": {
    "score": number,
    "issues": ["string"],
    "suggestions": ["string"]
  },
  "structure": {
    "score": number,
    "issues": ["string"],
    "suggestions": ["string"]
  },
  "completeness": {
    "score": number,
    "issues": ["string"],
    "suggestions": ["string"]
  },
  "effectiveness": {
    "score": number,
    "issues": ["string"],
    "suggestions": ["string"]
  },
  "improvements": ["string"],
  "optimizedVersion": "string"
}`

export async function analyzePrompt({ prompt, role, category }: OptimizeRequest): Promise<PromptAnalysis> {
  const roleSection = role ? `ROLE: ${role}\n\n` : ''
  const categorySection = category ? `\nCATEGORY: ${category}` : ''
  
  const analysisPrompt = `${OPTIMIZATION_SYSTEM_PROMPT}

Analyze the following prompt:

${roleSection}PROMPT: ${prompt}${categorySection}

Provide a comprehensive analysis following the structure defined above.`

  const result = await window.spark.llm(analysisPrompt, 'gpt-4o', true)
  
  try {
    const analysis = JSON.parse(result) as PromptAnalysis
    return analysis
  } catch (error) {
    console.error('Failed to parse analysis result:', error)
    throw new Error('Failed to analyze prompt. Please try again.')
  }
}

export async function optimizePrompt({ prompt, role, category }: OptimizeRequest): Promise<string> {
  const analysis = await analyzePrompt({ prompt, role, category })
  return analysis.optimizedVersion
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  if (score >= 40) return 'text-orange-600'
  return 'text-red-600'
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 80) return 'Very Good'
  if (score >= 70) return 'Good'
  if (score >= 60) return 'Fair'
  if (score >= 50) return 'Needs Improvement'
  return 'Poor'
}

export function getScoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (score >= 80) return 'default'
  if (score >= 60) return 'secondary'
  if (score >= 40) return 'outline'
  return 'destructive'
}
