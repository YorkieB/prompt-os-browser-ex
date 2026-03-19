import { useState } from 'react'
import { Search, Star, Plus, Copy, Trash2, Sparkles, BarChart2, Pencil, CopyPlus, RotateCcw, X } from 'lucide-react'
import type { Prompt, PromptCategory } from '@/lib/types'
import { toast } from 'sonner'

const CATEGORIES: Array<{ id: PromptCategory | 'all'; label: string }> = [
  { id: 'all',      label: 'All'      },
  { id: 'coding',   label: 'Coding'   },
  { id: 'image',    label: 'Image'    },
  { id: 'video',    label: 'Video'    },
  { id: 'research', label: 'Research' },
  { id: 'planning', label: 'Planning' },
  { id: 'agents',   label: 'Agents'   },
  { id: 'personal', label: 'Personal' },
]

interface SavedPromptsTabProps {
  prompts: Prompt[]
  trashedPrompts: Prompt[]
  onAddCustom: (text: string) => void
  onTrash: (id: string) => void
  onRestore: (id: string) => void
  onPermanentDelete: (id: string) => void
  onEmptyTrash: () => void
  onToggleFavorite: (id: string) => void
  onEnhance: (prompt: Prompt) => void
  onOptimize: (prompt: Prompt) => void
  onEdit: (prompt: Prompt) => void
  onDuplicate: (id: string) => void
}

