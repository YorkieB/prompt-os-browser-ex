import { Prompt } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Star, Copy, Pencil, ClipboardCopy, BarChart2, Sparkles, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

interface PromptCardProps {
  prompt: Prompt
  onEdit: (prompt: Prompt) => void
  onCopy: () => void
  onEnhance: (prompt: Prompt) => void
  onOptimize: (prompt: Prompt) => void
  onDuplicate: (prompt: Prompt) => void
  onDelete: (id: string) => void
  onToggleFavorite: (id: string) => void
}

export function PromptCard({
  prompt,
  onEdit,
  onCopy,
  onEnhance,
  onOptimize,
  onDuplicate,
  onDelete,
  onToggleFavorite,
}: Readonly<PromptCardProps>) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
      <Card className="p-3 hover:shadow-md transition-all duration-150 hover:border-accent/50">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="font-semibold text-sm leading-tight flex items-center gap-1.5 flex-1 min-w-0">
            <span className="truncate">{prompt.title}</span>
            {prompt.isFavorite && <Star className="w-3 h-3 text-accent fill-accent shrink-0" />}
          </h3>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0 -mt-0.5 -mr-0.5"
            onClick={() => onToggleFavorite(prompt.id)}
          >
            <Star className={`w-3.5 h-3.5 ${prompt.isFavorite ? 'fill-accent text-accent' : ''}`} />
          </Button>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-2">
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {prompt.category}
          </Badge>
          {prompt.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Role preview */}
        <p className="text-xs text-muted-foreground line-clamp-1 italic mb-1">
          {prompt.role}
        </p>

        {/* Content preview */}
        <p className="text-xs text-muted-foreground line-clamp-2 font-mono mb-2.5">
          {prompt.content}
        </p>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-1">
          <Button size="sm" className="h-7 text-xs px-2" onClick={onCopy}>
            <Copy className="w-3 h-3" />
            Copy
          </Button>
          <Button size="sm" variant="secondary" className="h-7 text-xs px-2" onClick={() => onEnhance(prompt)}>
            <Sparkles className="w-3 h-3" />
            Enhance
          </Button>
          <Button size="sm" variant="secondary" className="h-7 text-xs px-2" onClick={() => onOptimize(prompt)}>
            <BarChart2 className="w-3 h-3" />
            Optimize
          </Button>
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => onEdit(prompt)}>
            <Pencil className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => onDuplicate(prompt)}>
            <ClipboardCopy className="w-3 h-3" />
          </Button>
          {prompt.isCustom && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => onDelete(prompt.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  )
}
