import { sendTransactionalEmail } from '@/lib/email'

type RecipientRole = 'student' | 'parent' | 'tutor'
type EmailKind = 'confirmation' | 'reminder'

type BookingEmailContext = {
  bookingId: string
  userId: string
  tutorName: string
  tutorEmail: string
  studentName: string
  studentEmail: string
  parentGuardianEmail: string | null
  lessonStartTs: string
  reminderOffsetMinutes: number
}

type QueueParams = {
  supabase: any
  context: BookingEmailContext
}

const MAX_ATTEMPTS = 5

function getIdempotencyKey(bookingId: string, kind: EmailKind, role: RecipientRole) {
  return `booking:${bookingId}:${kind}:${role}`
}

function computeReminderSendAt(lessonStartTs: string, offsetMinutes: number) {
  const lessonDate = new Date(lessonStartTs)
  const sendAt = new Date(lessonDate.getTime() - offsetMinutes * 60 * 1000)
  const now = new Date()

  if (sendAt < now) return now.toISOString()
  return sendAt.toISOString()
}

function formatLessonDate(ts: string) {
  return new Date(ts).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function buildEmailContent(kind: EmailKind, role: RecipientRole, context: BookingEmailContext) {
  const lessonDate = formatLessonDate(context.lessonStartTs)
  const recipient = role === 'tutor' ? context.tutorName : context.studentName

  if (kind === 'confirmation') {
    if (role === 'tutor') {
      const subject = `New booking confirmed: ${context.studentName} on ${lessonDate}`
      const text = `Hi ${context.tutorName},\n\nA new lesson has been confirmed with ${context.studentName}.\nTime: ${lessonDate}\nStudent email: ${context.studentEmail}\n\n- Solo Tutor Suite`
      const html = `<p>Hi ${context.tutorName},</p><p>A new lesson has been confirmed with <strong>${context.studentName}</strong>.</p><p><strong>Time:</strong> ${lessonDate}<br/><strong>Student email:</strong> ${context.studentEmail}</p><p>- Solo Tutor Suite</p>`
      return { subject, text, html }
    }

    const subject = `Booking confirmed with ${context.tutorName} on ${lessonDate}`
    const text = `Hi ${recipient},\n\nYour lesson with ${context.tutorName} is confirmed.\nTime: ${lessonDate}\n\n- Solo Tutor Suite`
    const html = `<p>Hi ${recipient},</p><p>Your lesson with <strong>${context.tutorName}</strong> is confirmed.</p><p><strong>Time:</strong> ${lessonDate}</p><p>- Solo Tutor Suite</p>`
    return { subject, text, html }
  }

  if (role === 'tutor') {
    const subject = `Reminder: lesson with ${context.studentName} starts in ${context.reminderOffsetMinutes} minutes`
    const text = `Hi ${context.tutorName},\n\nReminder: your lesson with ${context.studentName} starts in ${context.reminderOffsetMinutes} minutes.\nStart time: ${lessonDate}\n\n- Solo Tutor Suite`
    const html = `<p>Hi ${context.tutorName},</p><p>Reminder: your lesson with <strong>${context.studentName}</strong> starts in ${context.reminderOffsetMinutes} minutes.</p><p><strong>Start time:</strong> ${lessonDate}</p><p>- Solo Tutor Suite</p>`
    return { subject, text, html }
  }

  const subject = `Reminder: your lesson with ${context.tutorName} starts in ${context.reminderOffsetMinutes} minutes`
  const text = `Hi ${recipient},\n\nReminder: your lesson with ${context.tutorName} starts in ${context.reminderOffsetMinutes} minutes.\nStart time: ${lessonDate}\n\n- Solo Tutor Suite`
  const html = `<p>Hi ${recipient},</p><p>Reminder: your lesson with <strong>${context.tutorName}</strong> starts in ${context.reminderOffsetMinutes} minutes.</p><p><strong>Start time:</strong> ${lessonDate}</p><p>- Solo Tutor Suite</p>`
  return { subject, text, html }
}

async function getEventByKey(supabase: any, idempotencyKey: string) {
  const { data, error } = await supabase
    .from('booking_email_events')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (error) throw error
  return data
}

async function createEvent(
  supabase: any,
  params: {
    bookingId: string
    userId: string
    recipientEmail: string
    recipientRole: RecipientRole
    emailKind: EmailKind
    reminderOffsetMinutes: number | null
    sendAt: string
    idempotencyKey: string
  }
) {
  const { data, error } = await supabase
    .from('booking_email_events')
    .insert({
      booking_id: params.bookingId,
      user_id: params.userId,
      recipient_email: params.recipientEmail,
      recipient_role: params.recipientRole,
      email_kind: params.emailKind,
      reminder_offset_minutes: params.reminderOffsetMinutes,
      send_at: params.sendAt,
      status: 'pending',
      idempotency_key: params.idempotencyKey,
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      return getEventByKey(supabase, params.idempotencyKey)
    }
    throw error
  }

  return data
}

async function lockEventForSend(supabase: any, eventId: string) {
  const { data, error } = await supabase
    .from('booking_email_events')
    .update({ status: 'processing' })
    .eq('id', eventId)
    .in('status', ['pending', 'failed'])
    .lt('attempts', MAX_ATTEMPTS)
    .select('*')
    .maybeSingle()

  if (error) throw error
  return data
}

async function markEventSent(supabase: any, eventId: string, attempts: number) {
  const { error } = await supabase
    .from('booking_email_events')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      attempts,
      error_message: null,
    })
    .eq('id', eventId)

  if (error) throw error
}

