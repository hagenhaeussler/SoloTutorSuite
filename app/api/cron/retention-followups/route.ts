import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { processDueRetentionEmailEvents, queueRetentionEvents } from '@/lib/retention-emails'

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
    const queueResult = await queueRetentionEvents(supabase)
    const processResult = await processDueRetentionEmailEvents(supabase, 100)

    return NextResponse.json({
      success: true,
      ...queueResult,
      ...processResult,
    })
  } catch (error: any) {
    console.error('Error running retention follow-up cron:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process retention follow-ups' },
      { status: 500 }
    )
  }
}
