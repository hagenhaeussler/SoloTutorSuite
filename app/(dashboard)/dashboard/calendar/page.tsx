import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarContent } from './calendar-content'
import { getGoogleCalendarConnection, toGoogleCalendarConnectionSummary } from '@/lib/google-calendar/client'
import { listGoogleEvents } from '@/lib/google-calendar/events'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const rangeStart = new Date()
  const rangeEnd = new Date(rangeStart.getTime() + 30 * 24 * 60 * 60 * 1000)

  // Get availability rules
  const { data: rules } = await supabase
    .from('availability_rules')
    .select('*')
    .eq('user_id', user.id)
    .order('day_of_week')

  // Get upcoming bookings
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_id', user.id)
    .gte('start_ts', new Date().toISOString())
    .order('start_ts')
    .limit(20)

  const { data: calendarEvents } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', user.id)
    .gte('start_ts', rangeStart.toISOString())
    .lte('start_ts', rangeEnd.toISOString())
    .order('start_ts', { ascending: true })

  // Get slug for booking link
  const { data: site } = await supabase
    .from('tutor_site')
    .select('slug')
    .eq('user_id', user.id)
    .single()

  // Get reminder preference
  const { data: profile } = await supabase
    .from('profiles')
    .select('reminder_minutes_before')
    .eq('id', user.id)
    .single()

  let googleConnection = null
  let googleEvents: any[] = []
  let googleWarning: string | null = null

  try {
    const connection = await getGoogleCalendarConnection(user.id)
    googleConnection = toGoogleCalendarConnectionSummary(connection)

    if (connection?.connection_status === 'connected') {
      const excludeGoogleEventIds = [
        ...((calendarEvents || []).map((event: any) => event.google_event_id).filter(Boolean) as string[]),
        ...((bookings || []).map((booking: any) => booking.google_event_id).filter(Boolean) as string[]),
      ]

      googleEvents = await listGoogleEvents(user.id, {
        timeMin: rangeStart.toISOString(),
        timeMax: rangeEnd.toISOString(),
        excludeGoogleEventIds,
      })
    }
  } catch (error: any) {
    googleWarning = error?.message || 'Google Calendar events could not be loaded.'
  }

  return (
    <CalendarContent 
      rules={rules || []}
      bookings={bookings || []}
      calendarEvents={calendarEvents || []}
      slug={site?.slug || ''}
      reminderMinutesBefore={profile?.reminder_minutes_before || 10}
      googleConnection={googleConnection}
      googleEvents={googleEvents}
      googleWarning={googleWarning}
      initialRangeStart={rangeStart.toISOString()}
      initialRangeEnd={rangeEnd.toISOString()}
    />
  )
}
