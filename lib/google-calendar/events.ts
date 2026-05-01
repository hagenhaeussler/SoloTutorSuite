import 'server-only'

import type { calendar_v3 } from 'googleapis'
import type { GoogleCalendarEvent } from '@/lib/types'
import { getAuthorizedCalendarClient } from './client'

const SOLO_EVENT_ID_KEY = 'soloTutorSuiteEventId'
const SOLO_SOURCE_KEY = 'soloTutorSuiteSource'

export type AppEventForGoogle = {
  id: string
  type: string
  title: string
  description?: string | null
  location?: string | null
  start: string
  end: string
  attendees?: Array<{ email: string; displayName?: string | null }>
}

export type GoogleEventSyncResult = {
  google_calendar_id: string
  google_event_id: string
  google_event_etag: string | null
  google_html_link: string | null
  google_sync_status: 'synced'
  google_last_synced_at: string
}

export function getSoloTutorSuiteEventId(event: Pick<calendar_v3.Schema$Event, 'extendedProperties'>) {
  return event.extendedProperties?.private?.[SOLO_EVENT_ID_KEY] || null
}

export function isSoloTutorSuiteGoogleEvent(event: Pick<calendar_v3.Schema$Event, 'extendedProperties'>) {
  return Boolean(getSoloTutorSuiteEventId(event))
}

function getEventDateTime(value: calendar_v3.Schema$EventDateTime | undefined) {
  return value?.dateTime || (value?.date ? `${value.date}T00:00:00.000Z` : null)
}

export function mapGoogleEventToCalendarEvent(event: calendar_v3.Schema$Event): GoogleCalendarEvent | null {
  const start = getEventDateTime(event.start || undefined)
  const end = getEventDateTime(event.end || undefined)

  if (!event.id || !start || !end) {
    return null
  }

  return {
    id: `google:${event.id}`,
    googleEventId: event.id,
    title: event.summary || 'Untitled Google event',
    description: event.description || null,
    location: event.location || null,
    start,
    end,
    htmlLink: event.htmlLink || null,
    source: 'google',
    sourceLabel: 'Google',
    isAllDay: Boolean(event.start?.date && !event.start.dateTime),
  }
}

export async function listGoogleEvents(
  userId: string,
  input: {
    timeMin: string
    timeMax: string
    timeZone?: string
    excludeGoogleEventIds?: string[]
  }
) {
  const { calendar } = await getAuthorizedCalendarClient(userId)
  const excludedIds = new Set(input.excludeGoogleEventIds || [])

  const { data } = await calendar.events.list({
    calendarId: 'primary',
    timeMin: input.timeMin,
    timeMax: input.timeMax,
    timeZone: input.timeZone,
    singleEvents: true,
    orderBy: 'startTime',
  })

  return (data.items || [])
    .filter((event) => event.status !== 'cancelled')
    .filter((event) => !event.id || !excludedIds.has(event.id))
    .filter((event) => !isSoloTutorSuiteGoogleEvent(event))
    .map(mapGoogleEventToCalendarEvent)
    .filter(Boolean) as GoogleCalendarEvent[]
}

export async function createGoogleEventForAppEvent(userId: string, appEvent: AppEventForGoogle): Promise<GoogleEventSyncResult> {
  const { calendar } = await getAuthorizedCalendarClient(userId)
  const requestBody: calendar_v3.Schema$Event = {
    summary: appEvent.title,
    description: appEvent.description || undefined,
    location: appEvent.location || undefined,
    start: {
      dateTime: appEvent.start,
    },
    end: {
      dateTime: appEvent.end,
    },
    attendees: appEvent.attendees?.filter((attendee) => attendee.email),
    extendedProperties: {
      private: {
        [SOLO_EVENT_ID_KEY]: appEvent.id,
        [SOLO_SOURCE_KEY]: appEvent.type,
      },
    },
  }

  const { data } = await calendar.events.insert({
    calendarId: 'primary',
    requestBody,
    sendUpdates: 'all',
  })

  if (!data.id) {
    throw new Error('Google Calendar did not return an event ID')
  }

  return {
    google_calendar_id: 'primary',
    google_event_id: data.id,
    google_event_etag: data.etag || null,
    google_html_link: data.htmlLink || null,
    google_sync_status: 'synced',
    google_last_synced_at: new Date().toISOString(),
  }
}
