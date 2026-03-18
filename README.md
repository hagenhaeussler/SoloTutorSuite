# Solo Tutor Suite

Solo Tutor Suite is a Next.js + Supabase tutoring platform for independent tutors to manage marketing, bookings, CRM, and student workflows.

## What it does

- Tutor onboarding and AI-generated growth plan/assets
- Public tutor profile site and booking flow
- Availability rules and calendar management
- CRM lead pipeline
- Student hub (files, homework, submissions)
- Student mode with tutor linking via Student ID
- Tutor↔student in-app chat
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
| CRM pipeline | ✅ Implemented | Lead stages + conversion to students |
| Students hub base workflows | ✅ Implemented | Add/manage students, files, homework, submissions |
| Student profile fields (parent contact, subject/exam, notes, status) | ✅ Implemented | Schema + validations + actions + list visibility |
| Student search/filter in hub | ✅ Implemented | Search + status filtering in Students Hub |
| Parent/student progress sharing | ✅ Implemented | `/progress/[token]` + student app progress tab |
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

## Environment variables

Copy `.env.example` to `.env.local` and fill:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM_ADDRESS`
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
