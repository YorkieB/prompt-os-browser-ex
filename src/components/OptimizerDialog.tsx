import { useState } from 'react'
import { Prompt } from '@/lib/types'
import { PromptAnalysis, analyzePrompt, getScoreColor, getScoreLabel } from '@/lib/optimizer'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import {
  BarChart3,
  Copy,
  Lightbulb,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

function scoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' {
  if (score >= 70) return 'default'
  if (score >= 50) return 'secondary'
  return 'destructive'
}

interface OptimizerDialogProps {
  readonly prompt: Prompt | null
  readonly open: boolean
  readonly onClose: () => void
  readonly onApplyOptimization?: (optimizedPrompt: string) => void
}

export function OptimizerDialog({ prompt, open, onClose, onApplyOptimization }: OptimizerDialogProps) {
  const [analysis, setAnalysis] = useState<PromptAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleAnalyze = async () => {
    if (!prompt) return

    setIsAnalyzing(true)
    try {
      const result = await analyzePrompt({
        prompt: prompt.content,
        role: prompt.role,
        category: prompt.category,
      })
      setAnalysis(result)
      toast.success('Analysis complete!')
    } catch (error) {
      toast.error('Failed to analyze prompt')
      console.error(error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCopyOptimized = () => {
    if (analysis?.optimizedVersion) {
      navigator.clipboard.writeText(analysis.optimizedVersion)
      toast.success('Optimized prompt copied to clipboard!')
    }
  }

  const handleApplyOptimized = () => {
    if (analysis?.optimizedVersion && onApplyOptimization) {
      onApplyOptimization(analysis.optimizedVersion)
      toast.success('Optimization applied!')
      onClose()
    }
  }

  const renderDimensionCard = (
    title: string,
    dimension: { score: number; issues: string[]; suggestions: string[] }
  ) => (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-sm">{title}</h4>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${getScoreColor(dimension.score)}`}>
            {dimension.score}
          </span>
          <Badge variant={scoreBadgeVariant(dimension.score)}>
            {getScoreLabel(dimension.score)}
          </Badge>
        </div>
      </div>
      <Progress value={dimension.score} className="mb-3" />
      
      {dimension.issues.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <AlertTriangle className="w-4 h-4" />
            Issues Found
          </div>
          <ul className="space-y-1">
            {dimension.issues.map((issue) => (
              <li key={issue} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-destructive mt-1">•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {dimension.suggestions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Lightbulb className="w-4 h-4" />
            Suggestions
          </div>
          <ul className="space-y-1">
            {dimension.suggestions.map((suggestion) => (
              <li key={suggestion} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-accent mt-1">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Prompt Optimizer
          </DialogTitle>
          <DialogDescription>
            Analyze your prompt's effectiveness and get AI-powered suggestions for improvement
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium mb-2">Original Prompt</p>
            <div className="p-4 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground italic mb-2">{prompt?.role}</p>
              <p className="text-sm font-mono">{prompt?.content}</p>
            </div>
          </div>

          {!analysis && (
            <Button 
              onClick={handleAnalyze} 
              disabled={isAnalyzing} 
              className="w-full" 
              size="lg"
            >
              <RefreshCw className={`w-5 h-5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              {isAnalyzing ? 'Analyzing Prompt...' : 'Analyze Prompt'}
            </Button>
          )}

          {analysis && (
            <ScrollArea className="h-[500px]">
              <div className="space-y-6 pr-4">
                <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold mb-1">Overall Effectiveness Score</h3>
                      <p className="text-sm text-muted-foreground">
                        Based on comprehensive analysis across 5 dimensions
                      </p>
                    </div>
                    <div className="text-center">
                      <div className={`text-5xl font-bold ${getScoreColor(analysis.overallScore)}`}>
                        {analysis.overallScore}
                      </div>
                      <Badge 
                        className="mt-2"
                        variant={scoreBadgeVariant(analysis.overallScore)}
                      >
                        {getScoreLabel(analysis.overallScore)}
                      </Badge>
                    </div>
                  </div>
                </Card>

                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Detailed Analysis
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderDimensionCard('Clarity', analysis.clarity)}
                    {renderDimensionCard('Specificity', analysis.specificity)}
                    {renderDimensionCard('Structure', analysis.structure)}
                    {renderDimensionCard('Completeness', analysis.completeness)}
                    {renderDimensionCard('Effectiveness', analysis.effectiveness)}
                  </div>
                </div>

                {analysis.improvements.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Top Recommendations
                    </h3>
                    <Card className="p-4">
                      <ol className="space-y-3">
                        {analysis.improvements.map((improvement, i) => (
                          <li key={improvement} className="flex items-start gap-3">
                            <Badge className="shrink-0 mt-0.5">{i + 1}</Badge>
                            <span className="text-sm">{improvement}</span>
                          </li>
                        ))}
                      </ol>
                    </Card>
                  </div>
                )}

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Lightbulb className="w-5 h-5" />
                      Optimized Version
                    </h3>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleCopyOptimized} variant="outline">
                        <Copy className="w-4 h-4" />
                        Copy
                      </Button>
                      {onApplyOptimization && (
                        <Button size="sm" onClick={handleApplyOptimized}>
                          <CheckCircle className="w-4 h-4" />
                          Apply
                        </Button>
                      )}
                    </div>
                  </div>
                  <Card className="p-4 bg-accent/5 border-accent/20">
                    <pre className="text-sm font-mono whitespace-pre-wrap">
                      {analysis.optimizedVersion}
                    </pre>
                  </Card>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button onClick={handleAnalyze} variant="outline" className="flex-1">
                    <RefreshCw className="w-4 h-4" />
                    Re-analyze
                  </Button>
                  <Button onClick={onClose} variant="secondary" className="flex-1">
                    Close
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
