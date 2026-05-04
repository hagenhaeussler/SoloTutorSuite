export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Profile {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  role: 'tutor' | 'student'
  student_invite_code: string | null
  timezone: string
  reminder_minutes_before: number
  created_at: string
  updated_at: string
}

export interface TutorOnboarding {
  id: string
  user_id: string
  subjects: string[]
  target: {
    age_range?: string
    level?: string
    exams?: string[]
  }
  location: string | null
  timezone: string | null
  pricing: {
    hourly_rate?: number
    packages?: Array<{
      name: string
      price: number
      sessions: number
    }>
  }
  high_paying_definition: {
    min_budget?: number
    goals?: string[]
    client_type?: string
  }
  completed: boolean
  created_at: string
  updated_at: string
}

export interface TutorSite {
  id: string
  user_id: string
  slug: string
  headline: string | null
  bio: string | null
  accent_color: string | null
  contact_email: string | null
  contact_phone: string | null
  packages: Array<{
    name: string
    price: number
    description?: string
  }>
  testimonials: Array<{
    name: string
    text: string
  }>
  booking_link: string | null
  published: boolean
  created_at: string
  updated_at: string
}

export interface GrowthPlan {
  id: string
  user_id: string
  plan_json: {
    positioning: string
    channels: string[]
    offers: Array<{
      name: string
      description: string
    }>
    funnel_steps: string[]
    weekly_checklist: string[]
    kpis: Array<{
      metric: string
      target: string
    }>
  }
  created_at: string
}

export interface Asset {
  id: string
  user_id: string
  asset_type: 'landing_page' | 'ad_angles' | 'linkedin_outreach' | 'email_sequence' | 'dm_sequence'
  content: Json
  created_at: string
}

export interface AvailabilityRule {
  id: string
  user_id: string
  day_of_week: number
  start_time: string
  end_time: string
  session_length: number
  buffer_time: number
  created_at: string
}

export interface Booking {
  id: string
  user_id: string
  student_id: string | null
  start_ts: string
  end_ts: string
  prospect_name: string
  prospect_email: string
  parent_guardian_email: string | null
  reason: string | null
  reminder_offset_minutes: number
  status: 'confirmed' | 'cancelled'
  google_calendar_id: string | null
  google_event_id: string | null
  google_event_etag: string | null
  google_html_link: string | null
  google_sync_status: 'not_synced' | 'synced' | 'failed'
  google_last_synced_at: string | null
  created_at: string
}

export interface BookingEmailEvent {
  id: string
  booking_id: string
  user_id: string
  recipient_email: string
  recipient_role: 'student' | 'parent' | 'tutor'
  email_kind: 'confirmation' | 'reminder'
  reminder_offset_minutes: number | null
  send_at: string
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
  attempts: number
  error_message: string | null
  idempotency_key: string
  sent_at: string | null
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  source: string | null
  stage: 'new' | 'contacted' | 'booked' | 'won' | 'lost'
  notes: string | null
  next_follow_up_date: string | null
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  user_id: string
  auth_user_id: string | null
  name: string
  email: string | null
  parent_contact: string | null
  subject_exam_type: string | null
  notes: string | null
  status: 'active' | 'inactive' | 'completed' | 'lead'
  invitation_status: 'pending' | 'active' | 'declined'
  invited_at: string | null
  accepted_at: string | null
  declined_at: string | null
  zoom_meeting_link: string | null
  access_token: string
  created_at: string
}

export interface StudentChatMessage {
  id: string
  tutor_user_id: string
  student_id: string
  sender_type: 'tutor' | 'student'
  sender_user_id: string | null
  message: string
  read_at: string | null
  created_at: string
}

export interface StudentFile {
  id: string
  user_id: string
  student_id: string
  storage_path: string
  filename: string
  file_size: number | null
  mime_type: string | null
  uploaded_by: 'tutor' | 'student'
  created_at: string
}

export interface Homework {
  id: string
  user_id: string
  student_id: string
  title: string
  instructions: string | null
  due_date: string | null
  google_calendar_id: string | null
  google_event_id: string | null
  google_event_etag: string | null
  google_html_link: string | null
  google_sync_status: 'not_synced' | 'synced' | 'failed'
  google_last_synced_at: string | null
  created_at: string
}

export interface HomeworkSubmission {
  id: string
  homework_id: string
  student_id: string
  storage_path: string
  filename: string
  submitted_at: string
}

export interface LessonNote {
  id: string
  user_id: string
  student_id: string
  booking_id: string | null
  lesson_date: string
  title: string
  summary: string | null
  homework_assigned: string | null
  visibility_scope: 'private' | 'student' | 'shared'
  created_at: string
  updated_at: string
}

export interface ProgressMilestone {
  id: string
  user_id: string
  student_id: string
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'achieved'
  target_date: string | null
  achieved_at: string | null
  visible_to_student: boolean
  created_at: string
  updated_at: string
}

export interface ProgressShareLink {
  id: string
  user_id: string
  student_id: string
  token: string
  expires_at: string | null
  revoked_at: string | null
  created_by: string | null
  created_at: string
}

export interface MockSubscription {
  id: string
  user_id: string
  student_id: string
  plan_name: string
  description: string | null
  amount_cents: number
  currency: string
  billing_interval: 'weekly' | 'monthly' | 'yearly'
  status: 'offered' | 'active' | 'cancelled'
  started_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface GoogleCalendarConnectionSummary {
  google_email: string | null
  calendar_id: string
  connection_status: 'connected' | 'needs_reconnect' | 'disconnected'
  connected_at: string
  updated_at: string
}

export interface CalendarEvent {
  id: string
  user_id: string
  student_id: string | null
  title: string
  description: string | null
  location: string | null
  start_ts: string
  end_ts: string
  event_type: 'calendar_event' | 'lesson_event' | 'student_event' | 'teacher_event'
  created_by_role: 'student' | 'tutor'
  google_calendar_id: string | null
  google_event_id: string | null
  google_event_etag: string | null
  google_html_link: string | null
  google_sync_status: 'not_synced' | 'synced' | 'failed'
  google_last_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface GoogleCalendarEvent {
  id: string
  googleEventId: string
  title: string
  description: string | null
  location: string | null
  start: string
  end: string
  htmlLink: string | null
  source: 'google'
  sourceLabel: 'Google'
  isAllDay: boolean
}

export type UnifiedCalendarEvent = {
  id: string
  title: string
  description?: string | null
  location?: string | null
  start: string
  end: string
  source: 'app' | 'booking' | 'homework' | 'google'
  sourceLabel: string
  htmlLink?: string | null
  googleSyncStatus?: 'not_synced' | 'synced' | 'failed'
}

export interface RetentionEmailEvent {
  id: string
  user_id: string
  student_id: string
  recipient_email: string
  template_kind: 'book_next_session' | 'course_end_followup' | 'reengagement'
  inactivity_days: number | null
  send_at: string
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
  attempts: number
  error_message: string | null
  idempotency_key: string
  sent_at: string | null
  created_at: string
  updated_at: string
}

export interface TutorInquiry {
  id: string
  user_id: string
  tutor_site_id: string | null
  name: string
  email: string
  message: string
  desired_start_date: string | null
  status: 'new' | 'contacted' | 'archived'
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  user_id: string
  student_id: string | null
  booking_id: string | null
  amount_cents: number
  currency: string
  status: 'pending' | 'paid' | 'void'
  due_date: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}
