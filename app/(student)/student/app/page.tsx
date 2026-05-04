import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { StudentAppContent } from './student-app-content'
import { getGoogleCalendarConnection, toGoogleCalendarConnectionSummary } from '@/lib/google-calendar/client'
import { listGoogleEvents } from '@/lib/google-calendar/events'

export default async function StudentAppPage() {
  const supabase = await createClient()
  const service = await createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?role=student')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login?error=Profile not found')
  }

  if (profile.role !== 'student') {
    redirect('/dashboard')
  }

  const rangeStart = new Date()
  const rangeEnd = new Date(rangeStart.getTime() + 30 * 24 * 60 * 60 * 1000)
  const normalizedProfileEmail = profile.email?.trim().toLowerCase()

  if (normalizedProfileEmail) {
    const { data: unlinkedMatchingStudents } = await service
      .from('students')
      .select('id')
      .is('auth_user_id', null)
      .ilike('email', normalizedProfileEmail)

    if ((unlinkedMatchingStudents || []).length > 0) {
      await service
        .from('students')
        .update({
          auth_user_id: user.id,
          invitation_status: 'pending',
          invited_at: new Date().toISOString(),
          declined_at: null,
        })
        .in('id', unlinkedMatchingStudents!.map((student) => student.id))
    }
  }

  const { data: connections } = await service
    .from('students')
    .select('id, user_id, name, email, zoom_meeting_link, invitation_status')
    .eq('auth_user_id', user.id)
    .eq('invitation_status', 'active')
    .order('created_at', { ascending: false })

  const { data: pendingInvitations } = await service
    .from('students')
    .select('id, user_id, name, email, zoom_meeting_link, invitation_status, invited_at')
    .eq('auth_user_id', user.id)
    .eq('invitation_status', 'pending')
    .order('invited_at', { ascending: false })

  const tutorIds = Array.from(new Set([...(connections || []), ...(pendingInvitations || [])].map((c) => c.user_id)))

  const { data: tutors } = tutorIds.length
    ? await service
        .from('profiles')
        .select('id, name, email')
        .in('id', tutorIds)
    : { data: [] as Array<{ id: string; name: string | null; email: string | null }> }

  const tutorMap = new Map((tutors || []).map((t) => [t.id, t]))

  const decoratedConnections = (connections || []).map((connection) => {
    const tutor = tutorMap.get(connection.user_id)
    return {
      id: connection.id,
      name: connection.name,
      email: connection.email,
      zoom_meeting_link: connection.zoom_meeting_link,
      tutorName: tutor?.name || 'Tutor',
      tutorEmail: tutor?.email || null,
    }
  })

  const decoratedPendingInvitations = (pendingInvitations || []).map((connection) => {
    const tutor = tutorMap.get(connection.user_id)
    return {
      id: connection.id,
      name: connection.name,
      email: connection.email,
      zoom_meeting_link: connection.zoom_meeting_link,
      invited_at: connection.invited_at,
      tutorName: tutor?.name || 'Tutor',
      tutorEmail: tutor?.email || null,
    }
  })

  const connectionStudentIds = (connections || []).map((c) => c.id)

  const { data: homework } = connectionStudentIds.length
    ? await service
        .from('homework')
        .select('*')
        .in('student_id', connectionStudentIds)
        .order('created_at', { ascending: false })
    : { data: [] as any[] }

  const { data: files } = connectionStudentIds.length
    ? await service
        .from('student_files')
        .select('*')
        .in('student_id', connectionStudentIds)
        .order('created_at', { ascending: false })
    : { data: [] as any[] }

  const { data: submissions } = connectionStudentIds.length
    ? await service
        .from('homework_submissions')
        .select('*')
        .in('student_id', connectionStudentIds)
        .order('submitted_at', { ascending: false })
    : { data: [] as any[] }

  const { data: chatMessages } = connectionStudentIds.length
    ? await service
        .from('student_chat_messages')
        .select('*')
        .in('student_id', connectionStudentIds)
        .order('created_at', { ascending: true })
    : { data: [] as any[] }

  const { data: lessonNotes } = connectionStudentIds.length
    ? await service
        .from('lesson_notes')
        .select('*')
        .in('student_id', connectionStudentIds)
        .in('visibility_scope', ['student', 'shared'])
        .order('lesson_date', { ascending: false })
    : { data: [] as any[] }

  const { data: milestones } = connectionStudentIds.length
    ? await service
        .from('progress_milestones')
        .select('*')
        .in('student_id', connectionStudentIds)
        .eq('visible_to_student', true)
        .order('created_at', { ascending: false })
    : { data: [] as any[] }

  const { data: subscriptions } = connectionStudentIds.length
    ? await service
        .from('mock_subscriptions')
        .select('*')
        .in('student_id', connectionStudentIds)
        .order('created_at', { ascending: false })
    : { data: [] as any[] }

  const { data: ownCalendarEvents } = await service
    .from('calendar_events')
    .select('*')
    .eq('user_id', user.id)
    .gte('start_ts', rangeStart.toISOString())
    .lte('start_ts', rangeEnd.toISOString())
    .order('start_ts', { ascending: true })

  const { data: linkedCalendarEvents } = connectionStudentIds.length
    ? await service
        .from('calendar_events')
        .select('*')
        .in('student_id', connectionStudentIds)
        .neq('user_id', user.id)
        .gte('start_ts', rangeStart.toISOString())
        .lte('start_ts', rangeEnd.toISOString())
        .order('start_ts', { ascending: true })
    : { data: [] as any[] }

  const calendarEventsById = new Map(
    [...(ownCalendarEvents || []), ...(linkedCalendarEvents || [])].map((event) => [event.id, event])
  )
  const calendarEvents = Array.from(calendarEventsById.values()).sort(
    (a, b) => new Date(a.start_ts).getTime() - new Date(b.start_ts).getTime()
  )

  const candidateEmails = Array.from(
    new Set(
      [profile.email, ...(connections || []).map((c) => c.email)]
        .filter(Boolean)
        .map((e) => (e as string).toLowerCase())
    )
  )

  const { data: bookings } = tutorIds.length && candidateEmails.length
    ? await service
        .from('bookings')
        .select('id, user_id, start_ts, end_ts, prospect_name, prospect_email, status')
        .in('user_id', tutorIds)
        .in('prospect_email', candidateEmails)
        .order('start_ts', { ascending: false })
    : { data: [] as any[] }

  let googleConnection = null
  let googleEvents: any[] = []
  let googleWarning: string | null = null

  try {
    const connection = await getGoogleCalendarConnection(user.id)
    googleConnection = toGoogleCalendarConnectionSummary(connection)

    if (connection?.connection_status === 'connected') {
      const excludeGoogleEventIds = (calendarEvents || [])
        .map((event: any) => event.google_event_id)
        .filter(Boolean) as string[]

      googleEvents = await listGoogleEvents(user.id, {
        timeMin: rangeStart.toISOString(),
        timeMax: rangeEnd.toISOString(),
        excludeGoogleEventIds,
      })
    }
  } catch (error: any) {
    googleWarning = error?.message || 'Google Calendar events could not be loaded.'
  }

  return (
    <StudentAppContent
      studentName={profile.name || 'Student'}
      studentEmail={profile.email || null}
      connections={decoratedConnections}
      pendingInvitations={decoratedPendingInvitations}
      homework={homework || []}
      files={files || []}
      submissions={submissions || []}
      bookings={bookings || []}
      chatMessages={chatMessages || []}
      lessonNotes={lessonNotes || []}
      milestones={milestones || []}
      subscriptions={subscriptions || []}
      calendarEvents={calendarEvents || []}
      googleConnection={googleConnection}
      googleEvents={googleEvents}
      googleWarning={googleWarning}
      initialRangeStart={rangeStart.toISOString()}
      initialRangeEnd={rangeEnd.toISOString()}
    />
  )
}
