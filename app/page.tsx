import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Sparkles, 
  Calendar, 
  Users, 
  FileText, 
  Globe, 
  TrendingUp,
  CheckCircle,
  ArrowRight
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">TutorLaunch</span>
          </div>
          <Link href="/login">
            <Button>Sign In</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          AI-Powered Growth for Tutors
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 max-w-4xl mx-auto leading-tight">
          Look Like a <span className="text-primary">Professional Platform</span>,
          <br />Stay Independent
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Get AI-generated marketing plans, professional mini-sites, booking pages, 
          and a CRM—everything you need to attract high-paying students.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/login">
            <Button size="lg" className="gap-2">
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Everything You Need to Grow</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={<TrendingUp className="w-6 h-6" />}
            title="AI Growth Plan"
            description="Get a personalized marketing strategy based on your niche, target students, and goals."
          />
          <FeatureCard
            icon={<FileText className="w-6 h-6" />}
            title="Marketing Assets"
            description="Generate landing page copy, ad angles, outreach scripts, and email sequences instantly."
          />
          <FeatureCard
            icon={<Globe className="w-6 h-6" />}
            title="Professional Mini-Site"
            description="Publish a beautiful tutor profile page to share with potential students."
          />
          <FeatureCard
            icon={<Calendar className="w-6 h-6" />}
            title="Easy Booking"
            description="Set your availability and let students book directly—no back-and-forth."
          />
          <FeatureCard
            icon={<Users className="w-6 h-6" />}
            title="Simple CRM"
            description="Track leads through your pipeline and never lose a potential student."
          />
          <FeatureCard
            icon={<FileText className="w-6 h-6" />}
            title="Student Hub"
            description="Share files, assign homework, and receive submissions—all in one place."
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-8">
            <Step number={1} title="Sign Up" description="Create your account with Google in seconds" />
            <Step number={2} title="Set Up Profile" description="Tell us about your subjects, students, and pricing" />
            <Step number={3} title="Generate Assets" description="AI creates your marketing plan and materials" />
            <Step number={4} title="Start Growing" description="Publish your site and start accepting bookings" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20 text-center">
        <Card className="bg-primary text-white max-w-3xl mx-auto">
          <CardContent className="py-12 px-8">
            <h2 className="text-3xl font-bold mb-4">Ready to Grow Your Tutoring Business?</h2>
            <p className="text-blue-100 mb-8 text-lg">
              Join tutors who are using AI to attract better clients and scale their income.
            </p>
            <Link href="/login">
              <Button size="lg" variant="secondary" className="gap-2">
                Sign In with Google <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>© 2024 TutorLaunch. Built to help tutors succeed.</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { 
  icon: React.ReactNode
  title: string
  description: string 
}) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-4">
          {icon}
        </div>
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        <p className="text-gray-600">{description}</p>
      </CardContent>
    </Card>
  )
}

function Step({ number, title, description }: {
  number: number
  title: string
  description: string
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center font-bold text-xl mx-auto mb-4">
        {number}
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}
