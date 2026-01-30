'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { Sparkles, RefreshCw, Copy, Loader2, Target, Megaphone, Package, TrendingUp, CheckSquare, BarChart } from 'lucide-react'
import type { TutorOnboarding, GrowthPlan } from '@/lib/types'
import { generatePlanAction } from './actions'

interface GrowthPlanContentProps {
  onboarding: TutorOnboarding
  growthPlan: GrowthPlan | null
  tutorName: string
}

export function GrowthPlanContent({ onboarding, growthPlan, tutorName }: GrowthPlanContentProps) {
  const [plan, setPlan] = useState(growthPlan?.plan_json || null)
  const [loading, setLoading] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())
  const { toast } = useToast()
  const router = useRouter()

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const result = await generatePlanAction(onboarding, tutorName)
      if (result.error) throw new Error(result.error)
      setPlan(result.plan)
      setCheckedItems(new Set())
      toast({
        title: 'Growth Plan Generated!',
        description: 'Your personalized marketing strategy is ready.',
      })
      router.refresh()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate plan',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copied!',
      description: 'Content copied to clipboard',
    })
  }

  const toggleChecked = (index: number) => {
    const newChecked = new Set(checkedItems)
    if (newChecked.has(index)) {
      newChecked.delete(index)
    } else {
      newChecked.add(index)
    }
    setCheckedItems(newChecked)
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI Growth Plan</h1>
          <p className="text-muted-foreground">
            Your personalized marketing strategy based on your profile
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : plan ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Plan
            </>
          )}
        </Button>
      </div>

      {!plan ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Growth Plan Yet</h3>
            <p className="text-muted-foreground mb-4">
              Click the button above to generate your personalized marketing strategy
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Positioning */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Positioning</CardTitle>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => copyToClipboard(plan.positioning)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{plan.positioning}</p>
            </CardContent>
          </Card>

          {/* Best Channels */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Best Marketing Channels</CardTitle>
              </div>
              <CardDescription>Focus your efforts on these platforms</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {plan.channels?.map((channel: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-sm">
                    {channel}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Offers */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Offer Ideas</CardTitle>
              </div>
              <CardDescription>Packages and offers to attract clients</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {plan.offers?.map((offer: { name: string; description: string }, i: number) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg">
                    <h4 className="font-medium">{offer.name}</h4>
                    <p className="text-sm text-muted-foreground">{offer.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Funnel Steps */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Client Funnel</CardTitle>
              </div>
              <CardDescription>How to convert prospects to paying clients</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {plan.funnel_steps?.map((step: string, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-medium shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-gray-700">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Weekly Checklist */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Weekly Checklist</CardTitle>
              </div>
              <CardDescription>
                {checkedItems.size}/{plan.weekly_checklist?.length || 0} completed this week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {plan.weekly_checklist?.map((item: string, i: number) => (
                  <label 
                    key={i} 
                    className="flex items-start gap-3 cursor-pointer group"
                  >
                    <Checkbox 
                      checked={checkedItems.has(i)}
                      onCheckedChange={() => toggleChecked(i)}
                    />
                    <span className={`text-gray-700 ${checkedItems.has(i) ? 'line-through text-muted-foreground' : ''}`}>
                      {item}
                    </span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* KPIs */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Key Performance Indicators</CardTitle>
              </div>
              <CardDescription>Track these metrics to measure success</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                {plan.kpis?.map((kpi: { metric: string; target: string }, i: number) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">{kpi.metric}</p>
                    <p className="font-semibold text-primary">{kpi.target}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
