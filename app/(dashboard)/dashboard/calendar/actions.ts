'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { availabilityRuleSchema, appCalendarEventSchema, type AvailabilityRuleInput, type AppCalendarEventInput } from '@/lib/validations'
import { cancelPendingReminderEmailEvents, reschedulePendingReminderEmailEvents } from '@/lib/booking-emails'
import { getGoogleCalendarConnection, GoogleCalendarConnectionError } from '@/lib/google-calendar/client'
import { createGoogleEventForAppEvent, listGoogleEvents } from '@/lib/google-calendar/events'

export async function addRuleAction(data: AvailabilityRuleInput) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: 'Not authenticated' }
    }

    // Validate input
    const validated = availabilityRuleSchema.parse(data)

    // Insert rule
    const { error } = await supabase
      .from('availability_rules')
      .insert({
        user_id: user.id,
        ...validated,
      })

    if (error) {
      if (error.code === '23505') {
        return { error: 'You already have availability set for this time slot' }
      }
      throw error
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error adding rule:', error)
    return { error: error.message || 'Failed to add availability' }
  }
}

export async function deleteRuleAction(id: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('availability_rules')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting rule:', error)
    return { error: error.message || 'Failed to delete availability' }
  }
}

export async function updateReminderPreferenceAction(reminderMinutesBefore: number) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    if (!Number.isInteger(reminderMinutesBefore) || reminderMinutesBefore < 1 || reminderMinutesBefore > 1440) {
      return { error: 'Reminder must be between 1 and 1440 minutes' }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ reminder_minutes_before: reminderMinutesBefore })
      .eq('id', user.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error updating reminder preference:', error)
    return { error: error.message || 'Failed to update reminder preference' }
  }
}

export async function cancelBookingAction(bookingId: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, user_id')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single()

    if (bookingError || !booking) {
      return { error: 'Booking not found' }
    }

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .eq('user_id', user.id)

    if (error) throw error

    await cancelPendingReminderEmailEvents(supabase, bookingId)

    return { success: true }
  } catch (error: any) {
    console.error('Error cancelling booking:', error)
    return { error: error.message || 'Failed to cancel booking' }
  }
}

export async function rescheduleBookingAction(bookingId: string, startTs: string, endTs: string, reminderOffsetMinutes: number) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('bookings')
      .update({
        start_ts: startTs,
        end_ts: endTs,
        reminder_offset_minutes: reminderOffsetMinutes,
        status: 'confirmed',
      })
      .eq('id', bookingId)
      .eq('user_id', user.id)

    if (error) throw error

    await reschedulePendingReminderEmailEvents(supabase, bookingId, startTs, reminderOffsetMinutes)

    return { success: true }
  } catch (error: any) {
    console.error('Error rescheduling booking:', error)
    return { error: error.message || 'Failed to reschedule booking' }
  }
}

export async function createTeacherCalendarEventAction(data: AppCalendarEventInput) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    const validated = appCalendarEventSchema.parse(data)
    const service = await createServiceClient()
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
        event_type: validated.event_type === 'lesson_event' ? 'lesson_event' : 'teacher_event',
        created_by_role: 'tutor',
        google_sync_status: validated.add_to_google_calendar ? 'not_synced' : 'not_synced',
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
    console.error('Error creating teacher calendar event:', error)
    return { error: error.message || 'Failed to create calendar event' }
  }
}

export async function listTeacherGoogleEventsAction(input: { timeMin: string; timeMax: string; timeZone?: string }) {
  const result = await loadTeacherCalendarRangeAction(input)

  if (result.error) {
    return { error: result.error }
  }

  return {
    success: true,
    events: result.googleEvents || [],
    warning: result.warning || null,
  }
}

export async function loadTeacherCalendarRangeAction(input: { timeMin: string; timeMax: string; timeZone?: string }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    const timeMin = new Date(input.timeMin)
    const timeMax = new Date(input.timeMax)

    if (Number.isNaN(timeMin.getTime()) || Number.isNaN(timeMax.getTime()) || timeMax <= timeMin) {
      return { error: 'Invalid calendar range' }
    }

    const [{ data: appEvents, error: appEventsError }, { data: bookings, error: bookingsError }] = await Promise.all([
      supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_ts', input.timeMin)
        .lte('start_ts', input.timeMax)
        .order('start_ts', { ascending: true }),
      supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'cancelled')
        .gte('start_ts', input.timeMin)
        .lte('start_ts', input.timeMax)
        .order('start_ts', { ascending: true }),
    ])

    if (appEventsError) throw appEventsError
    if (bookingsError) throw bookingsError

    const excludeGoogleEventIds = [
      ...(appEvents || []).map((event) => event.google_event_id).filter(Boolean),
      ...(bookings || []).map((booking) => booking.google_event_id).filter(Boolean),
    ] as string[]

    let googleEvents: Awaited<ReturnType<typeof listGoogleEvents>> = []
    let warning: string | null = null

    try {
      const connection = await getGoogleCalendarConnection(user.id)

      if (connection?.connection_status === 'connected') {
        googleEvents = await listGoogleEvents(user.id, {
          timeMin: input.timeMin,
          timeMax: input.timeMax,
          timeZone: input.timeZone,
          excludeGoogleEventIds,
        })
      } else if (connection?.connection_status === 'needs_reconnect') {
        warning = 'Google Calendar needs to be reconnected.'
      } else if (connection?.connection_status === 'disconnected') {
        warning = 'Google Calendar is disconnected for this account, so only SoloTutorSuite events were refreshed.'
      } else {
        warning = 'No Google Calendar connection row was found for this tutor. If you just approved Google, the OAuth callback probably could not save the encrypted refresh token.'
      }
    } catch (error: any) {
      warning = error instanceof GoogleCalendarConnectionError
        ? error.message
        : 'Google Calendar events could not be loaded.'
    }

    return {
      success: true,
      calendarEvents: appEvents || [],
      bookings: bookings || [],
      googleEvents,
      warning,
    }
  } catch (error: any) {
    console.error('Error loading teacher calendar range:', error)
    return { error: error.message || 'Failed to load calendar events' }
  }
}
