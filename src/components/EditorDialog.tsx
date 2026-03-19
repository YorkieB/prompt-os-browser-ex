import { useState, useEffect, useRef } from 'react'
import { X, Wand2, Loader2 } from 'lucide-react'
import { Prompt, PromptCategory } from '@/lib/types'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { callLLM, hasApiKey } from '@/lib/llm'
import { toast } from 'sonner'

const CATEGORIES: { value: PromptCategory; label: string }[] = [
  { value: 'coding',   label: 'Coding'   },
  { value: 'image',    label: 'Image'    },
  { value: 'video',    label: 'Video'    },
  { value: 'research', label: 'Research' },
  { value: 'planning', label: 'Planning' },
  { value: 'agents',   label: 'Agents'   },
  { value: 'personal', label: 'Personal' },
]

interface EditorDialogProps {
  prompt: Prompt | null
  open: boolean
  onClose: () => void
  onSave: (prompt: Prompt) => void
}

export function EditorDialog({ prompt, open, onClose, onSave }: Readonly<EditorDialogProps>) {
  const [title, setTitle]               = useState('')
  const [category, setCategory]         = useState<PromptCategory>('personal')
  const [description, setDescription]   = useState('')
  const [role, setRole]                 = useState('')
  const [tags, setTags]                 = useState('')
  const [content, setContent]           = useState('')
  const [fixingField, setFixingField]   = useState<'description' | 'role' | 'content' | null>(null)
  const debounceRef                     = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (prompt) {
      setTitle(prompt.title)
      setCategory(prompt.category)
      setDescription(prompt.description ?? '')
      setRole(prompt.role)
      setContent(prompt.content)
      setTags(prompt.tags.join(', '))
    } else {
      setTitle(''); setCategory('personal'); setDescription('')
      setRole(''); setContent(''); setTags('')
    }
  }, [prompt])

  // Auto spell-check description after user stops typing (1.5s debounce)
  useEffect(() => {
    if (!description.trim() || description.length < 10) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runGrammarFix('description', description)
    }, 1500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [description])

  async function runGrammarFix(field: 'description' | 'role' | 'content', text: string) {
    if (!text.trim() || !hasApiKey()) return
    setFixingField(field)
    try {
      const fixed = await callLLM(
        `Fix only spelling and grammar mistakes in the text below using British English conventions (e.g. "colour" not "color", "-ise" endings, "whilst", "amongst"). Return ONLY the corrected text with no explanation, no quotes, no preamble.\n\n${text}`
      )
      const trimmed = fixed.trim()
      if (trimmed && trimmed !== text) {
        if (field === 'description') setDescription(trimmed)
        if (field === 'role') setRole(trimmed)
        if (field === 'content') setContent(trimmed)
        toast.success('Spelling & grammar corrected')
      }
    } catch {
      // silently ignore — don't interrupt the user
    } finally {
      setFixingField(null)
    }
  }

  const handleSave = () => {
    if (!title || !content) return
    onSave({
      id: prompt?.id ?? `custom-${Date.now()}`,
      title,
      description: description.trim() || undefined,
      icon: prompt?.icon ?? '',
      category,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      variables: [],
      role,
      content,
      version: (prompt?.version ?? 0) + 1,
      createdAt: prompt?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      isFavorite: prompt?.isFavorite ?? false,
      isCustom: true,
    })
    onClose()
  }

  const isNew = !prompt

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-md p-0 overflow-hidden rounded-2xl gap-0">
        <DialogTitle className="sr-only">{isNew ? 'New Prompt' : 'Edit Prompt'}</DialogTitle>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-sm font-bold text-slate-900">{isNew ? 'New Prompt' : 'Edit Prompt'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{isNew ? 'Create a custom prompt' : `Editing · v${(prompt?.version ?? 0) + 1}`}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Title */}
          <div>
            <label htmlFor="editor-title" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Title</label>
            <input
              id="editor-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. React Component Builder"
              spellCheck
              className="w-full px-3 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition placeholder-slate-300"
            />
          </div>

          {/* Category + Tags */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="editor-category" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
              <select
                id="editor-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as PromptCategory)}
                className="w-full px-3 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition appearance-none cursor-pointer"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="editor-tags" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Tags</label>
              <input
                id="editor-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="react, api, typescript"
                className="w-full px-3 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition placeholder-slate-300"
              />
            </div>
          </div>

          {/* Short description — auto-corrected on pause */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="editor-description" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Short Description <span className="text-slate-300 font-normal normal-case tracking-normal">— shown on card</span>
              </label>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                {fixingField === 'description' && <><Loader2 className="w-3 h-3 animate-spin" /> Checking…</>}
                {fixingField !== 'description' && hasApiKey() && <span className="text-slate-300">auto spell-check on</span>}
                {fixingField !== 'description' && !hasApiKey() && <span className="text-slate-200">set API key to enable</span>}
              </div>
            </div>
            <input
              id="editor-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One sentence describing what this prompt does…"
              maxLength={120}
              spellCheck
              className="w-full px-3 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition placeholder-slate-300"
            />
            <p className="text-[10px] text-slate-300 mt-1 text-right">{description.length}/120</p>
          </div>

          {/* Role */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="editor-role" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Role <span className="text-slate-300 font-normal normal-case tracking-normal">— "You are a…"</span>
              </label>
              <button
                type="button"
                onClick={() => runGrammarFix('role', role)}
                disabled={!role.trim() || fixingField === 'role'}
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-violet-600 disabled:opacity-30 transition-colors"
              >
                {fixingField === 'role' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                Fix grammar
              </button>
            </div>
            <Textarea
              id="editor-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="You are a senior software engineer with expertise in…"
              rows={2}
              spellCheck
              className="text-sm resize-none bg-slate-50 border-slate-200 rounded-xl focus:border-violet-400 focus:ring-2 focus:ring-violet-100 placeholder-slate-300"
            />
          </div>

          {/* Prompt content */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="editor-content" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Prompt Content</label>
              <button
                type="button"
                onClick={() => runGrammarFix('content', content)}
                disabled={!content.trim() || fixingField === 'content'}
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-violet-600 disabled:opacity-30 transition-colors"
              >
                {fixingField === 'content' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                Fix grammar
              </button>
            </div>
            <Textarea
              id="editor-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your prompt content here…"
              rows={7}
              spellCheck
              className="text-sm font-mono resize-none bg-slate-50 border-slate-200 rounded-xl focus:border-violet-400 focus:ring-2 focus:ring-violet-100 placeholder-slate-300"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/60">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title || !content}
            className="flex-1 py-2 text-sm font-semibold text-white bg-violet-600 rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isNew ? 'Create Prompt' : 'Save Changes'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
