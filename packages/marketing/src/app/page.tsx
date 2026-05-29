import Link from 'next/link';
import WaitlistForm from '@/components/WaitlistForm';

const LAUNCH_MODE = process.env.NEXT_PUBLIC_LAUNCH_MODE ?? 'waitlist';

const TIERS = [
  {
    id: 'solo',
    name: 'SOLO',
    price: '$29',
    color: '#4fc3f7',
    description: 'The essentials for running your business solo.',
    features: [
      'Admin Agent — email triage & drafting',
      'Google Calendar management',
      'Approval queue — you stay in control',
      'Agent memory — learns your preferences',
      'Command Center dashboard',
      'BYOK — bring your own API key',
    ],
    highlight: false,
  },
  {
    id: 'operator',
    name: 'OPERATOR',
    price: '$79',
    color: '#00ff9d',
    description: 'Admin plus a full content machine.',
    features: [
      'Everything in Solo',
      'Content Agent — generate posts for any platform',
      'Weekly content plan generation',
      'Post quality scoring before approval',
      'Content calendar — 14-day view',
      'Memory shared across all agents',
    ],
    highlight: true,
  },
  {
    id: 'workforce',
    name: 'WORKFORCE',
    price: '$149',
    color: '#c084fc',
    description: 'The full AI workforce. Every agent, maximum intelligence.',
    features: [
      'Everything in Operator',
      'Research Agent — deep dives & synthesis',
      'Semantic memory search',
      'Cross-agent context sharing',
      'Priority support',
      'Early access to new agents',
    ],
    highlight: false,
  },
];

const PROBLEMS = [
  { pain: 'Inbox anxiety eating your mornings', fix: 'Admin Agent triages it. You get a clean summary with proposed replies — approve in one click.' },
  { pain: 'Calendar chaos and back-to-back meetings', fix: 'Calendar Agent spots conflicts before they happen and handles scheduling on your behalf.' },
  { pain: 'Content that never gets written', fix: 'Content Agent generates a week of posts in one shot. You approve the ones you like.' },
  { pain: 'Tools that make decisions for you', fix: 'Every action requires your explicit approval. You are always the decision-maker.' },
];

const HOW_IT_WORKS = [
  { step: '01', color: '#4fc3f7', title: 'Tell your agents about your business', body: 'A 10-question onboarding fills the shared memory store. Your agents know your clients, your tone, your priorities before they run their first task.' },
  { step: '02', color: '#00ff9d', title: 'Agents work in the background', body: 'Your Admin Agent triages your inbox every morning. Your Content Agent prepares a weekly post plan. All without you lifting a finger.' },
  { step: '03', color: '#ffb347', title: 'You approve. They execute.', body: 'Every proposed action lands in your Approval Queue. Tap Approve or Reject. Nothing happens without your sign-off.' },
  { step: '04', color: '#c084fc', title: 'The system gets smarter', body: 'Every approval and rejection is stored in shared memory. Agents learn your preferences over time. The longer you use it, the better it gets.' },
];

const AGENTS = [
  {
    icon: '📧',
    name: 'ADMIN AGENT',
    role: 'Inbox & Calendar',
    color: '#4fc3f7',
    capabilities: ['Triages unread emails every morning', 'Drafts replies for your approval', 'Spots calendar conflicts before they happen', 'Schedules meetings on your behalf', 'Flags urgent items immediately'],
    tier: 'solo',
  },
  {
    icon: '✍️',
    name: 'CONTENT AGENT',
    role: 'Content & Social',
    color: '#ffb347',
    capabilities: ['Generates posts for any platform', 'Builds weekly content plans', 'Scores post quality before presenting', 'Maintains your voice and tone', 'Schedules approved content'],
    tier: 'operator',
  },
  {
    icon: '🔍',
    name: 'RESEARCH AGENT',
    role: 'Research & Intelligence',
    color: '#c084fc',
    capabilities: ['Deep-dives any topic on demand', 'Synthesizes findings into memory', 'Surfaces relevant context for decisions', 'Monitors topics you care about', 'Available on Workforce plan'],
    tier: 'workforce',
  },
];

