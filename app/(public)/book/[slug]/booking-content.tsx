'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Sparkles, Calendar, Clock, CheckCircle, Loader2, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AvailabilityRule, Booking } from '@/lib/types'
import { createBookingAction } from './actions'

interface BookingContentProps {
  slug: string
  tutorName: string
  tutorId: string
  rules: AvailabilityRule[]
  existingBookings: Pick<Booking, 'start_ts' | 'end_ts'>[]
}

export function BookingContent({ slug, tutorName, tutorId, rules, existingBookings }: BookingContentProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [booked, setBooked] = useState(false)
  const { toast } = useToast()

  // Generate next 14 days
  const dates = useMemo(() => {
    const result = []
    const today = new Date()
    for (let i = 0; i < 14; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      result.push(date)
    }
    return result
  }, [])

  // Get available slots for selected date
  const availableSlots = useMemo(() => {
    if (!selectedDate) return []

    const date = new Date(selectedDate)
    const dayOfWeek = date.getDay()
    const dayRules = rules.filter(r => r.day_of_week === dayOfWeek)

    if (dayRules.length === 0) return []

    const slots: string[] = []

    dayRules.forEach(rule => {
      const [startH, startM] = rule.start_time.split(':').map(Number)
      const [endH, endM] = rule.end_time.split(':').map(Number)
      
      let currentHour = startH
      let currentMin = startM

      while (currentHour < endH || (currentHour === endH && currentMin < endM)) {
        const slotStart = new Date(date)
        slotStart.setHours(currentHour, currentMin, 0, 0)
        
        const slotEnd = new Date(slotStart)
        slotEnd.setMinutes(slotEnd.getMinutes() + rule.session_length)

        // Check if slot is in the past
        if (slotStart <= new Date()) {
          currentMin += rule.session_length + rule.buffer_time
          if (currentMin >= 60) {
            currentHour += Math.floor(currentMin / 60)
            currentMin = currentMin % 60
          }
          continue
        }

        // Check if slot conflicts with existing booking
        const isBooked = existingBookings.some(booking => {
          const bookingStart = new Date(booking.start_ts)
          const bookingEnd = new Date(booking.end_ts)
          return (
            (slotStart >= bookingStart && slotStart < bookingEnd) ||
            (slotEnd > bookingStart && slotEnd <= bookingEnd)
          )
        })

        if (!isBooked) {
          slots.push(slotStart.toISOString())
        }

        currentMin += rule.session_length + rule.buffer_time
        if (currentMin >= 60) {
          currentHour += Math.floor(currentMin / 60)
          currentMin = currentMin % 60
        }
      }
    })

    return slots
  }, [selectedDate, rules, existingBookings])

  const handleBook = async () => {
    if (!selectedSlot || !name || !email) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const startDate = new Date(selectedSlot)
      const sessionLength = rules.find(r => r.day_of_week === startDate.getDay())?.session_length || 60
      const endDate = new Date(startDate)
      endDate.setMinutes(endDate.getMinutes() + sessionLength)

      const result = await createBookingAction({
        tutor_slug: slug,
        start_ts: startDate.toISOString(),
        end_ts: endDate.toISOString(),
        prospect_name: name,
        prospect_email: email,
        reason,
      })

      if (result.error) throw new Error(result.error)

      setBooked(true)
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const formatSlotTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatDateLabel = (date: Date) => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
    
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  if (booked) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Booking Confirmed!</h1>
            <p className="text-muted-foreground mb-4">
              Your session with {tutorName} has been booked.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              {selectedSlot && new Date(selectedSlot).toLocaleString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
            <Link href={`/t/${slug}`}>
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Profile
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/t/${slug}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to profile
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold">TutorLaunch</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Book a Session with {tutorName}</h1>
            <p className="text-muted-foreground">Select a date and time that works for you</p>
          </div>

          {rules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Available Slots</h3>
                <p className="text-muted-foreground">
                  The tutor hasn&apos;t set their availability yet. Please check back later.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Date & Time Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Select Date
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-2 mb-6">
                    {dates.map(date => {
                      const dateStr = date.toISOString().split('T')[0]
                      const dayRules = rules.filter(r => r.day_of_week === date.getDay())
                      const hasAvailability = dayRules.length > 0

                      return (
                        <button
                          key={dateStr}
                          onClick={() => {
                            setSelectedDate(dateStr)
                            setSelectedSlot(null)
                          }}
                          disabled={!hasAvailability}
                          className={cn(
                            'p-2 rounded-lg text-center transition-colors',
                            selectedDate === dateStr
                              ? 'bg-primary text-white'
                              : hasAvailability
                              ? 'bg-gray-100 hover:bg-gray-200'
                              : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                          )}
                        >
                          <div className="text-xs">{formatDateLabel(date)}</div>
                          <div className="font-semibold">{date.getDate()}</div>
                        </button>
                      )
                    })}
                  </div>

                  {selectedDate && (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Available Times</span>
                      </div>
                      {availableSlots.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No available slots for this day</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {availableSlots.map(slot => (
                            <button
                              key={slot}
                              onClick={() => setSelectedSlot(slot)}
                              className={cn(
                                'p-2 rounded-lg text-sm transition-colors',
                                selectedSlot === slot
                                  ? 'bg-primary text-white'
                                  : 'bg-gray-100 hover:bg-gray-200'
                              )}
                            >
                              {formatSlotTime(slot)}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Booking Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Details</CardTitle>
                  <CardDescription>
                    Fill in your information to confirm the booking
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Name *</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <Label>What would you like to discuss?</Label>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Tell the tutor about your goals..."
                      rows={3}
                    />
                  </div>

                  {selectedSlot && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-primary">
                        Selected: {new Date(selectedSlot).toLocaleString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleBook}
                    disabled={!selectedSlot || !name || !email || loading}
                    className="w-full"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Booking...
                      </>
                    ) : (
                      'Confirm Booking'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
