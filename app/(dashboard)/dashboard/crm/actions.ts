'use server'

import { createClient } from '@/lib/supabase/server'
import { leadSchema, type LeadInput } from '@/lib/validations'

export async function addLeadAction(data: LeadInput) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: 'Not authenticated' }
    }

    const validated = leadSchema.parse(data)

    const { error } = await supabase
      .from('leads')
      .insert({
        user_id: user.id,
        name: validated.name,
        email: validated.email || null,
        phone: validated.phone || null,
        source: validated.source || null,
        stage: validated.stage,
        notes: validated.notes || null,
        next_follow_up_date: validated.next_follow_up_date || null,
      })

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error adding lead:', error)
    return { error: error.message || 'Failed to add lead' }
  }
}

export async function updateLeadAction(id: string, data: Partial<LeadInput>) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('leads')
      .update({
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        source: data.source || null,
        stage: data.stage,
        notes: data.notes || null,
        next_follow_up_date: data.next_follow_up_date || null,
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error updating lead:', error)
    return { error: error.message || 'Failed to update lead' }
  }
}

export async function deleteLeadAction(id: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting lead:', error)
    return { error: error.message || 'Failed to delete lead' }
  }
}

export async function addLeadToStudentsAction(leadId: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, user_id, name, email, stage')
      .eq('id', leadId)
      .eq('user_id', user.id)
      .single()

    if (leadError || !lead) {
      return { error: 'Lead not found' }
    }

    if (lead.email) {
      const { data: existingStudent } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .eq('email', lead.email)
        .maybeSingle()

      if (existingStudent) {
        return { success: true, alreadyExists: true }
      }
    }

    const { error: insertError } = await supabase.from('students').insert({
      user_id: user.id,
      name: lead.name,
      email: lead.email || null,
    })

    if (insertError) throw insertError

    // Mark lead as won once converted to a student.
    const { error: updateError } = await supabase
      .from('leads')
      .update({ stage: 'won' })
      .eq('id', leadId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Failed to update lead stage after student conversion:', updateError)
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error converting lead to student:', error)
    return { error: error.message || 'Failed to add lead to students' }
  }
}
