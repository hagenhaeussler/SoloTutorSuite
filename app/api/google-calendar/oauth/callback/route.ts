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

function getSafeCallbackFailureReason(error: any) {
  const message = String(error?.message || '')
  const code = String(error?.code || '')

  if (/SUPABASE_SERVICE_ROLE_KEY/i.test(message)) return 'service_role_missing'
  if (/GOOGLE_TOKEN_ENCRYPTION_KEY/i.test(message)) return 'encryption_key_missing'
  if (code === '42P01' || /google_calendar_connections/i.test(message)) return 'connection_table_missing'
  if (code === '42P10' || /no unique|unique constraint|on conflict/i.test(message)) return 'missing_unique_constraint'
  if (code === '42501' || /permission denied|row-level security|invalid api key|JWT/i.test(message)) {
    return 'supabase_permission_denied'
  }
  if (/state/i.test(message)) return 'invalid_state'
  if (/token/i.test(message)) return 'token_exchange_failed'

  return 'callback_exception'
}

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
      return NextResponse.redirect(
        new URL(appendGoogleCalendarStatus(returnTo, 'cancelled', error ? `oauth_${error}` : 'oauth_missing_code'), request.url)
      )
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
      return NextResponse.redirect(new URL(appendGoogleCalendarStatus(returnTo, 'needs_reconnect', 'missing_refresh_token'), request.url))
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
      console.error('Google Calendar connection upsert failed:', upsertError.code || 'no_code', upsertError.message || 'Unknown error')
      const upsertReason = getSafeCallbackFailureReason(upsertError)
      return NextResponse.redirect(
        new URL(
          appendGoogleCalendarStatus(returnTo, 'failed', upsertReason === 'callback_exception' ? 'supabase_upsert_failed' : upsertReason),
          request.url
        )
      )
    }

    return NextResponse.redirect(new URL(appendGoogleCalendarStatus(returnTo, 'connected'), request.url))
  } catch (error: any) {
    console.error('Google Calendar callback failed:', error?.message || 'Unknown error')
    return NextResponse.redirect(new URL(appendGoogleCalendarStatus(returnTo, 'failed', getSafeCallbackFailureReason(error)), request.url))
  }
}
