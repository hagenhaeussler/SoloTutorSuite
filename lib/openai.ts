import OpenAI from 'openai'
import { TutorOnboarding } from './types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function generateGrowthPlan(onboarding: TutorOnboarding, tutorName: string) {
  const prompt = `You are a marketing expert for tutors. Create a comprehensive growth plan for this tutor:

Name: ${tutorName}
Subjects: ${onboarding.subjects.join(', ')}
Target Students: ${onboarding.target.age_range || 'All ages'}, ${onboarding.target.level || 'All levels'}
${onboarding.target.exams?.length ? `Exam prep: ${onboarding.target.exams.join(', ')}` : ''}
Location: ${onboarding.location || 'Online'}
Hourly Rate: $${onboarding.pricing.hourly_rate || 'Not set'}
High-value client definition: Min budget $${onboarding.high_paying_definition?.min_budget || 500}, 
Client type: ${onboarding.high_paying_definition?.client_type || 'Any'},
Goals: ${onboarding.high_paying_definition?.goals?.join(', ') || 'Academic improvement'}

Generate a detailed growth plan in JSON format with these exact fields:
{
  "positioning": "A clear 2-3 sentence positioning statement",
  "channels": ["Array of 5 best marketing channels for this tutor"],
  "offers": [
    {"name": "Offer name", "description": "Brief description"},
    {"name": "Offer name 2", "description": "Brief description"}
  ],
  "funnel_steps": ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"],
  "weekly_checklist": ["10 specific weekly action items"],
  "kpis": [
    {"metric": "KPI name", "target": "Specific target"},
    {"metric": "KPI 2", "target": "Target 2"}
  ]
}

Be specific and actionable. Tailor everything to this tutor's niche and target market.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('No content in response')
  
  return JSON.parse(content)
}

export async function generateAsset(
  assetType: string,
  onboarding: TutorOnboarding,
  tutorName: string
) {
  const prompts: Record<string, string> = {
    landing_page: `Create landing page copy for a tutor:
Name: ${tutorName}
Subjects: ${onboarding.subjects.join(', ')}
Target: ${onboarding.target.age_range || 'All ages'}, ${onboarding.target.level || 'All levels'}
Rate: $${onboarding.pricing.hourly_rate || 75}/hour

Return JSON:
{
  "headline": "Compelling headline",
  "subheadline": "Supporting subheadline",
  "bullets": ["Benefit 1", "Benefit 2", "Benefit 3", "Benefit 4"],
  "cta": "Call to action text",
  "social_proof": "A line about results/experience"
}`,

    ad_angles: `Create 3 ad angles for a tutor:
Name: ${tutorName}
Subjects: ${onboarding.subjects.join(', ')}
Target: ${onboarding.target.age_range || 'All ages'}

Return JSON:
{
  "angles": [
    {"hook": "Hook 1", "headline": "Headline 1", "body": "Short ad body"},
    {"hook": "Hook 2", "headline": "Headline 2", "body": "Short ad body"},
    {"hook": "Hook 3", "headline": "Headline 3", "body": "Short ad body"}
  ]
}`,

    linkedin_outreach: `Create LinkedIn outreach for a tutor reaching out to potential clients (parents/students):
Name: ${tutorName}
Subjects: ${onboarding.subjects.join(', ')}
Target: ${onboarding.target.age_range || 'All ages'}

Return JSON:
{
  "connection_request": "Short connection request message",
  "initial_message": "First message after connecting",
  "follow_ups": ["Follow up 1", "Follow up 2", "Follow up 3", "Follow up 4", "Follow up 5"]
}`,

    email_sequence: `Create a 5-email nurture sequence for tutor leads:
Name: ${tutorName}
Subjects: ${onboarding.subjects.join(', ')}
Target: ${onboarding.target.age_range || 'All ages'}

Return JSON:
{
  "emails": [
    {"subject": "Subject 1", "body": "Email body 1"},
    {"subject": "Subject 2", "body": "Email body 2"},
    {"subject": "Subject 3", "body": "Email body 3"},
    {"subject": "Subject 4", "body": "Email body 4"},
    {"subject": "Subject 5", "body": "Email body 5"}
  ]
}`,

    dm_sequence: `Create a 5-message DM sequence for Instagram/Twitter outreach:
Name: ${tutorName}
Subjects: ${onboarding.subjects.join(', ')}
Target: ${onboarding.target.age_range || 'All ages'}

Return JSON:
{
  "messages": [
    {"timing": "Day 1", "message": "First DM"},
    {"timing": "Day 3", "message": "Second DM"},
    {"timing": "Day 5", "message": "Third DM"},
    {"timing": "Day 8", "message": "Fourth DM"},
    {"timing": "Day 12", "message": "Fifth DM"}
  ]
}`
  }

  const prompt = prompts[assetType]
  if (!prompt) throw new Error(`Unknown asset type: ${assetType}`)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('No content in response')
  
  return JSON.parse(content)
}