function BuyButton({ tierId, color, highlight }: { tierId: string; color: string; highlight: boolean }) {
  if (LAUNCH_MODE !== 'live') {
    return (
      <div className="mt-auto pt-6">
        <WaitlistForm compact />
      </div>
    );
  }
  const url = process.env[`NEXT_PUBLIC_LS_URL_${tierId.toUpperCase()}`] ?? '#';
  return (
    <a
      href={url}
      className="block text-center py-3 rounded-lg text-xs font-bold tracking-widest transition-all mt-auto"
      style={{
        background: highlight ? color : color + '15',
        color: highlight ? '#080810' : color,
        border: `1px solid ${color}40`,
      }}
    >
      START FREE TRIAL →
    </a>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen">

      {/* Nav */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4"
        style={{ background: '#08081099', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1e204050' }}
      >
        <div className="text-sm font-black tracking-widest">SYNQWORKS</div>
        <div className="flex items-center gap-6">
          <a href="#how-it-works" className="text-xs text-gray-500 hover:text-white transition-colors tracking-widest hidden md:block">HOW IT WORKS</a>
          <a href="#pricing" className="text-xs text-gray-500 hover:text-white transition-colors tracking-widest hidden md:block">PRICING</a>
          <Link href="/products" className="text-xs text-gray-500 hover:text-white transition-colors tracking-widest hidden md:block">PRODUCTS</Link>
          <Link href="/download" className="text-xs px-4 py-2 rounded tracking-widest transition-colors"
            style={{ background: '#4fc3f715', border: '1px solid #4fc3f740', color: '#4fc3f7' }}>
            DOWNLOAD
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="orb absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(circle, #ffb34720 0%, transparent 70%)' }} />
          <div className="orb-delay absolute bottom-1/4 left-1/4 w-72 h-72 rounded-full"
            style={{ background: 'radial-gradient(circle, #4fc3f715 0%, transparent 70%)' }} />
          <div className="orb-delay absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full"
            style={{ background: 'radial-gradient(circle, #c084fc15 0%, transparent 70%)' }} />
        </div>

        <div className="relative text-center px-6 max-w-4xl mx-auto">
          <div className="text-xs tracking-widest mb-6" style={{ color: '#4fc3f7' }}>
            AI WORKFORCE PLATFORM FOR SOLO OPERATORS
          </div>
          <h1 className="font-black leading-none mb-6" style={{ fontSize: 'clamp(48px, 10vw, 96px)', letterSpacing: '-2px' }}>
            RUN A BUSINESS.<br />SOLO.
          </h1>
          <p className="text-gray-400 mb-10 mx-auto max-w-xl leading-relaxed" style={{ fontSize: 'clamp(14px, 2vw, 18px)' }}>
            Build an AI workforce that manages your admin and amplifies your ideas.
            You stay in control. Agents handle the overhead.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {LAUNCH_MODE === 'live' ? (
              <Link href="/pricing" className="px-8 py-4 rounded-lg text-sm font-black tracking-widest"
                style={{ background: '#4fc3f7', color: '#080810' }}>
                START FREE TRIAL →
              </Link>
            ) : (
              <div className="flex justify-center">
                <WaitlistForm />
              </div>
            )}
            <a href="#how-it-works" className="px-8 py-4 rounded-lg text-sm font-bold tracking-widest transition-colors"
              style={{ background: 'transparent', border: '1px solid #1e2040', color: '#94a3b8' }}>
              SEE HOW IT WORKS
            </a>
          </div>
          <p className="text-gray-600 text-xs mt-6 tracking-widest">
            14-day free trial · No credit card required · BYOK — bring your own API key
          </p>
        </div>
      </section>

      {/* Problem → Solution */}
      <section className="py-24 px-6" style={{ borderTop: '1px solid #1e2040' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-xs tracking-widest text-gray-500 text-center mb-4">THE PROBLEM</div>
          <h2 className="text-3xl font-black text-center mb-16">Solo operators drown in overhead.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PROBLEMS.map((p, i) => (
              <div key={i} className="rounded-lg p-6" style={{ background: '#0d0d1a', border: '1px solid #1e2040' }}>
                <div className="text-sm text-gray-500 mb-3 line-through">{p.pain}</div>
                <div className="flex items-start gap-3">
                  <span style={{ color: '#00ff9d' }}>→</span>
                  <span className="text-sm text-gray-300 leading-relaxed">{p.fix}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6" style={{ borderTop: '1px solid #1e2040' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-xs tracking-widest text-gray-500 text-center mb-4">HOW IT WORKS</div>
          <h2 className="text-3xl font-black text-center mb-16">Your AI workforce, on your terms.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {HOW_IT_WORKS.map(s => (
              <div key={s.step} className="rounded-lg p-6"
                style={{ background: '#0d0d1a', border: '1px solid #1e2040', borderLeft: `3px solid ${s.color}` }}>
                <div className="text-3xl font-black mb-4" style={{ color: s.color }}>{s.step}</div>
                <h3 className="font-bold text-base mb-3">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agents */}
      <section className="py-24 px-6" style={{ borderTop: '1px solid #1e2040' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-xs tracking-widest text-gray-500 text-center mb-4">THE WORKFORCE</div>
          <h2 className="text-3xl font-black text-center mb-16">Meet your agents.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {AGENTS.map(a => (
              <div key={a.name} className="rounded-lg p-5"
                style={{ background: '#0d0d1a', border: `1px solid ${a.color}30`, borderTop: `3px solid ${a.color}` }}>
                <div className="text-2xl mb-3">{a.icon}</div>
                <div className="text-xs tracking-widest mb-1" style={{ color: a.color }}>{a.name}</div>
                <div className="text-xs text-gray-500 mb-4">{a.role}</div>
                {a.capabilities.map(c => (
                  <div key={c} className="flex items-start gap-2 mb-2">
                    <span className="text-xs mt-0.5 flex-shrink-0" style={{ color: a.color }}>→</span>
                    <span className="text-xs text-gray-400 leading-relaxed">{c}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6" style={{ borderTop: '1px solid #1e2040' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-xs tracking-widest text-gray-500 text-center mb-4">PRICING</div>
          <h2 className="text-3xl font-black text-center mb-4">Simple, honest pricing.</h2>
          <p className="text-gray-500 text-center text-sm mb-16 tracking-widest">
            BYOK — you pay for the platform, not the tokens. Bring your own Anthropic API key.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TIERS.map(tier => (
              <div key={tier.id} className="rounded-lg p-6 flex flex-col"
                style={{
                  background: tier.highlight ? '#0f1225' : '#0d0d1a',
                  border: `1px solid ${tier.highlight ? tier.color + '60' : '#1e2040'}`,
                  boxShadow: tier.highlight ? `0 0 40px ${tier.color}10` : 'none',
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
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">{tier.description}</p>
                <div className="space-y-3 mb-8 flex-1">
                  {tier.features.map(f => (
                    <div key={f} className="flex items-start gap-3">
                      <span className="text-xs mt-0.5 flex-shrink-0" style={{ color: tier.color }}>✓</span>
                      <span className="text-xs text-gray-400 leading-relaxed">{f}</span>
                    </div>
                  ))}
                </div>
                <BuyButton tierId={tier.id} color={tier.color} highlight={tier.highlight} />
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-600 mt-8 tracking-widest">
            All plans include a 14-day free trial. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6" style={{ borderTop: '1px solid #1e2040' }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-black mb-6" style={{ fontSize: 'clamp(32px, 6vw, 56px)', letterSpacing: '-1px' }}>
            Ready to run your business solo?
          </h2>
          <p className="text-gray-400 mb-10 text-sm leading-relaxed">
            Start your free trial today. No credit card. No setup fees.<br />
            Your AI workforce is ready in under 5 minutes.
          </p>
          {LAUNCH_MODE === 'live' ? (
            <Link href="/pricing" className="inline-block px-12 py-5 rounded-lg text-sm font-black tracking-widest"
              style={{ background: '#4fc3f7', color: '#080810' }}>
              START FOR FREE →
            </Link>
          ) : (
            <WaitlistForm />
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-8" style={{ borderTop: '1px solid #1e2040' }}>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm font-black tracking-widest">SYNQWORKS</div>
          <div className="text-xs text-gray-600 tracking-widest">© 2026 SYNQWORKS. ALL RIGHTS RESERVED.</div>
          <div className="flex gap-6">
            <Link href="/products" className="text-xs text-gray-600 hover:text-gray-400 tracking-widest">PRODUCTS</Link>
            <Link href="/download" className="text-xs text-gray-600 hover:text-gray-400 tracking-widest">DOWNLOAD</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
