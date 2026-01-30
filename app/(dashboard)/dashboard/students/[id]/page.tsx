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

  return (
    <StudentDetailContent 
      student={student}
      files={files || []}
      homework={homework || []}
      submissions={submissions || []}
    />
  )
}
