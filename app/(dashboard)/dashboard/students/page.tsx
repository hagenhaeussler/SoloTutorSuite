import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StudentsContent } from './students-content'

export default async function StudentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get students
  const { data: students } = await supabase
    .from('students')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return <StudentsContent students={students || []} />
}
