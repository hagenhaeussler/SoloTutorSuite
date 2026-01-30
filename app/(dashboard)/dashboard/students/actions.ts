'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { studentSchema, homeworkSchema, type StudentInput, type HomeworkInput } from '@/lib/validations'

export async function addStudentAction(data: StudentInput) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: 'Not authenticated' }
    }

    const validated = studentSchema.parse(data)

    const { error } = await supabase
      .from('students')
      .insert({
        user_id: user.id,
        name: validated.name,
        email: validated.email || null,
      })

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error adding student:', error)
    return { error: error.message || 'Failed to add student' }
  }
}

export async function deleteStudentAction(id: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting student:', error)
    return { error: error.message || 'Failed to delete student' }
  }
}

export async function addHomeworkAction(data: HomeworkInput) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: 'Not authenticated' }
    }

    const validated = homeworkSchema.parse(data)

    const { error } = await supabase
      .from('homework')
      .insert({
        user_id: user.id,
        student_id: validated.student_id,
        title: validated.title,
        instructions: validated.instructions || null,
        due_date: validated.due_date || null,
      })

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error adding homework:', error)
    return { error: error.message || 'Failed to add homework' }
  }
}

export async function deleteHomeworkAction(id: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('homework')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting homework:', error)
    return { error: error.message || 'Failed to delete homework' }
  }
}

export async function uploadFileAction(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: 'Not authenticated' }
    }

    const file = formData.get('file') as File
    const studentId = formData.get('studentId') as string

    if (!file || !studentId) {
      return { error: 'Missing file or student ID' }
    }

    // Upload to storage
    const path = `${user.id}/${studentId}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('student-files')
      .upload(path, file)

    if (uploadError) throw uploadError

    // Save to database
    const { error: dbError } = await supabase
      .from('student_files')
      .insert({
        user_id: user.id,
        student_id: studentId,
        storage_path: path,
        filename: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: 'tutor',
      })

    if (dbError) throw dbError

    return { success: true }
  } catch (error: any) {
    console.error('Error uploading file:', error)
    return { error: error.message || 'Failed to upload file' }
  }
}

export async function deleteFileAction(id: string, storagePath: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: 'Not authenticated' }
    }

    // Delete from storage
    await supabase.storage.from('student-files').remove([storagePath])

    // Delete from database
    const { error } = await supabase
      .from('student_files')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting file:', error)
    return { error: error.message || 'Failed to delete file' }
  }
}

export async function getSignedUrlAction(storagePath: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: 'Not authenticated' }
    }

    const { data, error } = await supabase.storage
      .from('student-files')
      .createSignedUrl(storagePath, 3600) // 1 hour

    if (error) throw error

    return { url: data.signedUrl }
  } catch (error: any) {
    console.error('Error getting signed URL:', error)
    return { error: error.message || 'Failed to get download link' }
  }
}