export function SavedPromptsTab({
  prompts,
  trashedPrompts,
  onAddCustom,
  onTrash,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
  onToggleFavorite,
  onEnhance,
  onOptimize,
  onEdit,
  onDuplicate,
}: Readonly<SavedPromptsTabProps>) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<PromptCategory | 'all'>('all')
  const [showFavorites, setShowFavorites] = useState(false)
  const [view, setView] = useState<'library' | 'trash'>('library')
  const [isAdding, setIsAdding] = useState(false)
  const [newText, setNewText] = useState('')

  const filtered = prompts.filter((p) => {
    const favOk = !showFavorites || p.isFavorite
    const catOk = activeCategory === 'all' || p.category === activeCategory
    const q = searchQuery.toLowerCase()
    const textOk =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
    return favOk && catOk && textOk
  })

  const handleSave = () => {
    const trimmed = newText.trim()
    if (!trimmed) return
    onAddCustom(trimmed)
    setNewText('')
    setIsAdding(false)
    toast.success('Prompt saved!')
  }

  const handleCopy = (p: Prompt) => {
    navigator.clipboard.writeText(`${p.role}\n\n${p.content}`)
    toast.success('Copied to clipboard')
  }

  // ── Trash view ─────────────────────────────────────────────────────────────
  if (view === 'trash') {
    return (
      <div className="flex flex-col h-full" style={{ background: '#f0f4f8' }}>
        <div className="bg-white px-4 pt-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('library')}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex-1">
              <h1 className="text-base font-semibold text-slate-900">Trash</h1>
              <p className="text-xs text-slate-400">{trashedPrompts.length} item{trashedPrompts.length === 1 ? '' : 's'}</p>
            </div>
            {trashedPrompts.length > 0 && (
              <button
                onClick={() => { onEmptyTrash(); toast.success('Trash emptied') }}
                className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors"
              >
                Empty Trash
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {trashedPrompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <Trash2 className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm font-medium">Trash is empty</p>
            </div>
          ) : (
            trashedPrompts.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden opacity-75">
                <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
                  <p className="flex-1 text-sm font-semibold text-slate-800 truncate">{p.title}</p>
                </div>
                <p className="px-3 pb-2 text-xs text-slate-400 line-clamp-1 leading-relaxed">{p.content}</p>
                <div className="flex items-center gap-1 px-3 pb-2">
                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-semibold rounded capitalize">
                    {p.category}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-2 border-t border-slate-50 bg-slate-50/60">
                  <button
                    onClick={() => { onRestore(p.id); toast.success(`"${p.title}" restored`) }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:border-blue-300 hover:text-blue-600 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" /> Restore
                  </button>
                  <button
                    onClick={() => { onPermanentDelete(p.id); toast.success('Permanently deleted') }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-400 text-xs font-semibold rounded-lg hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-auto"
                  >
                    <X className="w-3 h-3" /> Delete forever
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // ── Library view ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ background: '#f0f4f8' }}>
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-0 border-b border-slate-100">
        <div className="flex items-center justify-between mb-0.5">
          <h1 className="text-base font-semibold text-slate-900">Saved Prompts</h1>
          {trashedPrompts.length > 0 && (
            <button
              onClick={() => setView('trash')}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Trash ({trashedPrompts.length})
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-3">Your prompt library</p>

        {/* Search row */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-100 rounded-lg border-0 outline-none focus:ring-2 focus:ring-blue-200 placeholder-slate-400"
            />
          </div>
          <button
            onClick={() => setShowFavorites((v) => !v)}
            title="Show favourites"
            className={`p-1.5 rounded-lg transition-colors ${
              showFavorites ? 'bg-amber-100 text-amber-500' : 'text-slate-400 hover:bg-slate-100'
            }`}
          >
            <Star className={`w-4 h-4 ${showFavorites ? 'fill-amber-400' : ''}`} />
          </button>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>

        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const count = cat.id === 'all'
              ? prompts.length
              : prompts.filter((p) => p.category === cat.id).length
            const isActive = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all shrink-0 ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {cat.label}
                <span className={`text-[10px] font-semibold px-1 py-0.5 rounded-full ${
                  isActive ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Add new prompt form */}
      {isAdding && (
        <div className="mx-3 mt-3 bg-white rounded-xl p-3 shadow-sm border border-slate-100">
          <textarea
            autoFocus
            placeholder="Enter a new prompt..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            className="w-full text-sm text-slate-700 placeholder-slate-400 resize-none outline-none min-h-[80px]"
          />
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-400">{newText.length}/1000 chars</span>
            <div className="flex gap-2">
              <button
                onClick={() => { setIsAdding(false); setNewText('') }}
                className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Search className="w-8 h-8 mb-2 opacity-25" />
            <p className="text-sm font-medium">
              {prompts.length === 0 ? 'No prompts yet' : 'No prompts found'}
            </p>
            <p className="text-xs mt-1 text-center">
              {prompts.length === 0
                ? 'Tap + New to save your first prompt'
                : 'Try a different search or category'}
            </p>
          </div>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Title + star */}
              <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                <p className="flex-1 text-sm font-semibold text-slate-800 truncate">{p.title}</p>
                <button
                  onClick={() => onToggleFavorite(p.id)}
                  title="Favourite"
                  className="shrink-0 text-slate-300 hover:text-amber-400 transition-colors"
                >
                  <Star className={`w-3.5 h-3.5 ${p.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                </button>
              </div>

              {/* Short description only — hidden if not set */}
              {p.description && (
                <p className="px-3 pb-2 text-xs text-slate-400 line-clamp-1 leading-relaxed italic">
                  {p.description}
                </p>
              )}

              {/* Tags */}
              <div className="flex items-center gap-1 px-3 pb-2.5">
                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-semibold rounded capitalize">
                  {p.category}
                </span>
                {p.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="px-1.5 py-0.5 bg-blue-50 text-blue-500 text-[10px] font-medium rounded">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Action bar */}
              <div className="flex items-center gap-0.5 px-2.5 py-2 border-t border-slate-50 bg-slate-50/60">
                <button
                  onClick={() => handleCopy(p)}
                  title="Copy prompt"
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors mr-1"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
                <button
                  onClick={() => { onEnhance(p); toast('Opening enhancer…', { icon: '✨' }) }}
                  title="Enhance — improve quality with AI"
                  className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { onOptimize(p); toast('Opening optimizer…', { icon: '📊' }) }}
                  title="Optimize — analyse for clarity & structure"
                  className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { onEdit(p); toast('Opening editor…', { icon: '✏️' }) }}
                  title="Edit prompt"
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { onDuplicate(p.id); toast.success('Prompt duplicated') }}
                  title="Duplicate prompt"
                  className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <CopyPlus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { onTrash(p.id); toast('Moved to Trash', { icon: '🗑️', action: { label: 'Undo', onClick: () => onRestore(p.id) } }) }}
                  title="Move to Trash"
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
