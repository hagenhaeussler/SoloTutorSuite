import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarContent } from './calendar-content'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

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

  // Get slug for booking link
  const { data: site } = await supabase
    .from('tutor_site')
    .select('slug')
    .eq('user_id', user.id)
    .single()

  return (
    <CalendarContent 
      rules={rules || []}
      bookings={bookings || []}
      slug={site?.slug || ''}
    />
  )
}
