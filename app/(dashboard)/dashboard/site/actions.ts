'use server'

import { createClient } from '@/lib/supabase/server'
import { siteEditSchema, type SiteEditInput } from '@/lib/validations'

export async function updateSiteAction(data: SiteEditInput) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: 'Not authenticated' }
    }

    // Validate input
    const validated = siteEditSchema.parse(data)

    // Update site
    const { error } = await supabase
      .from('tutor_site')
      .update({
        headline: validated.headline,
        bio: validated.bio,
        packages: validated.packages,
        booking_link: validated.booking_link || null,
        published: validated.published,
      })
      .eq('user_id', user.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error updating site:', error)
    return { error: error.message || 'Failed to update site' }
  }
}
