-- SoloTutorSuite: transactional booking emails + reminders

-- Tutor-level reminder preference (default: 10 minutes)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS reminder_minutes_before INT NOT NULL DEFAULT 10;

-- Booking-level email context
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS parent_guardian_email TEXT,
ADD COLUMN IF NOT EXISTS reminder_offset_minutes INT NOT NULL DEFAULT 10;

-- Queue/log for confirmation + reminder emails
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'booking_email_events'
      AND policyname = 'Users can view own booking email events'
  ) THEN
    CREATE POLICY "Users can view own booking email events"
      ON booking_email_events FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'booking_email_events'
      AND policyname = 'Users can update own booking email events'
  ) THEN
    CREATE POLICY "Users can update own booking email events"
      ON booking_email_events FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_booking_email_events_updated_at'
  ) THEN
    CREATE TRIGGER update_booking_email_events_updated_at
      BEFORE UPDATE ON booking_email_events
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
