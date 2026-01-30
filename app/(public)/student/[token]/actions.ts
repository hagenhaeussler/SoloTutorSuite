'use server'

import { createServiceClient } from '@/lib/supabase/server'

export async function downloadFileAction(storagePath: string, token: string) {
  try {
    const supabase = await createServiceClient()

    // Verify token belongs to a student who has access to this file
    const { data: student } = await supabase
      .from('students')
      .select('id, user_id')
      .eq('access_token', token)
      .single()

    if (!student) {
      return { error: 'Invalid access token' }
    }

    // Verify the file belongs to this student
    const { data: file } = await supabase
      .from('student_files')
      .select('id')
      .eq('storage_path', storagePath)
      .eq('student_id', student.id)
      .single()

    if (!file) {
      return { error: 'File not found or access denied' }
    }

    // Get signed URL
    const { data, error } = await supabase.storage
      .from('student-files')
      .createSignedUrl(storagePath, 3600)

    if (error) throw error

    return { url: data.signedUrl }
  } catch (error: any) {
    console.error('Error downloading file:', error)
    return { error: error.message || 'Failed to download file' }
  }
}

export async function uploadFileAction(formData: FormData) {
  try {
    const supabase = await createServiceClient()

    const file = formData.get('file') as File
    const token = formData.get('token') as string

    if (!file || !token) {
      return { error: 'Missing file or token' }
    }

    // Verify token
    const { data: student } = await supabase
      .from('students')
      .select('id, user_id')
      .eq('access_token', token)
      .single()

    if (!student) {
      return { error: 'Invalid access token' }
    }

    // Upload to storage
    const path = `${student.user_id}/${student.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('student-files')
      .upload(path, file)

    if (uploadError) throw uploadError

    // Save to database
    const { error: dbError } = await supabase
      .from('student_files')
      .insert({
        user_id: student.user_id,
        student_id: student.id,
        storage_path: path,
        filename: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: 'student',
      })

    if (dbError) throw dbError

    return { success: true }
  } catch (error: any) {
    console.error('Error uploading file:', error)
    return { error: error.message || 'Failed to upload file' }
  }
}

export async function submitHomeworkAction(formData: FormData) {
  try {
    const supabase = await createServiceClient()

    const file = formData.get('file') as File
    const homeworkId = formData.get('homeworkId') as string
    const token = formData.get('token') as string

    if (!file || !homeworkId || !token) {
      return { error: 'Missing required fields' }
    }

    // Verify token
    const { data: student } = await supabase
      .from('students')
      .select('id, user_id')
      .eq('access_token', token)
      .single()

    if (!student) {
      return { error: 'Invalid access token' }
    }

    // Verify homework belongs to this student
    const { data: homework } = await supabase
      .from('homework')
      .select('id')
      .eq('id', homeworkId)
      .eq('student_id', student.id)
      .single()

    if (!homework) {
      return { error: 'Homework not found' }
    }

    // Upload to storage
    const path = `${student.user_id}/${student.id}/submissions/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('student-files')
      .upload(path, file)

    if (uploadError) throw uploadError

    // Save submission
    const { error: dbError } = await supabase
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
    console.error('Error submitting homework:', error)
    return { error: error.message || 'Failed to submit homework' }
  }
}
