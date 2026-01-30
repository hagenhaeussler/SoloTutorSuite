import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { BookingContent } from './booking-content'

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createServiceClient()

  // Get site by slug
  const { data: site } = await supabase
    .from('tutor_site')
    .select('user_id, slug')
    .eq('slug', slug)
    .single()

  if (!site) notFound()

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', site.user_id)
    .single()

  // Get availability rules
  const { data: rules } = await supabase
    .from('availability_rules')
    .select('*')
    .eq('user_id', site.user_id)

  // Get existing bookings for next 14 days
  const startDate = new Date()
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 14)

  const { data: bookings } = await supabase
    .from('bookings')
    .select('start_ts, end_ts')
    .eq('user_id', site.user_id)
    .eq('status', 'confirmed')
    .gte('start_ts', startDate.toISOString())
    .lte('start_ts', endDate.toISOString())

  return (
    <BookingContent
      slug={slug}
      tutorName={profile?.name || 'Tutor'}
      tutorId={site.user_id}
      rules={rules || []}
      existingBookings={bookings || []}
    />
  )
}
