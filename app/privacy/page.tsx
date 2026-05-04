import Link from 'next/link'
import { AppLogo } from '@/components/app-logo'

export const metadata = {
  title: 'Privacy Policy | SoloTutorSuite',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <AppLogo href="/" size="sm" textClassName="text-xl" priority />
          <Link href="/terms" className="text-sm font-medium text-primary">
            Terms
          </Link>
        </div>
      </header>

      <article className="container mx-auto max-w-3xl px-4 py-10 text-gray-700">
        <h1 className="mb-4 text-3xl font-bold text-gray-950">Privacy Policy</h1>
        <p className="mb-6 text-sm text-muted-foreground">Last updated: May 4, 2026</p>

        <section className="space-y-4">
          <p>
            SoloTutorSuite helps tutors manage bookings, students, homework, files, messages, subscriptions, and calendar events.
            We collect only the account and workspace information needed to provide those features.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-gray-950">Information We Collect</h2>
          <p>
            We may store your name, email address, profile role, tutor/student records, bookings, homework, files, chat messages,
            lesson notes, mock subscription records, and calendar metadata created or connected through SoloTutorSuite.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-gray-950">Google Calendar Data</h2>
          <p>
            If you connect Google Calendar, SoloTutorSuite requests permission to view and manage events on your primary Google
            Calendar so the app can show Google events in your SoloTutorSuite calendar and create Google events when you ask it to.
          </p>
          <p>
            Google access tokens and refresh tokens are never exposed to the browser. Refresh tokens are encrypted before being
            stored server-side. You can disconnect Google Calendar from inside SoloTutorSuite at any time.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-gray-950">How We Use Information</h2>
          <p>
            We use your information to authenticate you, operate the tutoring workspace, sync calendar events when enabled,
            provide student/tutor collaboration tools, and improve reliability and security.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-gray-950">Sharing</h2>
          <p>
            We do not sell personal information. Information is shared only as needed to operate the app, for example between a
            tutor and a student after an accepted invitation, or with service providers such as Supabase, Vercel, Google, and OpenAI
            when those services are used to provide app functionality.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-gray-950">Contact</h2>
          <p>
            For privacy questions, contact the project owner at{' '}
            <a href="mailto:hagen.haeussler@gmx.de" className="font-medium text-primary">
              hagen.haeussler@gmx.de
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  )
}
