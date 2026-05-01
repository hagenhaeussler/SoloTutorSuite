import assert from 'node:assert/strict'
import test from 'node:test'
import { getSoloTutorSuiteEventId, isSoloTutorSuiteGoogleEvent, mapGoogleEventToCalendarEvent } from './events'

test('recognizes SoloTutorSuite-owned Google events from private extended properties', () => {
  const googleEvent = {
    extendedProperties: {
      private: {
        soloTutorSuiteEventId: 'event-123',
        soloTutorSuiteSource: 'student_event',
      },
    },
  }

  assert.equal(getSoloTutorSuiteEventId(googleEvent), 'event-123')
  assert.equal(isSoloTutorSuiteGoogleEvent(googleEvent), true)
})

test('maps Google Calendar events into the app calendar shape', () => {
  const mapped = mapGoogleEventToCalendarEvent({
    id: 'google-event-1',
    summary: 'Practice block',
    description: 'Timed section',
    location: 'Library',
    htmlLink: 'https://calendar.google.com/event',
    start: { dateTime: '2026-05-01T18:00:00.000Z' },
    end: { dateTime: '2026-05-01T19:00:00.000Z' },
  })

  assert.deepEqual(mapped, {
    id: 'google:google-event-1',
    googleEventId: 'google-event-1',
    title: 'Practice block',
    description: 'Timed section',
    location: 'Library',
    start: '2026-05-01T18:00:00.000Z',
    end: '2026-05-01T19:00:00.000Z',
    htmlLink: 'https://calendar.google.com/event',
    source: 'google',
    sourceLabel: 'Google',
    isAllDay: false,
  })
})
