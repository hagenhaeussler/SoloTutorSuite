'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { bookingSchema, type BookingInput } from '@/lib/validations'

export async function createBookingAction(data: BookingInput) {
  try {
    const supabase = await createServiceClient()

    // Validate input
    const validated = bookingSchema.parse(data)

    // Get tutor user_id from slug
    const { data: site } = await supabase
      .from('tutor_site')
      .select('user_id')
      .eq('slug', validated.tutor_slug)
      .single()

    if (!site) {
      return { error: 'Tutor not found' }
    }

    // Create booking
    const { error: bookingError } = await supabase
      .from('bookings')
      .insert({
        user_id: site.user_id,
        start_ts: validated.start_ts,
        end_ts: validated.end_ts,
        prospect_name: validated.prospect_name,
        prospect_email: validated.prospect_email,
        reason: validated.reason || null,
        status: 'confirmed',
      })

    if (bookingError) throw bookingError

    // Auto-create CRM lead
    const { error: leadError } = await supabase
      .from('leads')
      .insert({
        user_id: site.user_id,
        name: validated.prospect_name,
        email: validated.prospect_email,
        source: 'booking',
        stage: 'booked',
        notes: validated.reason || null,
      })

    if (leadError) {
      console.error('Failed to create lead:', leadError)
      // Don't fail the booking if lead creation fails
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error creating booking:', error)
    return { error: error.message || 'Failed to create booking' }
  }
}
