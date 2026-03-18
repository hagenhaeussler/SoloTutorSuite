import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DollarSign, Users, Repeat, TrendingDown, CreditCard } from 'lucide-react'

function formatCurrency(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: onboarding } = await supabase
    .from('tutor_onboarding')
    .select('pricing')
    .eq('user_id', user.id)
    .single()

  const hourlyRate = Number(onboarding?.pricing?.hourly_rate || 50)

  const { data: monthBookings } = await supabase
    .from('bookings')
    .select('id, status, start_ts, student_id')
    .eq('user_id', user.id)
    .eq('status', 'confirmed')
    .gte('start_ts', startOfMonth.toISOString())

  const estimatedMonthlyRevenueCents = Math.round((monthBookings || []).length * hourlyRate * 100)

  const { data: monthPaidInvoices } = await supabase
    .from('invoices')
    .select('amount_cents, currency')
    .eq('user_id', user.id)
    .eq('status', 'paid')
    .gte('created_at', startOfMonth.toISOString())

  const invoiceMonthlyRevenueCents = (monthPaidInvoices || []).reduce(
    (sum: number, invoice: any) => sum + (invoice.amount_cents || 0),
    0
  )

  const monthlyRevenueCents = invoiceMonthlyRevenueCents || estimatedMonthlyRevenueCents

  const { count: activeStudentsCount } = await supabase
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'active')

  const { data: confirmedBookings } = await supabase
    .from('bookings')
    .select('id, student_id, prospect_email')
    .eq('user_id', user.id)
    .eq('status', 'confirmed')

  const byStudentKey = new Map<string, number>()
  for (const booking of confirmedBookings || []) {
    const key = booking.student_id || booking.prospect_email?.toLowerCase() || booking.id
    byStudentKey.set(key, (byStudentKey.get(key) || 0) + 1)
  }

  const studentsWithAnyBookings = Array.from(byStudentKey.values()).filter((count) => count >= 1).length
  const repeatStudents = Array.from(byStudentKey.values()).filter((count) => count >= 2).length
  const repeatBookingRate = studentsWithAnyBookings > 0 ? (repeatStudents / studentsWithAnyBookings) * 100 : 0

  const { count: completedStudentsCount } = await supabase
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'completed')

  const totalConsidered = (activeStudentsCount || 0) + (completedStudentsCount || 0)
  const churnPercent = totalConsidered > 0 ? ((completedStudentsCount || 0) / totalConsidered) * 100 : 0

  const { data: pendingInvoices } = await supabase
    .from('invoices')
    .select('amount_cents, currency')
    .eq('user_id', user.id)
    .eq('status', 'pending')

  const outstandingPaymentsCents = (pendingInvoices || []).reduce(
    (sum: number, invoice: any) => sum + (invoice.amount_cents || 0),
    0
  )

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Business snapshot for your tutoring practice.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <MetricCard
          title="Monthly Revenue"
          value={formatCurrency(monthlyRevenueCents)}
          subtitle={invoiceMonthlyRevenueCents ? 'From paid invoices' : 'Estimated from bookings'}
          icon={<DollarSign className="w-5 h-5" />}
        />

        <MetricCard
          title="Active Students"
          value={String(activeStudentsCount || 0)}
          subtitle="Currently active in your roster"
          icon={<Users className="w-5 h-5" />}
        />

        <MetricCard
          title="Repeat Booking Rate"
          value={`${repeatBookingRate.toFixed(1)}%`}
          subtitle="Students with 2+ sessions"
          icon={<Repeat className="w-5 h-5" />}
        />

        <MetricCard
          title="Retention / Churn"
          value={`${(100 - churnPercent).toFixed(1)}%`}
          subtitle={`Churn ${(churnPercent).toFixed(1)}%`}
          icon={<TrendingDown className="w-5 h-5" />}
        />

        <MetricCard
          title="Outstanding Payments"
          value={formatCurrency(outstandingPaymentsCents)}
          subtitle="Pending invoices"
          icon={<CreditCard className="w-5 h-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>How these metrics are calculated in the current release.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Revenue uses paid invoices when available, otherwise a booking-based estimate from your hourly rate.</p>
          <p>• Repeat booking rate groups by linked student ID when possible, then by booking email.</p>
          <p>• Retention/churn currently uses student statuses (`active` vs `completed`).</p>
          <div className="pt-1">
            <Badge variant="outline">Foundational analytics</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          {title}
          <span className="text-muted-foreground">{icon}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  )
}
