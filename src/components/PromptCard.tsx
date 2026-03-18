import { Prompt, PromptCategory } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Copy, PencilSimple, Star, Sparkle, Trash, CopySimple, ChartBar } from '@phosphor-icons/react'
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
}: PromptCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="p-6 hover:shadow-lg transition-all duration-200 hover:border-accent/50 group">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
              {prompt.title}
              {prompt.isFavorite && (
                <Star weight="fill" className="w-4 h-4 text-accent" />
              )}
            </h3>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                {prompt.category}
              </Badge>
              {prompt.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onToggleFavorite(prompt.id)}
            className="shrink-0"
          >
            <Star weight={prompt.isFavorite ? 'fill' : 'regular'} className="w-5 h-5" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2 italic mb-2">
          {prompt.role}
        </p>

        <p className="text-sm text-muted-foreground line-clamp-3 font-mono mb-4">
          {prompt.content}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onCopy}>
            <Copy className="w-4 h-4" />
            Copy
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onEnhance(prompt)}>
            <Sparkle className="w-4 h-4" />
            Enhance
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onOptimize(prompt)}>
            <ChartBar className="w-4 h-4" />
            Optimize
          </Button>
          <Button size="sm" variant="outline" onClick={() => onEdit(prompt)}>
            <PencilSimple className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDuplicate(prompt)}>
            <CopySimple className="w-4 h-4" />
          </Button>
          {prompt.isCustom && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete(prompt.id)}
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  )
}