async function markEventFailed(supabase: any, eventId: string, attempts: number, message: string) {
  const nextStatus = attempts >= MAX_ATTEMPTS ? 'cancelled' : 'failed'
  const { error } = await supabase
    .from('booking_email_events')
    .update({
      status: nextStatus,
      attempts,
      error_message: message,
    })
    .eq('id', eventId)

  if (error) throw error
}

async function markEventCancelled(supabase: any, eventId: string, message?: string) {
  const { error } = await supabase
    .from('booking_email_events')
    .update({
      status: 'cancelled',
      error_message: message || null,
    })
    .eq('id', eventId)

  if (error) throw error
}

async function sendEventWithContext(supabase: any, event: any, context: BookingEmailContext) {
  const locked = await lockEventForSend(supabase, event.id)
  if (!locked) return { skipped: true }

  const { subject, html, text } = buildEmailContent(
    locked.email_kind as EmailKind,
    locked.recipient_role as RecipientRole,
    {
      ...context,
      reminderOffsetMinutes: locked.reminder_offset_minutes ?? context.reminderOffsetMinutes,
    }
  )

  const result = await sendTransactionalEmail({
    to: locked.recipient_email,
    subject,
    html,
    text,
  })

  const attempts = (locked.attempts || 0) + 1

  if (result.error) {
    await markEventFailed(supabase, locked.id, attempts, result.error)
    return { error: result.error }
  }

  await markEventSent(supabase, locked.id, attempts)
  return { success: true }
}

function getRecipients(context: BookingEmailContext) {
  const recipients: Array<{ role: RecipientRole; email: string }> = [
    { role: 'student', email: context.studentEmail },
    { role: 'tutor', email: context.tutorEmail },
  ]

  if (context.parentGuardianEmail) {
    recipients.push({ role: 'parent', email: context.parentGuardianEmail })
  }

  return recipients
}

