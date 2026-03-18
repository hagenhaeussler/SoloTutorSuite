-- Solo Tutor Suite: student video call links
-- Adds a per-student Zoom meeting link for tutor/student portal join buttons.

ALTER TABLE students
ADD COLUMN IF NOT EXISTS zoom_meeting_link TEXT;
