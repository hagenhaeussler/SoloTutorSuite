'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { Calendar, Clock, Plus, Trash2, ExternalLink, Loader2 } from 'lucide-react'
import type { AvailabilityRule, Booking } from '@/lib/types'
import { addRuleAction, deleteRuleAction } from './actions'
import { getDayName, formatDateTime } from '@/lib/utils'

interface CalendarContentProps {
  rules: AvailabilityRule[]
  bookings: Booking[]
  slug: string
}

const DAYS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
]

export function CalendarContent({ rules, bookings, slug }: CalendarContentProps) {
  const [loading, setLoading] = useState(false)
  const [newRule, setNewRule] = useState({
    day_of_week: '',
    start_time: '09:00',
    end_time: '17:00',
    session_length: '60',
    buffer_time: '15',
  })
  const { toast } = useToast()
  const router = useRouter()

  const handleAddRule = async () => {
    if (!newRule.day_of_week) {
      toast({ title: 'Select a day', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const result = await addRuleAction({
        day_of_week: parseInt(newRule.day_of_week),
        start_time: newRule.start_time,
        end_time: newRule.end_time,
        session_length: parseInt(newRule.session_length),
        buffer_time: parseInt(newRule.buffer_time),
      })
      if (result.error) throw new Error(result.error)
      toast({ title: 'Availability added!' })
      setNewRule({ ...newRule, day_of_week: '' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteRuleAction(id)
      toast({ title: 'Availability removed' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const bookingUrl = slug ? `/book/${slug}` : null

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Calendar & Booking</h1>
          <p className="text-muted-foreground">
            Set your availability and view upcoming bookings
          </p>
        </div>
        {bookingUrl && (
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">
              <ExternalLink className="w-4 h-4 mr-2" />
              View Booking Page
            </Button>
          </a>
        )}
      </div>

      {/* Booking Link */}
      {bookingUrl && (
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Your booking link:</span>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded flex-1">
                {typeof window !== 'undefined' ? window.location.origin : ''}{bookingUrl}
              </code>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    (typeof window !== 'undefined' ? window.location.origin : '') + bookingUrl
                  )
                  toast({ title: 'Link copied!' })
                }}
              >
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Availability */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Availability
            </CardTitle>
            <CardDescription>
              Set your weekly schedule
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Add Rule Form */}
            <div className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Day</Label>
                  <Select
                    value={newRule.day_of_week}
                    onValueChange={(v) => setNewRule({ ...newRule, day_of_week: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Start</Label>
                    <Input
                      type="time"
                      value={newRule.start_time}
                      onChange={(e) => setNewRule({ ...newRule, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">End</Label>
                    <Input
                      type="time"
                      value={newRule.end_time}
                      onChange={(e) => setNewRule({ ...newRule, end_time: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Session (min)</Label>
                  <Select
                    value={newRule.session_length}
                    onValueChange={(v) => setNewRule({ ...newRule, session_length: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="45">45 min</SelectItem>
                      <SelectItem value="60">60 min</SelectItem>
                      <SelectItem value="90">90 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Buffer (min)</Label>
                  <Select
                    value={newRule.buffer_time}
                    onValueChange={(v) => setNewRule({ ...newRule, buffer_time: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No buffer</SelectItem>
                      <SelectItem value="5">5 min</SelectItem>
                      <SelectItem value="10">10 min</SelectItem>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleAddRule} disabled={loading} className="w-full">
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Add Availability
              </Button>
            </div>

            {/* Rules List */}
            {rules.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No availability set. Add your schedule above.
              </p>
            ) : (
              <div className="space-y-2">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-3 bg-white border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{getDayName(rule.day_of_week)}</p>
                      <p className="text-sm text-muted-foreground">
                        {rule.start_time} - {rule.end_time} · {rule.session_length}min sessions
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Bookings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Upcoming Bookings
            </CardTitle>
            <CardDescription>
              Sessions scheduled with you
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No upcoming bookings yet.
              </p>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{booking.prospect_name}</p>
                        <p className="text-sm text-muted-foreground">{booking.prospect_email}</p>
                      </div>
                      <Badge variant="secondary">
                        {booking.status}
                      </Badge>
                    </div>
                    <p className="text-sm mt-2">
                      {formatDateTime(booking.start_ts)}
                    </p>
                    {booking.reason && (
                      <p className="text-sm text-muted-foreground mt-1">
                        &quot;{booking.reason}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
