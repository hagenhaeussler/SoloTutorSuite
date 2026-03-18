import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { StudentDetailContent } from './student-detail-content'

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get student
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!student) notFound()

  // Get files
  const { data: files } = await supabase
    .from('student_files')
    .select('*')
    .eq('student_id', id)
    .order('created_at', { ascending: false })

  // Get homework
  const { data: homework } = await supabase
    .from('homework')
    .select('*')
    .eq('student_id', id)
    .order('created_at', { ascending: false })

  // Get submissions
  const { data: submissions } = await supabase
    .from('homework_submissions')
    .select('*')
    .eq('student_id', id)

  // Get chat messages
  const { data: chatMessages } = await supabase
    .from('student_chat_messages')
    .select('*')
    .eq('student_id', id)
    .eq('tutor_user_id', user.id)
    .order('created_at', { ascending: true })

  const { data: lessonNotes } = await supabase
    .from('lesson_notes')
    .select('*')
    .eq('student_id', id)
    .eq('user_id', user.id)
    .order('lesson_date', { ascending: false })

  const { data: milestones } = await supabase
    .from('progress_milestones')
    .select('*')
    .eq('student_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const { data: shareLinks } = await supabase
    .from('progress_share_links')
    .select('*')
    .eq('student_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <StudentDetailContent 
      student={student}
      files={files || []}
      homework={homework || []}
      submissions={submissions || []}
      chatMessages={chatMessages || []}
      lessonNotes={lessonNotes || []}
      milestones={milestones || []}
      shareLinks={shareLinks || []}
    />
  )
}
