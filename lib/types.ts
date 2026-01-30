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
  timezone: string
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
  start_ts: string
  end_ts: string
  prospect_name: string
  prospect_email: string
  reason: string | null
  status: 'confirmed' | 'cancelled'
  created_at: string
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
  name: string
  email: string | null
  access_token: string
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
