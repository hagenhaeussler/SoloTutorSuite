'use client'

import { useMemo, useRef, useState } from 'react'
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
  Link2,
  Plus,
  RefreshCw,
  Unplug,
} from 'lucide-react'
import type { CalendarEvent, GoogleCalendarConnectionSummary, GoogleCalendarEvent, Homework, HomeworkSubmission, Student, StudentChatMessage, StudentFile, LessonNote, ProgressMilestone, MockSubscription, UnifiedCalendarEvent } from '@/lib/types'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import {
  buyMockSubscriptionAction,
  cancelStudentMockSubscriptionAction,
  createStudentCalendarEventAction,
  listStudentGoogleEventsAction,
  sendStudentChatMessageAction,
  submitHomeworkByAuthAction,
  toggleStudentMilestoneAction,
} from './actions'

type StudentConnection = Pick<Student, 'id' | 'name' | 'email' | 'zoom_meeting_link'> & {
  tutorName: string
  tutorEmail: string | null
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

interface StudentAppContentProps {
  studentName: string
  studentEmail: string | null
  studentInviteCode: string | null
  connections: StudentConnection[]
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
  initialRangeStart: string
  initialRangeEnd: string
}

export function StudentAppContent({
  studentName,
  studentEmail,
  studentInviteCode,
  connections,
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
  initialRangeStart,
  initialRangeEnd,
}: StudentAppContentProps) {
  const defaultEventStart = new Date(Date.now() + 60 * 60 * 1000)
  const defaultEventEnd = new Date(defaultEventStart.getTime() + 60 * 60 * 1000)
  const [selectedStudentId, setSelectedStudentId] = useState(connections[0]?.id || '')
  const [uploadingHomeworkId, setUploadingHomeworkId] = useState<string | null>(null)
  const [chatText, setChatText] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [milestoneUpdatingId, setMilestoneUpdatingId] = useState<string | null>(null)
  const [celebratingMilestoneId, setCelebratingMilestoneId] = useState<string | null>(null)
  const [optimisticMilestoneStatuses, setOptimisticMilestoneStatuses] = useState<Record<string, ProgressMilestone['status']>>({})
  const [subscriptionUpdatingId, setSubscriptionUpdatingId] = useState<string | null>(null)
  const [creatingCalendarEvent, setCreatingCalendarEvent] = useState(false)
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
    add_to_google_calendar: googleConnection?.connection_status === 'connected',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingHomeworkId, setPendingHomeworkId] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()
  const googleConnected = googleConnection?.connection_status === 'connected'

  const selectedConnection = useMemo(
    () => connections.find((c) => c.id === selectedStudentId) || null,
    [connections, selectedStudentId]
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
    () => chatMessages.filter((m) => m.student_id === selectedStudentId),
    [chatMessages, selectedStudentId]
  )

  const filteredBookings = useMemo(() => {
    if (!selectedConnection) return []

    const connectionEmail = selectedConnection.email?.toLowerCase()
    const profileEmail = studentEmail?.toLowerCase()

    return bookings.filter((b) => {
      const bookingEmail = b.prospect_email.toLowerCase()
      return bookingEmail === connectionEmail || bookingEmail === profileEmail
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
    () => subscriptions.filter((subscription) => subscription.student_id === selectedStudentId),
    [subscriptions, selectedStudentId]
  )

  const filteredCalendarEvents = useMemo(
    () =>
      calendarEvents.filter((event) => {
        if (!selectedStudentId) return event.created_by_role === 'student'
        return event.student_id === selectedStudentId || event.student_id === null || event.created_by_role === 'student'
      }),
    [calendarEvents, selectedStudentId]
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
    if (!selectedStudentId || !chatText.trim()) return

    setChatSending(true)
    try {
      const result = await sendStudentChatMessageAction(selectedStudentId, chatText)
      if (result.error) throw new Error(result.error)
      setChatText('')
      router.refresh()
    } catch (error: any) {
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

      toast({ title: 'Subscription started!', description: 'This mock purchase is now active.' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSubscriptionUpdatingId(null)
    }
  }

  const handleCancelSubscription = async (subscription: MockSubscription) => {
    if (!confirm('Cancel this mock subscription?')) return

    setSubscriptionUpdatingId(subscription.id)
    try {
      const result = await cancelStudentMockSubscriptionAction(subscription.id)
      if (result.error) throw new Error(result.error)

      toast({ title: 'Subscription cancelled' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSubscriptionUpdatingId(null)
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
        add_to_google_calendar: googleConnected,
      })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setCreatingCalendarEvent(false)
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
      const result = await listStudentGoogleEventsAction({
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
            <Badge variant="outline">ID: {studentInviteCode || 'Pending'}</Badge>
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

        {connections.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <h2 className="text-xl font-semibold mb-2">You&apos;re all set 🎉</h2>
              <p className="text-muted-foreground mb-3">
                Share your Student ID with your tutor so they can add you to their Students Hub.
              </p>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded">{studentInviteCode || 'Generating...'}</code>
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
                  {connections.map((connection) => (
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
                      <CardTitle>Calendar</CardTitle>
                      <CardDescription>Bookings, homework due dates, SoloTutorSuite events, and Google events.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {unifiedCalendarEvents.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No calendar events in this range yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {unifiedCalendarEvents.map((event) => (
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
                      <CardDescription>Mock subscriptions and session-based billing summary.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground mb-2">Active mock subscriptions</p>
                          <p className="text-2xl font-bold">${(activeSubscriptionTotalCents / 100).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Simulated recurring total for the selected tutor.
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
                      <CardDescription>Buy or cancel mock subscription offers from your tutor.</CardDescription>
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
