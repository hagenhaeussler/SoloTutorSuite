'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Mail } from 'lucide-react'
import { submitTutorInquiryAction } from './actions'

export function InquiryForm({ slug, accentColor }: { slug: string; accentColor?: string | null }) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [desiredStartDate, setDesiredStartDate] = useState('')
  const { toast } = useToast()

  const onSubmit = async () => {
    if (!name || !email || !message) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const result = await submitTutorInquiryAction({
        tutor_slug: slug,
        name,
        email,
        message,
        desired_start_date: desiredStartDate,
      })

      if (result.error) throw new Error(result.error)

      toast({ title: 'Inquiry sent!', description: 'The tutor will follow up soon.' })
      setName('')
      setEmail('')
      setMessage('')
      setDesiredStartDate('')
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" style={{ color: accentColor || undefined }} />
          Contact / Request Booking
        </CardTitle>
        <CardDescription>
          Not ready to book a time slot? Send a request and receive a tailored response.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
          </div>
        </div>

        <div>
          <Label>Preferred start date</Label>
          <Input type="date" value={desiredStartDate} onChange={(e) => setDesiredStartDate(e.target.value)} />
        </div>

        <div>
          <Label>Message *</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Tell the tutor what support you need..." />
        </div>

        <Button onClick={onSubmit} disabled={loading} style={{ backgroundColor: accentColor || undefined }}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Send Request
        </Button>
      </CardContent>
    </Card>
  )
}
