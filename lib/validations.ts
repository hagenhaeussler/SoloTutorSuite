import { z } from 'zod'

// Onboarding form schema
export const onboardingSchema = z.object({
  subjects: z.array(z.string()).min(1, 'Add at least one subject'),
  target: z.object({
    age_range: z.string().min(1, 'Select an age range'),
    level: z.string().min(1, 'Select a level'),
    exams: z.array(z.string()).optional(),
  }),
  location: z.string().min(1, 'Enter your location'),
  timezone: z.string().min(1, 'Select your timezone'),
  pricing: z.object({
    hourly_rate: z.number().min(1, 'Enter your hourly rate'),
    packages: z.array(z.object({
      name: z.string(),
      price: z.number(),
      sessions: z.number(),
    })).optional(),
  }),
  high_paying_definition: z.object({
    min_budget: z.number().optional(),
    goals: z.array(z.string()).optional(),
    client_type: z.string().optional(),
  }).optional(),
})

export type OnboardingInput = z.infer<typeof onboardingSchema>

// Mini-site edit schema
export const siteEditSchema = z.object({
  headline: z.string().max(200).optional(),
  bio: z.string().max(2000).optional(),
  accent_color: z.string().regex(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/).optional().or(z.literal('')),
  contact_email: z.string().email().optional().or(z.literal('')),
  contact_phone: z.string().max(30).optional().or(z.literal('')),
  packages: z.array(z.object({
    name: z.string(),
    price: z.number().min(0),
    description: z.string().optional(),
  })).optional(),
  booking_link: z.string().url().optional().or(z.literal('')),
  published: z.boolean().optional(),
})

export type SiteEditInput = z.infer<typeof siteEditSchema>

// Availability rule schema
export const availabilityRuleSchema = z.object({
  day_of_week: z.number().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  session_length: z.number().min(15).max(180),
  buffer_time: z.number().min(0).max(60),
})

export type AvailabilityRuleInput = z.infer<typeof availabilityRuleSchema>

// Booking schema
export const bookingSchema = z.object({
  tutor_slug: z.string(),
  start_ts: z.string().datetime(),
  end_ts: z.string().datetime(),
  prospect_name: z.string().min(1, 'Enter your name'),
  prospect_email: z.string().email('Enter a valid email'),
  parent_guardian_email: z.string().email('Enter a valid parent/guardian email').optional().or(z.literal('')),
  reason: z.string().max(500).optional(),
  reminder_offset_minutes: z.number().min(1).max(1440).optional(),
})

export type BookingInput = z.infer<typeof bookingSchema>

// Lead schema
export const leadSchema = z.object({
  name: z.string().min(1, 'Enter a name'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  source: z.string().optional(),
  stage: z.enum(['new', 'contacted', 'booked', 'won', 'lost']).default('new'),
  notes: z.string().optional(),
  next_follow_up_date: z.string().optional(),
})

export type LeadInput = z.infer<typeof leadSchema>

export const studentStatusSchema = z.enum(['active', 'inactive', 'completed', 'lead'])
export const studentInvitationStatusSchema = z.enum(['pending', 'active', 'declined'])

// Student schema
export const studentSchema = z.object({
  name: z.string().min(1, 'Enter student name'),
  email: z.string().email().optional().or(z.literal('')),
  parent_contact: z.string().max(200, 'Parent contact is too long').optional().or(z.literal('')),
  subject_exam_type: z.string().max(200, 'Subject / exam type is too long').optional().or(z.literal('')),
  notes: z.string().max(5000, 'Notes are too long').optional().or(z.literal('')),
  status: studentStatusSchema.default('active'),
})

export type StudentInput = z.infer<typeof studentSchema>

export const studentEmailInviteSchema = z.object({
  email: z.string().trim().email('Enter a valid student email'),
})

export type StudentEmailInviteInput = z.infer<typeof studentEmailInviteSchema>

export const updateStudentProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Enter student name'),
  email: z.string().email().optional().or(z.literal('')),
  parent_contact: z.string().max(200, 'Parent contact is too long').optional().or(z.literal('')),
  subject_exam_type: z.string().max(200, 'Subject / exam type is too long').optional().or(z.literal('')),
  notes: z.string().max(5000, 'Notes are too long').optional().or(z.literal('')),
  status: studentStatusSchema,
})

