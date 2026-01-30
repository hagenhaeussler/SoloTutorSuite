import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardSidebar } from '@/components/dashboard-sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check onboarding status
  const { data: onboarding } = await supabase
    .from('tutor_onboarding')
    .select('completed')
    .eq('user_id', user.id)
    .single()

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get site for slug
  const { data: site } = await supabase
    .from('tutor_site')
    .select('slug')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <DashboardSidebar 
        user={user} 
        profile={profile}
        slug={site?.slug}
      />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  )
}
