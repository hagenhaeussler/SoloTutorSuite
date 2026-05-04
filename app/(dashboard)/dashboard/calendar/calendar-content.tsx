'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { AlertCircle, Bell, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Clock, ExternalLink, Link2, Loader2, Plus, RefreshCw, Trash2, Unplug, XCircle } from 'lucide-react'
import type { AvailabilityRule, Booking, CalendarEvent, GoogleCalendarConnectionSummary, GoogleCalendarEvent, UnifiedCalendarEvent } from '@/lib/types'
import { getGoogleCalendarDisconnectedText, getGoogleCalendarReasonText, getGoogleCalendarStatusDiagnostic } from '@/lib/google-calendar/diagnostics'
import { addRuleAction, deleteRuleAction, updateReminderPreferenceAction, cancelBookingAction, createTeacherCalendarEventAction, loadTeacherCalendarRangeAction } from './actions'
import { cn, getDayName } from '@/lib/utils'

interface CalendarContentProps {
  rules: AvailabilityRule[]
  bookings: Booking[]
  calendarEvents: CalendarEvent[]
  slug: string
  reminderMinutesBefore: number
  googleConnection: GoogleCalendarConnectionSummary | null
  googleEvents: GoogleCalendarEvent[]
  googleWarning: string | null
  googleCalendarStatus: string | null
  googleCalendarReason: string | null
}

type Meridiem = 'AM' | 'PM'

const padTime = (value: number) => value.toString().padStart(2, '0')

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

const toDateKey = (date: Date | string) => {
  const value = new Date(date)

  if (Number.isNaN(value.getTime())) return ''

  return [
    value.getFullYear(),
    padTime(value.getMonth() + 1),
    padTime(value.getDate()),
  ].join('-')
}

const getMonthGridRange = (monthDate: Date) => {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0, 0)
  start.setDate(start.getDate() - start.getDay())

  const end = new Date(start)
  end.setDate(start.getDate() + 41)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

