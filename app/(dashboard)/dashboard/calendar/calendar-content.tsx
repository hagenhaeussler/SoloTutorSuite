'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { AlertCircle, Bell, Calendar, CheckCircle2, Clock, ExternalLink, Link2, Loader2, Plus, RefreshCw, Trash2, Unplug, XCircle } from 'lucide-react'
import type { AvailabilityRule, Booking, CalendarEvent, GoogleCalendarConnectionSummary, GoogleCalendarEvent, UnifiedCalendarEvent } from '@/lib/types'
import { addRuleAction, deleteRuleAction, updateReminderPreferenceAction, cancelBookingAction, createTeacherCalendarEventAction, listTeacherGoogleEventsAction } from './actions'
import { getDayName, formatDateTime } from '@/lib/utils'

interface CalendarContentProps {
  rules: AvailabilityRule[]
  bookings: Booking[]
  calendarEvents: CalendarEvent[]
  slug: string
  reminderMinutesBefore: number
  googleConnection: GoogleCalendarConnectionSummary | null
  googleEvents: GoogleCalendarEvent[]
  googleWarning: string | null
  initialRangeStart: string
  initialRangeEnd: string
}

type Meridiem = 'AM' | 'PM'

const padTime = (value: number) => value.toString().padStart(2, '0')

const toDateInputValue = (date: Date | string) => {
  const value = new Date(date)
  if (Number.isNaN(value.getTime())) return ''
  return value.toISOString().slice(0, 10)
}

const toDateTimeLocalValue = (date: Date | string) => {
  const value = new Date(date)
  if (Number.isNaN(value.getTime())) return ''
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

const fromDateTimeLocalValue = (value: string) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

const getRangeIso = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T23:59:59`)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null
  }

  return { timeMin: start.toISOString(), timeMax: end.toISOString() }
}

const formatTimeForDisplay = (time24: string) => {
  const [hoursStr, minutesStr] = time24.split(':')
  const hours = parseInt(hoursStr, 10)
  const minutes = parseInt(minutesStr, 10)

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time24

  const period: Meridiem = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${padTime(minutes)} ${period}`
}

const toTimeEditorValue = (time24: string) => {
  const [hoursStr, minutesStr] = time24.split(':')
  const hours = parseInt(hoursStr, 10)
  const minutes = parseInt(minutesStr, 10)

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return { time: '9:00', period: 'AM' as Meridiem, time24: '09:00' }
  }

  const period: Meridiem = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return { time: `${hour12}:${padTime(minutes)}`, period, time24: `${padTime(hours)}:${padTime(minutes)}` }
}

