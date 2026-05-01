'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { appCalendarEventSchema, chatMessageSchema, type AppCalendarEventInput } from '@/lib/validations'
import { GoogleCalendarConnectionError } from '@/lib/google-calendar/client'
import { createGoogleEventForAppEvent, listGoogleEvents } from '@/lib/google-calendar/events'

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

export async function toggleStudentMilestoneAction(milestoneId: string, achieved: boolean) {
  try {
    const supabase = await createClient()
    const service = await createServiceClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const { data: milestone } = await service
      .from('progress_milestones')
      .select('id, student_id, visible_to_student')
      .eq('id', milestoneId)
      .eq('visible_to_student', true)
      .single()

    if (!milestone) return { error: 'Milestone not found' }

    const { data: student } = await service
      .from('students')
      .select('id')
      .eq('id', milestone.student_id)
      .eq('auth_user_id', user.id)
      .single()

    if (!student) return { error: 'Access denied' }

    const { error } = await service
      .from('progress_milestones')
      .update({
        status: achieved ? 'achieved' : 'pending',
        achieved_at: achieved ? new Date().toISOString() : null,
      })
      .eq('id', milestone.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error toggling student milestone:', error)
    return { error: error.message || 'Failed to update milestone' }
  }
}

export async function buyMockSubscriptionAction(subscriptionId: string) {
  try {
    const supabase = await createClient()
    const service = await createServiceClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const { data: subscription } = await service
      .from('mock_subscriptions')
      .select('id, student_id, status')
      .eq('id', subscriptionId)
      .single()

    if (!subscription) return { error: 'Subscription not found' }

    const { data: student } = await service
      .from('students')
      .select('id')
      .eq('id', subscription.student_id)
      .eq('auth_user_id', user.id)
      .single()

    if (!student) return { error: 'Access denied' }
    if (subscription.status !== 'offered') return { error: 'This subscription is no longer available to buy' }

    const { error } = await service
      .from('mock_subscriptions')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
        cancelled_at: null,
      })
      .eq('id', subscription.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error buying mock subscription:', error)
    return { error: error.message || 'Failed to buy subscription' }
  }
}

export async function cancelStudentMockSubscriptionAction(subscriptionId: string) {
  try {
    const supabase = await createClient()
    const service = await createServiceClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const { data: subscription } = await service
      .from('mock_subscriptions')
      .select('id, student_id, status')
      .eq('id', subscriptionId)
      .single()

    if (!subscription) return { error: 'Subscription not found' }

    const { data: student } = await service
      .from('students')
      .select('id')
      .eq('id', subscription.student_id)
      .eq('auth_user_id', user.id)
      .single()

    if (!student) return { error: 'Access denied' }
    if (subscription.status === 'cancelled') return { success: true }

    const { error } = await service
      .from('mock_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error cancelling student mock subscription:', error)
    return { error: error.message || 'Failed to cancel subscription' }
  }
}

export async function createStudentCalendarEventAction(data: AppCalendarEventInput) {
  try {
    const supabase = await createClient()
    const service = await createServiceClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const validated = appCalendarEventSchema.parse(data)

    if (validated.student_id) {
      const { data: student } = await service
        .from('students')
        .select('id')
        .eq('id', validated.student_id)
        .eq('auth_user_id', user.id)
        .single()

      if (!student) return { error: 'Access denied' }
    }

    const { data: event, error } = await service
      .from('calendar_events')
      .insert({
        user_id: user.id,
        student_id: validated.student_id || null,
        title: validated.title,
        description: validated.description || null,
        location: validated.location || null,
        start_ts: validated.start_ts,
        end_ts: validated.end_ts,
        event_type: 'student_event',
        created_by_role: 'student',
        google_sync_status: 'not_synced',
      })
      .select('id, title, description, location, start_ts, end_ts, event_type')
      .single()

    if (error) throw error

    let warning: string | null = null
    if (validated.add_to_google_calendar) {
      try {
        const googleResult = await createGoogleEventForAppEvent(user.id, {
          id: event.id,
          type: event.event_type,
          title: event.title,
          description: event.description,
          location: event.location,
          start: event.start_ts,
          end: event.end_ts,
        })

        await service
          .from('calendar_events')
          .update(googleResult)
          .eq('id', event.id)
          .eq('user_id', user.id)
      } catch (syncError: any) {
        warning = syncError instanceof GoogleCalendarConnectionError
          ? syncError.message
          : 'The event was saved, but Google Calendar sync failed.'

        if (!(syncError instanceof GoogleCalendarConnectionError && syncError.code === 'not_connected')) {
          await service
            .from('calendar_events')
            .update({
              google_sync_status: 'failed',
              google_last_synced_at: new Date().toISOString(),
            })
            .eq('id', event.id)
            .eq('user_id', user.id)
        }
      }
    }

    return { success: true, warning }
  } catch (error: any) {
    console.error('Error creating student calendar event:', error)
    return { error: error.message || 'Failed to create calendar event' }
  }
}

export async function listStudentGoogleEventsAction(input: { timeMin: string; timeMax: string; timeZone?: string }) {
  try {
    const supabase = await createClient()
    const service = await createServiceClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const timeMin = new Date(input.timeMin)
    const timeMax = new Date(input.timeMax)

    if (Number.isNaN(timeMin.getTime()) || Number.isNaN(timeMax.getTime()) || timeMax <= timeMin) {
      return { error: 'Invalid calendar range' }
    }

    const { data: appEvents } = await service
      .from('calendar_events')
      .select('google_event_id')
      .eq('user_id', user.id)
      .not('google_event_id', 'is', null)
      .gte('start_ts', input.timeMin)
      .lte('start_ts', input.timeMax)

    const excludeGoogleEventIds = (appEvents || [])
      .map((event) => event.google_event_id)
      .filter(Boolean) as string[]

    const events = await listGoogleEvents(user.id, {
      timeMin: input.timeMin,
      timeMax: input.timeMax,
      timeZone: input.timeZone,
      excludeGoogleEventIds,
    })

    return { success: true, events }
  } catch (error: any) {
    if (error instanceof GoogleCalendarConnectionError) {
      return { success: true, events: [], warning: error.message }
    }

    console.error('Error listing student Google Calendar events:', error)
    return { error: error.message || 'Failed to load Google Calendar events' }
  }
}
