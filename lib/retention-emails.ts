import { sendTransactionalEmail } from '@/lib/email'

const MAX_ATTEMPTS = 5
const INACTIVE_DAYS_DEFAULT = 21

type TemplateKind = 'book_next_session' | 'course_end_followup' | 'reengagement'

type RetentionEventContext = {
  tutorName: string
  bookingLink: string
  studentName: string
  studentEmail: string
  inactivityDays?: number | null
}

function buildTemplate(kind: TemplateKind, context: RetentionEventContext) {
  if (kind === 'book_next_session') {
    return {
      subject: `${context.tutorName}: ready for your next session?`,
      text: `Hi ${context.studentName},\n\nGreat progress so far. You can grab your next lesson slot here: ${context.bookingLink}\n\n- ${context.tutorName}`,
      html: `<p>Hi ${context.studentName},</p><p>Great progress so far. You can grab your next lesson slot here:</p><p><a href="${context.bookingLink}">${context.bookingLink}</a></p><p>- ${context.tutorName}</p>`,
    }
  }

  if (kind === 'course_end_followup') {
    return {
      subject: `${context.tutorName}: next-step plan after course completion`,
      text: `Hi ${context.studentName},\n\nCongrats on completing this phase 🎉. If you'd like to continue with an advanced plan, book your next session: ${context.bookingLink}\n\n- ${context.tutorName}`,
      html: `<p>Hi ${context.studentName},</p><p>Congrats on completing this phase 🎉.</p><p>If you'd like to continue with an advanced plan, book your next session: <a href="${context.bookingLink}">${context.bookingLink}</a></p><p>- ${context.tutorName}</p>`,
    }
  }

  return {
    subject: `${context.tutorName}: we miss seeing you in sessions`,
    text: `Hi ${context.studentName},\n\nIt's been ${context.inactivityDays ?? INACTIVE_DAYS_DEFAULT}+ days since your last session. If you want to get back on track, book here: ${context.bookingLink}\n\n- ${context.tutorName}`,
    html: `<p>Hi ${context.studentName},</p><p>It's been ${context.inactivityDays ?? INACTIVE_DAYS_DEFAULT}+ days since your last session.</p><p>If you want to get back on track, book here: <a href="${context.bookingLink}">${context.bookingLink}</a></p><p>- ${context.tutorName}</p>`,
  }
}

