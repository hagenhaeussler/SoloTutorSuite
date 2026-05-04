-- SoloTutorSuite: mock student subscriptions
-- Lightweight subscription state for demos/prototypes. No payment processor is involved.

CREATE TABLE IF NOT EXISTS mock_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  description TEXT,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_interval TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('once', 'weekly', 'monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('offered', 'active', 'cancelled')),
  started_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mock_subscriptions_user_student_status
  ON mock_subscriptions(user_id, student_id, status);

ALTER TABLE mock_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_mock_subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER update_mock_subscriptions_updated_at
      BEFORE UPDATE ON mock_subscriptions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mock_subscriptions'
      AND policyname = 'Tutors can manage own mock subscriptions'
  ) THEN
    CREATE POLICY "Tutors can manage own mock subscriptions"
      ON mock_subscriptions FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mock_subscriptions'
      AND policyname = 'Students can view linked mock subscriptions'
  ) THEN
    CREATE POLICY "Students can view linked mock subscriptions"
      ON mock_subscriptions FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM students s
          WHERE s.id = mock_subscriptions.student_id
            AND s.auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;
