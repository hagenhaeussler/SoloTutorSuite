-- SoloTutorSuite: email-based tutor/student invitations
-- Tutors invite existing student accounts by email; students approve before the
-- tutor workspace becomes visible in their authenticated student dashboard.

ALTER TABLE students
ADD COLUMN IF NOT EXISTS invitation_status TEXT NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'students_invitation_status_check'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT students_invitation_status_check
      CHECK (invitation_status IN ('pending', 'active', 'declined'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_auth_invitation_status
  ON students(auth_user_id, invitation_status);

CREATE INDEX IF NOT EXISTS idx_students_user_email_lower
  ON students(user_id, lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_email_role_lower
  ON profiles(lower(email), role);

UPDATE students
SET invitation_status = 'active',
    accepted_at = COALESCE(accepted_at, created_at)
WHERE invitation_status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'students'
      AND policyname = 'Students can view own tutor invitations'
  ) THEN
    CREATE POLICY "Students can view own tutor invitations"
      ON students FOR SELECT
      USING (auth.uid() = auth_user_id);
  END IF;
END $$;

-- Student-facing RLS policies should only expose accepted tutor connections.
DO $$
BEGIN
  DROP POLICY IF EXISTS "Students can read and send linked chats" ON student_chat_messages;

  CREATE POLICY "Students can read and send linked chats"
    ON student_chat_messages FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM students s
        WHERE s.id = student_chat_messages.student_id
          AND s.auth_user_id = auth.uid()
          AND s.invitation_status = 'active'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM students s
        WHERE s.id = student_chat_messages.student_id
          AND s.auth_user_id = auth.uid()
          AND s.invitation_status = 'active'
      )
    );
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Students can view linked lesson notes" ON lesson_notes;

  CREATE POLICY "Students can view linked lesson notes"
    ON lesson_notes FOR SELECT
    USING (
      visibility_scope <> 'private'
      AND EXISTS (
        SELECT 1
        FROM students s
        WHERE s.id = lesson_notes.student_id
          AND s.auth_user_id = auth.uid()
          AND s.invitation_status = 'active'
      )
    );
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Students can view linked milestones" ON progress_milestones;

  CREATE POLICY "Students can view linked milestones"
    ON progress_milestones FOR SELECT
    USING (
      visible_to_student = true
      AND EXISTS (
        SELECT 1
        FROM students s
        WHERE s.id = progress_milestones.student_id
          AND s.auth_user_id = auth.uid()
          AND s.invitation_status = 'active'
      )
    );
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Students can view linked mock subscriptions" ON mock_subscriptions;

  CREATE POLICY "Students can view linked mock subscriptions"
    ON mock_subscriptions FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM students s
        WHERE s.id = mock_subscriptions.student_id
          AND s.auth_user_id = auth.uid()
          AND s.invitation_status = 'active'
      )
    );
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Students can view linked teacher calendar events" ON calendar_events;

  CREATE POLICY "Students can view linked teacher calendar events"
    ON calendar_events FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM students s
        WHERE s.id = calendar_events.student_id
          AND s.auth_user_id = auth.uid()
          AND s.invitation_status = 'active'
      )
    );
END $$;
