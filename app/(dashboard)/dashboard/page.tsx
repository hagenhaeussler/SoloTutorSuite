import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GrowthPlanContent } from './growth-plan-content'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check onboarding
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

  // Get latest growth plan
  const { data: growthPlan } = await supabase
    .from('growth_plans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return (
    <GrowthPlanContent 
      onboarding={onboarding}
      growthPlan={growthPlan}
      tutorName={profile?.name || 'Tutor'}
    />
  )
}
