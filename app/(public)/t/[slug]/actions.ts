'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { tutorInquirySchema, type TutorInquiryInput } from '@/lib/validations'

export async function submitTutorInquiryAction(data: TutorInquiryInput) {
  try {
    const supabase = await createServiceClient()
    const validated = tutorInquirySchema.parse(data)

    const { data: site } = await supabase
      .from('tutor_site')
      .select('id, user_id, slug')
      .eq('slug', validated.tutor_slug)
      .single()

    if (!site) {
      return { error: 'Tutor site not found' }
    }

    const { error: inquiryError } = await supabase.from('tutor_inquiries').insert({
      user_id: site.user_id,
      tutor_site_id: site.id,
      name: validated.name,
      email: validated.email,
      message: validated.message,
      desired_start_date: validated.desired_start_date || null,
      status: 'new',
    })

    if (inquiryError) throw inquiryError

    const { error: leadError } = await supabase.from('leads').insert({
      user_id: site.user_id,
      name: validated.name,
      email: validated.email,
      source: 'tutor_site_contact',
      stage: 'new',
      notes: validated.message,
      next_follow_up_date: validated.desired_start_date || null,
    })

    if (leadError) {
      console.error('Failed to mirror inquiry into leads:', leadError)
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error submitting tutor inquiry:', error)
    return { error: error.message || 'Failed to submit inquiry' }
  }
}
