import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Helper: create a redirect that preserves any auth cookies the
  // Supabase client may have refreshed during getUser()
  const safeRedirect = (url: URL) => {
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie))
    return redirect
  }

  // Protected routes that require authentication
  const protectedRoutes = ['/dashboard', '/onboarding']
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  if (isProtectedRoute && !user) {
    return safeRedirect(new URL('/login', request.url))
  }

  // If an OAuth code landed on the homepage (Supabase ignored our
  // redirectTo), forward to /auth/callback so the code gets exchanged
  if (request.nextUrl.pathname === '/' && request.nextUrl.searchParams.has('code')) {
    const callbackUrl = new URL('/auth/callback', request.url)
    request.nextUrl.searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value)
    })
    const intendedRole = request.cookies.get('auth-intended-role')?.value
    if (intendedRole && !callbackUrl.searchParams.has('role')) {
      callbackUrl.searchParams.set('role', intendedRole)
    }
    const redirect = safeRedirect(callbackUrl)
    redirect.cookies.delete('auth-intended-role')
    return redirect
  }

  // Redirect authenticated users from landing page and login
  if (user && (request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/login')) {
    const roleParam = request.nextUrl.searchParams.get('role')
    const intendedRole = request.cookies.get('auth-intended-role')?.value

    // Homepage with intended-role cookie: OAuth finished but Supabase
    // sent the user here instead of /auth/callback. Forward to callback
    // so the role is persisted properly.
    if (request.nextUrl.pathname === '/' && intendedRole) {
      const dest = intendedRole === 'student' ? '/student/app' : '/dashboard'
      const callbackUrl = new URL('/auth/callback', request.url)
      callbackUrl.searchParams.set('role', intendedRole)
      callbackUrl.searchParams.set('next', dest)
      const redirect = safeRedirect(callbackUrl)
      redirect.cookies.delete('auth-intended-role')
      return redirect
    }

    // Fetch profile role once for routing decisions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Login page with explicit role that differs from the current
    // profile: let the user through so they can re-authenticate and
    // switch roles via the OAuth → callback flow
    if (request.nextUrl.pathname === '/login' && roleParam && profile?.role !== roleParam) {
      return response
    }

    // Default: redirect based on stored profile role
    if (profile?.role === 'student') {
      return safeRedirect(new URL('/student/app', request.url))
    }
    return safeRedirect(new URL('/dashboard', request.url))
  }

  return response
}
