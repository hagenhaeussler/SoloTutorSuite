-- SoloTutorSuite: production repairs after 012_student_email_invitations.sql
-- Keep this script focused on the pieces 012 does not fully repair in existing
-- production data: exact-email backfill, student-facing access policies not
-- covered by 012, and the Google Calendar OAuth upsert constraint.

CREATE INDEX IF NOT EXISTS idx_students_user_email_btrim_lower
  ON students(user_id, lower(btrim(email)))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_email_role_btrim_lower
  ON profiles(lower(btrim(email)), role);

-- If tutors already created student rows with the exact email of a signed-up
-- student account, link those rows and make them pending acceptance.
WITH exact_student_profiles AS (
  SELECT
    id,
    email,
    COUNT(*) OVER (PARTITION BY lower(btrim(email))) AS profile_count
  FROM profiles
  WHERE role = 'student'
    AND email IS NOT NULL
)
UPDATE students s
SET auth_user_id = p.id,
    invitation_status = CASE
      WHEN s.invitation_status = 'declined' THEN 'declined'
      ELSE 'pending'
    END,
    invited_at = COALESCE(s.invited_at, NOW()),
    declined_at = CASE
      WHEN s.invitation_status = 'declined' THEN s.declined_at
      ELSE NULL
    END
FROM exact_student_profiles p
WHERE s.auth_user_id IS NULL
  AND s.email IS NOT NULL
  AND p.profile_count = 1
  AND lower(btrim(s.email)) = lower(btrim(p.email));

-- Google OAuth callback upserts on (user_id, calendar_id), so production needs
-- a real unique constraint on those columns.
DO $$
BEGIN
  IF to_regclass('public.google_calendar_connections') IS NOT NULL THEN
    WITH ranked_connections AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY user_id, calendar_id
          ORDER BY updated_at DESC NULLS LAST, connected_at DESC NULLS LAST, id DESC
        ) AS row_num
      FROM google_calendar_connections
    )
    DELETE FROM google_calendar_connections c
    USING ranked_connections r
    WHERE c.id = r.id
      AND r.row_num > 1;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.google_calendar_connections'::regclass
        AND contype = 'u'
        AND conkey = ARRAY[
          (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.google_calendar_connections'::regclass AND attname = 'user_id'),
          (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.google_calendar_connections'::regclass AND attname = 'calendar_id')
        ]::int2[]
    ) THEN
      ALTER TABLE google_calendar_connections
        ADD CONSTRAINT google_calendar_connections_user_calendar_unique
        UNIQUE (user_id, calendar_id);
    END IF;
  END IF;
END $$;

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Students can view linked student files" ON student_files;

  CREATE POLICY "Students can view linked student files"
    ON student_files FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM students s
        WHERE s.id = student_files.student_id
          AND s.auth_user_id = auth.uid()
          AND s.invitation_status = 'active'
      )
    );
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Students can view linked homework" ON homework;

  CREATE POLICY "Students can view linked homework"
    ON homework FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM students s
        WHERE s.id = homework.student_id
          AND s.auth_user_id = auth.uid()
          AND s.invitation_status = 'active'
      )
    );
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Students can view own homework submissions" ON homework_submissions;

  CREATE POLICY "Students can view own homework submissions"
    ON homework_submissions FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM students s
        WHERE s.id = homework_submissions.student_id
          AND s.auth_user_id = auth.uid()
          AND s.invitation_status = 'active'
      )
    );
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Students can create own homework submissions" ON homework_submissions;

  CREATE POLICY "Students can create own homework submissions"
    ON homework_submissions FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM students s
        WHERE s.id = homework_submissions.student_id
          AND s.auth_user_id = auth.uid()
          AND s.invitation_status = 'active'
      )
    );
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Students can view linked bookings" ON bookings;

  CREATE POLICY "Students can view linked bookings"
    ON bookings FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM students s
        WHERE s.user_id = bookings.user_id
          AND s.auth_user_id = auth.uid()
          AND s.invitation_status = 'active'
          AND (
            s.id = bookings.student_id
            OR lower(btrim(s.email)) = lower(btrim(bookings.prospect_email))
          )
      )
    );
END $$;
