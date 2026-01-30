'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Sparkles, X, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { generateSlug } from '@/lib/utils'

const STEPS = ['Subjects', 'Students', 'Pricing', 'Goals']

const COMMON_SUBJECTS = [
  'Math', 'Physics', 'Chemistry', 'Biology', 'English', 'Spanish', 'French',
  'SAT Prep', 'ACT Prep', 'AP Courses', 'GCSE', 'A-Levels', 'IB', 'Computer Science',
  'Essay Writing', 'Reading', 'Science', 'Music', 'Art'
]

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore',
  'Australia/Sydney', 'UTC'
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  
  // Form state
  const [subjects, setSubjects] = useState<string[]>([])
  const [customSubject, setCustomSubject] = useState('')
  const [ageRange, setAgeRange] = useState('')
  const [level, setLevel] = useState('')
  const [exams, setExams] = useState<string[]>([])
  const [location, setLocation] = useState('')
  const [timezone, setTimezone] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [packages, setPackages] = useState<Array<{ name: string; price: number; sessions: number }>>([])
  const [minBudget, setMinBudget] = useState('')
  const [clientType, setClientType] = useState('')
  const [goals, setGoals] = useState<string[]>([])

  const addSubject = (subject: string) => {
    if (subject && !subjects.includes(subject)) {
      setSubjects([...subjects, subject])
    }
    setCustomSubject('')
  }

  const removeSubject = (subject: string) => {
    setSubjects(subjects.filter(s => s !== subject))
  }

  const addPackage = () => {
    setPackages([...packages, { name: '', price: 0, sessions: 5 }])
  }

  const updatePackage = (index: number, field: string, value: string | number) => {
    const updated = [...packages]
    updated[index] = { ...updated[index], [field]: value }
    setPackages(updated)
  }

  const removePackage = (index: number) => {
    setPackages(packages.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    setLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Save onboarding data
      const { error: onboardingError } = await supabase
        .from('tutor_onboarding')
        .upsert({
          user_id: user.id,
          subjects,
          target: { age_range: ageRange, level, exams },
          location,
          timezone,
          pricing: { hourly_rate: parseFloat(hourlyRate) || 0, packages },
          high_paying_definition: {
            min_budget: parseFloat(minBudget) || 500,
            client_type: clientType,
            goals
          },
          completed: true
        })

      if (onboardingError) throw onboardingError

      // Create initial tutor site
      const profile = await supabase.from('profiles').select('name').eq('id', user.id).single()
      const slug = generateSlug(profile.data?.name || user.email?.split('@')[0] || 'tutor') + '-' + Date.now().toString(36)
      
      const { error: siteError } = await supabase
        .from('tutor_site')
        .upsert({
          user_id: user.id,
          slug,
          headline: `Expert ${subjects[0] || 'Tutoring'} Tutor`,
          bio: `Helping students excel in ${subjects.join(', ')}.`,
          packages: packages.length > 0 ? packages.map(p => ({
            name: p.name || `${p.sessions} Sessions`,
            price: p.price,
            description: `${p.sessions} one-on-one sessions`
          })) : [
            { name: 'Single Session', price: parseFloat(hourlyRate) || 75, description: '1-hour session' }
          ],
          published: false
        })

      if (siteError) throw siteError

      toast({
        title: 'Welcome aboard!',
        description: 'Your profile is set up. Let\'s generate your growth plan!',
      })

      router.push('/dashboard')
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    switch (step) {
      case 0: return subjects.length > 0
      case 1: return ageRange && level && location && timezone
      case 2: return hourlyRate
      case 3: return true
      default: return false
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-2xl">TutorLaunch</span>
          </div>
          <h1 className="text-2xl font-bold">Let&apos;s set up your profile</h1>
          <p className="text-muted-foreground">This helps us create your personalized growth plan</p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div 
                className={`h-2 rounded-full ${i <= step ? 'bg-primary' : 'bg-gray-200'}`}
              />
              <p className={`text-xs mt-1 ${i <= step ? 'text-primary' : 'text-muted-foreground'}`}>
                {s}
              </p>
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>
              {step === 0 && 'What do you teach?'}
              {step === 1 && 'Who are your students?'}
              {step === 2 && 'What do you charge?'}
              {step === 3 && 'Define your ideal client'}
            </CardTitle>
            <CardDescription>
              {step === 0 && 'Select all subjects you offer tutoring in'}
              {step === 1 && 'Tell us about your target students'}
              {step === 2 && 'Set your rates and packages'}
              {step === 3 && 'Help us understand what "high-paying" means to you'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 0: Subjects */}
            {step === 0 && (
              <>
                <div className="flex flex-wrap gap-2">
                  {COMMON_SUBJECTS.map(subject => (
                    <Badge
                      key={subject}
                      variant={subjects.includes(subject) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => 
                        subjects.includes(subject) 
                          ? removeSubject(subject) 
                          : addSubject(subject)
                      }
                    >
                      {subject}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add custom subject..."
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addSubject(customSubject)}
                  />
                  <Button onClick={() => addSubject(customSubject)}>Add</Button>
                </div>
                {subjects.length > 0 && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Selected subjects:</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {subjects.map(subject => (
                        <Badge key={subject} className="gap-1">
                          {subject}
                          <X className="w-3 h-3 cursor-pointer" onClick={() => removeSubject(subject)} />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Step 1: Target Students */}
            {step === 1 && (
              <>
                <div className="grid gap-4">
                  <div>
                    <Label>Age Range</Label>
                    <Select value={ageRange} onValueChange={setAgeRange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select age range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5-10">Elementary (5-10)</SelectItem>
                        <SelectItem value="11-14">Middle School (11-14)</SelectItem>
                        <SelectItem value="15-18">High School (15-18)</SelectItem>
                        <SelectItem value="18+">College/Adult (18+)</SelectItem>
                        <SelectItem value="all">All Ages</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Level</Label>
                    <Select value={level} onValueChange={setLevel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                        <SelectItem value="exam-prep">Exam Preparation</SelectItem>
                        <SelectItem value="all">All Levels</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Input 
                      placeholder="e.g., New York, NY or Online Only"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Timezone</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map(tz => (
                          <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Pricing */}
            {step === 2 && (
              <>
                <div>
                  <Label>Hourly Rate ($)</Label>
                  <Input 
                    type="number"
                    placeholder="e.g., 75"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Packages (optional)</Label>
                    <Button variant="outline" size="sm" onClick={addPackage}>
                      Add Package
                    </Button>
                  </div>
                  {packages.map((pkg, i) => (
                    <div key={i} className="flex gap-2 items-end mb-2">
                      <div className="flex-1">
                        <Label className="text-xs">Name</Label>
                        <Input 
                          placeholder="e.g., Monthly Plan"
                          value={pkg.name}
                          onChange={(e) => updatePackage(i, 'name', e.target.value)}
                        />
                      </div>
                      <div className="w-24">
                        <Label className="text-xs">Sessions</Label>
                        <Input 
                          type="number"
                          value={pkg.sessions}
                          onChange={(e) => updatePackage(i, 'sessions', parseInt(e.target.value))}
                        />
                      </div>
                      <div className="w-24">
                        <Label className="text-xs">Price ($)</Label>
                        <Input 
                          type="number"
                          value={pkg.price || ''}
                          onChange={(e) => updatePackage(i, 'price', parseFloat(e.target.value))}
                        />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removePackage(i)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Step 3: High-Paying Definition */}
            {step === 3 && (
              <>
                <div>
                  <Label>Minimum Budget ($)</Label>
                  <Input 
                    type="number"
                    placeholder="e.g., 500"
                    value={minBudget}
                    onChange={(e) => setMinBudget(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    What&apos;s the minimum a &quot;high-paying&quot; client would spend?
                  </p>
                </div>
                <div>
                  <Label>Ideal Client Type</Label>
                  <Select value={clientType} onValueChange={setClientType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select client type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parent">Parents</SelectItem>
                      <SelectItem value="adult">Adult Learners</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Client Goals (select all that apply)</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {['Test Prep', 'Grade Improvement', 'College Admissions', 'Skill Building', 'Homework Help', 'Competition Prep'].map(goal => (
                      <Badge
                        key={goal}
                        variant={goals.includes(goal) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => 
                          goals.includes(goal)
                            ? setGoals(goals.filter(g => g !== goal))
                            : setGoals([...goals, goal])
                        }
                      >
                        {goal}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button 
            variant="outline" 
            onClick={() => setStep(step - 1)}
            disabled={step === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          {step < STEPS.length - 1 ? (
            <Button 
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  Complete Setup
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
