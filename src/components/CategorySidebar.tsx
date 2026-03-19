import { PromptCategory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Terminal, Image, Video, Search, ListChecks, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CategorySidebarProps {
  readonly selected: PromptCategory | 'all'
  readonly onSelect: (category: PromptCategory | 'all') => void
}

const categories: Array<{
  id: PromptCategory | 'all'
  label: string
  icon: React.ElementType
}> = [
  { id: 'all', label: 'All Prompts', icon: ListChecks },
  { id: 'coding', label: 'Coding', icon: Terminal },
  { id: 'image', label: 'Image', icon: Image },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'research', label: 'Research', icon: Search },
  { id: 'planning', label: 'Planning', icon: ListChecks },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'personal', label: 'Personal', icon: User },
]

export function CategorySidebar({ selected, onSelect }: CategorySidebarProps) {
  return (
    <div className="w-48 shrink-0 bg-card border-r border-border px-3 py-4 space-y-1">
      <h2 className="font-bold text-lg mb-4 px-2 tracking-tight">Nexus</h2>
      {categories.map((category) => {
        const Icon = category.icon
        return (
          <Button
            key={category.id}
            variant={selected === category.id ? 'default' : 'ghost'}
            className={cn(
              'w-full justify-start gap-2 text-sm transition-all duration-150',
              selected === category.id && 'bg-primary text-primary-foreground'
            )}
            onClick={() => onSelect(category.id)}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{category.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
