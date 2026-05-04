import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  appendGoogleCalendarStatus,
  getGoogleClientId,
  getGoogleOAuthClient,
  verifyGoogleCalendarState,
} from '@/lib/google-calendar/oauth'
import { encryptToken } from '@/lib/google-calendar/token-crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getGoogleEmailFromTokens(oauthClient: ReturnType<typeof getGoogleOAuthClient>, idToken?: string | null) {
  if (idToken) {
    try {
      const ticket = await oauthClient.verifyIdToken({
        idToken,
        audience: getGoogleClientId(),
      })
      return ticket.getPayload()?.email || null
    } catch {
      return null
    }
  }

  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauthClient })
    const { data } = await oauth2.userinfo.get()
    return data.email || null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  let returnTo = '/dashboard/calendar'

  try {
    const code = request.nextUrl.searchParams.get('code')
    const rawState = request.nextUrl.searchParams.get('state')
    const error = request.nextUrl.searchParams.get('error')
    const state = verifyGoogleCalendarState(rawState)
    returnTo = state.returnTo

    if (error || !code) {
      return NextResponse.redirect(new URL(appendGoogleCalendarStatus(returnTo, 'cancelled'), request.url))
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || user.id !== state.userId) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const oauthClient = getGoogleOAuthClient()
    const { tokens } = await oauthClient.getToken(code)

    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL(appendGoogleCalendarStatus(returnTo, 'needs_reconnect'), request.url))
    }

    oauthClient.setCredentials(tokens)
    const googleEmail = await getGoogleEmailFromTokens(oauthClient, tokens.id_token)
    const service = await createServiceClient()
    const { error: upsertError } = await service.from('google_calendar_connections').upsert(
      {
        user_id: user.id,
        google_email: googleEmail,
        calendar_id: 'primary',
        access_token_encrypted: tokens.access_token ? encryptToken(tokens.access_token) : null,
        refresh_token_encrypted: encryptToken(tokens.refresh_token),
        token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        scope: tokens.scope || null,
        connection_status: 'connected',
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,calendar_id' }
    )

    if (upsertError) {
      throw upsertError
    }

    return NextResponse.redirect(new URL(appendGoogleCalendarStatus(returnTo, 'connected'), request.url))
  } catch (error: any) {
    console.error('Google Calendar callback failed:', error?.message || 'Unknown error')
    return NextResponse.redirect(new URL(appendGoogleCalendarStatus(returnTo, 'failed'), request.url))
  }
}
