-- TutorLaunch Database Schema
-- Run this first in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TUTOR ONBOARDING TABLE
-- ============================================
CREATE TABLE tutor_onboarding (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subjects JSONB DEFAULT '[]'::jsonb,
  -- e.g., ["Math", "Physics", "SAT Prep"]
  target JSONB DEFAULT '{}'::jsonb,
  -- e.g., { "age_range": "13-18", "level": "High School", "exams": ["SAT", "AP"] }
  location TEXT,
  timezone TEXT,
  pricing JSONB DEFAULT '{}'::jsonb,
  -- e.g., { "hourly_rate": 75, "packages": [{ "name": "10 Sessions", "price": 650, "sessions": 10 }] }
  high_paying_definition JSONB DEFAULT '{}'::jsonb,
  -- e.g., { "min_budget": 500, "goals": ["Test prep"], "client_type": "parent" }
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================
-- TUTOR MINI-SITE TABLE
-- ============================================
CREATE TABLE tutor_site (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  headline TEXT,
  bio TEXT,
  packages JSONB DEFAULT '[]'::jsonb,
  -- e.g., [{ "name": "Single Session", "price": 75, "description": "1-hour session" }]
  testimonials JSONB DEFAULT '[]'::jsonb,
  booking_link TEXT,
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================
-- AI GROWTH PLANS TABLE
-- ============================================
CREATE TABLE growth_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_json JSONB NOT NULL,
  -- Contains: positioning, channels, offers, funnel_steps, weekly_checklist, kpis
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AI ASSETS TABLE
-- ============================================
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  -- Types: 'landing_page', 'ad_angles', 'linkedin_outreach', 'email_sequence', 'dm_sequence'
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster asset lookups by type
CREATE INDEX idx_assets_user_type ON assets(user_id, asset_type);

-- ============================================
-- AVAILABILITY RULES TABLE
-- ============================================
CREATE TABLE availability_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  -- 0 = Sunday, 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  session_length INT DEFAULT 60,
  -- in minutes
  buffer_time INT DEFAULT 0,
  -- in minutes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, day_of_week, start_time)
);

-- ============================================
-- BOOKINGS TABLE
-- ============================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts TIMESTAMPTZ NOT NULL,
  prospect_name TEXT NOT NULL,
  prospect_email TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'confirmed',
  -- confirmed, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster booking lookups
CREATE INDEX idx_bookings_user_time ON bookings(user_id, start_ts);

-- ============================================
-- CRM LEADS TABLE
-- ============================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT,
  -- e.g., 'booking', 'manual', 'linkedin', 'referral'
  stage TEXT DEFAULT 'new',
  -- new, contacted, booked, won, lost
  notes TEXT,
  next_follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lead lookups
CREATE INDEX idx_leads_user_stage ON leads(user_id, stage);

-- ============================================
-- STUDENTS TABLE
-- ============================================
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STUDENT FILES TABLE
-- ============================================
CREATE TABLE student_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INT,
  mime_type TEXT,
  uploaded_by TEXT DEFAULT 'tutor',
  -- 'tutor' or 'student'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- HOMEWORK TABLE
-- ============================================
CREATE TABLE homework (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- HOMEWORK SUBMISSIONS TABLE
-- ============================================
CREATE TABLE homework_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  homework_id UUID NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tutor_onboarding_updated_at
  BEFORE UPDATE ON tutor_onboarding
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tutor_site_updated_at
  BEFORE UPDATE ON tutor_site
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
