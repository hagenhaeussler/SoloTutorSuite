import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AssetsContent } from './assets-content'

export default async function AssetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get onboarding data
  const { data: onboarding } = await supabase
    .from('tutor_onboarding')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!onboarding?.completed) {
    redirect('/onboarding')
  }

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  // Get all assets
  const { data: assets } = await supabase
    .from('assets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <AssetsContent 
      onboarding={onboarding}
      assets={assets || []}
      tutorName={profile?.name || 'Tutor'}
    />
  )
}