export type UpdateStudentProfileInput = z.infer<typeof updateStudentProfileSchema>

// Homework schema
export const homeworkSchema = z.object({
  student_id: z.string().uuid(),
  title: z.string().min(1, 'Enter homework title'),
  instructions: z.string().optional(),
  due_date: z.string().optional(),
})

export type HomeworkInput = z.infer<typeof homeworkSchema>

// Video call link schema – accepts any valid meeting URL (Zoom, Google Meet, Teams…)
export const zoomMeetingLinkSchema = z
  .string()
  .url('Enter a valid URL')

export const studentInviteCodeSchema = z
  .string()
  .trim()
  .min(4, 'Student ID is too short')
  .max(32, 'Student ID is too long')
  .regex(/^[A-Z0-9-]+$/i, 'Student ID can only include letters, numbers, and dashes')

export const chatMessageSchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty').max(2000, 'Message is too long'),
})

export const lessonNoteSchema = z.object({
  student_id: z.string().uuid(),
  booking_id: z.string().uuid().optional().or(z.literal('')),
  lesson_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(200),
  summary: z.string().max(5000).optional().or(z.literal('')),
  homework_assigned: z.string().max(5000).optional().or(z.literal('')),
  visibility_scope: z.enum(['private', 'student', 'shared']).default('student'),
})

export const progressMilestoneSchema = z.object({
  student_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().or(z.literal('')),
  status: z.enum(['pending', 'in_progress', 'achieved']).default('pending'),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  visible_to_student: z.boolean().default(true),
})

export const progressShareLinkSchema = z.object({
  student_id: z.string().uuid(),
  expires_in_days: z.number().int().min(1).max(365).optional(),
})

export const mockSubscriptionOfferSchema = z.object({
  student_id: z.string().uuid(),
  plan_name: z.string().trim().min(1, 'Enter a plan name').max(120, 'Plan name is too long'),
  description: z.string().max(2000, 'Description is too long').optional().or(z.literal('')),
  amount_dollars: z.number().min(0, 'Amount cannot be negative').max(100000, 'Amount is too high'),
  billing_interval: z.enum(['once', 'weekly', 'monthly', 'yearly']).default('monthly'),
})

export const appCalendarEventSchema = z
  .object({
    student_id: z.string().uuid().optional().or(z.literal('')),
    title: z.string().trim().min(1, 'Enter a title').max(200, 'Title is too long'),
    description: z.string().max(5000, 'Description is too long').optional().or(z.literal('')),
    location: z.string().max(500, 'Location is too long').optional().or(z.literal('')),
    start_ts: z.string().datetime('Enter a valid start date and time'),
    end_ts: z.string().datetime('Enter a valid end date and time'),
    event_type: z.enum(['calendar_event', 'lesson_event', 'student_event', 'teacher_event']).default('calendar_event'),
    add_to_google_calendar: z.boolean().default(true),
  })
  .refine((value) => new Date(value.end_ts).getTime() > new Date(value.start_ts).getTime(), {
    message: 'End time must be later than start time',
    path: ['end_ts'],
  })

export const tutorInquirySchema = z.object({
  tutor_slug: z.string().min(1),
  name: z.string().min(1).max(120),
  email: z.string().email(),
  message: z.string().min(5).max(5000),
  desired_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
})

export type LessonNoteInput = z.infer<typeof lessonNoteSchema>
export type ProgressMilestoneInput = z.infer<typeof progressMilestoneSchema>
export type ProgressShareLinkInput = z.infer<typeof progressShareLinkSchema>
export type MockSubscriptionOfferInput = z.infer<typeof mockSubscriptionOfferSchema>
export type AppCalendarEventInput = z.infer<typeof appCalendarEventSchema>
export type TutorInquiryInput = z.infer<typeof tutorInquirySchema>
