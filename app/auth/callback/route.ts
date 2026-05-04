import { createClient, createServiceClient } from '@/lib/supabase/server'
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
  const explicitRoleChoice =
    roleParam === 'student'
    || roleParam === 'tutor'
    || cookieRole === 'student'
    || cookieRole === 'tutor'
    || nextIndicatesStudent

  const redirectAndClearRoleCookie = (url: string | URL) => {
    const response = NextResponse.redirect(url)
    response.cookies.delete('auth-intended-role')
    return response
  }

  const supabase = await createClient()
  const service = await createServiceClient()

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
  const { data: profile } = await service
    .from('profiles')
    .select('email, name, avatar_url, role, student_invite_code, created_at')
    .eq('id', user.id)
    .maybeSingle()

  const profileCreatedAt = profile?.created_at ? Date.parse(profile.created_at) : NaN
  const profileWasJustCreated =
    Number.isFinite(profileCreatedAt) && Date.now() - profileCreatedAt < 2 * 60 * 1000
  const isFreshDefaultTutorProfile =
    profile?.role === 'tutor'
    && requestedRole === 'student'
    && profileWasJustCreated
    && !profile.student_invite_code

  if (
    explicitRoleChoice
    && profile?.role
    && profile.role !== requestedRole
    && !isFreshDefaultTutorProfile
  ) {
    const conflictUrl = new URL('/login', origin)
    conflictUrl.searchParams.set('role', requestedRole)
    conflictUrl.searchParams.set('role_conflict', profile.role)
    return redirectAndClearRoleCookie(conflictUrl)
  }

  // Preserve existing role only when there is NO explicit signal
  // (neither query param nor cookie) indicating a role choice.
  const roleToPersist: 'student' | 'tutor' =
    roleParam == null && cookieRole == null && profile?.role
      ? profile.role
      : requestedRole

  if (!profile || profile.role !== roleToPersist || (roleToPersist === 'student' && !profile.student_invite_code)) {
    const email = user.email || profile?.email
    if (!email) {
      return NextResponse.redirect(`${origin}/login?error=Could not read account email`)
    }

    const inviteCode = roleToPersist === 'student'
      ? (profile?.student_invite_code || `STU-${user.id.slice(0, 8).toUpperCase()}`)
      : null

    await service
      .from('profiles')
      .upsert({
        id: user.id,
        email,
        name: profile?.name || user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0],
        avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || null,
        role: roleToPersist,
        student_invite_code: inviteCode,
      }, { onConflict: 'id' })
  }

  if (roleToPersist === 'student') {
    return redirectAndClearRoleCookie(`${origin}/student/app`)
  }

  const { data: onboarding } = await supabase
    .from('tutor_onboarding')
    .select('completed')
    .eq('user_id', user.id)
    .single()

  // Redirect to onboarding if not completed
  if (!onboarding?.completed) {
    return redirectAndClearRoleCookie(`${origin}/onboarding`)
  }

  return redirectAndClearRoleCookie(`${origin}${next}`)
}
