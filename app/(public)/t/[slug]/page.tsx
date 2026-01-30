import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Calendar, CheckCircle } from 'lucide-react'

export default async function TutorSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createServiceClient()

  // Get site by slug
  const { data: site } = await supabase
    .from('tutor_site')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .single()

  if (!site) notFound()

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, avatar_url')
    .eq('id', site.user_id)
    .single()

  // Get onboarding for subjects
  const { data: onboarding } = await supabase
    .from('tutor_onboarding')
    .select('subjects, pricing')
    .eq('user_id', site.user_id)
    .single()

  const bookingUrl = site.booking_link || `/book/${slug}`

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold">TutorLaunch</span>
          </div>
          <Link href={bookingUrl}>
            <Button>
              <Calendar className="w-4 h-4 mr-2" />
              Book a Call
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {site.headline || `${profile?.name || 'Expert'} - Professional Tutor`}
          </h1>
          
          {/* Subjects */}
          {onboarding?.subjects && onboarding.subjects.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mb-6">
              {onboarding.subjects.map((subject: string) => (
                <Badge key={subject} variant="secondary" className="text-sm">
                  {subject}
                </Badge>
              ))}
            </div>
          )}
          
          <p className="text-lg text-gray-600 mb-8">
            {site.bio || 'Dedicated to helping students achieve their academic goals.'}
          </p>
          
          <Link href={bookingUrl}>
            <Button size="lg" className="gap-2">
              <Calendar className="w-5 h-5" />
              Schedule Your Session
            </Button>
          </Link>
        </div>
      </section>

      {/* Packages */}
      {site.packages && site.packages.length > 0 && (
        <section className="container mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-8">Packages & Pricing</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {site.packages.map((pkg: any, i: number) => (
              <Card key={i} className={i === 1 ? 'border-primary shadow-lg' : ''}>
                <CardHeader>
                  <CardTitle>{pkg.name}</CardTitle>
                  <CardDescription>{pkg.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary mb-4">
                    ${pkg.price}
                  </div>
                  <Link href={bookingUrl}>
                    <Button className="w-full" variant={i === 1 ? 'default' : 'outline'}>
                      Get Started
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Why Choose */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">Why Work With Me</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Personalized Approach</h3>
              <p className="text-sm text-gray-600">
                Lessons tailored to your specific goals and learning style
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Flexible Scheduling</h3>
              <p className="text-sm text-gray-600">
                Book sessions that fit your busy schedule
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Proven Results</h3>
              <p className="text-sm text-gray-600">
                Track record of helping students succeed
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
        <p className="text-gray-600 mb-6">
          Book a free consultation to discuss your goals
        </p>
        <Link href={bookingUrl}>
          <Button size="lg">
            <Calendar className="w-5 h-5 mr-2" />
            Book Your Call
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-gray-600 text-sm">
          <p>Powered by TutorLaunch</p>
        </div>
      </footer>
    </div>
  )
}
