import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getGoogleOAuthClient } from '@/lib/google-calendar/oauth'
import { decryptToken } from '@/lib/google-calendar/token-crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const service = await createServiceClient()
    const { data: connection } = await service
      .from('google_calendar_connections')
      .select('refresh_token_encrypted')
      .eq('user_id', user.id)
      .eq('calendar_id', 'primary')
      .maybeSingle()

    if (connection?.refresh_token_encrypted) {
      try {
        const oauthClient = getGoogleOAuthClient()
        await oauthClient.revokeToken(decryptToken(connection.refresh_token_encrypted))
      } catch {
        // Revocation is best-effort; deleting the server-side token still disconnects the app.
      }
    }

    const { error } = await service
      .from('google_calendar_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('calendar_id', 'primary')

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Google Calendar disconnect failed:', error?.message || 'Unknown error')
    return NextResponse.json({ error: 'Failed to disconnect Google Calendar' }, { status: 500 })
  }
}
