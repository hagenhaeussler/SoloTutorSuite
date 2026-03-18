'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { bookingSchema, type BookingInput } from '@/lib/validations'
import { queueBookingEmailsAndSendConfirmations } from '@/lib/booking-emails'

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

    // Get tutor profile for tutor email + reminder preference
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email, reminder_minutes_before')
      .eq('id', site.user_id)
      .single()

    if (!profile?.email) {
      return { error: 'Tutor email is not configured. Ask the tutor to update their profile email.' }
    }

    const reminderOffset = validated.reminder_offset_minutes || profile.reminder_minutes_before || 10

    // Try to link booking to an existing student by email when the match is unambiguous.
    let linkedStudentId: string | null = null
    const normalizedProspectEmail = validated.prospect_email.trim()
    if (normalizedProspectEmail) {
      const { data: studentMatches } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', site.user_id)
        .ilike('email', normalizedProspectEmail)
        .limit(2)

      if ((studentMatches || []).length === 1) {
        linkedStudentId = studentMatches![0].id
      }
    }

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        user_id: site.user_id,
        student_id: linkedStudentId,
        start_ts: validated.start_ts,
        end_ts: validated.end_ts,
        prospect_name: validated.prospect_name,
        prospect_email: validated.prospect_email,
        parent_guardian_email: validated.parent_guardian_email || null,
        reason: validated.reason || null,
        reminder_offset_minutes: reminderOffset,
        status: 'confirmed',
      })
      .select('id, user_id, student_id, start_ts, prospect_name, prospect_email, parent_guardian_email, reminder_offset_minutes')
      .single()

    if (bookingError) throw bookingError

    // Send confirmation emails now and queue reminders.
    await queueBookingEmailsAndSendConfirmations({
      supabase,
      context: {
        bookingId: booking.id,
        userId: booking.user_id,
        tutorName: profile.name || 'Tutor',
        tutorEmail: profile.email,
        studentName: booking.prospect_name,
        studentEmail: booking.prospect_email,
        parentGuardianEmail: booking.parent_guardian_email,
        lessonStartTs: booking.start_ts,
        reminderOffsetMinutes: booking.reminder_offset_minutes || reminderOffset,
      },
    })

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
