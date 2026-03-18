-- Solo Tutor Suite: progress sharing + retention automations + analytics foundations

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TUTOR SITE ENHANCEMENTS (branding/contact)
-- ============================================
ALTER TABLE tutor_site
ADD COLUMN IF NOT EXISTS accent_color TEXT,
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- ============================================
-- LESSON NOTES
-- ============================================
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

-- ============================================
-- PROGRESS MILESTONES
-- ============================================
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
  ON progress_milestones(user_id, student_id, status);

-- ============================================
-- SHARE LINKS FOR PROGRESS SUMMARY
-- ============================================
CREATE TABLE IF NOT EXISTS progress_share_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progress_share_links_student_active
  ON progress_share_links(student_id, revoked_at, expires_at);

-- ============================================
-- RETENTION EMAIL EVENTS QUEUE
-- ============================================
CREATE TABLE IF NOT EXISTS retention_email_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  template_kind TEXT NOT NULL CHECK (template_kind IN ('book_next_session', 'course_end_followup', 'reengagement')),
  inactivity_days INT,
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

-- ============================================
-- TUTOR INQUIRIES (public mini-site contact form)
-- ============================================
CREATE TABLE IF NOT EXISTS tutor_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tutor_site_id UUID REFERENCES tutor_site(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  desired_start_date DATE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tutor_inquiries_user_status
  ON tutor_inquiries(user_id, status, created_at DESC);

-- ============================================
-- INVOICES (analytics: outstanding payments)
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'void')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_status_created
  ON invoices(user_id, status, created_at DESC);

-- ============================================
-- TRIGGERS
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_lesson_notes_updated_at'
  ) THEN
    CREATE TRIGGER update_lesson_notes_updated_at
      BEFORE UPDATE ON lesson_notes
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_progress_milestones_updated_at'
  ) THEN
    CREATE TRIGGER update_progress_milestones_updated_at
      BEFORE UPDATE ON progress_milestones
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_retention_email_events_updated_at'
  ) THEN
    CREATE TRIGGER update_retention_email_events_updated_at
      BEFORE UPDATE ON retention_email_events
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_tutor_inquiries_updated_at'
  ) THEN
    CREATE TRIGGER update_tutor_inquiries_updated_at
      BEFORE UPDATE ON tutor_inquiries
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_invoices_updated_at'
  ) THEN
    CREATE TRIGGER update_invoices_updated_at
      BEFORE UPDATE ON invoices
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- RLS
-- ============================================
ALTER TABLE lesson_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lesson_notes' AND policyname = 'Users can manage own lesson notes'
  ) THEN
    CREATE POLICY "Users can manage own lesson notes"
      ON lesson_notes FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'lesson_notes' AND policyname = 'Students can view linked lesson notes'
  ) THEN
    CREATE POLICY "Students can view linked lesson notes"
      ON lesson_notes FOR SELECT
      USING (
        visibility_scope <> 'private'
        AND EXISTS (
          SELECT 1 FROM students s
          WHERE s.id = lesson_notes.student_id
            AND s.auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'progress_milestones' AND policyname = 'Users can manage own milestones'
  ) THEN
    CREATE POLICY "Users can manage own milestones"
      ON progress_milestones FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'progress_milestones' AND policyname = 'Students can view linked milestones'
  ) THEN
    CREATE POLICY "Students can view linked milestones"
      ON progress_milestones FOR SELECT
      USING (
        visible_to_student = true
        AND EXISTS (
          SELECT 1 FROM students s
          WHERE s.id = progress_milestones.student_id
            AND s.auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'progress_share_links' AND policyname = 'Users can manage own share links'
  ) THEN
    CREATE POLICY "Users can manage own share links"
      ON progress_share_links FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'retention_email_events' AND policyname = 'Users can view own retention events'
  ) THEN
    CREATE POLICY "Users can view own retention events"
      ON retention_email_events FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'retention_email_events' AND policyname = 'Users can update own retention events'
  ) THEN
    CREATE POLICY "Users can update own retention events"
      ON retention_email_events FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tutor_inquiries' AND policyname = 'Users can view own inquiries'
  ) THEN
    CREATE POLICY "Users can view own inquiries"
      ON tutor_inquiries FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tutor_inquiries' AND policyname = 'Public can create tutor inquiries'
  ) THEN
    CREATE POLICY "Public can create tutor inquiries"
      ON tutor_inquiries FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'Users can manage own invoices'
  ) THEN
    CREATE POLICY "Users can manage own invoices"
      ON invoices FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
