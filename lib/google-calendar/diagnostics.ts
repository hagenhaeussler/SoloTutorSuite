export type GoogleCalendarDiagnosticTone = 'success' | 'warning'

export type GoogleCalendarDiagnostic = {
  tone: GoogleCalendarDiagnosticTone
  title: string
  text: string
}

const reasonMessages: Record<string, string> = {
  oauth_access_denied: 'Google returned access_denied. The Google approval screen was cancelled or denied.',
  oauth_missing_code: 'Google redirected back without an authorization code.',
  missing_refresh_token: 'Google did not return a refresh token. Reconnect with consent so offline access can be stored.',
  service_role_missing: 'The Supabase service role key is missing or unavailable in the deployed server environment.',
  connection_table_missing: 'The google_calendar_connections table could not be found. Run the Google Calendar migration.',
  missing_unique_constraint: 'Supabase rejected the connection upsert because the unique key on user_id + calendar_id is missing. Run migration 013.',
  supabase_permission_denied: 'Supabase rejected the server write. Check the service role key value and redeploy.',
  supabase_upsert_failed: 'The OAuth callback reached Supabase but could not save the Google connection row.',
  encryption_key_missing: 'The Google token encryption key is missing or invalid in the deployed server environment.',
  token_exchange_failed: 'Google did not exchange the OAuth code for usable tokens.',
  invalid_state: 'The OAuth state check failed. This can happen if the callback URL or cookies do not match the original app session.',
  callback_exception: 'The OAuth callback failed unexpectedly before the connection could be saved.',
  start_config_missing: 'The Connect button could not start OAuth because required Google environment variables are missing.',
}

export function getGoogleCalendarReasonText(reason?: string | null) {
  if (!reason) return null
  return reasonMessages[reason] || `Callback reason: ${reason}.`
}

export function getGoogleCalendarStatusDiagnostic(input: {
  status?: string | null
  reason?: string | null
  googleConnected: boolean
}) {
  const reasonText = getGoogleCalendarReasonText(input.reason)

  if (input.status === 'connected' && input.googleConnected) {
    return {
      tone: 'success' as const,
      title: 'Google Calendar connected',
      text: 'SoloTutorSuite found the saved Google connection row. Visible-range sync and Add to my Google Calendar can now work.',
    }
  }

  if (input.status === 'connected' && !input.googleConnected) {
    return {
      tone: 'warning' as const,
      title: 'Google authorized, but no connection row is visible',
      text:
        'Google redirected back successfully, but SoloTutorSuite cannot read a saved google_calendar_connections row for this user. Check SUPABASE_SERVICE_ROLE_KEY in Vercel, run migration 013, then reconnect Google Calendar.',
    }
  }

  if (input.status === 'needs_reconnect') {
    return {
      tone: 'warning' as const,
      title: 'Google Calendar needs reconnect',
      text: reasonText || 'Google did not return a refresh token. Reconnect and approve offline access.',
    }
  }

  if (input.status === 'failed' || input.status === 'config_missing') {
    return {
      tone: 'warning' as const,
      title: 'Google Calendar connection failed',
      text:
        reasonText ||
        'The Google Calendar OAuth flow failed. Check the Google client env vars, the exact redirect URI, Supabase service role key, and migration 013.',
    }
  }

  if (input.status === 'cancelled') {
    return {
      tone: 'warning' as const,
      title: 'Google Calendar connection cancelled',
      text: reasonText || 'The Google Calendar approval flow was cancelled before SoloTutorSuite received tokens.',
    }
  }

  return null
}

export function getGoogleCalendarDisconnectedText() {
  return 'No connected google_calendar_connections row was found for this signed-in user and primary calendar. Google sync buttons will only refresh SoloTutorSuite events until the OAuth callback saves that row.'
}
