-- SoloTutorSuite: Google Calendar integration
-- OAuth connection storage + app calendar events + Google sync metadata.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email TEXT,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  scope TEXT,
  connection_status TEXT NOT NULL DEFAULT 'connected' CHECK (connection_status IN ('connected', 'needs_reconnect', 'disconnected')),
  sync_token TEXT,
  watch_channel_id TEXT,
  watch_resource_id TEXT,
  watch_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, calendar_id)
);

CREATE INDEX IF NOT EXISTS idx_google_calendar_connections_user_status
  ON google_calendar_connections(user_id, connection_status);

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts TIMESTAMPTZ NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'calendar_event' CHECK (event_type IN ('calendar_event', 'lesson_event', 'student_event', 'teacher_event')),
  created_by_role TEXT NOT NULL CHECK (created_by_role IN ('student', 'tutor')),
  google_calendar_id TEXT,
  google_event_id TEXT,
  google_event_etag TEXT,
  google_html_link TEXT,
  google_sync_status TEXT NOT NULL DEFAULT 'not_synced' CHECK (google_sync_status IN ('not_synced', 'synced', 'failed')),
  google_last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_ts > start_ts)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_start
  ON calendar_events(user_id, start_ts);

CREATE INDEX IF NOT EXISTS idx_calendar_events_student_start
  ON calendar_events(student_id, start_ts)
  WHERE student_id IS NOT NULL;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
ADD COLUMN IF NOT EXISTS google_event_id TEXT,
ADD COLUMN IF NOT EXISTS google_event_etag TEXT,
ADD COLUMN IF NOT EXISTS google_html_link TEXT,
ADD COLUMN IF NOT EXISTS google_sync_status TEXT DEFAULT 'not_synced' CHECK (google_sync_status IN ('not_synced', 'synced', 'failed')),
ADD COLUMN IF NOT EXISTS google_last_synced_at TIMESTAMPTZ;

ALTER TABLE homework
ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
ADD COLUMN IF NOT EXISTS google_event_id TEXT,
ADD COLUMN IF NOT EXISTS google_event_etag TEXT,
ADD COLUMN IF NOT EXISTS google_html_link TEXT,
ADD COLUMN IF NOT EXISTS google_sync_status TEXT DEFAULT 'not_synced' CHECK (google_sync_status IN ('not_synced', 'synced', 'failed')),
ADD COLUMN IF NOT EXISTS google_last_synced_at TIMESTAMPTZ;

ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_google_calendar_connections_updated_at'
  ) THEN
    CREATE TRIGGER update_google_calendar_connections_updated_at
      BEFORE UPDATE ON google_calendar_connections
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_calendar_events_updated_at'
  ) THEN
    CREATE TRIGGER update_calendar_events_updated_at
      BEFORE UPDATE ON calendar_events
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'google_calendar_connections'
      AND policyname = 'Users can view own Google Calendar connection'
  ) THEN
    CREATE POLICY "Users can view own Google Calendar connection"
      ON google_calendar_connections FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'calendar_events'
      AND policyname = 'Users can manage own calendar events'
  ) THEN
    CREATE POLICY "Users can manage own calendar events"
      ON calendar_events FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'calendar_events'
      AND policyname = 'Students can view linked teacher calendar events'
  ) THEN
    CREATE POLICY "Students can view linked teacher calendar events"
      ON calendar_events FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM students s
          WHERE s.id = calendar_events.student_id
            AND s.auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;