const parseFlexibleTimeInput = (rawInput: string, selectedPeriod: Meridiem) => {
  const normalized = rawInput.trim().toUpperCase().replace(/\s+/g, '')
  const match = normalized.match(/^(\d{1,2})(?::?(\d{2}))?(AM|PM)?$/)

  if (!match) return null

  const inputHour = parseInt(match[1], 10)
  const inputMinute = match[2] ? parseInt(match[2], 10) : 0
  const explicitPeriod = (match[3] as Meridiem | undefined)

  if (Number.isNaN(inputHour) || Number.isNaN(inputMinute) || inputMinute < 0 || inputMinute > 59) {
    return null
  }

  let hours24: number
  let period: Meridiem

  if (explicitPeriod) {
    if (inputHour < 1 || inputHour > 12) return null
    period = explicitPeriod
    hours24 = inputHour % 12
    if (period === 'PM') hours24 += 12
  } else if (inputHour > 12) {
    if (inputHour > 23) return null
    hours24 = inputHour
    period = hours24 >= 12 ? 'PM' : 'AM'
  } else {
    if (inputHour < 1 || inputHour > 12) return null
    period = selectedPeriod
    hours24 = inputHour % 12
    if (period === 'PM') hours24 += 12
  }

  const displayHour = hours24 % 12 || 12

  return {
    time24: `${padTime(hours24)}:${padTime(inputMinute)}`,
    time: `${displayHour}:${padTime(inputMinute)}`,
    period,
  }
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

export function CalendarContent({
  rules,
  bookings,
  calendarEvents,
  slug,
  reminderMinutesBefore,
  googleConnection,
  googleEvents,
  googleWarning,
  initialRangeStart,
  initialRangeEnd,
}: CalendarContentProps) {
  const initialStartTime = toTimeEditorValue('09:00')
  const initialEndTime = toTimeEditorValue('17:00')
  const defaultEventStart = new Date(Date.now() + 60 * 60 * 1000)
  const defaultEventEnd = new Date(defaultEventStart.getTime() + 60 * 60 * 1000)
  const [loading, setLoading] = useState(false)
  const [savingReminder, setSavingReminder] = useState(false)
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [syncingGoogle, setSyncingGoogle] = useState(false)
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState(googleEvents)
  const [googleCalendarWarning, setGoogleCalendarWarning] = useState<string | null>(googleWarning)
  const [rangeStart, setRangeStart] = useState(toDateInputValue(initialRangeStart))
  const [rangeEnd, setRangeEnd] = useState(toDateInputValue(initialRangeEnd))
  const [newCalendarEvent, setNewCalendarEvent] = useState({
    title: '',
    description: '',
    location: '',
    start_ts: toDateTimeLocalValue(defaultEventStart),
    end_ts: toDateTimeLocalValue(defaultEventEnd),
    event_type: 'teacher_event' as 'teacher_event' | 'lesson_event',
    add_to_google_calendar: googleConnection?.connection_status === 'connected',
  })
  const [reminderOffset, setReminderOffset] = useState(String(reminderMinutesBefore || 10))
  const [newRule, setNewRule] = useState({
    day_of_week: '',
    start_time: '09:00',
    end_time: '17:00',
    session_length: '60',
    buffer_time: '15',
  })
  const [startTimeInput, setStartTimeInput] = useState(initialStartTime.time)
  const [startPeriod, setStartPeriod] = useState<Meridiem>(initialStartTime.period)
  const [endTimeInput, setEndTimeInput] = useState(initialEndTime.time)
  const [endPeriod, setEndPeriod] = useState<Meridiem>(initialEndTime.period)
  const { toast } = useToast()
  const router = useRouter()
  const googleConnected = googleConnection?.connection_status === 'connected'

  const unifiedEvents = useMemo<UnifiedCalendarEvent[]>(() => {
    const appItems: UnifiedCalendarEvent[] = calendarEvents.map((event) => ({
      id: `app:${event.id}`,
      title: event.title,
      description: event.description,
      location: event.location,
      start: event.start_ts,
      end: event.end_ts,
      source: 'app',
      sourceLabel: event.event_type === 'lesson_event' ? 'Lesson' : 'SoloTutorSuite',
      htmlLink: event.google_html_link,
      googleSyncStatus: event.google_sync_status,
    }))

    const bookingItems: UnifiedCalendarEvent[] = bookings.map((booking) => ({
      id: `booking:${booking.id}`,
      title: `Booking with ${booking.prospect_name}`,
      description: booking.reason,
      start: booking.start_ts,
      end: booking.end_ts,
      source: 'booking',
      sourceLabel: 'Booking',
      htmlLink: booking.google_html_link,
      googleSyncStatus: booking.google_sync_status,
    }))

    const googleItems: UnifiedCalendarEvent[] = googleCalendarEvents.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      start: event.start,
      end: event.end,
      source: 'google',
      sourceLabel: event.sourceLabel,
      htmlLink: event.htmlLink,
    }))

    return [...appItems, ...bookingItems, ...googleItems].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    )
  }, [bookings, calendarEvents, googleCalendarEvents])

  const handleAddRule = async () => {
    if (!newRule.day_of_week) {
      toast({ title: 'Select a day', variant: 'destructive' })
      return
    }

    const normalizedStart = parseFlexibleTimeInput(startTimeInput, startPeriod)
    const normalizedEnd = parseFlexibleTimeInput(endTimeInput, endPeriod)

    if (!normalizedStart || !normalizedEnd) {
      toast({
        title: 'Invalid time format',
        description: 'Use a format like 5:00 PM or 17:00.',
        variant: 'destructive',
      })
      return
    }

    const startTotalMinutes = parseInt(normalizedStart.time24.slice(0, 2), 10) * 60 + parseInt(normalizedStart.time24.slice(3, 5), 10)
    const endTotalMinutes = parseInt(normalizedEnd.time24.slice(0, 2), 10) * 60 + parseInt(normalizedEnd.time24.slice(3, 5), 10)

    if (endTotalMinutes <= startTotalMinutes) {
      toast({
        title: 'Invalid time range',
        description: 'End time must be later than start time.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const result = await addRuleAction({
        day_of_week: parseInt(newRule.day_of_week),
        start_time: normalizedStart.time24,
        end_time: normalizedEnd.time24,
        session_length: parseInt(newRule.session_length),
        buffer_time: parseInt(newRule.buffer_time),
      })
      if (result.error) throw new Error(result.error)
      toast({ title: 'Availability added!' })
      setNewRule({ ...newRule, day_of_week: '' })
      setStartTimeInput(normalizedStart.time)
      setStartPeriod(normalizedStart.period)
      setEndTimeInput(normalizedEnd.time)
      setEndPeriod(normalizedEnd.period)
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

  const handleSaveReminderPreference = async () => {
    const minutes = parseInt(reminderOffset, 10)
    if (Number.isNaN(minutes)) {
      toast({ title: 'Invalid reminder value', variant: 'destructive' })
      return
    }

    setSavingReminder(true)
    try {
      const result = await updateReminderPreferenceAction(minutes)
      if (result.error) throw new Error(result.error)
      toast({ title: 'Reminder preference saved' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSavingReminder(false)
    }
  }

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Cancel this booking? Pending reminder emails for this lesson will also be cancelled.')) {
      return
    }

    try {
      const result = await cancelBookingAction(bookingId)
      if (result.error) throw new Error(result.error)
      toast({ title: 'Booking cancelled' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const handleCreateCalendarEvent = async () => {
    const startIso = fromDateTimeLocalValue(newCalendarEvent.start_ts)
    const endIso = fromDateTimeLocalValue(newCalendarEvent.end_ts)

    if (!startIso || !endIso) {
      toast({ title: 'Invalid event time', variant: 'destructive' })
      return
    }

    setCreatingEvent(true)
    try {
      const result = await createTeacherCalendarEventAction({
        title: newCalendarEvent.title,
        description: newCalendarEvent.description,
        location: newCalendarEvent.location,
        start_ts: startIso,
        end_ts: endIso,
        event_type: newCalendarEvent.event_type,
        add_to_google_calendar: newCalendarEvent.add_to_google_calendar && googleConnected,
      })

      if (result.error) throw new Error(result.error)

      toast({
        title: 'Calendar event created',
        description: result.warning || undefined,
      })
      setNewCalendarEvent({
        title: '',
        description: '',
        location: '',
        start_ts: toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)),
        end_ts: toDateTimeLocalValue(new Date(Date.now() + 2 * 60 * 60 * 1000)),
        event_type: 'teacher_event',
        add_to_google_calendar: googleConnected,
      })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setCreatingEvent(false)
    }
  }

  const handleSyncGoogleEvents = async () => {
    const range = getRangeIso(rangeStart, rangeEnd)
    if (!range) {
      toast({ title: 'Invalid date range', variant: 'destructive' })
      return
    }

    setSyncingGoogle(true)
    setGoogleCalendarWarning(null)
    try {
      const result = await listTeacherGoogleEventsAction({
        ...range,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })

      if (result.error) throw new Error(result.error)

      setGoogleCalendarEvents(result.events || [])
      setGoogleCalendarWarning(result.warning || null)
      toast({
        title: 'Calendar refreshed',
        description: result.warning || undefined,
      })
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSyncingGoogle(false)
    }
  }

  const handleDisconnectGoogle = async () => {
    setSyncingGoogle(true)
    try {
      const response = await fetch('/api/google-calendar/disconnect', { method: 'POST' })
      const result = await response.json()
      if (!response.ok || result.error) throw new Error(result.error || 'Failed to disconnect')

      setGoogleCalendarEvents([])
      toast({ title: 'Google Calendar disconnected' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSyncingGoogle(false)
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Google Calendar
          </CardTitle>
          <CardDescription>
            {googleConnected
              ? `Connected${googleConnection?.google_email ? ` as ${googleConnection.google_email}` : ''}`
              : googleConnection?.connection_status === 'needs_reconnect'
                ? 'Reconnect to keep syncing events.'
                : 'Connect your primary Google Calendar.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {googleCalendarWarning && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{googleCalendarWarning}</span>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={googleConnected ? 'success' : googleConnection?.connection_status === 'needs_reconnect' ? 'destructive' : 'outline'}>
                {googleConnected ? 'Connected' : googleConnection?.connection_status === 'needs_reconnect' ? 'Needs reconnect' : 'Not connected'}
              </Badge>
              {googleConnected && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            </div>
            <div className="flex flex-wrap gap-2">
              {!googleConnected && (
                <Button asChild>
                  <a href={`/api/google-calendar/oauth/start?returnTo=${encodeURIComponent('/dashboard/calendar')}`}>
                    <Link2 className="mr-2 h-4 w-4" />
                    Connect Google Calendar
                  </a>
                </Button>
              )}
              {googleConnected && (
                <>
                  <Button variant="outline" onClick={handleSyncGoogleEvents} disabled={syncingGoogle}>
                    {syncingGoogle ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Sync Now
                  </Button>
                  <Button variant="ghost" onClick={handleDisconnectGoogle} disabled={syncingGoogle}>
                    <Unplug className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </>
              )}
            </div>
          </div>
          {googleConnected && (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={handleSyncGoogleEvents} disabled={syncingGoogle} className="w-full">
                  {syncingGoogle ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Refresh
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Booking Reminder Emails
          </CardTitle>
          <CardDescription>
            Default reminder timing for new bookings. Confirmation emails send immediately after a booking is confirmed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Select value={reminderOffset} onValueChange={setReminderOffset}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 minutes before</SelectItem>
                <SelectItem value="10">10 minutes before</SelectItem>
                <SelectItem value="15">15 minutes before</SelectItem>
                <SelectItem value="30">30 minutes before</SelectItem>
                <SelectItem value="60">60 minutes before</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSaveReminderPreference} disabled={savingReminder}>
              {savingReminder && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Reminder Setting
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create Calendar Event
          </CardTitle>
          <CardDescription>
            Add a lesson or personal teaching event to your schedule.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label className="text-xs">Title</Label>
              <Input
                value={newCalendarEvent.title}
                onChange={(event) => setNewCalendarEvent({ ...newCalendarEvent, title: event.target.value })}
                placeholder="SAT prep with Maya"
              />
            </div>
            <div>
              <Label className="text-xs">Start</Label>
              <Input
                type="datetime-local"
                value={newCalendarEvent.start_ts}
                onChange={(event) => setNewCalendarEvent({ ...newCalendarEvent, start_ts: event.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">End</Label>
              <Input
                type="datetime-local"
                value={newCalendarEvent.end_ts}
                onChange={(event) => setNewCalendarEvent({ ...newCalendarEvent, end_ts: event.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select
                value={newCalendarEvent.event_type}
                onValueChange={(value) => setNewCalendarEvent({ ...newCalendarEvent, event_type: value as 'teacher_event' | 'lesson_event' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher_event">Calendar event</SelectItem>
                  <SelectItem value="lesson_event">Lesson event</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Location</Label>
              <Input
                value={newCalendarEvent.location}
                onChange={(event) => setNewCalendarEvent({ ...newCalendarEvent, location: event.target.value })}
                placeholder="Zoom, library, studio"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Description</Label>
              <Input
                value={newCalendarEvent.description}
                onChange={(event) => setNewCalendarEvent({ ...newCalendarEvent, description: event.target.value })}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={newCalendarEvent.add_to_google_calendar && googleConnected}
                disabled={!googleConnected}
                onCheckedChange={(checked) => setNewCalendarEvent({ ...newCalendarEvent, add_to_google_calendar: Boolean(checked) })}
              />
              Add to my Google Calendar
            </label>
            {!googleConnected && (
              <Button variant="outline" asChild>
                <a href={`/api/google-calendar/oauth/start?returnTo=${encodeURIComponent('/dashboard/calendar')}`}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Connect Google Calendar
                </a>
              </Button>
            )}
            <Button onClick={handleCreateCalendarEvent} disabled={creatingEvent || !newCalendarEvent.title.trim()}>
              {creatingEvent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create Event
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Schedule
          </CardTitle>
          <CardDescription>
            SoloTutorSuite bookings, calendar entries, and Google events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unifiedEvents.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No events in this range yet.
            </p>
          ) : (
            <div className="space-y-3">
              {unifiedEvents.map((event) => (
                <div key={event.id} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{event.title}</p>
                        <Badge variant={event.source === 'google' ? 'outline' : 'secondary'}>
                          {event.sourceLabel}
                        </Badge>
                        {event.googleSyncStatus === 'failed' && (
                          <Badge variant="destructive">Google sync failed</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDateTime(event.start)} - {formatDateTime(event.end)}
                      </p>
                      {event.location && (
                        <p className="text-sm text-muted-foreground mt-1">{event.location}</p>
                      )}
                      {event.description && (
                        <p className="text-sm mt-2">{event.description}</p>
                      )}
                    </div>
                    {event.htmlLink && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={event.htmlLink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
              <div className="space-y-3">
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Start</Label>
                    <div className="flex gap-1">
                      <Input
                        type="text"
                        className="flex-1 min-w-0"
                        value={startTimeInput}
                        placeholder="9:00"
                        onChange={(e) => setStartTimeInput(e.target.value)}
                        onBlur={() => {
                          const parsed = parseFlexibleTimeInput(startTimeInput, startPeriod)
                          if (!parsed) return
                          setStartTimeInput(parsed.time)
                          setStartPeriod(parsed.period)
                          setNewRule({ ...newRule, start_time: parsed.time24 })
                        }}
                      />
                      <Select
                        value={startPeriod}
                        onValueChange={(value) => {
                          const nextPeriod = value as Meridiem
                          setStartPeriod(nextPeriod)
                          const parsed = parseFlexibleTimeInput(startTimeInput, nextPeriod)
                          if (!parsed) return
                          setStartTimeInput(parsed.time)
                          setStartPeriod(parsed.period)
                          setNewRule({ ...newRule, start_time: parsed.time24 })
                        }}
                      >
                        <SelectTrigger className="w-[70px] shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AM">AM</SelectItem>
                          <SelectItem value="PM">PM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">End</Label>
                    <div className="flex gap-1">
                      <Input
                        type="text"
                        className="flex-1 min-w-0"
                        value={endTimeInput}
                        placeholder="5:00"
                        onChange={(e) => setEndTimeInput(e.target.value)}
                        onBlur={() => {
                          const parsed = parseFlexibleTimeInput(endTimeInput, endPeriod)
                          if (!parsed) return
                          setEndTimeInput(parsed.time)
                          setEndPeriod(parsed.period)
                          setNewRule({ ...newRule, end_time: parsed.time24 })
                        }}
                      />
                      <Select
                        value={endPeriod}
                        onValueChange={(value) => {
                          const nextPeriod = value as Meridiem
                          setEndPeriod(nextPeriod)
                          const parsed = parseFlexibleTimeInput(endTimeInput, nextPeriod)
                          if (!parsed) return
                          setEndTimeInput(parsed.time)
                          setEndPeriod(parsed.period)
                          setNewRule({ ...newRule, end_time: parsed.time24 })
                        }}
                      >
                        <SelectTrigger className="w-[70px] shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AM">AM</SelectItem>
                          <SelectItem value="PM">PM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tip: You can type either 12-hour time (e.g. 5:00 PM) or 24-hour time (e.g. 17:00). We&apos;ll normalize it automatically.
                </p>
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
                        {formatTimeForDisplay(rule.start_time)} - {formatTimeForDisplay(rule.end_time)} · {rule.session_length}min sessions
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
                    {booking.status === 'confirmed' && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelBooking(booking.id)}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Cancel Booking
                        </Button>
                      </div>
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
