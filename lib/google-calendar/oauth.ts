import 'server-only'

import { createHmac, randomBytes } from 'crypto'
import { google } from 'googleapis'
import { secureCompare } from './token-crypto'

const STATE_TTL_MS = 10 * 60 * 1000

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'openid',
  'email',
]

export interface GoogleCalendarOAuthState {
  userId: string
  returnTo: string
  nonce: string
  exp: number
}

function getOAuthEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = normalizeEnvValue(process.env.GOOGLE_CALENDAR_REDIRECT_URI, 'GOOGLE_CALENDAR_REDIRECT_URI')

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google Calendar OAuth is not configured')
  }

  return { clientId, clientSecret, redirectUri }
}

function normalizeEnvValue(value: string | undefined, key: string) {
  if (!value) return value

  const trimmed = value.trim().replace(/^['"]|['"]$/g, '')
  const prefixedValue = `${key}=`

  if (trimmed.startsWith(prefixedValue)) {
    return trimmed.slice(prefixedValue.length).trim().replace(/^['"]|['"]$/g, '')
  }

  return trimmed
}

function getStateSecret() {
  return process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || process.env.GOOGLE_CLIENT_SECRET
}

function signStatePayload(encodedPayload: string) {
  const secret = getStateSecret()

  if (!secret) {
    throw new Error('Google Calendar state signing is not configured')
  }

  return createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

export function getGoogleOAuthClient() {
  const { clientId, clientSecret, redirectUri } = getOAuthEnv()
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export function getGoogleClientId() {
  return getOAuthEnv().clientId
}

export function normalizeGoogleCalendarReturnTo(returnTo: string | null | undefined, fallback = '/dashboard/calendar') {
  if (!returnTo) return fallback

  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return fallback
  }

  return returnTo
}

export function appendGoogleCalendarStatus(returnTo: string, status: string, reason?: string | null) {
  const [path, query = ''] = returnTo.split('?')
  const params = new URLSearchParams(query)
  params.set('googleCalendar', status)
  if (reason) {
    params.set('googleCalendarReason', reason)
  } else {
    params.delete('googleCalendarReason')
  }
  const nextQuery = params.toString()

  return nextQuery ? `${path}?${nextQuery}` : path
}

export function createGoogleCalendarState(input: { userId: string; returnTo: string }) {
  const payload: GoogleCalendarOAuthState = {
    userId: input.userId,
    returnTo: normalizeGoogleCalendarReturnTo(input.returnTo),
    nonce: randomBytes(16).toString('base64url'),
    exp: Date.now() + STATE_TTL_MS,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = signStatePayload(encodedPayload)

  return `${encodedPayload}.${signature}`
}

export function verifyGoogleCalendarState(state: string | null) {
  if (!state) {
    throw new Error('Missing Google Calendar state')
  }

  const [encodedPayload, signature] = state.split('.')
  if (!encodedPayload || !signature) {
    throw new Error('Invalid Google Calendar state')
  }

  const expectedSignature = signStatePayload(encodedPayload)
  if (!secureCompare(signature, expectedSignature)) {
    throw new Error('Invalid Google Calendar state signature')
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as GoogleCalendarOAuthState

  if (!payload.userId || !payload.returnTo || !payload.exp || payload.exp < Date.now()) {
    throw new Error('Expired Google Calendar state')
  }

  return {
    ...payload,
    returnTo: normalizeGoogleCalendarReturnTo(payload.returnTo),
  }
}
