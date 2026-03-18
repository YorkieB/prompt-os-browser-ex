import { useState, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { Prompt, PromptCategory } from '@/lib/types'
import { defaultPrompts } from '@/lib/defaultPrompts'
import { CategorySidebar } from '@/components/CategorySidebar'
import { PromptCard } from '@/components/PromptCard'
import { EnhanceDialog } from '@/components/EnhanceDialog'
import { EditorDialog } from '@/components/EditorDialog'
import { OptimizerDialog } from '@/components/OptimizerDialog'
import { RoleFilter } from '@/components/RoleFilter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MagnifyingGlass, Plus, X } from '@phosphor-icons/react'
import { toast } from 'sonner'

function App() {
  const [customPrompts, setCustomPrompts] = useKV<Prompt[]>('custom-prompts', [])
  const [favorites, setFavorites] = useKV<string[]>('favorites', [])
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory | 'all'>('all')
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [enhancePrompt, setEnhancePrompt] = useState<Prompt | null>(null)
  const [optimizePrompt, setOptimizePrompt] = useState<Prompt | null>(null)
  const [editorPrompt, setEditorPrompt] = useState<Prompt | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)

  const allPrompts = useMemo(() => {
    const combined = [...defaultPrompts, ...(customPrompts || [])]
    return combined.map((p) => ({
      ...p,
      isFavorite: (favorites || []).includes(p.id),
    }))
  }, [customPrompts, favorites])

  const filteredPrompts = useMemo(() => {
    let filtered = allPrompts

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((p) => p.category === selectedCategory)
    }

    if (selectedRole) {
      filtered = filtered.filter((p) => p.role === selectedRole)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.content.toLowerCase().includes(query) ||
          p.role.toLowerCase().includes(query) ||
          p.tags.some((tag) => tag.toLowerCase().includes(query))
      )
    }

    return filtered
  }, [allPrompts, selectedCategory, selectedRole, searchQuery])

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success('Prompt copied to clipboard!')
  }

  const handleCopyWithRole = (prompt: Prompt) => {
    const fullPrompt = `${prompt.role}\n\n${prompt.content}`
    navigator.clipboard.writeText(fullPrompt)
    toast.success('Prompt with role copied to clipboard!')
  }

  const handleEnhance = (prompt: Prompt) => {
    setEnhancePrompt(prompt)
  }

  const handleOptimize = (prompt: Prompt) => {
    setOptimizePrompt(prompt)
  }

  const handleEdit = (prompt: Prompt) => {
    setEditorPrompt(prompt)
    setIsEditorOpen(true)
  }

  const handleDuplicate = (prompt: Prompt) => {
    const duplicated: Prompt = {
      ...prompt,
      id: `custom-${Date.now()}`,
      title: `${prompt.title} (Copy)`,
      isCustom: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    }
    setCustomPrompts((current) => [...(current || []), duplicated])
    toast.success('Prompt duplicated!')
  }

  const handleDelete = (id: string) => {
    setCustomPrompts((current) => (current || []).filter((p) => p.id !== id))
    toast.success('Prompt deleted!')
  }

  const handleToggleFavorite = (id: string) => {
    setFavorites((current) => {
      const favs = current || []
      if (favs.includes(id)) {
        return favs.filter((f) => f !== id)
      } else {
        return [...favs, id]
      }
    })
  }

  const handleSavePrompt = (prompt: Prompt) => {
    setCustomPrompts((current) => {
      const prompts = current || []
      const existingIndex = prompts.findIndex((p) => p.id === prompt.id)
      if (existingIndex >= 0) {
        const updated = [...prompts]
        updated[existingIndex] = prompt
        return updated
      } else {
        return [...prompts, prompt]
      }
    })
    toast.success(editorPrompt ? 'Prompt updated!' : 'Prompt created!')
  }

  const handleCreateNew = () => {
    setEditorPrompt(null)
    setIsEditorOpen(true)
  }

  const handleClearFilters = () => {
    setSearchQuery('')
    setSelectedRole(null)
    toast.success('Filters cleared!')
  }

  const hasActiveFilters = searchQuery !== '' || selectedRole !== null

  return (
    <div className="flex h-screen bg-background">
      <CategorySidebar selected={selectedCategory} onSelect={setSelectedCategory} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {selectedCategory === 'all'
                  ? 'All Prompts'
                  : selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}
              </h1>
              <p className="text-muted-foreground mt-1">
                {filteredPrompts.length} prompt{filteredPrompts.length !== 1 ? 's' : ''} available
              </p>
            </div>
            <Button onClick={handleCreateNew} size="lg">
              <Plus className="w-5 h-5" weight="bold" />
              Create Prompt
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search prompts by title, role, content, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <RoleFilter
              prompts={allPrompts}
              selectedRole={selectedRole}
              onRoleChange={setSelectedRole}
            />
            {hasActiveFilters && (
              <Button onClick={handleClearFilters} variant="outline">
                <X className="w-4 h-4" weight="bold" />
                Clear Filters
              </Button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPrompts.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                onEdit={handleEdit}
                onCopy={() => handleCopyWithRole(prompt)}
                onEnhance={handleEnhance}
                onOptimize={handleOptimize}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>

          {filteredPrompts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg">No prompts found</p>
              <p className="text-muted-foreground text-sm mt-2">
                Try adjusting your filters or create a new prompt
              </p>
            </div>
          )}
        </main>
      </div>

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
        onClose={() => {
          setIsEditorOpen(false)
          setEditorPrompt(null)
        }}
        onSave={handleSavePrompt}
      />
    </div>
  )
}

export default App