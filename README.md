# SoloTutorSuite

SoloTutorSuite is a Next.js + Supabase tutoring platform for independent tutors to manage marketing, bookings, CRM, and student workflows.

## What it does

- Tutor onboarding and AI-generated growth plan/assets
- Public tutor profile site and booking flow
- Availability rules and calendar management
- Google Calendar integration for students and tutors
- CRM lead pipeline
- Student hub (files, homework, submissions)
- Student mode with email-based tutor invitations and student approval
- Tutor↔student in-app chat
- Mock financial subscriptions (teacher offers, student buy/cancel)
- Transactional booking emails (confirmation + reminder queue)
- Shareable parent/student progress summaries
- Retention follow-up automations (cron + templates)
- Analytics dashboard (revenue, repeat rate, churn, outstanding)
- Tutor mini-site contact/request form

## Architecture (concise)

- **Frontend:** Next.js App Router + TypeScript + Tailwind + shadcn/ui
- **Backend:** Supabase Postgres + Auth + RLS + Storage
- **Server logic:** Next.js Server Actions in route-local `actions.ts` files
- **AI:** OpenAI API (`lib/openai.ts`)
- **Email:** Resend-style transactional integration (`lib/email.ts`, `lib/booking-emails.ts`)
- **Scheduling:** Vercel cron endpoint at `/api/cron/booking-reminders`

## Feature status matrix

| Area | Status | Notes |
| --- | --- | --- |
| Tutor auth & onboarding | ✅ Implemented | Google OAuth + onboarding flow |
| Public tutor mini-site | ✅ Implemented | `/t/[slug]` |
| Booking flow | ✅ Implemented | `/book/[slug]`, slot generation, booking creation |
| Booking reminders (email) | ✅ Implemented | Queue + cron processor + cancellation/reschedule handling |
| Booking → Student direct linkage (`bookings.student_id`) | ✅ Implemented | Migration + unambiguous email backfill + create-time link attempt |
| Availability calendar | ✅ Implemented | Availability rules + reminder preference management |
| Google Calendar sync | ✅ MVP implemented | OAuth offline access, encrypted refresh tokens, on-demand visible-range fetch, app-event inserts |
| CRM pipeline | ✅ Implemented | Lead stages + conversion to students |
| Students hub base workflows | ✅ Implemented | Add/manage students, files, homework, submissions |
| Student email invitations | ✅ Implemented | Tutors invite existing student accounts by email; students accept before data appears |
| Student profile fields (parent contact, subject/exam, notes, status) | ✅ Implemented | Schema + validations + actions + list visibility |
| Student search/filter in hub | ✅ Implemented | Search + status filtering in Students Hub |
| Parent/student progress sharing | ✅ Implemented | `/progress/[token]` + student app progress tab |
| Mock subscriptions / financials | ✅ Implemented | Teacher-side offers + student-side buy/cancel, no Stripe integration |
| Retention/re-engagement automation | ✅ Implemented | `/api/cron/retention-followups` queue + sender |
| Basic analytics dashboard | ✅ Implemented | `/dashboard/analytics` |
| Tutor-site contact/request form | ✅ Implemented | Public mini-site inquiry capture to CRM |
| Lesson lifecycle states beyond confirmed/cancelled | ⏳ Partial | Confirmed/cancelled exists; richer lesson-state workflow pending |
| Multi-channel reminders (SMS/WhatsApp) | ❌ Not implemented | Current scope is email-only |

## Database migrations

Run in order from `supabase/migrations/`:

1. `001_schema.sql`
2. `002_rls_policies.sql`
3. `003_storage_policies.sql`
4. `004_students_zoom_link.sql`
5. `005_booking_transactional_emails.sql`
6. `006_student_mode_and_chat.sql`
7. `007_student_profiles_and_booking_link.sql`
8. `008_progress_retention_analytics.sql`
9. `009_catchup_missing_columns.sql`
10. `010_mock_subscriptions.sql`
11. `011_google_calendar_integration.sql`
12. `012_student_email_invitations.sql`

The Google Calendar migration is numbered `011` because this repo already has a `009` migration.

## Environment variables

Copy `.env.example` to `.env.local` and fill:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REDIRECT_URI`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`
- `CRON_SECRET` (recommended)
- `NEXT_PUBLIC_APP_URL`

## Local development

- Install dependencies: `npm install`
- Start app: `npm run dev`
- Open `http://localhost:3000`

## Deployment notes

- Configure Supabase OAuth redirect URLs to include `/auth/callback`
- Configure Vercel env vars from `.env.example`
- `vercel.json` contains cron schedule for booking reminders

## Production setup checklist

### Supabase

1. Open your Supabase project and run every pending migration in order from `supabase/migrations/`.
2. For this release, make sure these new migrations have run:
   - `010_mock_subscriptions.sql`
   - `011_google_calendar_integration.sql`
   - `012_student_email_invitations.sql`
   - `013_production_student_invitation_repairs.sql`
3. Confirm the `google_calendar_connections` table has RLS enabled.
4. Confirm users can only select their own Google Calendar connection rows.
5. Confirm `calendar_events`, `bookings`, and `homework` include the Google sync columns.
6. Copy the production Supabase values into Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Google Cloud

1. Create or open a Google Cloud project.
2. Enable the Google Calendar API.
3. Configure the OAuth consent screen.
4. Add the calendar scope:
   - `https://www.googleapis.com/auth/calendar.events`
5. Create an OAuth 2.0 Client ID for a web application.
6. Add authorized redirect URIs:
   - Local: `http://localhost:3000/api/google-calendar/oauth/callback`
   - Production: `https://YOUR_VERCEL_DOMAIN/api/google-calendar/oauth/callback`
   - Custom domain, if used: `https://YOUR_CUSTOM_DOMAIN/api/google-calendar/oauth/callback`
7. Copy the generated client ID and client secret into Vercel:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

### Vercel

1. Add every variable from `.env.example` to the Vercel project.
2. Set `NEXT_PUBLIC_APP_URL` to the production URL, for example `https://YOUR_DOMAIN`.
3. Set `GOOGLE_CALENDAR_REDIRECT_URI` to the exact production callback URL you added in Google Cloud.
4. Generate `GOOGLE_TOKEN_ENCRYPTION_KEY` as a long random secret or 32-byte base64 key.
5. Keep `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_TOKEN_ENCRYPTION_KEY` server-side only.
6. Redeploy after saving environment variables.
   - If Vercel marks `SUPABASE_SERVICE_ROLE_KEY` as "Needs Attention", replace it with the current project service-role key from Supabase and redeploy before testing Google Calendar.
7. Test as both roles:
   - Sign in as a student and connect Google Calendar from `/student/app`.
   - Sign in as a tutor and connect Google Calendar from `/dashboard/calendar`.
   - Create one app calendar event from each side and confirm `google_event_id` is stored.
   - Disconnect and reconnect once to verify the reconnect flow.

### Google Calendar troubleshooting

- `GOOGLE_CALENDAR_REDIRECT_URI` must exactly match `https://YOUR_DOMAIN/api/google-calendar/oauth/callback`.
- Google Cloud OAuth Client > Authorized redirect URIs must include that exact same callback URL.
- If the app says "authorized, but no connection row is visible", check `SUPABASE_SERVICE_ROLE_KEY`, run migration `013`, redeploy, then reconnect Google Calendar.
- The app never returns Google access tokens or refresh tokens to the browser; debug messages only expose safe status/reason codes.
