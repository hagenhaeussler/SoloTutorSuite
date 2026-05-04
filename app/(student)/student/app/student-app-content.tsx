'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AppLogo } from '@/components/app-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import {
  AlertCircle,
  ClipboardList,
  FileText,
  ExternalLink,
  MessageSquare,
  Calendar,
  CreditCard,
  Target,
  Upload,
  Loader2,
  Send,
  Video,
  LogOut,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Link2,
  Plus,
  RefreshCw,
  Unplug,
} from 'lucide-react'
import type { CalendarEvent, GoogleCalendarConnectionSummary, GoogleCalendarEvent, Homework, HomeworkSubmission, Student, StudentChatMessage, StudentFile, LessonNote, ProgressMilestone, MockSubscription, UnifiedCalendarEvent } from '@/lib/types'
import { getGoogleCalendarDisconnectedText, getGoogleCalendarReasonText, getGoogleCalendarStatusDiagnostic } from '@/lib/google-calendar/diagnostics'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import {
  buyMockSubscriptionAction,
  cancelStudentMockSubscriptionAction,
  createStudentCalendarEventAction,
  acceptTutorInvitationAction,
  declineTutorInvitationAction,
  listStudentGoogleEventsAction,
  sendStudentChatMessageAction,
  submitHomeworkByAuthAction,
  toggleStudentMilestoneAction,
} from './actions'

type StudentConnection = Pick<Student, 'id' | 'user_id' | 'name' | 'email' | 'zoom_meeting_link'> & {
  tutorName: string
  tutorEmail: string | null
}

type PendingTutorInvitation = StudentConnection & {
  invited_at: string | null
}

type StudentBooking = {
  id: string
  user_id: string
  start_ts: string
  end_ts: string
  prospect_name: string
  prospect_email: string
  status: 'confirmed' | 'cancelled'
}

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

interface StudentAppContentProps {
  studentName: string
  studentEmail: string | null
  connections: StudentConnection[]
  pendingInvitations: PendingTutorInvitation[]
  homework: Homework[]
  files: StudentFile[]
  submissions: HomeworkSubmission[]
  bookings: StudentBooking[]
  chatMessages: StudentChatMessage[]
  lessonNotes: LessonNote[]
  milestones: ProgressMilestone[]
  subscriptions: MockSubscription[]
  calendarEvents: CalendarEvent[]
  googleConnection: GoogleCalendarConnectionSummary | null
  googleEvents: GoogleCalendarEvent[]
  googleWarning: string | null
  googleCalendarStatus: string | null
  googleCalendarReason: string | null
  initialRangeStart: string
  initialRangeEnd: string
}

