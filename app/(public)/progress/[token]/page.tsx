import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, ClipboardList, Target, BookOpenCheck } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'

export default async function ProgressSummaryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createServiceClient()

  const { data: shareLink } = await supabase
    .from('progress_share_links')
    .select('id, student_id, revoked_at, expires_at')
    .eq('token', token)
    .single()

  if (!shareLink) notFound()

  if (shareLink.revoked_at) notFound()
  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) notFound()

  const { data: student } = await supabase
    .from('students')
    .select('id, user_id, name')
    .eq('id', shareLink.student_id)
    .single()

  if (!student) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', student.user_id)
    .single()

  const nowIso = new Date().toISOString()

  const { data: upcomingLessons } = await supabase
    .from('bookings')
    .select('id, start_ts, end_ts, status, reason')
    .eq('user_id', student.user_id)
    .eq('student_id', student.id)
    .eq('status', 'confirmed')
    .gte('start_ts', nowIso)
    .order('start_ts', { ascending: true })
    .limit(8)

  const { data: lessonNotes } = await supabase
    .from('lesson_notes')
    .select('id, lesson_date, title, summary, homework_assigned, visibility_scope')
    .eq('student_id', student.id)
    .in('visibility_scope', ['student', 'shared'])
    .order('lesson_date', { ascending: false })
    .limit(8)

  const { data: homework } = await supabase
    .from('homework')
    .select('id, title, due_date')
    .eq('student_id', student.id)
    .order('due_date', { ascending: true })
    .limit(12)

  const { data: milestones } = await supabase
    .from('progress_milestones')
    .select('id, title, description, status, target_date, achieved_at')
    .eq('student_id', student.id)
    .eq('visible_to_student', true)
    .order('created_at', { ascending: false })
    .limit(12)

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Progress Summary</h1>
          <p className="text-sm text-muted-foreground">
            {student.name} · Tutor: {profile?.name || 'Tutor'}
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Upcoming Lessons
              </CardTitle>
              <CardDescription>Confirmed upcoming sessions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(upcomingLessons || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming lessons scheduled.</p>
              ) : (
                upcomingLessons!.map((lesson: any) => (
                  <div key={lesson.id} className="p-3 border rounded-lg">
                    <p className="font-medium">{formatDateTime(lesson.start_ts)}</p>
                    {lesson.reason && <p className="text-sm text-muted-foreground mt-1">{lesson.reason}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                Homework
              </CardTitle>
              <CardDescription>Assigned tasks and due dates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(homework || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No homework assigned.</p>
              ) : (
                homework!.map((hw: any) => (
                  <div key={hw.id} className="p-3 border rounded-lg flex items-center justify-between gap-3">
                    <p className="font-medium">{hw.title}</p>
                    <Badge variant="outline">{hw.due_date ? formatDate(hw.due_date) : 'No due date'}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpenCheck className="w-5 h-5" />
              Recent Lesson Notes
            </CardTitle>
            <CardDescription>Recaps and assigned follow-up work</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(lessonNotes || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No lesson notes shared yet.</p>
            ) : (
              lessonNotes!.map((note: any) => (
                <div key={note.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{note.title}</p>
                    <Badge variant="secondary">{formatDate(note.lesson_date)}</Badge>
                  </div>
                  {note.summary && <p className="text-sm text-muted-foreground mt-2">{note.summary}</p>}
                  {note.homework_assigned && <p className="text-sm mt-2"><span className="font-medium">Homework:</span> {note.homework_assigned}</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Progress Milestones
            </CardTitle>
            <CardDescription>Current goals and achievements</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(milestones || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No milestones yet.</p>
            ) : (
              milestones!.map((milestone: any) => (
                <div key={milestone.id} className="p-3 border rounded-lg flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{milestone.title}</p>
                    {milestone.description && <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>}
                  </div>
                  <Badge variant={milestone.status === 'achieved' ? 'success' : 'outline'}>{milestone.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
