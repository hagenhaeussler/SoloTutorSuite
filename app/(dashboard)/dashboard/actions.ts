'use server'

import { createClient } from '@/lib/supabase/server'
import { generateGrowthPlan } from '@/lib/openai'
import type { TutorOnboarding } from '@/lib/types'

export async function generatePlanAction(onboarding: TutorOnboarding, tutorName: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: 'Not authenticated' }
    }

    // Generate plan with OpenAI
    const plan = await generateGrowthPlan(onboarding, tutorName)

    // Save to database
    const { error } = await supabase
      .from('growth_plans')
      .insert({
        user_id: user.id,
        plan_json: plan,
      })

    if (error) throw error

    return { plan }
  } catch (error: any) {
    console.error('Error generating plan:', error)
    return { error: error.message || 'Failed to generate plan' }
  }
}
