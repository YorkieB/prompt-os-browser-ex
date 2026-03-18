import { useState, useEffect } from 'react'
import { Prompt, PromptCategory } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface EditorDialogProps {
  prompt: Prompt | null
  open: boolean
  onClose: () => void
  onSave: (prompt: Prompt) => void
}

export function EditorDialog({ prompt, open, onClose, onSave }: EditorDialogProps) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<PromptCategory>('personal')
  const [role, setRole] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')

  useEffect(() => {
    if (prompt) {
      setTitle(prompt.title)
      setCategory(prompt.category)
      setRole(prompt.role)
      setContent(prompt.content)
      setTags(prompt.tags.join(', '))
    } else {
      setTitle('')
      setCategory('personal')
      setRole('')
      setContent('')
      setTags('')
    }
  }, [prompt])

  const handleSave = () => {
    const updatedPrompt: Prompt = {
      id: prompt?.id || `custom-${Date.now()}`,
      title,
      icon: 'Terminal',
      category,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      variables: [],
      role,
      content,
      version: (prompt?.version || 0) + 1,
      createdAt: prompt?.createdAt || Date.now(),
      updatedAt: Date.now(),
      isFavorite: prompt?.isFavorite || false,
      isCustom: true,
    }
    onSave(updatedPrompt)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {prompt ? 'Edit Prompt' : 'Create New Prompt'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Custom Prompt"
            />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as PromptCategory)}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coding">Coding</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="research">Research</SelectItem>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="agents">Agents</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="role">Role (starts with "You are a...")</Label>
            <Textarea
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="You are a senior software engineer with expertise in..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="react, component, typescript"
            />
          </div>

          <div>
            <Label htmlFor="content">Prompt Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your prompt content here..."
              rows={10}
              className="font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title || !role || !content}>
            {prompt ? 'Save Changes' : 'Create Prompt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
