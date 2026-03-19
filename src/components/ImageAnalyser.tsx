import { useState, useRef, useCallback } from 'react'
import { ImageIcon, Loader2, X, Sparkles, Copy, CheckCheck } from 'lucide-react'
import { callLLMWithImage, hasApiKey } from '@/lib/llm'
import { toast } from 'sonner'

const VISION_PROMPT = `Analyse this reference image in comprehensive detail for use as an AI image/video generation prompt reference.

Describe the following in precise, evocative language:
- **Subject**: what or who is depicted, pose, expression, clothing, proportions, skin/material texture
- **Composition**: framing, rule of thirds, perspective, camera angle (low/high/eye-level), depth of field, foreground/background separation
- **Lighting**: type (natural/studio/ambient), direction, quality (soft/hard), colour temperature (warm/cool/neutral), shadows and highlights
- **Colour palette**: dominant hues, tones, saturation, contrast, any colour grading or tinting
- **Environment**: setting, background elements, time of day, weather/atmosphere, indoor/outdoor
- **Style**: artistic style, rendering quality, photographic or illustrative qualities, mood and emotional tone
- **Technical characteristics**: apparent focal length, lens distortion, film grain, sharpness, any post-processing
- **Notable details**: textures, patterns, unique elements, any text or symbols

Be highly specific and descriptive — this analysis will be fed directly into an AI image generation prompt to recreate the visual style and attributes.`

interface Props {
  onAnalysis: (description: string) => void
  compact?: boolean
}

export function ImageAnalyser({ onAnalysis, compact = false }: Readonly<Props>) {
  const [imageData, setImageData]     = useState<{ base64: string; mime: string; preview: string } | null>(null)
  const [analysing, setAnalysing]     = useState(false)
  const [analysis, setAnalysis]       = useState('')
  const [error, setError]             = useState('')
  const [copied, setCopied]           = useState(false)
  const [dragging, setDragging]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const readFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10 MB'); return }
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      const base64  = dataUrl.split(',')[1]
      setImageData({ base64, mime: file.type, preview: dataUrl })
      setAnalysis('')
      setError('')
    }
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) readFile(file)
  }, [readFile])

  const handleAnalyse = async () => {
    if (!imageData) return
    if (!hasApiKey()) { setError('No API key set — add it in Features → API Key Settings.'); return }
    setAnalysing(true); setError(''); setAnalysis('')
    try {
      const result = await callLLMWithImage(imageData.base64, imageData.mime, VISION_PROMPT)
      setAnalysis(result.trim())
      onAnalysis(result.trim())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAnalysing(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(analysis)
    setCopied(true)
    toast.success('Analysis copied')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleUse = () => {
    onAnalysis(analysis)
    toast.success('Analysis applied to prompt')
  }

  const clear = () => {
    setImageData(null); setAnalysis(''); setError('')
    onAnalysis('')
  }

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      {imageData ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
          <img
            src={imageData.preview}
            alt="Reference"
            className="w-full object-cover max-h-48"
          />
          <button
            onClick={clear}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            aria-label="Upload image: drop a file here or activate to choose a file"
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 ${
              dragging
                ? 'border-violet-400 bg-violet-50'
                : 'border-slate-200 bg-slate-50 hover:border-violet-300 hover:bg-violet-50/40'
            } ${compact ? 'py-4' : 'py-6'}`}
          >
            <ImageIcon className={`text-slate-300 ${compact ? 'w-6 h-6' : 'w-8 h-8'}`} />
            <div className="text-center">
              <p className="text-xs font-medium text-slate-500">Drop an image or click to upload</p>
              <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP, GIF · max 10 MB</p>
            </div>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f) }}
          />
        </>
      )}

      {/* Analyse button */}
      {imageData && !analysis && (
        <button
          onClick={handleAnalyse}
          disabled={analysing}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-white bg-violet-600 rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {analysing
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing image…</>
            : <><Sparkles className="w-3.5 h-3.5" /> Analyse Image with AI</>}
        </button>
      )}

      {/* Error */}
      {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {/* Analysis result */}
      {analysis && (
        <div className="rounded-xl border border-violet-100 bg-violet-50/50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-violet-100">
            <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Image Analysis</p>
            <div className="flex items-center gap-1">
              <button
                onClick={handleAnalyse}
                disabled={analysing}
                title="Re-analyse"
                className="p-1 text-violet-400 hover:text-violet-600 transition-colors disabled:opacity-40"
              >
                <Sparkles className="w-3 h-3" />
              </button>
              <button onClick={handleCopy} className="p-1 text-violet-400 hover:text-violet-600 transition-colors">
                {copied ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
          <pre className="px-3 py-2 text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
            {analysis}
          </pre>
          <div className="px-3 py-2 border-t border-violet-100">
            <button
              onClick={handleUse}
              className="w-full py-1.5 text-xs font-semibold text-violet-700 bg-violet-100 rounded-lg hover:bg-violet-200 transition-colors"
            >
              ✓ Use this analysis in prompt
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