async function markEventStatus(
  supabase: any,
  eventId: string,
  status: 'sent' | 'failed' | 'cancelled',
  attempts: number,
  errorMessage?: string
) {
  const payload: Record<string, any> = {
    status,
    attempts,
    error_message: errorMessage || null,
  }

  if (status === 'sent') {
    payload.sent_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('retention_email_events')
    .update(payload)
    .eq('id', eventId)

  if (error) throw error
}

async function lockEventForSend(supabase: any, eventId: string) {
  const { data, error } = await supabase
    .from('retention_email_events')
    .update({ status: 'processing' })
    .eq('id', eventId)
    .in('status', ['pending', 'failed'])
    .lt('attempts', MAX_ATTEMPTS)
    .select('*')
    .maybeSingle()

  if (error) throw error
  return data
}

export async function queueRetentionEvents(supabase: any, options?: { inactiveDays?: number }) {
  const inactiveDays = options?.inactiveDays ?? INACTIVE_DAYS_DEFAULT
  const now = new Date()
  const cutoffIso = new Date(now.getTime() - inactiveDays * 24 * 60 * 60 * 1000).toISOString()

  const { data: students, error: studentError } = await supabase
    .from('students')
    .select('id, user_id, name, email, status')
    .not('email', 'is', null)

  if (studentError) throw studentError

  let queued = 0

  for (const student of students || []) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', student.user_id)
      .maybeSingle()

    const { data: site } = await supabase
      .from('tutor_site')
      .select('slug')
      .eq('user_id', student.user_id)
      .maybeSingle()

    const bookingLink = `${process.env.NEXT_PUBLIC_APP_URL || ''}/book/${site?.slug || ''}`

    const { data: upcomingBookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('user_id', student.user_id)
      .eq('student_id', student.id)
      .eq('status', 'confirmed')
      .gte('start_ts', now.toISOString())
      .limit(1)

    const { data: lastBooking } = await supabase
      .from('bookings')
      .select('start_ts')
      .eq('user_id', student.user_id)
      .eq('student_id', student.id)
      .eq('status', 'confirmed')
      .order('start_ts', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (upcomingBookings && upcomingBookings.length > 0) {
      continue
    }

    const lastTs = lastBooking?.start_ts ? new Date(lastBooking.start_ts) : null
    const inactive = !lastTs || lastTs.toISOString() <= cutoffIso

    const eventKinds: Array<TemplateKind> = []

    if (student.status === 'completed') {
      eventKinds.push('course_end_followup')
    } else if (inactive) {
      eventKinds.push('reengagement')
    } else {
      eventKinds.push('book_next_session')
    }

    for (const kind of eventKinds) {
      const idempotencyKey = `retention:${student.id}:${kind}:${new Date().toISOString().slice(0, 10)}`
      const { data: existing } = await supabase
        .from('retention_email_events')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()

      if (existing) continue

      const { error: insertError } = await supabase.from('retention_email_events').insert({
        user_id: student.user_id,
        student_id: student.id,
        recipient_email: student.email,
        template_kind: kind,
        inactivity_days: inactiveDays,
        send_at: new Date().toISOString(),
        status: 'pending',
        idempotency_key: idempotencyKey,
        attempts: 0,
      })

      if (!insertError) queued += 1

      if (insertError) {
        console.error('Failed to queue retention event:', insertError)
      }

      // Lightweight context cache: update event immediately when details are missing.
      if (!profile?.name || !site?.slug || !bookingLink.includes('/book/')) {
        console.warn('Retention queue context partially missing for student:', student.id)
      }
    }
  }

  return { queued }
}

export async function processDueRetentionEmailEvents(supabase: any, limit = 50) {
  const nowIso = new Date().toISOString()

  const { data: events, error } = await supabase
    .from('retention_email_events')
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

    const locked = await lockEventForSend(supabase, event.id)
    if (!locked) continue

    const { data: student } = await supabase
      .from('students')
      .select('id, user_id, name, email')
      .eq('id', locked.student_id)
      .maybeSingle()

    if (!student?.email) {
      await markEventStatus(supabase, locked.id, 'cancelled', (locked.attempts || 0) + 1, 'Student email not found')
      cancelled += 1
      continue
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', student.user_id)
      .maybeSingle()

    const { data: site } = await supabase
      .from('tutor_site')
      .select('slug')
      .eq('user_id', student.user_id)
      .maybeSingle()

    const bookingLink = `${process.env.NEXT_PUBLIC_APP_URL || ''}/book/${site?.slug || ''}`

    if (!site?.slug) {
      await markEventStatus(supabase, locked.id, 'failed', (locked.attempts || 0) + 1, 'Tutor booking page is not configured')
      failed += 1
      continue
    }

    const template = buildTemplate(locked.template_kind as TemplateKind, {
      tutorName: profile?.name || 'Tutor',
      bookingLink,
      studentName: student.name || 'Student',
      studentEmail: student.email,
      inactivityDays: locked.inactivity_days,
    })

    const attempts = (locked.attempts || 0) + 1

    const result = await sendTransactionalEmail({
      to: locked.recipient_email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })

    if (result.error) {
      await markEventStatus(supabase, locked.id, 'failed', attempts, result.error)
      failed += 1
      continue
    }

    await markEventStatus(supabase, locked.id, 'sent', attempts)
    sent += 1
  }

  return { processed, sent, failed, cancelled }
}
