const API_KEY_STORAGE_KEY = 'do-api-key'
const DO_MODEL_STORAGE_KEY = 'do-model'

const DO_BASE_URL = 'https://inference.do-ai.run/v1'

// tier: 'budget' = <$1/M input · 'standard' = $1–$5/M · 'premium' = >$5/M
// priceUsd = input cost per 1M tokens in USD
export type ModelTier = 'budget' | 'standard' | 'premium'

export const DO_MODELS: Array<{ id: string; label: string; tier: ModelTier; priceUsd: number }> = [
  // Meta / Llama
  { id: 'llama3.3-70b-instruct',         label: 'Llama 3.3 70B Instruct',  tier: 'budget',   priceUsd: 0.65  },
  { id: 'llama3-8b-instruct',            label: 'Llama 3.1 8B Instruct',   tier: 'budget',   priceUsd: 0.198 },
  // Anthropic / Claude
  { id: 'anthropic-claude-4.6-sonnet',   label: 'Claude Sonnet 4.6',       tier: 'standard', priceUsd: 3  },
  { id: 'anthropic-claude-4.5-sonnet',   label: 'Claude Sonnet 4.5',       tier: 'standard', priceUsd: 3  },
  { id: 'anthropic-claude-sonnet-4',     label: 'Claude Sonnet 4',         tier: 'standard', priceUsd: 3  },
  { id: 'anthropic-claude-4.5-haiku',    label: 'Claude Haiku 4.5',        tier: 'standard', priceUsd: 1  },
  { id: 'anthropic-claude-opus-4.6',     label: 'Claude Opus 4.6',         tier: 'premium',  priceUsd: 5  },
  { id: 'anthropic-claude-opus-4.5',     label: 'Claude Opus 4.5',         tier: 'premium',  priceUsd: 5  },
  { id: 'anthropic-claude-4.1-opus',     label: 'Claude Opus 4.1',         tier: 'premium',  priceUsd: 15 },
  { id: 'anthropic-claude-opus-4',       label: 'Claude Opus 4',           tier: 'premium',  priceUsd: 15 },
  // OpenAI / GPT-5
  { id: 'openai-gpt-5',                  label: 'GPT-5',                    tier: 'standard', priceUsd: 1.25  },
  { id: 'openai-gpt-5-mini',             label: 'GPT-5 Mini',               tier: 'budget',   priceUsd: 0.25  },
  { id: 'openai-gpt-5-nano',             label: 'GPT-5 Nano',               tier: 'budget',   priceUsd: 0.05  },
  { id: 'openai-gpt-5.4',                label: 'GPT-5.4',                  tier: 'standard', priceUsd: 2.5  },
  { id: 'openai-gpt-5.3-codex',          label: 'GPT-5.3 Codex',            tier: 'standard', priceUsd: 1.75  },
  { id: 'openai-gpt-5.2',                label: 'GPT-5.2',                  tier: 'standard', priceUsd: 1.75  },
  { id: 'openai-gpt-5-2-pro',            label: 'GPT-5.2 Pro',              tier: 'premium',  priceUsd: 21 },
  { id: 'openai-gpt-5.1-codex-max',      label: 'GPT-5.1 Codex Max',        tier: 'standard', priceUsd: 1.25  },
  // OpenAI / GPT-4
  { id: 'openai-gpt-4.1',                label: 'GPT-4.1',                  tier: 'standard', priceUsd: 2  },
  { id: 'openai-gpt-4o',                 label: 'GPT-4o',                   tier: 'standard', priceUsd: 2.5  },
  { id: 'openai-gpt-4o-mini',            label: 'GPT-4o Mini',              tier: 'budget',   priceUsd: 0.15  },
  // OpenAI / OSS & Reasoning
  { id: 'openai-gpt-oss-120b',           label: 'GPT-OSS 120B',             tier: 'budget',   priceUsd: 0.1  },
  { id: 'openai-gpt-oss-20b',            label: 'GPT-OSS 20B',              tier: 'budget',   priceUsd: 0.05  },
  { id: 'openai-o1',                     label: 'OpenAI o1',                tier: 'premium',  priceUsd: 15 },
  { id: 'openai-o3',                     label: 'OpenAI o3',                tier: 'standard', priceUsd: 2  },
  { id: 'openai-o3-mini',                label: 'OpenAI o3 Mini',           tier: 'standard', priceUsd: 1.1  },
  // DeepSeek
  { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill 70B',  tier: 'budget',   priceUsd: 0.99  },
  // Mistral
  { id: 'mistral-nemo-instruct-2407',    label: 'Mistral Nemo Instruct',    tier: 'budget',   priceUsd: 0.3  },
  // NVIDIA
  { id: 'nvidia-nemotron-3-super-120b',  label: 'Nemotron 3 Super 120B',    tier: 'budget',   priceUsd: 0.3  },
  // Alibaba
  { id: 'alibaba-qwen3-32b',             label: 'Qwen3 32B',                tier: 'budget',   priceUsd: 0.25  },
  // MiniMax
  { id: 'minimax-m2.5',                  label: 'MiniMax M2.5',             tier: 'budget',   priceUsd: 0.3  },
  // Moonshot
  { id: 'kimi-k2.5',                     label: 'Kimi K2.5',                tier: 'budget',   priceUsd: 0.5  },
  // Z.ai
  { id: 'glm-5',                         label: 'GLM-5',                    tier: 'standard', priceUsd: 1  },
]

export const DEFAULT_MODEL = 'llama3.3-70b-instruct'

// ── Usage tracking ────────────────────────────────────────────────────────────
const USAGE_KEY = 'prompt-os-usage'

export interface UsageRecord {
  totalPromptTokens: number
  totalCompletionTokens: number
  totalCostUsd: number
  callCount: number
}

export function getUsage(): UsageRecord {
  const raw = localStorage.getItem(USAGE_KEY)
  return raw
    ? (JSON.parse(raw) as UsageRecord)
    : { totalPromptTokens: 0, totalCompletionTokens: 0, totalCostUsd: 0, callCount: 0 }
}

export function clearUsage(): void {
  localStorage.removeItem(USAGE_KEY)
}

function trackUsage(promptTokens: number, completionTokens: number, modelId: string) {
  const model = DO_MODELS.find((m) => m.id === modelId)
  if (!model) return
  // Use input price per 1M tokens for both directions (approximate)
  const costUsd = ((promptTokens + completionTokens) / 1_000_000) * model.priceUsd
  const cur = getUsage()
  localStorage.setItem(
    USAGE_KEY,
    JSON.stringify({
      totalPromptTokens: cur.totalPromptTokens + promptTokens,
      totalCompletionTokens: cur.totalCompletionTokens + completionTokens,
      totalCostUsd: cur.totalCostUsd + costUsd,
      callCount: cur.callCount + 1,
    } satisfies UsageRecord)
  )
}

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE_KEY) || ''
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, key)
  // Sync to chrome.storage.local so content scripts can read it
  try { chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: key }) } catch { /* outside extension */ }
}

