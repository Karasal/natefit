import Link from 'next/link';
import { Scan, Zap, Shield, Users, ArrowRight, Check, Camera, BarChart3, Smartphone } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg">
      {/* Nav */}
      <nav className="border-b border-white/5 sticky top-0 z-50 bg-bg/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-neon/10 flex items-center justify-center">
              <Scan className="h-4 w-4 text-neon" />
            </div>
            <span className="font-display font-bold tracking-tight">NATEFIT</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-text-muted hover:text-text transition-colors">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center h-9 px-4 rounded-lg bg-neon text-bg text-sm font-semibold hover:bg-neon/90 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-neon font-medium mb-6">
          <Zap className="h-3 w-3" />
          AI-Powered Body Composition
        </div>
        <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6 max-w-4xl mx-auto">
          Replace your{' '}
          <span className="text-neon neon-text">$6,500 body scanner</span>{' '}
          with a phone camera
        </h1>
        <p className="text-lg text-text-muted max-w-2xl mx-auto mb-8">
          Professional body composition analysis — 14 circumference measurements, body fat estimation,
          and progress tracking — powered entirely by AI. No hardware. No app install. Just open and scan.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center h-12 px-6 rounded-lg bg-neon text-bg font-semibold hover:bg-neon/90 transition-colors gap-2"
          >
            Start Free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center h-12 px-6 rounded-lg glass glass-hover font-medium gap-2"
          >
            View Pricing
          </Link>
        </div>
      </section>

      {/* How it Works */}
      <section className="border-t border-white/5 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="font-display text-3xl font-bold text-center mb-12">
            Three steps. Fifteen seconds.
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Camera,
                title: 'Front Photo',
                desc: 'Stand in an A-pose facing the camera. Our AI detects 33 body landmarks in real-time and auto-captures when you\'re perfectly positioned.',
              },
              {
                icon: Smartphone,
                title: 'Side Photo',
                desc: 'Turn 90° for a side profile. Same AI guidance ensures accuracy. Two photos give us the frontal width and sagittal depth for each body region.',
              },
              {
                icon: BarChart3,
                title: 'Instant Results',
                desc: '14 circumference measurements, body fat percentage (Navy + CUN-BAE ensemble), lean mass, BMI, and a 3D avatar — all computed on-device in under 4 seconds.',
              },
            ].map((step, i) => (
              <div key={i} className="glass rounded-xl p-6 text-center">
                <div className="w-14 h-14 rounded-xl bg-neon/10 flex items-center justify-center mx-auto mb-4">
                  <step.icon className="h-7 w-7 text-neon" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-text-muted">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-white/5 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="font-display text-3xl font-bold text-center mb-4">
            Built for personal trainers
          </h2>
          <p className="text-text-muted text-center mb-12 max-w-xl mx-auto">
            Everything you need to track client progress, demonstrate results, and grow your business.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Users, title: 'Multi-Client Dashboard', desc: 'Manage unlimited clients. Invite via email or scan link.' },
              { icon: BarChart3, title: 'Progress Charts', desc: 'Track every metric over time. Visual proof of results.' },
              { icon: Shield, title: 'Privacy First', desc: 'All processing happens on-device. Photos are encrypted.' },
              { icon: Zap, title: 'Browser-Based', desc: 'No app install. Works on any phone with a camera.' },
              { icon: Scan, title: '14 Measurements', desc: 'Neck, shoulders, chest, biceps, waist, hips, thighs, calves.' },
              { icon: Camera, title: 'AI Pose Guide', desc: 'Real-time overlay guides users into the perfect position.' },
            ].map((feature, i) => (
              <div key={i} className="flex gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <feature.icon className="h-5 w-5 text-neon" />
                </div>
                <div>
                  <h3 className="font-medium text-sm mb-1">{feature.title}</h3>
                  <p className="text-xs text-text-dim">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="border-t border-white/5 py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="font-display text-3xl font-bold text-center mb-12">
            How we compare
          </h2>
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-text-dim font-medium" />
                  <th className="px-4 py-3 text-center text-text-dim font-medium">Styku</th>
                  <th className="px-4 py-3 text-center text-neon font-bold">NATEFIT</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Hardware cost', '$6,500+', '$0'],
                  ['Monthly cost', '$200/mo', '$49/mo'],
                  ['Scan time', '35 sec', '< 15 sec'],
                  ['Works on Android', 'No', 'Yes'],
                  ['Browser-based', 'No', 'Yes'],
                  ['Floor space needed', '6ft x 4ft', 'None'],
                ].map(([label, styku, natefit], i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 text-text-muted">{label}</td>
                    <td className="px-4 py-3 text-center text-text-dim">{styku}</td>
                    <td className="px-4 py-3 text-center text-neon font-medium">{natefit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5 py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="font-display text-3xl font-bold mb-4">
            Ready to ditch the hardware?
          </h2>
          <p className="text-text-muted mb-8">
            Start scanning clients today. No hardware. No commitment. Free to try.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center h-12 px-8 rounded-lg bg-neon text-bg font-semibold hover:bg-neon/90 transition-colors gap-2 neon-glow"
          >
            Get Started Free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scan className="h-4 w-4 text-text-dim" />
            <span className="text-xs text-text-dim">NATEFIT</span>
          </div>
          <p className="text-xs text-text-dim">AI Body Scanner</p>
        </div>
      </footer>
    </div>
  );
}
