import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SiteContent } from './site-content'

export default async function SitePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get site data
  const { data: site } = await supabase
    .from('tutor_site')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Get profile for name
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  // Get onboarding for subjects
  const { data: onboarding } = await supabase
    .from('tutor_onboarding')
    .select('subjects')
    .eq('user_id', user.id)
    .single()

  return (
    <SiteContent 
      site={site}
      tutorName={profile?.name || 'Tutor'}
      subjects={onboarding?.subjects || []}
    />
  )
}