export function getModel(): string {
  return localStorage.getItem(DO_MODEL_STORAGE_KEY) || DEFAULT_MODEL
}

export function setModel(model: string): void {
  localStorage.setItem(DO_MODEL_STORAGE_KEY, model)
  try { chrome.storage.local.set({ [DO_MODEL_STORAGE_KEY]: model }) } catch { /* outside extension */ }
}

export function hasApiKey(): boolean {
  return !!getApiKey()
}

/**
 * Call DigitalOcean Gradient AI (OpenAI-compatible) inference API.
 * Drop-in replacement for window.spark.llm(prompt, model, jsonMode).
 *
 * @param prompt   The full prompt text (sent as a user message)
 * @param jsonMode When true, instructs the model to return valid JSON only
 */
/**
 * Call the vision-capable model with a base64 image + text prompt.
 * The selected model must support multimodal input (e.g. gpt-4o, claude-sonnet).
 */
export async function callLLMWithImage(base64: string, mimeType: string, textPrompt: string): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('No API key configured. Please add your DigitalOcean Model Access Key in Features → Settings.')

  const response = await fetch(`${DO_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: getModel(),
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: textPrompt },
        ],
      }],
      max_completion_tokens: 2048,
    }),
  })

  if (!response.ok) {
    let message = `API error ${response.status}`
    try { const e = await response.json(); message = e?.error?.message || message } catch { /* ignore */ }
    throw new Error(message)
  }

  const data = await response.json()
  if (data.usage) trackUsage(data.usage.prompt_tokens ?? 0, data.usage.completion_tokens ?? 0, getModel())
  return data.choices[0].message.content as string
}

export async function callLLM(
  prompt: string,
  jsonMode = false,
  options?: { maxCompletionTokens?: number }
): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error(
      'No API key configured. Please click the Settings icon and add your DigitalOcean Model Access Key.'
    )
  }

  const messages: { role: string; content: string }[] = []

  if (jsonMode) {
    messages.push({
      role: 'system',
      content:
        'You must respond with valid JSON only. Do not include markdown code fences, explanations, or any text outside the JSON object.',
    })
  }

  messages.push({ role: 'user', content: prompt })

  const body = {
    model: getModel(),
    messages,
    max_completion_tokens: options?.maxCompletionTokens ?? 4096,
  }

  const response = await fetch(`${DO_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let message = `API error ${response.status}`
    try {
      const err = await response.json()
      message = err?.error?.message || err?.message || message
    } catch {
      // ignore parse error
    }
    throw new Error(message)
  }

  const data = await response.json()
  if (data.usage) {
    trackUsage(
      data.usage.prompt_tokens ?? 0,
      data.usage.completion_tokens ?? 0,
      getModel()
    )
  }
  return data.choices[0].message.content as string
}
