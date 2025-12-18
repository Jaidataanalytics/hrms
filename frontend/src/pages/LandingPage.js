import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { 
  Users, 
  Calendar, 
  Clock, 
  BarChart3, 
  Shield, 
  Bell,
  CheckCircle2,
  ArrowRight,
  Briefcase
} from 'lucide-react';

const LandingPage = () => {
  const features = [
    {
      icon: Users,
      title: 'Employee Management',
      description: 'Complete employee lifecycle management from onboarding to exit with comprehensive profiles.'
    },
    {
      icon: Clock,
      title: 'Attendance Tracking',
      description: 'Biometric integration, WFH support, and tour attendance with GPS tracking.'
    },
    {
      icon: Calendar,
      title: 'Leave Management',
      description: 'Configurable leave policies, approval workflows, and real-time balance tracking.'
    },
    {
      icon: Briefcase,
      title: 'Payroll Processing',
      description: 'India-compliant payroll with PF, ESI, PT, TDS calculations and payslip generation.'
    },
    {
      icon: BarChart3,
      title: 'Performance & KPI',
      description: 'Customizable KPI templates, reviews, and performance trend analysis.'
    },
    {
      icon: Shield,
      title: 'Role-Based Access',
      description: 'Granular permissions with audit trails for complete security and compliance.'
    }
  ];

  const benefits = [
    'Admin-configurable rules for all modules',
    'Real-time dashboards and analytics',
    'Single session login for security',
    'In-app notifications system',
    'Comprehensive audit logging',
    'Custom report builder'
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Sharda HR" className="h-9 w-9 object-contain" />
              <span className="font-semibold text-xl text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Sharda HR
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/login">
                <Button variant="ghost" data-testid="nav-login-btn">Sign In</Button>
              </Link>
              <Link to="/register">
                <Button data-testid="nav-register-btn">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-slide-in-bottom">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Bell className="w-4 h-4" />
                Production-grade HRMS for Indian Companies
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-tight mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Streamline Your
                <span className="text-primary"> HR Operations</span>
              </h1>
              <p className="text-lg text-slate-600 mb-8 max-w-xl leading-relaxed">
                A comprehensive HRMS designed for Indian companies. Manage employees, attendance, 
                leaves, payroll, and performance — all in one secure, configurable platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/register">
                  <Button size="lg" className="w-full sm:w-auto gap-2" data-testid="hero-get-started-btn">
                    Get Started Free
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto" data-testid="hero-sign-in-btn">
                    Sign In to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative animate-fade-in" style={{ animationDelay: '200ms' }}>
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 rounded-3xl blur-3xl"></div>
              <img 
                src="https://images.pexels.com/photos/7723554/pexels-photo-7723554.jpeg"
                alt="Team collaboration"
                className="relative rounded-2xl shadow-2xl w-full object-cover aspect-[4/3]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Everything You Need to Manage HR
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              From hiring to retirement, Sharda HR covers every aspect of human resource management 
              with India-specific compliance built-in.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="p-6 rounded-xl border border-slate-200 bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                data-testid={`feature-card-${index}`}
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {feature.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Built for Enterprise Security & Compliance
              </h2>
              <p className="text-slate-300 mb-8 text-lg leading-relaxed">
                Sharda HR prioritizes security, auditability, and configurability. 
                Every sensitive action is logged, every rule is customizable by admin.
              </p>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-slate-200">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30 rounded-3xl blur-2xl"></div>
              <img 
                src="https://images.pexels.com/photos/4087571/pexels-photo-4087571.jpeg"
                alt="Professional HR Manager"
                className="relative rounded-2xl shadow-2xl w-full object-cover aspect-[4/3]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Ready to Transform Your HR Operations?
          </h2>
          <p className="text-primary-foreground/80 mb-8 text-lg">
            Start managing your workforce more efficiently today. No credit card required.
          </p>
          <Link to="/register">
            <Button size="lg" variant="secondary" className="gap-2" data-testid="cta-get-started-btn">
              Get Started for Free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Sharda HR" className="h-8 w-8 object-contain" />
              <span className="font-semibold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Sharda HR
              </span>
            </div>
            <p className="text-sm">
              © {new Date().getFullYear()} Nexus HR. Built for Indian Enterprises.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