export function StudentAppContent({
  studentName,
  studentEmail,
  connections,
  pendingInvitations,
  homework,
  files,
  submissions,
  bookings,
  chatMessages,
  lessonNotes,
  milestones,
  subscriptions,
  calendarEvents,
  googleConnection,
  googleEvents,
  googleWarning,
  googleCalendarStatus,
  googleCalendarReason,
  initialRangeStart,
  initialRangeEnd,
}: StudentAppContentProps) {
  const defaultEventStart = new Date(Date.now() + 60 * 60 * 1000)
  const defaultEventEnd = new Date(defaultEventStart.getTime() + 60 * 60 * 1000)
  const [connectionItems, setConnectionItems] = useState(connections)
  const [pendingInvitationItems, setPendingInvitationItems] = useState(pendingInvitations)
  const [resolvedInvitationIds, setResolvedInvitationIds] = useState<string[]>([])
  const [calendarEventItems, setCalendarEventItems] = useState(calendarEvents)
  const [chatMessageItems, setChatMessageItems] = useState(chatMessages)
  const [subscriptionItems, setSubscriptionItems] = useState(subscriptions)
  const [selectedStudentId, setSelectedStudentId] = useState(connections[0]?.id || '')
  const [uploadingHomeworkId, setUploadingHomeworkId] = useState<string | null>(null)
  const [chatText, setChatText] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [milestoneUpdatingId, setMilestoneUpdatingId] = useState<string | null>(null)
  const [celebratingMilestoneId, setCelebratingMilestoneId] = useState<string | null>(null)
  const [optimisticMilestoneStatuses, setOptimisticMilestoneStatuses] = useState<Record<string, ProgressMilestone['status']>>({})
  const [subscriptionUpdatingId, setSubscriptionUpdatingId] = useState<string | null>(null)
  const [invitationUpdatingId, setInvitationUpdatingId] = useState<string | null>(null)
  const [creatingCalendarEvent, setCreatingCalendarEvent] = useState(false)
  const [syncingGoogle, setSyncingGoogle] = useState(false)
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState(googleEvents)
  const [googleCalendarWarning, setGoogleCalendarWarning] = useState<string | null>(googleWarning)
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()))
  const [rangeStart, setRangeStart] = useState(toDateInputValue(initialRangeStart))
  const [rangeEnd, setRangeEnd] = useState(toDateInputValue(initialRangeEnd))
  const [newCalendarEvent, setNewCalendarEvent] = useState({
    title: '',
    description: '',
    location: '',
    start_ts: toDateTimeLocalValue(defaultEventStart),
    end_ts: toDateTimeLocalValue(defaultEventEnd),
    add_to_google_calendar: googleConnection?.connection_status === 'connected',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingHomeworkId, setPendingHomeworkId] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()
  const googleConnected = googleConnection?.connection_status === 'connected'
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
      rows.push('Add to my Google Calendar is disabled until a connected row exists for this signed-in student.')
    }

    if (googleCalendarWarning) {
      rows.push(`Visible-range sync warning: ${googleCalendarWarning}`)
    }

    return rows
  }, [googleCalendarReason, googleCalendarStatus, googleCalendarWarning, googleConnected, googleConnection?.google_email, googleConnection?.connection_status])

  useEffect(() => {
    setConnectionItems((current) => {
      const merged = new Map(current.map((connection) => [connection.id, connection]))
      connections.forEach((connection) => merged.set(connection.id, connection))
      return Array.from(merged.values())
    })
  }, [connections])

  useEffect(() => {
    setPendingInvitationItems(pendingInvitations.filter((invitation) => !resolvedInvitationIds.includes(invitation.id)))
  }, [pendingInvitations, resolvedInvitationIds])

  useEffect(() => {
    setCalendarEventItems(calendarEvents)
  }, [calendarEvents])

  useEffect(() => {
    setChatMessageItems(chatMessages)
  }, [chatMessages])

  useEffect(() => {
    setSubscriptionItems(subscriptions)
  }, [subscriptions])

  useEffect(() => {
    setGoogleCalendarEvents(googleEvents)
    setGoogleCalendarWarning(googleWarning)
  }, [googleEvents, googleWarning])

  useEffect(() => {
    if (!googleConnected) return

    setNewCalendarEvent((current) => ({
      ...current,
      add_to_google_calendar: true,
    }))
  }, [googleConnected])

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

  useEffect(() => {
    if (connectionItems.length === 0) return

    const selectedStillExists = connectionItems.some((connection) => connection.id === selectedStudentId)
    if (!selectedStudentId || !selectedStillExists) {
      setSelectedStudentId(connectionItems[0].id)
    }
  }, [connectionItems, selectedStudentId])

  const selectedConnection = useMemo(
    () => connectionItems.find((c) => c.id === selectedStudentId) || null,
    [connectionItems, selectedStudentId]
  )

  const filteredHomework = useMemo(
    () => homework.filter((h) => h.student_id === selectedStudentId),
    [homework, selectedStudentId]
  )

  const filteredFiles = useMemo(
    () => files.filter((f) => f.student_id === selectedStudentId),
    [files, selectedStudentId]
  )

  const filteredSubmissions = useMemo(
    () => submissions.filter((s) => filteredHomework.some((h) => h.id === s.homework_id)),
    [submissions, filteredHomework]
  )

  const filteredChat = useMemo(
    () => chatMessageItems.filter((m) => m.student_id === selectedStudentId),
    [chatMessageItems, selectedStudentId]
  )

  const filteredBookings = useMemo(() => {
    if (!selectedConnection) return []

    const connectionEmail = selectedConnection.email?.toLowerCase()
    const profileEmail = studentEmail?.toLowerCase()

    return bookings.filter((b) => {
      const bookingEmail = b.prospect_email.toLowerCase()
      return b.user_id === selectedConnection.user_id && (bookingEmail === connectionEmail || bookingEmail === profileEmail)
    })
  }, [bookings, selectedConnection, studentEmail])

  const filteredNotes = useMemo(
    () => lessonNotes.filter((n) => n.student_id === selectedStudentId),
    [lessonNotes, selectedStudentId]
  )

  const filteredMilestones = useMemo(
    () => milestones.filter((m) => m.student_id === selectedStudentId),
    [milestones, selectedStudentId]
  )

  const filteredSubscriptions = useMemo(
    () => subscriptionItems.filter((subscription) => subscription.student_id === selectedStudentId),
    [subscriptionItems, selectedStudentId]
  )

  const filteredCalendarEvents = useMemo(
    () =>
      calendarEventItems.filter((event) => {
        if (!selectedStudentId) return event.created_by_role === 'student'
        return event.student_id === selectedStudentId || event.student_id === null || event.created_by_role === 'student'
      }),
    [calendarEventItems, selectedStudentId]
  )

  const unifiedCalendarEvents = useMemo<UnifiedCalendarEvent[]>(() => {
    const appItems: UnifiedCalendarEvent[] = filteredCalendarEvents.map((event) => ({
      id: `app:${event.id}`,
      title: event.title,
      description: event.description,
      location: event.location,
      start: event.start_ts,
      end: event.end_ts,
      source: 'app',
      sourceLabel: event.created_by_role === 'student' ? 'SoloTutorSuite' : 'Tutor',
      htmlLink: event.google_html_link,
      googleSyncStatus: event.google_sync_status,
    }))

    const bookingItems: UnifiedCalendarEvent[] = filteredBookings.map((booking) => ({
      id: `booking:${booking.id}`,
      title: `Lesson with ${selectedConnection?.tutorName || 'Tutor'}`,
      start: booking.start_ts,
      end: booking.end_ts,
      source: 'booking',
      sourceLabel: 'Booking',
    }))

    const homeworkItems: UnifiedCalendarEvent[] = filteredHomework
      .filter((item) => item.due_date)
      .map((item) => {
        const start = new Date(`${item.due_date}T12:00:00`).toISOString()
        const end = new Date(`${item.due_date}T13:00:00`).toISOString()

        return {
          id: `homework:${item.id}`,
          title: item.title,
          description: item.instructions,
          start,
          end,
          source: 'homework',
          sourceLabel: 'Homework Due',
          googleSyncStatus: item.google_sync_status,
          htmlLink: item.google_html_link,
        } satisfies UnifiedCalendarEvent
      })

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

    return [...appItems, ...bookingItems, ...homeworkItems, ...googleItems].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    )
  }, [filteredBookings, filteredCalendarEvents, filteredHomework, googleCalendarEvents, selectedConnection?.tutorName])

  const monthDays = useMemo(() => getMonthDays(visibleMonth), [visibleMonth])
  const eventsByDate = useMemo(() => {
    const { start, end } = getMonthGridRange(visibleMonth)
    const grouped = new Map<string, UnifiedCalendarEvent[]>()

    unifiedCalendarEvents.forEach((event) => {
      const startDate = new Date(event.start)
      if (Number.isNaN(startDate.getTime()) || startDate < start || startDate > end) return

      const key = toDateKey(startDate)
      const existing = grouped.get(key) || []
      existing.push(event)
      grouped.set(key, existing)
    })

    return grouped
  }, [unifiedCalendarEvents, visibleMonth])
  const selectedDayEvents = eventsByDate.get(selectedDateKey) || []

  const milestoneProgress = useMemo(() => {
    const achieved = filteredMilestones.filter((m) => {
      const status = optimisticMilestoneStatuses[m.id] ?? m.status
      return status === 'achieved'
    }).length
    const total = filteredMilestones.length

    return {
      achieved,
      total,
      percent: total > 0 ? Math.round((achieved / total) * 100) : 0,
    }
  }, [filteredMilestones, optimisticMilestoneStatuses])

  const getMilestoneStatus = (milestone: ProgressMilestone) => {
    return optimisticMilestoneStatuses[milestone.id] ?? milestone.status
  }

  const activeSubscriptionTotalCents = filteredSubscriptions
    .filter((subscription) => subscription.status === 'active')
    .reduce((sum, subscription) => sum + subscription.amount_cents, 0)

  const formatSubscriptionPrice = (subscription: MockSubscription) => {
    const amount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: subscription.currency || 'USD',
    }).format(subscription.amount_cents / 100)

    if (subscription.billing_interval === 'once') {
      return `${amount} once`
    }

    return `${amount}/${subscription.billing_interval.replace('ly', '')}`
  }

  const getSubmission = (homeworkId: string) => {
    return filteredSubmissions.find((s) => s.homework_id === homeworkId)
  }

  const triggerHomeworkUpload = (homeworkId: string) => {
    setPendingHomeworkId(homeworkId)
    fileInputRef.current?.click()
  }

  const handleHomeworkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pendingHomeworkId) return

    setUploadingHomeworkId(pendingHomeworkId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('homeworkId', pendingHomeworkId)

      const result = await submitHomeworkByAuthAction(formData)
      if (result.error) throw new Error(result.error)

      toast({ title: 'Homework submitted!' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setUploadingHomeworkId(null)
      setPendingHomeworkId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSendMessage = async () => {
    const message = chatText.trim()
    if (!selectedStudentId || !selectedConnection || !message) return

    const optimisticId = `local:${Date.now()}`
    setChatSending(true)
    setChatText('')
    setChatMessageItems((current) => [
      ...current,
      {
        id: optimisticId,
        tutor_user_id: selectedConnection.user_id,
        student_id: selectedStudentId,
        sender_type: 'student',
        sender_user_id: null,
        message,
        read_at: null,
        created_at: new Date().toISOString(),
      },
    ])
    try {
      const result = await sendStudentChatMessageAction(selectedStudentId, message)
      if (result.error) throw new Error(result.error)
      router.refresh()
    } catch (error: any) {
      setChatMessageItems((current) => current.filter((item) => item.id !== optimisticId))
      setChatText(message)
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setChatSending(false)
    }
  }

  const handleToggleMilestone = async (milestone: ProgressMilestone) => {
    const currentStatus = getMilestoneStatus(milestone)
    const nextStatus: ProgressMilestone['status'] = currentStatus === 'achieved' ? 'pending' : 'achieved'

    setMilestoneUpdatingId(milestone.id)
    setOptimisticMilestoneStatuses((current) => ({
      ...current,
      [milestone.id]: nextStatus,
    }))

    if (nextStatus === 'achieved') {
      setCelebratingMilestoneId(milestone.id)
      window.setTimeout(() => {
        setCelebratingMilestoneId((current) => (current === milestone.id ? null : current))
      }, 900)
    }

    try {
      const result = await toggleStudentMilestoneAction(milestone.id, nextStatus === 'achieved')
      if (result.error) throw new Error(result.error)

      toast({ title: nextStatus === 'achieved' ? 'Milestone accomplished!' : 'Milestone reopened' })
      router.refresh()
    } catch (error: any) {
      setOptimisticMilestoneStatuses((current) => {
        const next = { ...current }
        delete next[milestone.id]
        return next
      })
      setCelebratingMilestoneId(null)
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setMilestoneUpdatingId(null)
    }
  }

  const handleBuySubscription = async (subscription: MockSubscription) => {
    setSubscriptionUpdatingId(subscription.id)
    try {
      const result = await buyMockSubscriptionAction(subscription.id)
      if (result.error) throw new Error(result.error)

      setSubscriptionItems((current) =>
        current.map((item) =>
          item.id === subscription.id
            ? { ...item, status: 'active', started_at: new Date().toISOString(), cancelled_at: null }
            : item
        )
      )
      toast({ title: 'Subscription started!', description: 'This mock purchase is now active.' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSubscriptionUpdatingId(null)
    }
  }

  const handleCancelSubscription = async (subscription: MockSubscription) => {
    if (!confirm('Cancel this subscription?')) return

    setSubscriptionUpdatingId(subscription.id)
    try {
      const result = await cancelStudentMockSubscriptionAction(subscription.id)
      if (result.error) throw new Error(result.error)

      setSubscriptionItems((current) =>
        current.map((item) =>
          item.id === subscription.id
            ? { ...item, status: 'cancelled', cancelled_at: new Date().toISOString() }
            : item
        )
      )
      toast({ title: 'Subscription cancelled' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSubscriptionUpdatingId(null)
    }
  }

  const handleAcceptInvitation = async (studentId: string) => {
    setInvitationUpdatingId(studentId)
    try {
      const invitation = pendingInvitationItems.find((item) => item.id === studentId)
      const result = await acceptTutorInvitationAction(studentId)
      if (result.error) throw new Error(result.error)

      const activatedConnection = (result as { connection?: StudentConnection }).connection || invitation
      if (activatedConnection) {
        setResolvedInvitationIds((current) => Array.from(new Set([...current, studentId])))
        setPendingInvitationItems((current) => current.filter((item) => item.id !== studentId))
        setConnectionItems((current) => {
          const withoutDuplicate = current.filter((item) => item.id !== activatedConnection.id)
          return [activatedConnection, ...withoutDuplicate]
        })
        setSelectedStudentId(activatedConnection.id)
      }

      toast({ title: 'Invitation accepted', description: 'Your tutor workspace is now available.' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setInvitationUpdatingId(null)
    }
  }

  const handleDeclineInvitation = async (studentId: string) => {
    if (!confirm('Decline this tutor invitation?')) return

    setInvitationUpdatingId(studentId)
    try {
      const result = await declineTutorInvitationAction(studentId)
      if (result.error) throw new Error(result.error)

      setResolvedInvitationIds((current) => Array.from(new Set([...current, studentId])))
      setPendingInvitationItems((current) => current.filter((item) => item.id !== studentId))
      toast({ title: 'Invitation declined' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setInvitationUpdatingId(null)
    }
  }

  const handleCreateCalendarEvent = async () => {
    const startIso = fromDateTimeLocalValue(newCalendarEvent.start_ts)
    const endIso = fromDateTimeLocalValue(newCalendarEvent.end_ts)

    if (!startIso || !endIso) {
      toast({ title: 'Invalid event time', variant: 'destructive' })
      return
    }

    setCreatingCalendarEvent(true)
    try {
      if (!googleConnected) {
        toast({
          title: 'Google sync skipped for this event',
          description: 'The event will be saved in SoloTutorSuite only because no connected Google Calendar row is available for this student account.',
          variant: 'destructive',
        })
      } else if (!newCalendarEvent.add_to_google_calendar) {
        toast({
          title: 'Google sync disabled for this event',
          description: 'The checkbox is off, so this event will only be saved inside SoloTutorSuite.',
        })
      }

      const result = await createStudentCalendarEventAction({
        student_id: selectedStudentId || '',
        title: newCalendarEvent.title,
        description: newCalendarEvent.description,
        location: newCalendarEvent.location,
        start_ts: startIso,
        end_ts: endIso,
        event_type: 'student_event',
        add_to_google_calendar: newCalendarEvent.add_to_google_calendar && googleConnected,
      })

      if (result.error) throw new Error(result.error)

      const createdEvent = (result as { event?: CalendarEvent }).event
      if (createdEvent) {
        setCalendarEventItems((current) => {
          const withoutDuplicate = current.filter((event) => event.id !== createdEvent.id)
          return [...withoutDuplicate, createdEvent].sort(
            (a, b) => new Date(a.start_ts).getTime() - new Date(b.start_ts).getTime()
          )
        })
        setSelectedDateKey(toDateKey(createdEvent.start_ts))
        setVisibleMonth(new Date(new Date(createdEvent.start_ts).getFullYear(), new Date(createdEvent.start_ts).getMonth(), 1))
      }

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
        add_to_google_calendar: googleConnected,
      })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setCreatingCalendarEvent(false)
    }
  }

  const updateVisibleMonth = (month: Date) => {
    const normalizedMonth = new Date(month.getFullYear(), month.getMonth(), 1)
    const { start, end } = getMonthGridRange(normalizedMonth)

    setVisibleMonth(normalizedMonth)
    setSelectedDateKey(toDateKey(normalizedMonth))
    setRangeStart(toDateInputValue(start))
    setRangeEnd(toDateInputValue(end))
  }

  const handleChangeMonth = (offset: number) => {
    updateVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1))
  }

  const handleTodayCalendar = () => {
    const today = new Date()
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const { start, end } = getMonthGridRange(currentMonth)

    setVisibleMonth(currentMonth)
    setSelectedDateKey(toDateKey(today))
    setRangeStart(toDateInputValue(start))
    setRangeEnd(toDateInputValue(end))
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
      if (!googleConnected) {
        toast({
          title: 'Google sync skipped',
          description: `${getGoogleCalendarDisconnectedText()} This refresh will not load Google events until the connection saves successfully.`,
          variant: 'destructive',
        })
      }

      const result = await listStudentGoogleEventsAction({
        ...range,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })

      if (result.error) throw new Error(result.error)

      setGoogleCalendarEvents(result.events || [])
      setGoogleCalendarWarning(result.warning || null)
      toast({
        title: result.warning ? 'Calendar refreshed with Google warning' : 'Calendar refreshed',
        description: result.warning || undefined,
        variant: result.warning ? 'destructive' : undefined,
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

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login?role=student')
    router.refresh()
  }

  const estimatedBillingCents = filteredBookings
    .filter((b) => b.status === 'confirmed')
    .length * 5000

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="border-b bg-white">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <AppLogo href="/" size="md" showText={false} />
            <div>
              <h1 className="font-bold">Student App</h1>
              <p className="text-sm text-muted-foreground">Welcome, {studentName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {studentEmail && <Badge variant="outline">{studentEmail}</Badge>}
            <Button variant="ghost" size="sm" className="gap-2" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleHomeworkUpload} />

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
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
                    <a href={`/api/google-calendar/oauth/start?returnTo=${encodeURIComponent('/student/app')}`}>
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
                  <label className="text-xs font-medium">From</label>
                  <Input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium">To</label>
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

        {pendingInvitationItems.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Tutor Invitations</CardTitle>
              <CardDescription>
                Accept an invitation before that tutor can share files, homework, billing plans, notes, progress, chat, and video links in your dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingInvitationItems.map((invitation) => {
                  const updating = invitationUpdatingId === invitation.id

                  return (
                    <div key={invitation.id} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{invitation.tutorName}</p>
                            <Badge variant="warning">pending</Badge>
                          </div>
                          {invitation.tutorEmail && (
                            <p className="text-sm text-muted-foreground">{invitation.tutorEmail}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Invited {invitation.invited_at ? formatDate(invitation.invited_at) : 'recently'}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 gap-2">
                          <Button onClick={() => handleAcceptInvitation(invitation.id)} disabled={updating}>
                            {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Accept
                          </Button>
                          <Button variant="outline" onClick={() => handleDeclineInvitation(invitation.id)} disabled={updating}>
                            Decline
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {connectionItems.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <h2 className="text-xl font-semibold mb-2">Student account ready</h2>
              <p className="text-muted-foreground mb-3">
                Ask your tutor to invite the exact Google email you used here. Their workspace appears after you accept the invitation.
              </p>
              {studentEmail && <code className="text-sm bg-gray-100 px-2 py-1 rounded">{studentEmail}</code>}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Your Tutors</CardTitle>
                <CardDescription>Select a tutor workspace</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {connectionItems.map((connection) => (
                    <Button
                      key={connection.id}
                      variant={selectedStudentId === connection.id ? 'default' : 'outline'}
                      onClick={() => setSelectedStudentId(connection.id)}
                    >
                      {connection.tutorName}
                    </Button>
                  ))}
                </div>
                {selectedConnection?.zoom_meeting_link && (
                  <Button className="mt-4" asChild>
                    <a href={selectedConnection.zoom_meeting_link} target="_blank" rel="noopener noreferrer">
                      <Video className="w-4 h-4 mr-2" />
                      Join Zoom Lesson
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>

            {filteredMilestones.length > 0 && (
              <Card className="mb-6 overflow-hidden">
                <CardContent className="py-5">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Milestone Progress</p>
                      <p className="text-xs text-muted-foreground">
                        {milestoneProgress.achieved} of {milestoneProgress.total} accomplished with {selectedConnection?.tutorName || 'this tutor'}
                      </p>
                    </div>
                    <Badge variant={milestoneProgress.percent === 100 ? 'success' : 'secondary'}>
                      {milestoneProgress.percent}%
                    </Badge>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={cn(
                        'h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 transition-all duration-700',
                        celebratingMilestoneId && 'progress-fill-celebrate'
                      )}
                      style={{ width: `${milestoneProgress.percent}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="homework">
              <TabsList className="mb-6 flex h-auto flex-wrap justify-start">
                <TabsTrigger value="homework" className="gap-2">
                  <ClipboardList className="w-4 h-4" /> Homework
                </TabsTrigger>
                <TabsTrigger value="files" className="gap-2">
                  <FileText className="w-4 h-4" /> Files
                </TabsTrigger>
                <TabsTrigger value="calendar" className="gap-2">
                  <Calendar className="w-4 h-4" /> Calendar
                </TabsTrigger>
                <TabsTrigger value="bookings" className="gap-2">
                  <Calendar className="w-4 h-4" /> Bookings
                </TabsTrigger>
                <TabsTrigger value="financials" className="gap-2">
                  <CreditCard className="w-4 h-4" /> Financials
                </TabsTrigger>
                <TabsTrigger value="chat" className="gap-2">
                  <MessageSquare className="w-4 h-4" /> Chat
                </TabsTrigger>
                <TabsTrigger value="progress" className="gap-2">
                  <Target className="w-4 h-4" /> Progress
                </TabsTrigger>
              </TabsList>

              <TabsContent value="homework">
                <Card>
                  <CardHeader>
                    <CardTitle>Homework</CardTitle>
                    <CardDescription>Complete and upload homework for your tutor.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredHomework.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No homework assigned yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {filteredHomework.map((hw) => {
                          const submission = getSubmission(hw.id)
                          return (
                            <div key={hw.id} className="p-4 bg-gray-50 rounded-lg">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{hw.title}</p>
                                  {hw.instructions && (
                                    <p className="text-sm text-muted-foreground mt-1">{hw.instructions}</p>
                                  )}
                                  {submission && (
                                    <Badge variant="success" className="mt-2">Submitted</Badge>
                                  )}
                                </div>
                                {!submission && (
                                  <Button
                                    size="sm"
                                    onClick={() => triggerHomeworkUpload(hw.id)}
                                    disabled={uploadingHomeworkId === hw.id}
                                  >
                                    {uploadingHomeworkId === hw.id ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <Upload className="w-4 h-4 mr-2" />
                                    )}
                                    Upload
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="files">
                <Card>
                  <CardHeader>
                    <CardTitle>Shared Files</CardTitle>
                    <CardDescription>Files shared with you by this tutor.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredFiles.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No files shared yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {filteredFiles.map((file) => (
                          <div key={file.id} className="p-3 bg-gray-50 rounded-lg">
                            <p className="font-medium">{file.filename}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(file.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="calendar">
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Create Calendar Event</CardTitle>
                      <CardDescription>Add a study session, reminder, or personal event.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="md:col-span-2">
                          <label className="text-xs font-medium">Title</label>
                          <Input
                            value={newCalendarEvent.title}
                            onChange={(event) => setNewCalendarEvent({ ...newCalendarEvent, title: event.target.value })}
                            placeholder="Practice exam block"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Start</label>
                          <Input
                            type="datetime-local"
                            value={newCalendarEvent.start_ts}
                            onChange={(event) => setNewCalendarEvent({ ...newCalendarEvent, start_ts: event.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">End</label>
                          <Input
                            type="datetime-local"
                            value={newCalendarEvent.end_ts}
                            onChange={(event) => setNewCalendarEvent({ ...newCalendarEvent, end_ts: event.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Location</label>
                          <Input
                            value={newCalendarEvent.location}
                            onChange={(event) => setNewCalendarEvent({ ...newCalendarEvent, location: event.target.value })}
                            placeholder="Home, library, Zoom"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Notes</label>
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
                            <a href={`/api/google-calendar/oauth/start?returnTo=${encodeURIComponent('/student/app')}`}>
                              <Link2 className="mr-2 h-4 w-4" />
                              Connect Google Calendar
                            </a>
                          </Button>
                        )}
                        <Button onClick={handleCreateCalendarEvent} disabled={creatingCalendarEvent || !newCalendarEvent.title.trim()}>
                          {creatingCalendarEvent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                          Create Event
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <CardTitle>Calendar</CardTitle>
                          <CardDescription>Classes, bookings, homework due dates, SoloTutorSuite events, and Google events.</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" onClick={handleTodayCalendar} disabled={syncingGoogle}>
                            Today
                          </Button>
                          <div className="inline-flex overflow-hidden rounded-md border">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-none"
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
                            { source: 'homework' as const, label: 'Homework' },
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
                              {selectedDayEvents.map((event) => (
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
                                  {event.htmlLink && (
                                    <div className="mt-3">
                                      <Button variant="outline" size="sm" asChild>
                                        <a href={event.htmlLink} target="_blank" rel="noopener noreferrer">
                                          <ExternalLink className="mr-2 h-4 w-4" />
                                          Open
                                        </a>
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="bookings">
                <Card>
                  <CardHeader>
                    <CardTitle>Bookings</CardTitle>
                    <CardDescription>Upcoming and past sessions.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredBookings.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No bookings found yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {filteredBookings.map((booking) => (
                          <div key={booking.id} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{formatDateTime(booking.start_ts)}</p>
                              <Badge variant={booking.status === 'confirmed' ? 'secondary' : 'destructive'}>{booking.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="financials">
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Financials</CardTitle>
                      <CardDescription>Subscription offers and session-based billing summary.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground mb-2">Active subscriptions</p>
                          <p className="text-2xl font-bold">${(activeSubscriptionTotalCents / 100).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Simulated active total for the selected tutor.
                          </p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground mb-2">Estimated confirmed sessions</p>
                          <p className="text-2xl font-bold">${(estimatedBillingCents / 100).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Based on confirmed booking history only.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Subscriptions</CardTitle>
                      <CardDescription>Buy or cancel subscription offers from your tutor.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {filteredSubscriptions.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No subscription offers yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {filteredSubscriptions.map((subscription) => {
                            const updating = subscriptionUpdatingId === subscription.id

                            return (
                              <div key={subscription.id} className="rounded-lg border p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-medium">{subscription.plan_name}</p>
                                      <Badge variant={subscription.status === 'active' ? 'success' : subscription.status === 'offered' ? 'secondary' : 'outline'}>
                                        {subscription.status}
                                      </Badge>
                                    </div>
                                    {subscription.description && (
                                      <p className="text-sm text-muted-foreground mt-1">{subscription.description}</p>
                                    )}
                                    <p className="text-sm font-semibold mt-2">{formatSubscriptionPrice(subscription)}</p>
                                    {subscription.started_at && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Started {formatDate(subscription.started_at)}
                                      </p>
                                    )}
                                    {subscription.cancelled_at && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Cancelled {formatDate(subscription.cancelled_at)}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-shrink-0 gap-2">
                                    {subscription.status === 'offered' && (
                                      <Button onClick={() => handleBuySubscription(subscription)} disabled={updating}>
                                        {updating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        Buy
                                      </Button>
                                    )}
                                    {subscription.status === 'active' && (
                                      <Button variant="outline" onClick={() => handleCancelSubscription(subscription)} disabled={updating}>
                                        {updating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        Cancel
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="chat">
                <Card>
                  <CardHeader>
                    <CardTitle>Chat</CardTitle>
                    <CardDescription>Message your tutor directly.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-[420px] overflow-y-auto mb-4">
                      {filteredChat.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>
                      ) : (
                        filteredChat.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.sender_type === 'student' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                                message.sender_type === 'student'
                                  ? 'bg-primary text-white'
                                  : 'bg-gray-100 text-gray-900'
                              }`}
                            >
                              <p>{message.message}</p>
                              <p className={`text-[10px] mt-1 ${message.sender_type === 'student' ? 'text-blue-100' : 'text-muted-foreground'}`}>
                                {formatDateTime(message.created_at)}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        value={chatText}
                        onChange={(e) => setChatText(e.target.value)}
                        placeholder="Type a message..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSendMessage()
                          }
                        }}
                      />
                      <Button onClick={handleSendMessage} disabled={chatSending || !chatText.trim()}>
                        {chatSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="progress">
                <div className="grid lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Lesson Notes</CardTitle>
                      <CardDescription>Shared session recaps from your tutor.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {filteredNotes.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No lesson notes yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {filteredNotes.map((note) => (
                            <div key={note.id} className="p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium">{note.title}</p>
                                <Badge variant="outline">{note.lesson_date}</Badge>
                              </div>
                              {note.summary && <p className="text-sm text-muted-foreground mt-2">{note.summary}</p>}
                              {note.homework_assigned && <p className="text-sm mt-2"><span className="font-medium">Homework:</span> {note.homework_assigned}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Milestones</CardTitle>
                      <CardDescription>Your current progress goals.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {filteredMilestones.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No milestones yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {filteredMilestones.map((milestone) => {
                            const status = getMilestoneStatus(milestone)
                            const achieved = status === 'achieved'
                            const updating = milestoneUpdatingId === milestone.id

                            return (
                              <div
                                key={milestone.id}
                                className={cn(
                                  'relative flex flex-col gap-3 overflow-hidden rounded-lg border p-3 transition-all sm:flex-row sm:items-start sm:justify-between',
                                  achieved ? 'border-green-200 bg-green-50/70' : 'border-transparent bg-gray-50',
                                  celebratingMilestoneId === milestone.id && 'milestone-achieved'
                                )}
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium">{milestone.title}</p>
                                    {milestone.target_date && (
                                      <Badge variant="outline">Target {formatDate(milestone.target_date)}</Badge>
                                    )}
                                  </div>
                                  {milestone.description && <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>}
                                </div>
                                <div className="flex flex-shrink-0 items-center gap-2">
                                  <Badge variant={achieved ? 'success' : 'secondary'}>{achieved ? 'achieved' : status}</Badge>
                                  <Button
                                    size="sm"
                                    variant={achieved ? 'outline' : 'default'}
                                    className="gap-2"
                                    onClick={() => handleToggleMilestone(milestone)}
                                    disabled={updating}
                                  >
                                    {updating ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-4 w-4" />
                                    )}
                                    {achieved ? 'Reopen' : 'Mark Done'}
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  )
}
