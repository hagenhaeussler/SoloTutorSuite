-- SoloTutorSuite: catch-up migration
-- Adds every column that earlier migrations defined but that may not have
-- been applied to the live database yet.  All statements are idempotent
-- (IF NOT EXISTS / DO $$ checks) so running this file twice is safe.

-- ============================================
-- 004: per-student Zoom / video-call link
-- ============================================
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS zoom_meeting_link TEXT;

-- ============================================
-- 005: tutor reminder preference + richer booking fields
-- ============================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS reminder_minutes_before INT NOT NULL DEFAULT 10;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS parent_guardian_email TEXT,
  ADD COLUMN IF NOT EXISTS reminder_offset_minutes INT NOT NULL DEFAULT 10;

-- booking_email_events table (005)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS booking_email_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('student', 'parent', 'tutor')),
  email_kind TEXT NOT NULL CHECK (email_kind IN ('confirmation', 'reminder')),
  reminder_offset_minutes INT,
  send_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts INT NOT NULL DEFAULT 0,
  error_message TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_email_events_status_send_at
  ON booking_email_events(status, send_at);

CREATE INDEX IF NOT EXISTS idx_booking_email_events_booking_id
  ON booking_email_events(booking_id);

ALTER TABLE booking_email_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'booking_email_events'
      AND policyname = 'Users can view own booking email events'
  ) THEN
    CREATE POLICY "Users can view own booking email events"
      ON booking_email_events FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'booking_email_events'
      AND policyname = 'Users can update own booking email events'
  ) THEN
    CREATE POLICY "Users can update own booking email events"
      ON booking_email_events FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================
-- 006: student auth link + role on profiles + chat
-- ============================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'tutor' CHECK (role IN ('tutor', 'student')),
  ADD COLUMN IF NOT EXISTS student_invite_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_student_invite_code_unique
  ON profiles(student_invite_code)
  WHERE student_invite_code IS NOT NULL;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_auth_user_id ON students(auth_user_id);

CREATE TABLE IF NOT EXISTS student_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('tutor', 'student')),
  sender_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_chat_messages_student_created
  ON student_chat_messages(student_id, created_at);

ALTER TABLE student_chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_chat_messages'
      AND policyname = 'Tutors can view own chat messages'
  ) THEN
    CREATE POLICY "Tutors can view own chat messages"
      ON student_chat_messages FOR SELECT USING (auth.uid() = tutor_user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_chat_messages'
      AND policyname = 'Tutors can insert own chat messages'
  ) THEN
    CREATE POLICY "Tutors can insert own chat messages"
      ON student_chat_messages FOR INSERT WITH CHECK (auth.uid() = tutor_user_id);
  END IF;
END $$;

-- ============================================
-- 007: richer student profiles + booking-to-student link
-- ============================================
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS parent_contact TEXT,
  ADD COLUMN IF NOT EXISTS subject_exam_type TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_status_check'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT students_status_check
      CHECK (status IN ('active', 'inactive', 'completed', 'lead'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_user_status ON students(user_id, status);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_user_student ON bookings(user_id, student_id);

-- ============================================
-- 008: tutor site branding + progress/retention tables
-- ============================================
ALTER TABLE tutor_site
  ADD COLUMN IF NOT EXISTS accent_color TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;

CREATE TABLE IF NOT EXISTS lesson_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  lesson_date DATE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  homework_assigned TEXT,
  visibility_scope TEXT NOT NULL DEFAULT 'student' CHECK (visibility_scope IN ('private', 'student', 'shared')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_notes_user_student_date
  ON lesson_notes(user_id, student_id, lesson_date DESC);

CREATE TABLE IF NOT EXISTS progress_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'achieved')),
  target_date DATE,
  achieved_at TIMESTAMPTZ,
  visible_to_student BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progress_milestones_user_student
  ON progress_milestones(user_id, student_id);

ALTER TABLE progress_milestones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'progress_milestones'
      AND policyname = 'Users can view own milestones'
  ) THEN
    CREATE POLICY "Users can view own milestones"
      ON progress_milestones FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'progress_milestones'
      AND policyname = 'Users can insert own milestones'
  ) THEN
    CREATE POLICY "Users can insert own milestones"
      ON progress_milestones FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'progress_milestones'
      AND policyname = 'Users can update own milestones'
  ) THEN
    CREATE POLICY "Users can update own milestones"
      ON progress_milestones FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'progress_milestones'
      AND policyname = 'Users can delete own milestones'
  ) THEN
    CREATE POLICY "Users can delete own milestones"
      ON progress_milestones FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS progress_share_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progress_share_links_token ON progress_share_links(token);
CREATE INDEX IF NOT EXISTS idx_progress_share_links_user_student
  ON progress_share_links(user_id, student_id);

ALTER TABLE progress_share_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'progress_share_links'
      AND policyname = 'Users can view own share links'
  ) THEN
    CREATE POLICY "Users can view own share links"
      ON progress_share_links FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'progress_share_links'
      AND policyname = 'Users can insert own share links'
  ) THEN
    CREATE POLICY "Users can insert own share links"
      ON progress_share_links FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'progress_share_links'
      AND policyname = 'Users can delete own share links'
  ) THEN
    CREATE POLICY "Users can delete own share links"
      ON progress_share_links FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Also allow unauthenticated read of share-link by token (for public progress page)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'progress_share_links'
      AND policyname = 'Public can read share link by token'
  ) THEN
    CREATE POLICY "Public can read share link by token"
      ON progress_share_links FOR SELECT USING (true);
  END IF;
END $$;

-- Retention email events table
CREATE TABLE IF NOT EXISTS retention_email_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  email_kind TEXT NOT NULL,
  send_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts INT NOT NULL DEFAULT 0,
  error_message TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retention_email_events_status_send_at
  ON retention_email_events(status, send_at);

ALTER TABLE retention_email_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'retention_email_events'
      AND policyname = 'Users can view own retention email events'
  ) THEN
    CREATE POLICY "Users can view own retention email events"
      ON retention_email_events FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- lesson_notes RLS
ALTER TABLE lesson_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lesson_notes'
      AND policyname = 'Users can view own lesson notes'
  ) THEN
    CREATE POLICY "Users can view own lesson notes"
      ON lesson_notes FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lesson_notes'
      AND policyname = 'Users can insert own lesson notes'
  ) THEN
    CREATE POLICY "Users can insert own lesson notes"
      ON lesson_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lesson_notes'
      AND policyname = 'Users can update own lesson notes'
  ) THEN
    CREATE POLICY "Users can update own lesson notes"
      ON lesson_notes FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lesson_notes'
      AND policyname = 'Users can delete own lesson notes'
  ) THEN
    CREATE POLICY "Users can delete own lesson notes"
      ON lesson_notes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
