import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { StudentPortalContent } from './student-portal-content'

export default async function StudentPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createServiceClient()

  // Get student by access token
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('access_token', token)
    .single()

  if (!student) notFound()

  // Get tutor name
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', student.user_id)
    .single()

  // Get files for this student
  const { data: files } = await supabase
    .from('student_files')
    .select('*')
    .eq('student_id', student.id)
    .order('created_at', { ascending: false })

  // Get homework for this student
  const { data: homework } = await supabase
    .from('homework')
    .select('*')
    .eq('student_id', student.id)
    .order('due_date', { ascending: true })

  // Get submissions
  const { data: submissions } = await supabase
    .from('homework_submissions')
    .select('*')
    .eq('student_id', student.id)

  return (
    <StudentPortalContent
      student={student}
      tutorName={profile?.name || 'Your Tutor'}
      files={files || []}
      homework={homework || []}
      submissions={submissions || []}
      token={token}
    />
  )
}
