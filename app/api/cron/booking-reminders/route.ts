import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { processDueBookingEmailEvents } from '@/lib/booking-emails'

export const dynamic = 'force-dynamic'

function isAuthorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET
  const url = new URL(request.url)
  const querySecret = url.searchParams.get('secret')
  const authHeader = request.headers.get('authorization')
  const xVercelCron = request.headers.get('x-vercel-cron')
  const userAgent = request.headers.get('user-agent') || ''

  if (!secret) {
    return xVercelCron === '1' || userAgent.toLowerCase().includes('vercel-cron')
  }

  if (querySecret && querySecret === secret) return true
  if (authHeader === `Bearer ${secret}`) return true
  if (xVercelCron === '1') return true

  return false
}

export async function GET(request: Request) {
  try {
    if (!isAuthorizedCronRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServiceClient()
    const result = await processDueBookingEmailEvents(supabase, 100)

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('Error running booking reminder cron:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process booking reminders' },
      { status: 500 }
    )
  }
}
