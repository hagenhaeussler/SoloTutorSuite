'use server'

import { createClient } from '@/lib/supabase/server'
import { availabilityRuleSchema, type AvailabilityRuleInput } from '@/lib/validations'
import { cancelPendingReminderEmailEvents, reschedulePendingReminderEmailEvents } from '@/lib/booking-emails'

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
