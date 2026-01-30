'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { Sparkles, RefreshCw, Copy, Loader2, Globe, Megaphone, Linkedin, Mail, MessageSquare } from 'lucide-react'
import type { TutorOnboarding, Asset } from '@/lib/types'
import { generateAssetAction } from './actions'

const ASSET_TYPES = [
  { id: 'landing_page', label: 'Landing Page', icon: Globe },
  { id: 'ad_angles', label: 'Ad Angles', icon: Megaphone },
  { id: 'linkedin_outreach', label: 'LinkedIn', icon: Linkedin },
  { id: 'email_sequence', label: 'Emails', icon: Mail },
  { id: 'dm_sequence', label: 'DMs', icon: MessageSquare },
]

interface AssetsContentProps {
  onboarding: TutorOnboarding
  assets: Asset[]
  tutorName: string
}

export function AssetsContent({ onboarding, assets, tutorName }: AssetsContentProps) {
  const [loadingType, setLoadingType] = useState<string | null>(null)
  const [localAssets, setLocalAssets] = useState<Record<string, any>>(() => {
    const map: Record<string, any> = {}
    assets.forEach(a => {
      map[a.asset_type] = a.content
    })
    return map
  })
  const { toast } = useToast()
  const router = useRouter()

  const handleGenerate = async (assetType: string) => {
    setLoadingType(assetType)
    try {
      const result = await generateAssetAction(assetType, onboarding, tutorName)
      if (result.error) throw new Error(result.error)
      setLocalAssets(prev => ({ ...prev, [assetType]: result.content }))
      toast({
        title: 'Asset Generated!',
        description: `Your ${assetType.replace('_', ' ')} is ready.`,
      })
      router.refresh()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate asset',
        variant: 'destructive',
      })
    } finally {
      setLoadingType(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copied!',
      description: 'Content copied to clipboard',
    })
  }

  const copyAll = (assetType: string) => {
    const content = localAssets[assetType]
    if (!content) return
    const text = JSON.stringify(content, null, 2)
      .replace(/[{}\[\]",]/g, '')
      .replace(/^\s+/gm, '')
    copyToClipboard(text)
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI Marketing Assets</h1>
        <p className="text-muted-foreground">
          Generate copy and scripts for all your marketing channels
        </p>
      </div>

      <Tabs defaultValue="landing_page">
        <TabsList className="grid grid-cols-5 mb-6">
          {ASSET_TYPES.map(type => (
            <TabsTrigger key={type.id} value={type.id} className="gap-2">
              <type.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{type.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {ASSET_TYPES.map(type => (
          <TabsContent key={type.id} value={type.id}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{type.label}</CardTitle>
                  <CardDescription>
                    {type.id === 'landing_page' && 'Headlines, bullets, and CTAs for your landing page'}
                    {type.id === 'ad_angles' && 'Three different ad angles with hooks and copy'}
                    {type.id === 'linkedin_outreach' && 'Connection request and follow-up messages'}
                    {type.id === 'email_sequence' && 'Five-email nurture sequence for leads'}
                    {type.id === 'dm_sequence' && 'Five-message DM sequence for social outreach'}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {localAssets[type.id] && (
                    <Button variant="outline" size="sm" onClick={() => copyAll(type.id)}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy All
                    </Button>
                  )}
                  <Button 
                    onClick={() => handleGenerate(type.id)}
                    disabled={loadingType === type.id}
                    size="sm"
                  >
                    {loadingType === type.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : localAssets[type.id] ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Regenerate
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!localAssets[type.id] ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <type.icon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Click Generate to create your {type.label.toLowerCase()}</p>
                  </div>
                ) : (
                  <AssetRenderer type={type.id} content={localAssets[type.id]} onCopy={copyToClipboard} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function AssetRenderer({ type, content, onCopy }: { type: string; content: any; onCopy: (text: string) => void }) {
  if (type === 'landing_page') {
    return (
      <div className="space-y-4">
        <CopyableBlock label="Headline" content={content.headline} onCopy={onCopy} />
        <CopyableBlock label="Subheadline" content={content.subheadline} onCopy={onCopy} />
        <div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-medium text-muted-foreground">Bullets</p>
            <Button variant="ghost" size="sm" onClick={() => onCopy(content.bullets?.join('\n'))}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {content.bullets?.map((bullet: string, i: number) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        </div>
        <CopyableBlock label="CTA" content={content.cta} onCopy={onCopy} />
        <CopyableBlock label="Social Proof" content={content.social_proof} onCopy={onCopy} />
      </div>
    )
  }

  if (type === 'ad_angles') {
    return (
      <div className="space-y-4">
        {content.angles?.map((angle: any, i: number) => (
          <div key={i} className="p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-primary">Angle {i + 1}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onCopy(`${angle.hook}\n\n${angle.headline}\n\n${angle.body}`)}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <p className="font-semibold mb-1">{angle.hook}</p>
            <p className="text-lg font-bold mb-2">{angle.headline}</p>
            <p className="text-gray-600">{angle.body}</p>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'linkedin_outreach') {
    return (
      <div className="space-y-4">
        <CopyableBlock label="Connection Request" content={content.connection_request} onCopy={onCopy} />
        <CopyableBlock label="Initial Message" content={content.initial_message} onCopy={onCopy} />
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Follow-ups</p>
          {content.follow_ups?.map((msg: string, i: number) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg mb-2">
              <div className="flex justify-between items-start">
                <span className="text-xs font-medium text-primary mb-1">Follow-up {i + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => onCopy(msg)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm">{msg}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'email_sequence') {
    return (
      <div className="space-y-4">
        {content.emails?.map((email: any, i: number) => (
          <div key={i} className="p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-primary">Email {i + 1}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onCopy(`Subject: ${email.subject}\n\n${email.body}`)}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <p className="font-semibold mb-2">Subject: {email.subject}</p>
            <p className="text-gray-600 whitespace-pre-wrap">{email.body}</p>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'dm_sequence') {
    return (
      <div className="space-y-4">
        {content.messages?.map((msg: any, i: number) => (
          <div key={i} className="p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-primary">{msg.timing}</span>
              <Button variant="ghost" size="sm" onClick={() => onCopy(msg.message)}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <p className="text-gray-600">{msg.message}</p>
          </div>
        ))}
      </div>
    )
  }

  return <pre className="text-sm overflow-auto">{JSON.stringify(content, null, 2)}</pre>
}

function CopyableBlock({ label, content, onCopy }: { label: string; content: string; onCopy: (text: string) => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Button variant="ghost" size="sm" onClick={() => onCopy(content)}>
          <Copy className="w-3 h-3" />
        </Button>
      </div>
      <p className="p-3 bg-gray-50 rounded-lg">{content}</p>
    </div>
  )
}
