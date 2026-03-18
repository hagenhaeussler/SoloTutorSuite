-- Solo Tutor Suite: student mode + tutor/student chat

-- Role + shareable student ID on profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'tutor' CHECK (role IN ('tutor', 'student')),
ADD COLUMN IF NOT EXISTS student_invite_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_student_invite_code_unique
  ON profiles(student_invite_code)
  WHERE student_invite_code IS NOT NULL;

-- Link tutor-owned student records to authenticated student accounts
ALTER TABLE students
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_auth_user_id ON students(auth_user_id);

-- Tutor <-> Student chat messages
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'student_chat_messages'
      AND policyname = 'Tutors can manage own student chats'
  ) THEN
    CREATE POLICY "Tutors can manage own student chats"
      ON student_chat_messages FOR ALL
      USING (auth.uid() = tutor_user_id)
      WITH CHECK (auth.uid() = tutor_user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'student_chat_messages'
      AND policyname = 'Students can read and send linked chats'
  ) THEN
    CREATE POLICY "Students can read and send linked chats"
      ON student_chat_messages FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM students s
          WHERE s.id = student_chat_messages.student_id
            AND s.auth_user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM students s
          WHERE s.id = student_chat_messages.student_id
            AND s.auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;
