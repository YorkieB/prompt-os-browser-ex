import { useState, useMemo } from 'react'
import { useStorage } from '@/hooks/useStorage'
import { Prompt, PromptCategory } from '@/lib/types'
import { defaultPrompts } from '@/lib/defaultPrompts'
import { SavedPromptsTab } from '@/components/tabs/SavedPromptsTab'
import { CraftTab } from '@/components/tabs/CraftTab'
import { ExportChatTab } from '@/components/tabs/ExportChatTab'
import { FeaturesTab } from '@/components/tabs/FeaturesTab'
import { EnhanceDialog } from '@/components/EnhanceDialog'
import { EditorDialog } from '@/components/EditorDialog'
import { OptimizerDialog } from '@/components/OptimizerDialog'
import { ApiKeySettings } from '@/components/ApiKeySettings'
import { Bookmark, Sparkles, Share2, Zap, FlaskConical, Stethoscope, ListTodo, FileText } from 'lucide-react'
import { ResearchTab } from '@/components/tabs/ResearchTab'
import { DiagnosticsTab } from '@/components/tabs/DiagnosticsTab'
import { PlanningSuiteTab } from '@/components/tabs/PlanningSuiteTab'
import { InstructionalContractTab } from '@/components/tabs/InstructionalContractTab'

