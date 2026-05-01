import 'server-only'

import { google } from 'googleapis'
import type { Credentials, OAuth2Client } from 'google-auth-library'
import { createServiceClient } from '@/lib/supabase/server'
import type { GoogleCalendarConnectionSummary } from '@/lib/types'
import { decryptToken, encryptToken } from './token-crypto'
import { getGoogleOAuthClient } from './oauth'

type GoogleCalendarConnectionRow = {
  id: string
  user_id: string
  google_email: string | null
  calendar_id: string
  access_token_encrypted: string | null
  refresh_token_encrypted: string
  token_expiry: string | null
  scope: string | null
  connection_status: 'connected' | 'needs_reconnect' | 'disconnected'
  connected_at: string
  updated_at: string
}

export class GoogleCalendarConnectionError extends Error {
  code: 'not_connected' | 'needs_reconnect' | 'not_configured'

  constructor(code: GoogleCalendarConnectionError['code'], message: string) {
    super(message)
    this.name = 'GoogleCalendarConnectionError'
    this.code = code
  }
}

export function isMissingGoogleCalendarTableError(error: any) {
  return error?.code === '42P01' || /google_calendar_connections/i.test(error?.message || '')
}

export function toGoogleCalendarConnectionSummary(
  connection: GoogleCalendarConnectionRow | null
): GoogleCalendarConnectionSummary | null {
  if (!connection) return null

  return {
    google_email: connection.google_email,
    calendar_id: connection.calendar_id,
    connection_status: connection.connection_status,
    connected_at: connection.connected_at,
    updated_at: connection.updated_at,
  }
}

export async function getGoogleCalendarConnection(userId: string) {
  const service = await createServiceClient()
  const { data, error } = await service
    .from('google_calendar_connections')
    .select(
      'id, user_id, google_email, calendar_id, access_token_encrypted, refresh_token_encrypted, token_expiry, scope, connection_status, connected_at, updated_at'
    )
    .eq('user_id', userId)
    .eq('calendar_id', 'primary')
    .maybeSingle()

  if (error) {
    if (isMissingGoogleCalendarTableError(error)) return null
    throw error
  }

  return data as GoogleCalendarConnectionRow | null
}

export async function markGoogleCalendarNeedsReconnect(userId: string) {
  const service = await createServiceClient()
  await service
    .from('google_calendar_connections')
    .update({ connection_status: 'needs_reconnect' })
    .eq('user_id', userId)
    .eq('calendar_id', 'primary')
}

async function persistRotatedTokens(userId: string, credentials: Credentials) {
  const update: Record<string, string | null> = {
    connection_status: 'connected',
  }

  if (credentials.access_token) {
    update.access_token_encrypted = encryptToken(credentials.access_token)
  }

  if (credentials.refresh_token) {
    update.refresh_token_encrypted = encryptToken(credentials.refresh_token)
  }

  if (credentials.expiry_date) {
    update.token_expiry = new Date(credentials.expiry_date).toISOString()
  }

  const service = await createServiceClient()
  await service
    .from('google_calendar_connections')
    .update(update)
    .eq('user_id', userId)
    .eq('calendar_id', 'primary')
}

export async function getAuthorizedCalendarClient(userId: string) {
  const connection = await getGoogleCalendarConnection(userId)

  if (!connection || connection.connection_status === 'disconnected') {
    throw new GoogleCalendarConnectionError('not_connected', 'Google Calendar is not connected')
  }

  if (connection.connection_status === 'needs_reconnect') {
    throw new GoogleCalendarConnectionError('needs_reconnect', 'Google Calendar needs to be reconnected')
  }

  let oauthClient: OAuth2Client

  try {
    oauthClient = getGoogleOAuthClient()
  } catch (error: any) {
    throw new GoogleCalendarConnectionError('not_configured', error.message || 'Google Calendar is not configured')
  }

  const refreshToken = decryptToken(connection.refresh_token_encrypted)
  const accessToken = connection.access_token_encrypted ? decryptToken(connection.access_token_encrypted) : undefined
  const expiryDate = connection.token_expiry ? new Date(connection.token_expiry).getTime() : undefined

  oauthClient.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiryDate,
    scope: connection.scope || undefined,
  })

  const shouldRefresh = !expiryDate || expiryDate < Date.now() + 60_000

  if (shouldRefresh) {
    try {
      const { credentials } = await oauthClient.refreshAccessToken()
      oauthClient.setCredentials({
        ...credentials,
        refresh_token: credentials.refresh_token || refreshToken,
      })
      await persistRotatedTokens(userId, credentials)
    } catch (error) {
      await markGoogleCalendarNeedsReconnect(userId)
      throw new GoogleCalendarConnectionError('needs_reconnect', 'Google Calendar needs to be reconnected')
    }
  }

  return {
    calendar: google.calendar({ version: 'v3', auth: oauthClient }),
    oauthClient,
    connection,
  }
}