export async function queueBookingEmailsAndSendConfirmations({ supabase, context }: QueueParams) {
  const recipients = getRecipients(context)

  for (const recipient of recipients) {
    const confirmationKey = getIdempotencyKey(context.bookingId, 'confirmation', recipient.role)
    const reminderKey = getIdempotencyKey(context.bookingId, 'reminder', recipient.role)

    const confirmationEvent = await createEvent(supabase, {
      bookingId: context.bookingId,
      userId: context.userId,
      recipientEmail: recipient.email,
      recipientRole: recipient.role,
      emailKind: 'confirmation',
      reminderOffsetMinutes: null,
      sendAt: new Date().toISOString(),
      idempotencyKey: confirmationKey,
    })

    if (confirmationEvent?.status !== 'sent' && confirmationEvent?.status !== 'cancelled') {
      await sendEventWithContext(supabase, confirmationEvent, context)
    }

    await createEvent(supabase, {
      bookingId: context.bookingId,
      userId: context.userId,
      recipientEmail: recipient.email,
      recipientRole: recipient.role,
      emailKind: 'reminder',
      reminderOffsetMinutes: context.reminderOffsetMinutes,
      sendAt: computeReminderSendAt(context.lessonStartTs, context.reminderOffsetMinutes),
      idempotencyKey: reminderKey,
    })
  }
}

export async function processDueBookingEmailEvents(supabase: any, limit = 50) {
  const nowIso = new Date().toISOString()

  const { data: events, error } = await supabase
    .from('booking_email_events')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lte('send_at', nowIso)
    .lt('attempts', MAX_ATTEMPTS)
    .order('send_at', { ascending: true })
    .limit(limit)

  if (error) throw error

  let processed = 0
  let sent = 0
  let failed = 0
  let cancelled = 0

  for (const event of events || []) {
    processed += 1

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, user_id, start_ts, prospect_name, prospect_email, parent_guardian_email, status, reminder_offset_minutes')
      .eq('id', event.booking_id)
      .maybeSingle()

    if (bookingError || !booking) {
      await markEventCancelled(supabase, event.id, 'Booking not found')
      cancelled += 1
      continue
    }

    if (booking.status !== 'confirmed') {
      await markEventCancelled(supabase, event.id, `Booking status is ${booking.status}`)
      cancelled += 1
      continue
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', booking.user_id)
      .maybeSingle()

    if (!profile?.email) {
      await markEventFailed(supabase, event.id, (event.attempts || 0) + 1, 'Tutor email not configured')
      failed += 1
      continue
    }

    const context: BookingEmailContext = {
      bookingId: booking.id,
      userId: booking.user_id,
      tutorName: profile.name || 'Tutor',
      tutorEmail: profile.email,
      studentName: booking.prospect_name,
      studentEmail: booking.prospect_email,
      parentGuardianEmail: booking.parent_guardian_email,
      lessonStartTs: booking.start_ts,
      reminderOffsetMinutes: booking.reminder_offset_minutes || 10,
    }

    const result = await sendEventWithContext(supabase, event, context)
    if (result.success) sent += 1
    if (result.error) failed += 1
  }

  return { processed, sent, failed, cancelled }
}

export async function cancelPendingReminderEmailEvents(supabase: any, bookingId: string) {
  const { error } = await supabase
    .from('booking_email_events')
    .update({
      status: 'cancelled',
      error_message: 'Booking cancelled',
    })
    .eq('booking_id', bookingId)
    .eq('email_kind', 'reminder')
    .in('status', ['pending', 'failed', 'processing'])

  if (error) throw error
}

export async function reschedulePendingReminderEmailEvents(
  supabase: any,
  bookingId: string,
  lessonStartTs: string,
  reminderOffsetMinutes: number
) {
  const { error } = await supabase
    .from('booking_email_events')
    .update({
      send_at: computeReminderSendAt(lessonStartTs, reminderOffsetMinutes),
      reminder_offset_minutes: reminderOffsetMinutes,
      status: 'pending',
      error_message: null,
    })
    .eq('booking_id', bookingId)
    .eq('email_kind', 'reminder')
    .in('status', ['pending', 'failed'])

  if (error) throw error
}
