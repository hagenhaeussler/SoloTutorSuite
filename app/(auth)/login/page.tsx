'use client'

import { createClient } from '@/lib/supabase/client'
import { AppLogo } from '@/components/app-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Sparkles, GraduationCap } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageShell />}>
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const requestedRole = searchParams.get('role') === 'student' ? 'student' : 'tutor'
  const roleConflictParam = searchParams.get('role_conflict')
  const roleConflict =
    roleConflictParam === 'student' || roleConflictParam === 'tutor'
      ? roleConflictParam
      : null
  const authError = searchParams.get('error')

  const handleGoogleLogin = async (role: 'tutor' | 'student') => {
    // Persist intended role in a short-lived cookie so the auth callback
    // can still determine the role even if Supabase strips our custom
    // query params from the redirect URL.
    document.cookie = `auth-intended-role=${role}; path=/; max-age=300; samesite=lax`

    const next = role === 'student' ? '/student/app' : '/dashboard'
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?role=${role}&next=${encodeURIComponent(next)}`,
        queryParams: {
          prompt: 'select_account',
        },
      },
    })

    if (error) {
      console.error('Error logging in:', error.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <AppLogo href="/" size="md" className="mb-4 justify-center" />
          <CardTitle>Welcome</CardTitle>
          <CardDescription>
            {requestedRole === 'student'
              ? 'Sign in as a student to access homework, bookings, financials, and chat.'
              : 'Sign in to access your tutor dashboard and grow your tutoring business.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roleConflict && (
            <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                  <p className="font-medium">This email is already a {roleConflict} account.</p>
                  <p className="mt-1 text-yellow-800">
                    Use a different Google account to continue as a {requestedRole}, or open your existing{' '}
                    <Link
                      href={roleConflict === 'student' ? '/student/app' : '/dashboard'}
                      className="font-medium underline underline-offset-2"
                    >
                      {roleConflict} dashboard
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>
          )}
          {authError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {authError}
            </div>
          )}
          <div className="space-y-3">
            <Button
              onClick={() => handleGoogleLogin('tutor')}
              className="w-full gap-2"
              size="lg"
              variant={requestedRole === 'tutor' ? 'default' : 'outline'}
            >
              <Sparkles className="w-5 h-5" />
              Continue as Tutor
            </Button>
            <Button
              onClick={() => handleGoogleLogin('student')}
              className="w-full gap-2"
              size="lg"
              variant={requestedRole === 'student' ? 'default' : 'outline'}
            >
              <GraduationCap className="w-5 h-5" />
              Continue as Student
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            By signing in, you agree to our Terms of Service
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function LoginPageShell() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <AppLogo href="/" size="md" className="mb-4 justify-center" />
          <CardTitle>Welcome</CardTitle>
          <CardDescription>
            Sign in to access your tutor dashboard or student workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button className="w-full gap-2" size="lg">
              <Sparkles className="w-5 h-5" />
              Continue as Tutor
            </Button>
            <Button className="w-full gap-2" size="lg" variant="outline">
              <GraduationCap className="w-5 h-5" />
              Continue as Student
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            By signing in, you agree to our Terms of Service
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
