-- TutorLaunch Storage Policies
-- Run this AFTER creating the 'student-files' bucket in Storage

-- First, create the bucket if it doesn't exist (run in SQL editor)
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-files', 'student-files', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Policy: Tutors can upload files to their own folder
CREATE POLICY "Tutors can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'student-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Tutors can view files in their own folder
CREATE POLICY "Tutors can view own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'student-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Tutors can delete files in their own folder
CREATE POLICY "Tutors can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'student-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Tutors can update files in their own folder
CREATE POLICY "Tutors can update own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'student-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Note: For student uploads via access token, we use the service role
-- which bypasses RLS. The application validates the access token.
