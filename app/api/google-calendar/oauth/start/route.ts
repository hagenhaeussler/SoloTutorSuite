import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  GOOGLE_CALENDAR_SCOPES,
  appendGoogleCalendarStatus,
  createGoogleCalendarState,
  getGoogleOAuthClient,
  normalizeGoogleCalendarReturnTo,
} from '@/lib/google-calendar/oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const returnTo = normalizeGoogleCalendarReturnTo(request.nextUrl.searchParams.get('returnTo'))

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const oauthClient = getGoogleOAuthClient()
    const state = createGoogleCalendarState({ userId: user.id, returnTo })
    const authorizationUrl = oauthClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: GOOGLE_CALENDAR_SCOPES,
      state,
    })

    return NextResponse.redirect(authorizationUrl)
  } catch {
    return NextResponse.redirect(new URL(appendGoogleCalendarStatus(returnTo, 'config_missing', 'start_config_missing'), request.url))
  }
}
