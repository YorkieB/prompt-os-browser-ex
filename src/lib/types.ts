export type PromptCategory = 'coding' | 'image' | 'video' | 'research' | 'planning' | 'agents' | 'personal'

export type EnhancementMode = 'coding' | 'image' | 'video' | 'research' | 'planning' | 'agent'

export interface Prompt {
  id: string
  title: string
  icon: string
  category: PromptCategory
  tags: string[]
  variables: string[]
  role: string
  content: string
  version: number
  createdAt: number
  updatedAt: number
  description?: string
  isFavorite?: boolean
  isCustom?: boolean
}

export interface ExportedChat {
  id: string
  title: string
  source: 'chatgpt' | 'claude' | 'gemini' | 'perplexity' | 'copilot' | 'unknown'
  messages: { role: string; text: string }[]
  exportedAt: number
  isTrashed?: boolean
}

export interface EnhancedPrompt {
  original: string
  enhanced: string
  mode: EnhancementMode
  timestamp: number
}

export interface CameraPhysics {
  lens: string
  aperture: string
  focalLength: string
  shutterSpeed: string
  iso: string
  sensor: string
  lighting: string
  temperature: string
}

export interface ImageAttributes {
  subject: string
  pose: string
  clothing: string
  lighting: string
  environment: string
  cameraAngle: string
  backgroundDepth: string
  colorPalette: string
  mood: string
  style: string
  identityFeatures: string
}
