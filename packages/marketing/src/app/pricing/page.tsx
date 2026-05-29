import Link from 'next/link';
import WaitlistForm from '@/components/WaitlistForm';

const LAUNCH_MODE = process.env.NEXT_PUBLIC_LAUNCH_MODE ?? 'waitlist';

const TIERS = [
  {
    id: 'solo',
    name: 'SOLO',
    price: '$29',
    color: '#4fc3f7',
    description: 'The essentials.',
    features: ['Admin Agent', 'Calendar management', 'Approval queue', 'Agent memory', 'Command Center', 'BYOK'],
    highlight: false,
  },
  {
    id: 'operator',
    name: 'OPERATOR',
    price: '$79',
    color: '#00ff9d',
    description: 'Admin + content machine.',
    features: ['Everything in Solo', 'Content Agent', 'Weekly content plans', 'Post quality scoring', 'Content calendar', 'Cross-agent memory'],
    highlight: true,
  },
  {
    id: 'workforce',
    name: 'WORKFORCE',
    price: '$149',
    color: '#c084fc',
    description: 'The full workforce.',
    features: ['Everything in Operator', 'Research Agent', 'Semantic memory search', 'Cross-agent coordination', 'Priority support', 'Early access to new agents'],
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-8 py-5" style={{ borderBottom: '1px solid #1e2040' }}>
        <Link href="/" className="text-sm font-black tracking-widest">SYNQWORKS</Link>
        <Link href="/" className="text-xs text-gray-500 hover:text-accent tracking-widest transition-colors">← HOME</Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-xs tracking-widest mb-4 text-center" style={{ color: '#4fc3f7' }}>PRICING</div>
        <h1 className="text-4xl font-black mb-4 text-center">Simple, honest pricing.</h1>
        <p className="text-gray-500 text-center text-sm mb-16 tracking-widest">
          BYOK — bring your own Anthropic API key. You pay Anthropic for tokens directly.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {TIERS.map(tier => (
            <div key={tier.id} className="rounded-lg p-6 flex flex-col"
              style={{
                background: tier.highlight ? '#0f1225' : '#0d0d1a',
                border: `1px solid ${tier.highlight ? tier.color + '60' : '#1e2040'}`,
              }}>
              {tier.highlight && (
                <div className="text-xs tracking-widest mb-4 text-center px-3 py-1 rounded-full self-center"
                  style={{ color: tier.color, background: tier.color + '15', border: `1px solid ${tier.color}30` }}>
                  MOST POPULAR
                </div>
              )}
              <div className="text-xs tracking-widest mb-2" style={{ color: tier.color }}>{tier.name}</div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-black">{tier.price}</span>
                <span className="text-gray-500 text-sm">/mo</span>
              </div>
              <p className="text-sm text-gray-500 mb-6">{tier.description}</p>
              <div className="space-y-2 mb-8 flex-1">
                {tier.features.map(f => (
                  <div key={f} className="flex items-start gap-2">
                    <span className="text-xs mt-0.5 flex-shrink-0" style={{ color: tier.color }}>✓</span>
                    <span className="text-xs text-gray-400">{f}</span>
                  </div>
                ))}
              </div>
              {LAUNCH_MODE === 'live' ? (
                <a href={process.env[`NEXT_PUBLIC_LS_URL_${tier.id.toUpperCase()}`] ?? '#'}
                  className="block text-center py-3 rounded-lg text-xs font-bold tracking-widest"
                  style={{
                    background: tier.highlight ? tier.color : tier.color + '15',
                    color: tier.highlight ? '#080810' : tier.color,
                    border: `1px solid ${tier.color}40`,
                  }}>
                  START FREE TRIAL →
                </a>
              ) : (
                <WaitlistForm compact />
              )}
            </div>
          ))}
        </div>

        <div className="rounded-lg p-6 text-center" style={{ background: '#0d0d1a', border: '1px solid #1e2040' }}>
          <p className="text-xs text-gray-500 leading-relaxed">
            All plans include a 14-day free trial. No credit card required.
            Payments processed by LemonSqueezy. Cancel anytime from your account dashboard.
          </p>
        </div>
      </div>

      <footer className="py-8 px-8" style={{ borderTop: '1px solid #1e2040' }}>
        <div className="max-w-5xl mx-auto text-center text-xs text-gray-600 tracking-widest">
          © 2026 SYNQWORKS. ALL RIGHTS RESERVED.
        </div>
      </footer>
    </div>
  );
}
