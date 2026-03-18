import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { StudentAppContent } from './student-app-content'

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
    .select('id, name, email, role, student_invite_code')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login?error=Profile not found')
  }

  if (profile.role !== 'student') {
    redirect('/dashboard')
  }

  const { data: connections } = await service
    .from('students')
    .select('id, user_id, name, email, zoom_meeting_link')
    .eq('auth_user_id', user.id)
    .order('created_at', { ascending: false })

  const tutorIds = Array.from(new Set((connections || []).map((c) => c.user_id)))

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

  return (
    <StudentAppContent
      studentName={profile.name || 'Student'}
      studentEmail={profile.email || null}
      studentInviteCode={profile.student_invite_code}
      connections={decoratedConnections}
      homework={homework || []}
      files={files || []}
      submissions={submissions || []}
      bookings={bookings || []}
      chatMessages={chatMessages || []}
      lessonNotes={lessonNotes || []}
      milestones={milestones || []}
    />
  )
}
