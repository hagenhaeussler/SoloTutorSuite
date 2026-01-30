'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { Globe, ExternalLink, Save, Loader2, Plus, X, Eye } from 'lucide-react'
import type { TutorSite } from '@/lib/types'
import { updateSiteAction } from './actions'

interface SiteContentProps {
  site: TutorSite | null
  tutorName: string
  subjects: string[]
}

export function SiteContent({ site, tutorName, subjects }: SiteContentProps) {
  const [loading, setLoading] = useState(false)
  const [headline, setHeadline] = useState(site?.headline || '')
  const [bio, setBio] = useState(site?.bio || '')
  const [packages, setPackages] = useState<Array<{ name: string; price: number; description?: string }>>(
    site?.packages || []
  )
  const [bookingLink, setBookingLink] = useState(site?.booking_link || '')
  const [published, setPublished] = useState(site?.published || false)
  const { toast } = useToast()
  const router = useRouter()

  const addPackage = () => {
    setPackages([...packages, { name: '', price: 0, description: '' }])
  }

  const updatePackage = (index: number, field: string, value: string | number) => {
    const updated = [...packages]
    updated[index] = { ...updated[index], [field]: value }
    setPackages(updated)
  }

  const removePackage = (index: number) => {
    setPackages(packages.filter((_, i) => i !== index))
  }

  const handleSave = async (publish = false) => {
    setLoading(true)
    try {
      const result = await updateSiteAction({
        headline,
        bio,
        packages,
        booking_link: bookingLink,
        published: publish ? true : published,
      })
      
      if (result.error) throw new Error(result.error)
      
      if (publish) setPublished(true)
      
      toast({
        title: publish ? 'Site Published!' : 'Changes Saved',
        description: publish 
          ? 'Your mini-site is now live!'
          : 'Your changes have been saved.',
      })
      router.refresh()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save changes',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const siteUrl = site?.slug ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/t/${site.slug}` : null

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mini-Site</h1>
          <p className="text-muted-foreground">
            Your professional tutor profile page
          </p>
        </div>
        <div className="flex gap-2">
          {siteUrl && (
            <a href={`/t/${site?.slug}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
            </a>
          )}
          <Button onClick={() => handleSave()} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save
          </Button>
          {!published && (
            <Button onClick={() => handleSave(true)} disabled={loading}>
              <Globe className="w-4 h-4 mr-2" />
              Publish
            </Button>
          )}
        </div>
      </div>

      {/* Site URL */}
      {siteUrl && (
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={published ? 'success' : 'secondary'}>
                  {published ? 'Published' : 'Draft'}
                </Badge>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                  /t/{site?.slug}
                </code>
              </div>
              {published && (
                <a 
                  href={`/t/${site?.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  View Live Site
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Your headline and bio that visitors will see
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Headline</Label>
              <Input
                placeholder="e.g., Expert Math Tutor Helping Students Excel"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
              />
            </div>
            <div>
              <Label>Bio</Label>
              <Textarea
                placeholder="Tell potential students about yourself, your experience, and teaching style..."
                rows={5}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Packages */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Packages</CardTitle>
                <CardDescription>
                  Pricing options displayed on your site
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addPackage}>
                <Plus className="w-4 h-4 mr-2" />
                Add Package
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {packages.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No packages yet. Add one to display pricing on your site.
              </p>
            ) : (
              <div className="space-y-4">
                {packages.map((pkg, i) => (
                  <div key={i} className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Name</Label>
                          <Input
                            placeholder="e.g., Single Session"
                            value={pkg.name}
                            onChange={(e) => updatePackage(i, 'name', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Price ($)</Label>
                          <Input
                            type="number"
                            value={pkg.price || ''}
                            onChange={(e) => updatePackage(i, 'price', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Description</Label>
                        <Input
                          placeholder="e.g., 60-minute one-on-one session"
                          value={pkg.description || ''}
                          onChange={(e) => updatePackage(i, 'description', e.target.value)}
                        />
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => removePackage(i)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Booking Link */}
        <Card>
          <CardHeader>
            <CardTitle>Booking</CardTitle>
            <CardDescription>
              Link to your booking page or scheduling tool
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label>Custom Booking Link (optional)</Label>
              <Input
                placeholder="Leave empty to use built-in booking page"
                value={bookingLink}
                onChange={(e) => setBookingLink(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Default: /book/{site?.slug}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