type Tab = 'saved' | 'craft' | 'export' | 'research' | 'planning' | 'contract' | 'diagnostics' | 'features'

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: 'saved',       label: 'Saved',       icon: Bookmark     },
  { id: 'craft',       label: 'Craft',       icon: Sparkles     },
  { id: 'export',      label: 'Export',      icon: Share2       },
  { id: 'research',    label: 'Research',    icon: FlaskConical },
  { id: 'planning',    label: 'Plan',        icon: ListTodo     },
  { id: 'contract',    label: 'Contract',    icon: FileText     },
  { id: 'diagnostics', label: 'Diagnostics', icon: Stethoscope  },
  { id: 'features',    label: 'Features',    icon: Zap          },
]

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('saved')
  const [customPrompts, setCustomPrompts] = useStorage<Prompt[]>('custom-prompts', [])
  const [favorites, setFavorites] = useStorage<string[]>('favorites', [])
  const [trashedIds, setTrashedIds] = useStorage<string[]>('trashed-prompt-ids', [])
  const [deletedIds, setDeletedIds] = useStorage<string[]>('permanently-deleted-ids', [])
  const [enhancePrompt, setEnhancePrompt] = useState<Prompt | null>(null)
  const [optimizePrompt, setOptimizePrompt] = useState<Prompt | null>(null)
  const [editorPrompt, setEditorPrompt] = useState<Prompt | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const allPrompts = useMemo(() => {
    const trashed = trashedIds || []
    const deleted = deletedIds || []
    const combined = [...defaultPrompts, ...(customPrompts || [])]
    return combined
      .filter((p) => !trashed.includes(p.id) && !deleted.includes(p.id))
      .map((p) => ({ ...p, isFavorite: (favorites || []).includes(p.id) }))
  }, [customPrompts, favorites, trashedIds, deletedIds])

  const trashedPrompts = useMemo(() => {
    const trashed = trashedIds || []
    const deleted = deletedIds || []
    const combined = [...defaultPrompts, ...(customPrompts || [])]
    return combined.filter((p) => trashed.includes(p.id) && !deleted.includes(p.id)).map((p) => ({ ...p, isFavorite: false }))
  }, [customPrompts, trashedIds, deletedIds])

  const handleAddCustom = (text: string) => {
    const prompt: Prompt = {
      id: `custom-${Date.now()}`,
      title: text.slice(0, 50),
      icon: '',
      content: text,
      role: '',
      category: 'personal' as PromptCategory,
      tags: [],
      variables: [],
      isCustom: true,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setCustomPrompts((cur) => [...(cur || []), prompt])
  }

  const handleSaveGenerated = (prompt: Prompt) => {
    setCustomPrompts((cur) => [...(cur || []), prompt])
  }

  const handleTrash = (id: string) => {
    setTrashedIds((cur) => [...(cur || []), id])
  }

  const handleRestore = (id: string) => {
    setTrashedIds((cur) => (cur || []).filter((t) => t !== id))
  }

  const handlePermanentDelete = (id: string) => {
    const isCustom = (customPrompts || []).some((p) => p.id === id)
    if (isCustom) {
      setCustomPrompts((cur) => (cur || []).filter((p) => p.id !== id))
    } else {
      setDeletedIds((cur) => [...(cur || []), id])
    }
    setTrashedIds((cur) => (cur || []).filter((t) => t !== id))
  }

  const handleEmptyTrash = () => {
    const trashed = trashedIds || []
    const customIds = new Set((customPrompts || []).map((p) => p.id))
    const defaultTrashed = trashed.filter((id) => !customIds.has(id))
    setCustomPrompts((cur) => (cur || []).filter((p) => !trashed.includes(p.id)))
    setDeletedIds((cur) => [...(cur || []), ...defaultTrashed])
    setTrashedIds([])
  }

  const handleToggleFavorite = (id: string) => {
    setFavorites((cur) => {
      const favs = cur || []
      return favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id]
    })
  }

  const handleDuplicate = (id: string) => {
    const original = allPrompts.find((p) => p.id === id)
    if (!original) return
    const copy: Prompt = {
      ...original,
      id: `custom-${Date.now()}`,
      title: `${original.title} (copy)`,
      isCustom: true,
      isFavorite: false,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setCustomPrompts((cur) => [...(cur || []), copy])
  }

  const handleSaveEdit = (prompt: Prompt) => {
    setCustomPrompts((cur) => {
      const prompts = cur || []
      const idx = prompts.findIndex((p) => p.id === prompt.id)
      if (idx >= 0) {
        const updated = [...prompts]
        updated[idx] = prompt
        return updated
      }
      return [...prompts, prompt]
    })
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'saved' && (
          <SavedPromptsTab
            prompts={allPrompts}
            trashedPrompts={trashedPrompts}
            onAddCustom={handleAddCustom}
            onTrash={handleTrash}
            onRestore={handleRestore}
            onPermanentDelete={handlePermanentDelete}
            onEmptyTrash={handleEmptyTrash}
            onToggleFavorite={handleToggleFavorite}
            onEnhance={setEnhancePrompt}
            onOptimize={setOptimizePrompt}
            onDuplicate={handleDuplicate}
            onEdit={(p) => { setEditorPrompt(p); setIsEditorOpen(true) }}
          />
        )}
        {activeTab === 'craft' && (
          <CraftTab onSaveGenerated={handleSaveGenerated} />
        )}
        {activeTab === 'export' && <ExportChatTab />}
        {activeTab === 'research' && <ResearchTab />}
        {activeTab === 'planning' && <PlanningSuiteTab />}
        {activeTab === 'contract' && <InstructionalContractTab />}
        {activeTab === 'diagnostics' && <DiagnosticsTab />}
        {activeTab === 'features' && (
          <FeaturesTab onOpenSettings={() => setIsSettingsOpen(true)} />
        )}
      </div>

      {/* Bottom navigation */}
      <nav className="bg-white border-t border-slate-200 flex shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
                isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'fill-blue-100' : ''}`} />
              <span className="text-[10px] font-medium leading-tight text-center">{tab.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Dialogs */}
      <ApiKeySettings open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <EnhanceDialog
        prompt={enhancePrompt}
        open={enhancePrompt !== null}
        onClose={() => setEnhancePrompt(null)}
      />
      <OptimizerDialog
        prompt={optimizePrompt}
        open={optimizePrompt !== null}
        onClose={() => setOptimizePrompt(null)}
      />
      <EditorDialog
        prompt={editorPrompt}
        open={isEditorOpen}
        onClose={() => { setIsEditorOpen(false); setEditorPrompt(null) }}
        onSave={handleSaveEdit}
      />
    </div>
  )
}

export default App
