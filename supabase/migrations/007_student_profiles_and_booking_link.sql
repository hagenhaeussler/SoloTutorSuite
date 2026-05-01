-- SoloTutorSuite: richer student profiles + direct booking-to-student linkage

-- 1) Extend students profile fields
ALTER TABLE students
ADD COLUMN IF NOT EXISTS parent_contact TEXT,
ADD COLUMN IF NOT EXISTS subject_exam_type TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'students_status_check'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT students_status_check
      CHECK (status IN ('active', 'inactive', 'completed', 'lead'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_user_status
  ON students(user_id, status);

-- 2) Link bookings directly to students
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_user_student
  ON bookings(user_id, student_id);

-- 3) Backfill bookings.student_id when we have an unambiguous email match
WITH student_email_map AS (
  SELECT
    s.user_id,
    lower(s.email) AS email_lower,
    min(s.id) AS student_id,
    count(*) AS email_count
  FROM students s
  WHERE s.email IS NOT NULL
  GROUP BY s.user_id, lower(s.email)
),
unambiguous_map AS (
  SELECT user_id, email_lower, student_id
  FROM student_email_map
  WHERE email_count = 1
)
UPDATE bookings b
SET student_id = m.student_id
FROM unambiguous_map m
WHERE b.student_id IS NULL
  AND lower(b.prospect_email) = m.email_lower
  AND b.user_id = m.user_id;
