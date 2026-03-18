type SendEmailInput = {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendTransactionalEmail({ to, subject, html, text }: SendEmailInput) {
  try {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.EMAIL_FROM_ADDRESS

    if (!apiKey || !from) {
      console.error('Email provider is not configured. Missing RESEND_API_KEY or EMAIL_FROM_ADDRESS')
      return { error: 'Email provider is not configured' }
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        text,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Email API failed (${response.status}): ${errorBody}`)
    }

    const data = await response.json()
    return { success: true, id: data?.id as string | undefined }
  } catch (error: any) {
    console.error('Error sending transactional email:', error)
    return { error: error.message || 'Failed to send email' }
  }
}
