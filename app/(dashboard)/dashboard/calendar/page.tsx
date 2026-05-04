import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarContent } from './calendar-content'
import { getGoogleCalendarConnection, toGoogleCalendarConnectionSummary } from '@/lib/google-calendar/client'
import { listGoogleEvents } from '@/lib/google-calendar/events'

type CalendarPageProps = {
  searchParams?: Promise<{ googleCalendar?: string; googleCalendarReason?: string }> | { googleCalendar?: string; googleCalendarReason?: string }
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams || {})
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0)
  const rangeStart = new Date(monthStart)
  rangeStart.setDate(monthStart.getDate() - monthStart.getDay())
  const rangeEnd = new Date(rangeStart)
  rangeEnd.setDate(rangeStart.getDate() + 41)
  rangeEnd.setHours(23, 59, 59, 999)

  // Get availability rules
  const { data: rules } = await supabase
    .from('availability_rules')
    .select('*')
    .eq('user_id', user.id)
    .order('day_of_week')

  // Get bookings in the first visible month. The client can load other visible ranges on demand.
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_id', user.id)
    .neq('status', 'cancelled')
    .gte('start_ts', rangeStart.toISOString())
    .lte('start_ts', rangeEnd.toISOString())
    .order('start_ts')

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
      googleCalendarStatus={resolvedSearchParams.googleCalendar || null}
      googleCalendarReason={resolvedSearchParams.googleCalendarReason || null}
    />
  )
}
