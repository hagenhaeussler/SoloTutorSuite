'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { chatMessageSchema } from '@/lib/validations'

export async function submitHomeworkByAuthAction(formData: FormData) {
  try {
    const supabase = await createClient()
    const service = await createServiceClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const file = formData.get('file') as File
    const homeworkId = formData.get('homeworkId') as string

    if (!file || !homeworkId) return { error: 'Missing file or homework ID' }

    const { data: homework } = await service
      .from('homework')
      .select('id, student_id, user_id')
      .eq('id', homeworkId)
      .single()

    if (!homework) return { error: 'Homework not found' }

    const { data: student } = await service
      .from('students')
      .select('id, user_id')
      .eq('id', homework.student_id)
      .eq('auth_user_id', user.id)
      .single()

    if (!student) return { error: 'Access denied' }

    const path = `${student.user_id}/${student.id}/submissions/${Date.now()}-${file.name}`
    const { error: uploadError } = await service.storage
      .from('student-files')
      .upload(path, file)

    if (uploadError) throw uploadError

    const { error: dbError } = await service
      .from('homework_submissions')
      .insert({
        homework_id: homeworkId,
        student_id: student.id,
        storage_path: path,
        filename: file.name,
      })

    if (dbError) throw dbError

    return { success: true }
  } catch (error: any) {
    console.error('Error submitting homework (student auth):', error)
    return { error: error.message || 'Failed to submit homework' }
  }
}

export async function sendStudentChatMessageAction(studentId: string, messageInput: string) {
  try {
    const supabase = await createClient()
    const service = await createServiceClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const { message } = chatMessageSchema.parse({ message: messageInput })

    const { data: student } = await service
      .from('students')
      .select('id, user_id')
      .eq('id', studentId)
      .eq('auth_user_id', user.id)
      .single()

    if (!student) return { error: 'Access denied' }

    const { error } = await service
      .from('student_chat_messages')
      .insert({
        tutor_user_id: student.user_id,
        student_id: student.id,
        sender_type: 'student',
        sender_user_id: user.id,
        message,
      })

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error sending student chat message:', error)
    return { error: error.message || 'Failed to send message' }
  }
}
