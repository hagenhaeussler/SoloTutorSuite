'use server'

import { createClient } from '@/lib/supabase/server'
import { availabilityRuleSchema, type AvailabilityRuleInput } from '@/lib/validations'

export async function addRuleAction(data: AvailabilityRuleInput) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: 'Not authenticated' }
    }

    // Validate input
    const validated = availabilityRuleSchema.parse(data)

    // Insert rule
    const { error } = await supabase
      .from('availability_rules')
      .insert({
        user_id: user.id,
        ...validated,
      })

    if (error) {
      if (error.code === '23505') {
        return { error: 'You already have availability set for this time slot' }
      }
      throw error
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error adding rule:', error)
    return { error: error.message || 'Failed to add availability' }
  }
}

export async function deleteRuleAction(id: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('availability_rules')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting rule:', error)
    return { error: error.message || 'Failed to delete availability' }
  }
}
