import Link from 'next/link';
import { Scan, Check, ArrowRight } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: '$0',
    period: '/mo',
    description: 'Try it out',
    features: ['5 clients', '10 scans/month', 'Basic measurements', 'Client portal'],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/mo',
    description: 'For active trainers',
    features: [
      'Unlimited clients',
      'Unlimited scans',
      '14 measurements + body fat',
      'Progress charts',
      'PDF reports',
      'Client invite links',
      'Priority support',
    ],
    cta: 'Start Pro',
    highlighted: true,
  },
  {
    name: 'Studio',
    price: '$99',
    period: '/mo',
    description: 'Multi-trainer teams',
    features: [
      'Everything in Pro',
      'Multiple trainers',
      'Team management',
      'Custom branding',
      'API access',
      'White-label portal',
    ],
    cta: 'Contact Us',
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-bg">
      {/* Nav */}
      <nav className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-neon/10 flex items-center justify-center">
              <Scan className="h-4 w-4 text-neon" />
            </div>
            <span className="font-display font-bold tracking-tight">NATEFIT</span>
          </Link>
          <Link href="/login" className="text-sm text-text-muted hover:text-text">
            Sign in
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h1 className="font-display text-4xl font-bold mb-3">Simple pricing</h1>
          <p className="text-text-muted">No hardware costs. No contracts. Cancel anytime.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`
                rounded-2xl p-6 flex flex-col
                ${plan.highlighted
                  ? 'glass border-neon/30 neon-glow'
                  : 'glass'
                }
              `}
            >
              <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
              <p className="text-xs text-text-dim mb-4">{plan.description}</p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="font-display text-4xl font-bold">{plan.price}</span>
                <span className="text-text-dim text-sm">{plan.period}</span>
              </div>

              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-neon shrink-0 mt-0.5" />
                    <span className="text-text-muted">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`
                  inline-flex items-center justify-center h-10 rounded-lg font-medium text-sm transition-colors gap-2
                  ${plan.highlighted
                    ? 'bg-neon text-bg hover:bg-neon/90'
                    : 'glass glass-hover'
                  }
                `}
              >
                {plan.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
