import { PromptCategory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Terminal, Image, Video, MagnifyingGlass, ListChecks, Robot } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface CategorySidebarProps {
  selected: PromptCategory | 'all'
  onSelect: (category: PromptCategory | 'all') => void
}

const categories: Array<{ id: PromptCategory | 'all'; label: string; icon: typeof Terminal }> = [
  { id: 'all', label: 'All Prompts', icon: ListChecks },
  { id: 'coding', label: 'Coding', icon: Terminal },
  { id: 'image', label: 'Image', icon: Image },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'research', label: 'Research', icon: MagnifyingGlass },
  { id: 'planning', label: 'Planning', icon: ListChecks },
  { id: 'agents', label: 'Agents', icon: Robot },
  { id: 'personal', label: 'Personal', icon: ListChecks },
]

export function CategorySidebar({ selected, onSelect }: CategorySidebarProps) {
  return (
    <div className="w-64 bg-card border-r border-border p-6 space-y-2">
      <h2 className="font-bold text-2xl mb-6 tracking-tight">Prompt OS</h2>
      {categories.map((category) => {
        const Icon = category.icon
        return (
          <Button
            key={category.id}
            variant={selected === category.id ? 'default' : 'ghost'}
            className={cn(
              'w-full justify-start gap-3 transition-all duration-150',
              selected === category.id && 'bg-primary text-primary-foreground'
            )}
            onClick={() => onSelect(category.id)}
          >
            <Icon className="w-5 h-5" />
            <span>{category.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
