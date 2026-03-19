'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, GraduationCap } from 'lucide-react'
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
          <Link href="/" className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-2xl">Solo Tutor Suite</span>
          </Link>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>
            {requestedRole === 'student'
              ? 'Sign in as a student to access homework, bookings, billing, and chat.'
              : 'Sign in to access your tutor dashboard and grow your tutoring business.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
          <Link href="/" className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-2xl">Solo Tutor Suite</span>
          </Link>
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
