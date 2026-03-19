import { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles, Copy, Check, Save } from 'lucide-react'
import { callLLM, hasApiKey } from '@/lib/llm'
import { enhancePrompt } from '@/lib/enhancer'
import { GLOBAL_STRUCTURED_CONTRACT } from '@/lib/schemas'
import { toast } from 'sonner'
import type { Prompt, EnhancementMode } from '@/lib/types'
import { ImageAnalyser } from '@/components/ImageAnalyser'

// Categories that map to a strict mode schema
const SCHEMA_MODES: Record<string, EnhancementMode> = {
  'Image':    'image',
  'Video':    'video',
  'Coding':   'coding',
  'Research': 'research',
  'Planning': 'planning',
  'Agents':   'agent',
}

const ALL_CATEGORIES = [
  'General', 'Coding', 'Image', 'Video',
  'Research', 'Planning', 'Agents',
  'Marketing', 'Professional', 'Educational', 'Creative', 'Personal',
]

// Category colour overrides for Image/Video
const CAT_COLOURS: Record<string, string> = {
  'Image': 'bg-purple-600 text-white border-purple-600',
  'Video': 'bg-pink-600 text-white border-pink-600',
}

function getCatPrefix(cat: string): string {
  if (cat === 'Image') return '🎨 '
  if (cat === 'Video') return '🎥 '
  return ''
}

function getIconForCategory(cat: string): string {
  if (cat === 'Image') return '🎨'
  if (cat === 'Video') return '🎥'
  return ''
}

const TONES = [
  { id: 'formal',       label: 'Formal',       emoji: '😊' },
  { id: 'casual',       label: 'Casual',       emoji: '😄' },
  { id: 'persuasive',   label: 'Persuasive',   emoji: '🎯' },
  { id: 'enthusiastic', label: 'Enthusiastic', emoji: '🤩' },
  { id: 'analytical',   label: 'Analytical',   emoji: '🔍' },
  { id: 'creative',     label: 'Creative',     emoji: '🎨' },
]

interface CraftTabProps {
  onSaveGenerated: (prompt: Prompt) => void
}

