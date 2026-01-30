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
  reason: z.string().max(500).optional(),
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

// Student schema
export const studentSchema = z.object({
  name: z.string().min(1, 'Enter student name'),
  email: z.string().email().optional().or(z.literal('')),
})

export type StudentInput = z.infer<typeof studentSchema>

// Homework schema
export const homeworkSchema = z.object({
  student_id: z.string().uuid(),
  title: z.string().min(1, 'Enter homework title'),
  instructions: z.string().optional(),
  due_date: z.string().optional(),
})

export type HomeworkInput = z.infer<typeof homeworkSchema>
