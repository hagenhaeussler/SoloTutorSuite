import Link from 'next/link'
import { AppLogo } from '@/components/app-logo'

export const metadata = {
  title: 'Terms of Service | SoloTutorSuite',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <AppLogo href="/" size="sm" textClassName="text-xl" priority />
          <Link href="/privacy" className="text-sm font-medium text-primary">
            Privacy
          </Link>
        </div>
      </header>

      <article className="container mx-auto max-w-3xl px-4 py-10 text-gray-700">
        <h1 className="mb-4 text-3xl font-bold text-gray-950">Terms of Service</h1>
        <p className="mb-6 text-sm text-muted-foreground">Last updated: May 4, 2026</p>

        <section className="space-y-4">
          <p>
            By using SoloTutorSuite, you agree to use the app responsibly and only for lawful tutoring, scheduling, and student
            management purposes.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-gray-950">Accounts</h2>
          <p>
            You are responsible for keeping your account secure and for the information you add to SoloTutorSuite. Tutors and
            students should only share information they are authorized to share.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-gray-950">Calendar Integration</h2>
          <p>
            Google Calendar integration is optional. If you connect it, SoloTutorSuite may display your Google events and create
            events in your Google Calendar when you choose to sync an app event. You can disconnect calendar access at any time.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-gray-950">Mock Billing Features</h2>
          <p>
            Subscription and billing features currently simulate plan offers, purchases, and cancellations. They do not process
            real payments.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-gray-950">Acceptable Use</h2>
          <p>
            Do not use SoloTutorSuite to upload malicious files, spam students or tutors, impersonate others, or violate another
            person&apos;s privacy.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-gray-950">Contact</h2>
          <p>
            For questions about these terms, contact{' '}
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