const getMonthDays = (monthDate: Date) => {
  const { start } = getMonthGridRange(monthDate)

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

const formatSelectedDayLabel = (dateKey: string) => {
  const date = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(date.getTime())) return 'Selected day'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

const formatEventTimeRange = (start: string, end: string) => {
  const startDate = new Date(start)
  const endDate = new Date(end)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return ''
  }

  return `${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

const getEventSourceClassName = (source: UnifiedCalendarEvent['source']) => {
  if (source === 'google') return 'border-amber-300 bg-amber-50 text-amber-950'
  if (source === 'booking') return 'border-blue-300 bg-blue-50 text-blue-950'
  if (source === 'homework') return 'border-purple-300 bg-purple-50 text-purple-950'
  return 'border-emerald-300 bg-emerald-50 text-emerald-950'
}

const getEventSourceDotClassName = (source: UnifiedCalendarEvent['source']) => {
  if (source === 'google') return 'bg-amber-500'
  if (source === 'booking') return 'bg-blue-500'
  if (source === 'homework') return 'bg-purple-500'
  return 'bg-emerald-500'
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
  googleCalendarStatus,
  googleCalendarReason,
}: CalendarContentProps) {
  const initialStartTime = toTimeEditorValue('09:00')
  const initialEndTime = toTimeEditorValue('17:00')
  const defaultEventStart = new Date(Date.now() + 60 * 60 * 1000)
  const defaultEventEnd = new Date(defaultEventStart.getTime() + 60 * 60 * 1000)
  const [loading, setLoading] = useState(false)
  const [savingReminder, setSavingReminder] = useState(false)
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [syncingGoogle, setSyncingGoogle] = useState(false)
  const [calendarEventItems, setCalendarEventItems] = useState(calendarEvents)
  const [bookingItems, setBookingItems] = useState(bookings)
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState(googleEvents)
  const [googleCalendarWarning, setGoogleCalendarWarning] = useState<string | null>(googleWarning)
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()))
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

  useEffect(() => {
    setCalendarEventItems(calendarEvents)
    setBookingItems(bookings)
    setGoogleCalendarEvents(googleEvents)
    setGoogleCalendarWarning(googleWarning)
  }, [bookings, calendarEvents, googleEvents, googleWarning])

  useEffect(() => {
    if (!googleConnected) return

    setNewCalendarEvent((current) => ({
      ...current,
      add_to_google_calendar: true,
    }))
  }, [googleConnected])

  const unifiedEvents = useMemo<UnifiedCalendarEvent[]>(() => {
    const appItems: UnifiedCalendarEvent[] = calendarEventItems.map((event) => ({
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

    const bookingCalendarItems: UnifiedCalendarEvent[] = bookingItems.map((booking) => ({
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

    return [...appItems, ...bookingCalendarItems, ...googleItems].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    )
  }, [bookingItems, calendarEventItems, googleCalendarEvents])

  const monthDays = useMemo(() => getMonthDays(visibleMonth), [visibleMonth])
  const visibleRangeLabel = useMemo(() => {
    const { start, end } = getMonthGridRange(visibleMonth)
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }, [visibleMonth])
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, UnifiedCalendarEvent[]>()

    unifiedEvents.forEach((event) => {
      const dateKey = toDateKey(event.start)
      if (!dateKey) return

      grouped.set(dateKey, [...(grouped.get(dateKey) || []), event])
    })

    return grouped
  }, [unifiedEvents])
  const selectedDayEvents = eventsByDate.get(selectedDateKey) || []
  const googleStatusMessage = useMemo(
    () =>
      getGoogleCalendarStatusDiagnostic({
        status: googleCalendarStatus,
        reason: googleCalendarReason,
        googleConnected,
      }),
    [googleCalendarReason, googleCalendarStatus, googleConnected]
  )
  const googleDiagnostics = useMemo(() => {
    const rows = [
      googleConnected
        ? `Connection row found: primary calendar${googleConnection?.google_email ? ` for ${googleConnection.google_email}` : ''}.`
        : googleConnection?.connection_status === 'needs_reconnect'
          ? 'Connection row exists, but it is marked needs_reconnect.'
          : getGoogleCalendarDisconnectedText(),
      googleCalendarStatus
        ? `Last OAuth callback status: ${googleCalendarStatus}${googleCalendarReason ? ` (${googleCalendarReason})` : ''}.`
        : 'No Google OAuth callback status is present on this page load. If you just approved Google and came back here, the redirect URI may not be this app callback route.',
      getGoogleCalendarReasonText(googleCalendarReason) ||
        'Expected production callback: https://solotutorsuite.vercel.app/api/google-calendar/oauth/callback.',
    ]

    if (!googleConnected) {
      rows.push('Add to my Google Calendar is disabled until a connected row exists for this signed-in tutor.')
    }

    if (googleCalendarWarning) {
      rows.push(`Visible-range sync warning: ${googleCalendarWarning}`)
    }

    return rows
  }, [googleCalendarReason, googleCalendarStatus, googleCalendarWarning, googleConnected, googleConnection?.google_email, googleConnection?.connection_status])

  useEffect(() => {
    if (!googleStatusMessage) return

    toast({
      title: googleStatusMessage.title,
      description: googleStatusMessage.text,
      variant: googleStatusMessage.tone === 'warning' ? 'destructive' : undefined,
    })
  }, [googleStatusMessage, toast])

  useEffect(() => {
    if (!googleCalendarWarning) return

    toast({
      title: 'Google Calendar sync warning',
      description: googleCalendarWarning,
      variant: 'destructive',
    })
  }, [googleCalendarWarning, toast])

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

  const loadVisibleCalendarRange = async (
    month = visibleMonth,
    options: { showToast?: boolean } = { showToast: true }
  ) => {
    const { start, end } = getMonthGridRange(month)
    const range = { timeMin: start.toISOString(), timeMax: end.toISOString() }
    const rangeLabel = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

    setSyncingGoogle(true)
    setGoogleCalendarWarning(null)

    try {
      if (!googleConnected && options.showToast) {
        toast({
          title: 'Google sync skipped',
          description: `${getGoogleCalendarDisconnectedText()} This refresh will reload SoloTutorSuite bookings and calendar events only.`,
          variant: 'destructive',
        })
      }

      const result = await loadTeacherCalendarRangeAction({
        ...range,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })

      if (result.error) throw new Error(result.error)

      setCalendarEventItems(result.calendarEvents || [])
      setBookingItems(result.bookings || [])
      setGoogleCalendarEvents(result.googleEvents || [])
      setGoogleCalendarWarning(result.warning || null)

      if (options.showToast) {
        toast({
          title: result.warning ? 'Calendar refreshed with Google warning' : googleConnected ? 'Calendar synced' : 'Calendar refreshed',
          description: result.warning || `Visible range: ${rangeLabel}`,
          variant: result.warning ? 'destructive' : undefined,
        })
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSyncingGoogle(false)
    }
  }

  const handleChangeMonth = async (offset: number) => {
    const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1)
    setVisibleMonth(nextMonth)
    setSelectedDateKey(toDateKey(nextMonth))
    await loadVisibleCalendarRange(nextMonth, { showToast: false })
  }

  const handleToday = async () => {
    const today = new Date()
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    setVisibleMonth(currentMonth)
    setSelectedDateKey(toDateKey(today))
    await loadVisibleCalendarRange(currentMonth, { showToast: false })
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
      if (!googleConnected) {
        toast({
          title: 'Google sync skipped for this event',
          description: 'The event will be saved in SoloTutorSuite only because no connected Google Calendar row is available for this tutor.',
          variant: 'destructive',
        })
      } else if (!newCalendarEvent.add_to_google_calendar) {
        toast({
          title: 'Google sync disabled for this event',
          description: 'The checkbox is off, so this event will only be saved inside SoloTutorSuite.',
        })
      }

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
        title: result.warning ? 'Calendar event created with Google warning' : 'Calendar event created',
        description: result.warning || undefined,
        variant: result.warning ? 'destructive' : undefined,
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
      await loadVisibleCalendarRange(visibleMonth, { showToast: false })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setCreatingEvent(false)
    }
  }

  const handleSyncGoogleEvents = async () => {
    await loadVisibleCalendarRange(visibleMonth)
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
    <div className="max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Calendar & Booking</h1>
          <p className="text-muted-foreground">
            Manage availability, bookings, lessons, and synced Google events.
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
          {googleStatusMessage && (
            <div
              className={cn(
                'flex items-start gap-2 rounded-lg border p-3 text-sm',
                googleStatusMessage.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              )}
            >
              {googleStatusMessage.tone === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              )}
              <span>
                <strong>{googleStatusMessage.title}:</strong> {googleStatusMessage.text}
              </span>
            </div>
          )}
          {googleCalendarWarning && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{googleCalendarWarning}</span>
            </div>
          )}
          {(!googleConnected || googleStatusMessage || googleCalendarWarning) && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
              <div className="mb-2 font-semibold">Google sync diagnostics</div>
              <ul className="list-disc space-y-1 pl-5">
                {googleDiagnostics.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
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
                    Sync Visible Calendar
                  </Button>
                  <Button variant="ghost" onClick={handleDisconnectGoogle} disabled={syncingGoogle}>
                    <Unplug className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The sync button refreshes SoloTutorSuite and Google events for the visible calendar range: {visibleRangeLabel}.
          </p>
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
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Calendar
              </CardTitle>
              <CardDescription>
                SoloTutorSuite lessons, onboarding bookings, and Google events in one workspace.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleToday} disabled={syncingGoogle}>
                Today
              </Button>
              <div className="flex overflow-hidden rounded-md border">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-none border-r"
                  onClick={() => handleChangeMonth(-1)}
                  disabled={syncingGoogle}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-none"
                  onClick={() => handleChangeMonth(1)}
                  disabled={syncingGoogle}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={handleSyncGoogleEvents} disabled={syncingGoogle} variant={googleConnected ? 'default' : 'outline'}>
                {syncingGoogle ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {googleConnected ? 'Sync Visible Calendar' : 'Refresh Calendar'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-lg font-semibold">{formatMonthLabel(visibleMonth)}</h2>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {[
                { source: 'app' as const, label: 'SoloTutorSuite' },
                { source: 'booking' as const, label: 'Bookings' },
                { source: 'google' as const, label: 'Google' },
              ].map((item) => (
                <span key={item.source} className="inline-flex items-center gap-1.5">
                  <span className={cn('h-2.5 w-2.5 rounded-full', getEventSourceDotClassName(item.source))} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="overflow-x-auto rounded-lg border">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-7 border-b bg-gray-50">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthDays.map((day) => {
                    const dayKey = toDateKey(day)
                    const dayEvents = eventsByDate.get(dayKey) || []
                    const isCurrentMonth = day.getMonth() === visibleMonth.getMonth()
                    const isSelected = dayKey === selectedDateKey
                    const isToday = dayKey === toDateKey(new Date())

                    return (
                      <button
                        key={dayKey}
                        type="button"
                        onClick={() => setSelectedDateKey(dayKey)}
                        aria-pressed={isSelected}
                        className={cn(
                          'min-h-[132px] border-b border-r p-2 text-left align-top transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset',
                          !isCurrentMonth && 'bg-gray-50/70 text-muted-foreground',
                          isSelected && 'bg-blue-50',
                          isToday && 'shadow-[inset_0_0_0_2px_rgba(37,99,235,0.55)]'
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className={cn('text-sm font-semibold', isToday && 'text-blue-700')}>
                            {day.getDate()}
                          </span>
                          {dayEvents.length > 0 && (
                            <span className="rounded-full bg-gray-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              {dayEvents.length}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              className={cn(
                                'min-h-7 rounded border px-2 py-1 text-xs leading-tight',
                                getEventSourceClassName(event.source)
                              )}
                            >
                              <div className="truncate font-semibold">{event.title}</div>
                              <div className="truncate opacity-80">{formatEventTimeRange(event.start, event.end)}</div>
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-xs font-medium text-muted-foreground">
                              +{dayEvents.length - 3} more
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Selected Day
                </p>
                <h3 className="text-lg font-semibold">{formatSelectedDayLabel(selectedDateKey)}</h3>
              </div>

              {selectedDayEvents.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No events on this day.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedDayEvents.map((event) => {
                    const bookingId = event.source === 'booking' ? event.id.replace('booking:', '') : null

                    return (
                      <div key={event.id} className={cn('rounded-lg border p-3', getEventSourceClassName(event.source))}>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 flex-1 font-semibold">{event.title}</p>
                          <Badge variant={event.source === 'google' ? 'outline' : 'secondary'}>
                            {event.sourceLabel}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm opacity-80">
                          {formatEventTimeRange(event.start, event.end)}
                        </p>
                        {event.location && (
                          <p className="mt-1 text-sm opacity-80">{event.location}</p>
                        )}
                        {event.description && (
                          <p className="mt-2 text-sm">{event.description}</p>
                        )}
                        {event.googleSyncStatus === 'failed' && (
                          <Badge variant="destructive" className="mt-3">Google sync failed</Badge>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {event.htmlLink && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={event.htmlLink} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open
                              </a>
                            </Button>
                          )}
                          {bookingId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancelBooking(bookingId)}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancel Booking
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
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

      </div>
    </div>
  )
}
