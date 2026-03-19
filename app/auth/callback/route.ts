import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const roleParam = searchParams.get('role')
  const next = searchParams.get('next') ?? '/dashboard'

  // Fallback: read the intended role cookie set by the login page
  const cookieStore = await cookies()
  const cookieRole = cookieStore.get('auth-intended-role')?.value

  const nextIndicatesStudent = next.startsWith('/student')
  const requestedRole: 'student' | 'tutor' =
    roleParam === 'student'
    || (roleParam == null && cookieRole === 'student')
    || (roleParam == null && cookieRole == null && nextIndicatesStudent)
      ? 'student' : 'tutor'

  const supabase = await createClient()

  // Exchange the OAuth code for a session when present
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
    }
  }

  // Either the code exchange above established a session, or the user
  // was already authenticated (middleware forwarded them here for role
  // processing).
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
  }

  // Determine which role to persist
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, student_invite_code')
    .eq('id', user.id)
    .single()

  // Preserve existing role only when there is NO explicit signal
  // (neither query param nor cookie) indicating a role choice.
  const roleToPersist: 'student' | 'tutor' =
    roleParam == null && cookieRole == null && profile?.role
      ? profile.role
      : requestedRole

  if (!profile || profile.role !== roleToPersist || (roleToPersist === 'student' && !profile.student_invite_code)) {
    const inviteCode = roleToPersist === 'student'
      ? (profile?.student_invite_code || `STU-${user.id.slice(0, 8).toUpperCase()}`)
      : null

    await supabase
      .from('profiles')
      .update({
        role: roleToPersist,
        student_invite_code: inviteCode,
      })
      .eq('id', user.id)
  }

  if (roleToPersist === 'student') {
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

  return NextResponse.redirect(`${origin}${next}`)
}
