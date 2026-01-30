-- TutorLaunch Row Level Security Policies
-- Run this AFTER 001_schema.sql

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_site ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_submissions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- TUTOR ONBOARDING POLICIES
-- ============================================
CREATE POLICY "Users can view own onboarding"
  ON tutor_onboarding FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding"
  ON tutor_onboarding FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding"
  ON tutor_onboarding FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- TUTOR SITE POLICIES
-- ============================================
-- Tutors can manage their own site
CREATE POLICY "Users can view own site"
  ON tutor_site FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own site"
  ON tutor_site FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own site"
  ON tutor_site FOR UPDATE
  USING (auth.uid() = user_id);

-- Public can view published sites (for mini-site feature)
CREATE POLICY "Public can view published sites"
  ON tutor_site FOR SELECT
  USING (published = true);

-- ============================================
-- GROWTH PLANS POLICIES
-- ============================================
CREATE POLICY "Users can view own growth plans"
  ON growth_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own growth plans"
  ON growth_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own growth plans"
  ON growth_plans FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- ASSETS POLICIES
-- ============================================
CREATE POLICY "Users can view own assets"
  ON assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assets"
  ON assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assets"
  ON assets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assets"
  ON assets FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- AVAILABILITY RULES POLICIES
-- ============================================
CREATE POLICY "Users can view own availability"
  ON availability_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own availability"
  ON availability_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own availability"
  ON availability_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own availability"
  ON availability_rules FOR DELETE
  USING (auth.uid() = user_id);

-- Public can view availability for booking pages
-- We'll use a service role for public booking page queries

-- ============================================
-- BOOKINGS POLICIES
-- ============================================
CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert bookings"
  ON bookings FOR INSERT
  WITH CHECK (true);
  -- Anyone can create a booking (prospects)

CREATE POLICY "Users can update own bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- LEADS POLICIES
-- ============================================
CREATE POLICY "Users can view own leads"
  ON leads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leads"
  ON leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leads"
  ON leads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own leads"
  ON leads FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- STUDENTS POLICIES
-- ============================================
CREATE POLICY "Users can view own students"
  ON students FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own students"
  ON students FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own students"
  ON students FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own students"
  ON students FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- STUDENT FILES POLICIES
-- ============================================
CREATE POLICY "Users can view own student files"
  ON student_files FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own student files"
  ON student_files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own student files"
  ON student_files FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- HOMEWORK POLICIES
-- ============================================
CREATE POLICY "Users can view own homework"
  ON homework FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own homework"
  ON homework FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own homework"
  ON homework FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own homework"
  ON homework FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- HOMEWORK SUBMISSIONS POLICIES
-- ============================================
-- Tutors can view submissions for their homework
CREATE POLICY "Users can view submissions for own homework"
  ON homework_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM homework h
      WHERE h.id = homework_submissions.homework_id
      AND h.user_id = auth.uid()
    )
  );

-- Submissions are inserted via service role for student access
CREATE POLICY "Allow insert submissions"
  ON homework_submissions FOR INSERT
  WITH CHECK (true);
