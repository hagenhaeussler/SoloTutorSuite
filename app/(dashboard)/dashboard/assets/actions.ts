'use server'

import { createClient } from '@/lib/supabase/server'
import { generateAsset } from '@/lib/openai'
import type { TutorOnboarding } from '@/lib/types'

export async function generateAssetAction(
  assetType: string,
  onboarding: TutorOnboarding,
  tutorName: string
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: 'Not authenticated' }
    }

    // Generate asset with OpenAI
    const content = await generateAsset(assetType, onboarding, tutorName)

    // Delete existing asset of this type
    await supabase
      .from('assets')
      .delete()
      .eq('user_id', user.id)
      .eq('asset_type', assetType)

    // Save new asset
    const { error } = await supabase
      .from('assets')
      .insert({
        user_id: user.id,
        asset_type: assetType,
        content,
      })

    if (error) throw error

    return { content }
  } catch (error: any) {
    console.error('Error generating asset:', error)
    return { error: error.message || 'Failed to generate asset' }
  }
}