export function CraftTab({ onSaveGenerated }: Readonly<CraftTabProps>) {
  const [description, setDescription]     = useState('')
  const [category, setCategory]           = useState('General')
  const [showOptions, setShowOptions]     = useState(false)
  const [tone, setTone]                   = useState('formal')
  const [length, setLength]               = useState('medium')
  const [level, setLevel]                 = useState('intermediate')
  const [includeExamples, setIncludeExamples] = useState(false)
  const [referenceImage, setReferenceImage] = useState('')
  const [result, setResult]               = useState('')
  const [loading, setLoading]             = useState(false)
  const [copied, setCopied]               = useState(false)

  const schemaMode = SCHEMA_MODES[category] as EnhancementMode | undefined
  const isImageVideo = category === 'Image' || category === 'Video'

  const handleCompose = async () => {
    if (!description.trim()) {
      toast.error('Describe what prompt you want to generate')
      return
    }
    if (!hasApiKey()) {
      toast.error('Add your API key in the Features tab first')
      return
    }
    setLoading(true)
    setResult('')
    try {
      let generated: string

      if (schemaMode) {
        // Route through the structured enhancer (applies global contract + mode schema)
        generated = await enhancePrompt({
          prompt: description.trim(),
          mode: schemaMode,
          referenceImage: referenceImage.trim() || undefined,
        })
      } else {
        // General categories: apply global contract only, then free-form compose
        const systemPrompt = `You are an expert prompt engineer.

GLOBAL CONTRACT — FOLLOW THIS STRUCTURE STRICTLY:
${GLOBAL_STRUCTURED_CONTRACT}

Use ## headers for each section. Never skip or reorder sections.

Additional context:
- Category: ${category}
- Tone: ${tone}
- Length preference: ${length}
- Complexity: ${level}
- Include examples: ${includeExamples ? 'yes' : 'no'}

User's request: ${description.trim()}

Produce the full structured output now.`
        generated = await callLLM(systemPrompt)
      }

      setResult(generated.trim())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate prompt')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = () => {
    const catValue = category.toLowerCase() as Prompt['category']
    const safeCategory: Prompt['category'] =
      ['coding','image','video','research','planning','agents','personal'].includes(catValue)
        ? catValue
        : 'personal'
    const prompt: Prompt = {
      id: `custom-${Date.now()}`,
      title: description.slice(0, 50) || 'Generated Prompt',
      icon: getIconForCategory(category),
      content: result,
      role: `You are an expert in ${category.toLowerCase()} tasks.`,
      category: safeCategory,
      tags: [category.toLowerCase(), tone],
      variables: [],
      isCustom: true,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    onSaveGenerated(prompt)
    toast.success('Saved to your prompts!')
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#f0f4f8' }}>
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-slate-100">
        <h1 className="text-base font-semibold text-slate-900">Craft</h1>
        <p className="text-xs text-slate-400">Generate structured AI prompts</p>
      </div>

      <div className="p-3 space-y-3">
        {/* Main input card */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
          <textarea
            placeholder={
              isImageVideo
                ? `Describe the ${category.toLowerCase()} you want to generate…`
                : 'Describe what prompt to generate…'
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full text-sm text-slate-700 placeholder-slate-400 resize-none outline-none min-h-[72px]"
          />

          {/* Category chips */}
          <div className="flex flex-wrap gap-1.5 my-3 border-t border-slate-50 pt-3">
            {ALL_CATEGORIES.map((cat) => {
              const isActive = category === cat
              const activeClass = CAT_COLOURS[cat] ?? 'bg-blue-600 text-white border-blue-600'
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all ${
                    isActive
                      ? activeClass
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {getCatPrefix(cat)}{cat}
                </button>
              )
            })}
          </div>

          {/* Reference image upload + AI analysis (Image / Video only) */}
          {isImageVideo && (
            <div className="mb-3 border-t border-slate-50 pt-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Reference Image <span className="font-normal normal-case text-slate-300">— optional, AI-analysed</span>
              </p>
              <ImageAnalyser compact onAnalysis={setReferenceImage} />
              {referenceImage && (
                <p className="text-[10px] text-violet-500 mt-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />
                  Analysis will be included in the generated prompt
                </p>
              )}
            </div>
          )}

          {/* Schema badge */}
          {schemaMode && (
            <div className="mb-2 flex items-center gap-1.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                {category.toUpperCase()} MODE SCHEMA ACTIVE
              </span>
              <span className="text-[10px] text-slate-400">· structured output enforced</span>
            </div>
          )}

          {/* Options toggle + Compose */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => setShowOptions((v) => !v)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              {showOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Options
            </button>
            <button
              onClick={handleCompose}
              disabled={loading || !description.trim()}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                isImageVideo
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-slate-200 text-slate-600 hover:bg-blue-600 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {loading ? 'Composing…' : 'Compose'}
            </button>
          </div>
        </div>

        {/* Options panel — hidden for Image/Video (reference is more important) */}
        {showOptions && !isImageVideo && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-4">
            {/* Tone */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tone:</p>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      tone === t.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Length */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Length:</p>
              <div className="flex rounded-full bg-slate-100 p-0.5">
                {['Short', 'Medium', 'Long'].map((l) => (
                  <button
                    key={l}
                    onClick={() => setLength(l.toLowerCase())}
                    className={`flex-1 py-1 text-xs font-medium rounded-full transition-all ${
                      length === l.toLowerCase()
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Level */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Level:</p>
              <div className="flex rounded-full bg-slate-100 p-0.5">
                {['Beginner', 'Intermediate', 'Advanced'].map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevel(l.toLowerCase())}
                    className={`flex-1 py-1 text-xs font-medium rounded-full transition-all ${
                      level === l.toLowerCase()
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Examples */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Examples:</p>
              <div className="flex rounded-full bg-slate-100 p-0.5 w-32">
                {['Yes', 'No'].map((v) => (
                  <button
                    key={v}
                    onClick={() => setIncludeExamples(v === 'Yes')}
                    className={`flex-1 py-1 text-xs font-medium rounded-full transition-all ${
                      includeExamples === (v === 'Yes')
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Generated result */}
        {result && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Output</p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full hover:bg-slate-200 transition-colors"
                >
                  <Save className="w-3 h-3" /> Save
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded-full hover:bg-blue-700 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            {/* Render structured markdown sections */}
            <div className="p-3 space-y-0 max-h-[480px] overflow-y-auto">
              {result.split(/\n(?=## )/).map((section, i) => {
                const [headerLine, ...bodyLines] = section.split('\n')
                const body = bodyLines.join('\n').trim()
                const isHeader = headerLine.startsWith('## ')
                const title = isHeader ? headerLine.replace(/^## \d+\.\s*/, '') : headerLine
                const divClass = i > 0 ? 'border-t border-slate-50 pt-3 mt-3' : ''
                return (
                  <div key={headerLine} className={divClass}>
                    {isHeader && (
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        {headerLine.replace('## ', '')}
                      </p>
                    )}
                    {!isHeader && <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{title}</p>}
                    {body && <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{body}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-2 animate-pulse">
            {[80, 60, 90, 50, 70].map((w) => (
              <div key={w} className="h-3 bg-slate-100 rounded-full" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
