import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const role = searchParams.get('role') === 'student' ? 'student' : 'tutor'
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Apply selected role to profile and complete role-specific routing
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Ensure role and invite code (for students) are available
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, student_invite_code')
          .eq('id', user.id)
          .single()

        if (!profile || profile.role !== role || (role === 'student' && !profile.student_invite_code)) {
          const inviteCode = role === 'student'
            ? (profile?.student_invite_code || `STU-${user.id.slice(0, 8).toUpperCase()}`)
            : null

          await supabase
            .from('profiles')
            .update({
              role,
              student_invite_code: inviteCode,
            })
            .eq('id', user.id)
        }

        if (role === 'student') {
          return NextResponse.redirect(`${origin}/student/app`)
        }

        const { data: onboarding } = await supabase
          .from('tutor_onboarding')
          .select('completed')
          .eq('user_id', user.id)
          .single()

        // Redirect to onboarding if not completed
        if (!onboarding?.completed) {
          return NextResponse.redirect(`${origin}/onboarding`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}
