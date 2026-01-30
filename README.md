# TutorLaunch - Professional Tutoring Platform

A complete SaaS platform that helps self-employed tutors look professional and grow their business with AI-powered marketing tools.

## Features

- 🔐 **Google OAuth Authentication** via Supabase
- 📝 **Onboarding Flow** - Collect tutor details, subjects, pricing
- 🤖 **AI Growth Plan** - Generate personalized marketing strategies
- ✍️ **AI Marketing Assets** - Landing page copy, ads, outreach scripts
- 🌐 **Public Mini-Site** - Professional tutor profile at `/t/{slug}`
- 📅 **Calendar & Booking** - Set availability, accept bookings
- 👥 **CRM Pipeline** - Track leads through stages
- 📚 **Student Hub** - Files, homework, submissions

## Tech Stack

- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres, Auth, Storage)
- OpenAI API
- Zod validation

---

## 🚀 Deploy Today (Step-by-Step)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings > API

### 2. Run Database Migrations

In Supabase SQL Editor, run the files in this order:

1. `supabase/migrations/001_schema.sql` - Creates all tables
2. `supabase/migrations/002_rls_policies.sql` - Sets up Row Level Security

### 3. Set Up Storage Buckets

In Supabase Storage:

1. Create a bucket called `student-files` (private)
2. Run `supabase/migrations/003_storage_policies.sql` in SQL Editor

### 4. Enable Google OAuth

1. Go to Supabase > Authentication > Providers > Google
2. Enable Google provider
3. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Create OAuth 2.0 Client ID (Web application)
   - Authorized redirect URI: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
4. Copy Client ID and Secret to Supabase Google provider settings

### 5. Configure Auth Redirect URLs

In Supabase > Authentication > URL Configuration:

- Site URL: `https://your-vercel-app.vercel.app`
- Redirect URLs: 
  - `https://your-vercel-app.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback` (for local dev)

### 6. Deploy to Vercel

1. Push this repo to GitHub
2. Import to [Vercel](https://vercel.com)
3. Add Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-api-key
NEXT_PUBLIC_APP_URL=https://your-vercel-app.vercel.app
```

4. Deploy!

---

## 🛠 Local Development

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase project (for database)

### Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Fill in your environment variables in .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `OPENAI_API_KEY` | OpenAI API key for AI features |
| `NEXT_PUBLIC_APP_URL` | Your app's public URL |

---

## Project Structure

```
├── app/
│   ├── (auth)/           # Auth pages (login)
│   ├── (dashboard)/      # Protected dashboard pages
│   ├── (public)/         # Public pages (mini-site, booking)
│   ├── api/              # API routes
│   └── auth/callback/    # OAuth callback handler
├── components/           # React components
├── lib/                  # Utilities, Supabase client, types
├── supabase/
│   └── migrations/       # SQL migration files
└── public/               # Static assets
```

---

## Testing the App

1. ✅ Sign in with Google
2. ✅ Complete onboarding form
3. ✅ Generate AI growth plan
4. ✅ Generate marketing assets
5. ✅ Publish mini-site, visit `/t/{your-slug}`
6. ✅ Set availability, book via `/book/{your-slug}`
7. ✅ Check booking appears in CRM
8. ✅ Create student, share access link
9. ✅ Upload files, create homework, submit as student

---

## License

MIT

# TutorLaunch - Professional Tutoring Platform

A complete SaaS platform that helps self-employed tutors look professional and grow their business with AI-powered marketing tools.

## Features

- 🔐 **Google OAuth Authentication** via Supabase
- 📝 **Onboarding Flow** - Collect tutor details, subjects, pricing
- 🤖 **AI Growth Plan** - Generate personalized marketing strategies
- ✍️ **AI Marketing Assets** - Landing page copy, ads, outreach scripts
- 🌐 **Public Mini-Site** - Professional tutor profile at `/t/{slug}`
- 📅 **Calendar & Booking** - Set availability, accept bookings
- 👥 **CRM Pipeline** - Track leads through stages
- 📚 **Student Hub** - Files, homework, submissions

## Tech Stack

- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres, Auth, Storage)
- OpenAI API
- Zod validation

---

## 🚀 Deploy Today (Step-by-Step)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings > API

### 2. Run Database Migrations

In Supabase SQL Editor, run the files in this order:

1. `supabase/migrations/001_schema.sql` - Creates all tables
2. `supabase/migrations/002_rls_policies.sql` - Sets up Row Level Security

### 3. Set Up Storage Buckets

In Supabase Storage:

1. Create a bucket called `student-files` (private)
2. Run `supabase/migrations/003_storage_policies.sql` in SQL Editor

### 4. Enable Google OAuth

1. Go to Supabase > Authentication > Providers > Google
2. Enable Google provider
3. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Create OAuth 2.0 Client ID (Web application)
   - Authorized redirect URI: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
4. Copy Client ID and Secret to Supabase Google provider settings

### 5. Configure Auth Redirect URLs

In Supabase > Authentication > URL Configuration:

- Site URL: `https://your-vercel-app.vercel.app`
- Redirect URLs: 
  - `https://your-vercel-app.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback` (for local dev)

### 6. Deploy to Vercel

1. Push this repo to GitHub
2. Import to [Vercel](https://vercel.com)
3. Add Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-api-key
NEXT_PUBLIC_APP_URL=https://your-vercel-app.vercel.app
```

4. Deploy!

---

## 🛠 Local Development

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase project (for database)

### Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Fill in your environment variables in .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `OPENAI_API_KEY` | OpenAI API key for AI features |
| `NEXT_PUBLIC_APP_URL` | Your app's public URL |

---

## Project Structure

```
├── app/
│   ├── (auth)/           # Auth pages (login)
│   ├── (dashboard)/      # Protected dashboard pages
│   ├── (public)/         # Public pages (mini-site, booking)
│   ├── api/              # API routes
│   └── auth/callback/    # OAuth callback handler
├── components/           # React components
├── lib/                  # Utilities, Supabase client, types
├── supabase/
│   └── migrations/       # SQL migration files
└── public/               # Static assets
```

---

## Testing the App

1. ✅ Sign in with Google
2. ✅ Complete onboarding form
3. ✅ Generate AI growth plan
4. ✅ Generate marketing assets
5. ✅ Publish mini-site, visit `/t/{your-slug}`
6. ✅ Set availability, book via `/book/{your-slug}`
7. ✅ Check booking appears in CRM
8. ✅ Create student, share access link
9. ✅ Upload files, create homework, submit as student

---

## License

MIT
