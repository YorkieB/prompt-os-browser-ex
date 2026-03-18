import { useState } from 'react'
import { Prompt, EnhancementMode } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { enhancePrompt } from '@/lib/enhancer'
import { Copy, Sparkle } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface EnhanceDialogProps {
  prompt: Prompt | null
  open: boolean
  onClose: () => void
}

export function EnhanceDialog({ prompt, open, onClose }: EnhanceDialogProps) {
  const [mode, setMode] = useState<EnhancementMode>('coding')
  const [referenceImage, setReferenceImage] = useState('')
  const [enhancedResult, setEnhancedResult] = useState<string>('')
  const [isEnhancing, setIsEnhancing] = useState(false)

  const handleEnhance = async () => {
    if (!prompt) return

    setIsEnhancing(true)
    try {
      const result = await enhancePrompt({
        prompt: prompt.content,
        mode,
        referenceImage: referenceImage || undefined,
      })
      setEnhancedResult(result)
      toast.success('Prompt enhanced successfully!')
    } catch (error) {
      toast.error('Failed to enhance prompt')
      console.error(error)
    } finally {
      setIsEnhancing(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(enhancedResult)
    toast.success('Enhanced prompt copied to clipboard!')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Enhance Prompt</DialogTitle>
          <DialogDescription>
            Select an enhancement mode and generate a structured, comprehensive version of your
            prompt
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Label className="text-sm font-medium mb-2 block">Original Prompt</Label>
            <div className="p-4 bg-muted rounded-md font-mono text-sm">
              {prompt?.content || ''}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Enhancement Mode</Label>
            <Tabs value={mode} onValueChange={(v) => setMode(v as EnhancementMode)}>
              <TabsList className="grid grid-cols-6 w-full">
                <TabsTrigger value="coding">Coding</TabsTrigger>
                <TabsTrigger value="image">Image</TabsTrigger>
                <TabsTrigger value="video">Video</TabsTrigger>
                <TabsTrigger value="research">Research</TabsTrigger>
                <TabsTrigger value="planning">Planning</TabsTrigger>
                <TabsTrigger value="agent">Agent</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {(mode === 'image' || mode === 'video') && (
            <div>
              <Label htmlFor="reference-image" className="text-sm font-medium mb-2 block">
                Reference Image Description (Optional)
              </Label>
              <Textarea
                id="reference-image"
                placeholder="Describe a reference image to extract visual attributes..."
                value={referenceImage}
                onChange={(e) => setReferenceImage(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <Button onClick={handleEnhance} disabled={isEnhancing} className="w-full" size="lg">
            <Sparkle className="w-5 h-5" />
            {isEnhancing ? 'Enhancing...' : 'Enhance Prompt'}
          </Button>

          {enhancedResult && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Enhanced Result</Label>
                <Button size="sm" onClick={handleCopy} variant="outline">
                  <Copy className="w-4 h-4" />
                  Copy
                </Button>
              </div>
              <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                <pre className="text-sm font-mono whitespace-pre-wrap">{enhancedResult}</pre>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
