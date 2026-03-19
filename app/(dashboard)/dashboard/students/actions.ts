'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  studentSchema,
  homeworkSchema,
  zoomMeetingLinkSchema,
  studentInviteCodeSchema,
  chatMessageSchema,
  updateStudentProfileSchema,
  lessonNoteSchema,
  progressMilestoneSchema,
  progressShareLinkSchema,
  type StudentInput,
  type HomeworkInput,
  type UpdateStudentProfileInput,
} from '@/lib/validations'

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
        parent_contact: validated.parent_contact || null,
        subject_exam_type: validated.subject_exam_type || null,
        notes: validated.notes || null,
        status: validated.status,
      })

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error adding student:', error)
    return { error: error.message || 'Failed to add student' }
  }
}

export async function updateStudentProfileAction(data: UpdateStudentProfileInput) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    const validated = updateStudentProfileSchema.parse(data)

    const { error } = await supabase
      .from('students')
      .update({
        name: validated.name,
        email: validated.email || null,
        parent_contact: validated.parent_contact || null,
        subject_exam_type: validated.subject_exam_type || null,
        notes: validated.notes || null,
        status: validated.status,
      })
      .eq('id', validated.id)
      .eq('user_id', user.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error updating student profile:', error)
    return { error: error.message || 'Failed to update student profile' }
  }
}

export async function addStudentByInviteCodeAction(inviteCodeInput: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    const inviteCode = studentInviteCodeSchema.parse(inviteCodeInput.trim().toUpperCase())

    const { data: studentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .eq('student_invite_code', inviteCode)
      .single()

    if (profileError || !studentProfile || studentProfile.role !== 'student') {
      return { error: 'Student ID not found' }
    }

    const { data: existing } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .eq('auth_user_id', studentProfile.id)
      .maybeSingle()

    if (existing) {
      return { success: true, alreadyExists: true }
    }

    const { error } = await supabase.from('students').insert({
      user_id: user.id,
      auth_user_id: studentProfile.id,
      name: studentProfile.name || 'Student',
      email: studentProfile.email || null,
    })

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error adding student by invite code:', error)
    return { error: error.message || 'Failed to add student by ID' }
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

    // Verify ownership with the user (anon) client before writing anything
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('user_id', user.id)
      .single()

    if (!student) {
      return { error: 'Student not found' }
    }

    // Use the service client for storage and DB writes.
    // The anon-client JWT is not reliably propagated to PostgREST in
    // Next.js Server Actions, causing RLS violations even when the user
    // is authenticated. Ownership has already been verified above.
    const service = await createServiceClient()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${user.id}/${studentId}/${Date.now()}-${safeName}`

    const { error: uploadError } = await service.storage
      .from('student-files')
      .upload(path, file)

    if (uploadError) throw uploadError

    // Save to database
    const { error: dbError } = await service
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

export async function updateStudentZoomLinkAction(studentId: string, zoomMeetingLink: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    const normalized = zoomMeetingLink.trim()
    let value: string | null = null
    if (normalized) {
      try {
        value = zoomMeetingLinkSchema.parse(normalized)
      } catch (zodErr: any) {
        const msg = zodErr?.errors?.[0]?.message ?? zodErr?.message ?? 'Enter a valid URL'
        return { error: msg }
      }
    }

    // Use service client to avoid JWT propagation issues in Server Actions
    const service = await createServiceClient()
    const { error } = await service
      .from('students')
      .update({ zoom_meeting_link: value })
      .eq('id', studentId)
      .eq('user_id', user.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error updating student Zoom link:', error)
    return { error: error.message || 'Failed to update video call link' }
  }
}

export async function sendTutorChatMessageAction(studentId: string, messageInput: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    const { message } = chatMessageSchema.parse({ message: messageInput })

    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('user_id', user.id)
      .single()

    if (!student) {
      return { error: 'Student not found' }
    }

    const { error } = await supabase
      .from('student_chat_messages')
      .insert({
        tutor_user_id: user.id,
        student_id: student.id,
        sender_type: 'tutor',
        sender_user_id: user.id,
        message,
      })

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error sending tutor chat message:', error)
    return { error: error.message || 'Failed to send message' }
  }
}

export async function addLessonNoteAction(data: {
  student_id: string
  booking_id?: string
  lesson_date: string
  title: string
  summary?: string
  homework_assigned?: string
  visibility_scope?: 'private' | 'student' | 'shared'
}) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const validated = lessonNoteSchema.parse(data)

    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', validated.student_id)
      .eq('user_id', user.id)
      .single()

    if (!student) return { error: 'Student not found' }

    const { error } = await supabase.from('lesson_notes').insert({
      user_id: user.id,
      student_id: validated.student_id,
      booking_id: validated.booking_id || null,
      lesson_date: validated.lesson_date,
      title: validated.title,
      summary: validated.summary || null,
      homework_assigned: validated.homework_assigned || null,
      visibility_scope: validated.visibility_scope,
    })

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Error adding lesson note:', error)
    return { error: error.message || 'Failed to add lesson note' }
  }
}

export async function addProgressMilestoneAction(data: {
  student_id: string
  title: string
  description?: string
  status?: 'pending' | 'in_progress' | 'achieved'
  target_date?: string
  visible_to_student?: boolean
}) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const validated = progressMilestoneSchema.parse(data)

    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', validated.student_id)
      .eq('user_id', user.id)
      .single()

    if (!student) return { error: 'Student not found' }

    const { error } = await supabase.from('progress_milestones').insert({
      user_id: user.id,
      student_id: validated.student_id,
      title: validated.title,
      description: validated.description || null,
      status: validated.status,
      target_date: validated.target_date || null,
      visible_to_student: validated.visible_to_student,
      achieved_at: validated.status === 'achieved' ? new Date().toISOString() : null,
    })

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Error adding milestone:', error)
    return { error: error.message || 'Failed to add milestone' }
  }
}

export async function createProgressShareLinkAction(data: { student_id: string; expires_in_days?: number }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const validated = progressShareLinkSchema.parse(data)

    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', validated.student_id)
      .eq('user_id', user.id)
      .single()

    if (!student) return { error: 'Student not found' }

    const expiresAt = validated.expires_in_days
      ? new Date(Date.now() + validated.expires_in_days * 24 * 60 * 60 * 1000).toISOString()
      : null

    const { data: link, error } = await supabase
      .from('progress_share_links')
      .insert({
        user_id: user.id,
        student_id: validated.student_id,
        expires_at: expiresAt,
        created_by: user.id,
      })
      .select('id, token')
      .single()

    if (error) throw error

    return { success: true, id: link.id, token: link.token }
  } catch (error: any) {
    console.error('Error creating progress share link:', error)
    return { error: error.message || 'Failed to create share link' }
  }
}

export async function revokeProgressShareLinkAction(linkId: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('progress_share_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', linkId)
      .eq('user_id', user.id)

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Error revoking progress share link:', error)
    return { error: error.message || 'Failed to revoke share link' }
  }
}
