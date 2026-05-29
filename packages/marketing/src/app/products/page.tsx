import Link from 'next/link';

const PRODUCTS = [
  {
    name: 'SYNQAGENT',
    tagline: 'Your AI workforce. Desktop-native.',
    description: 'Manage your inbox, calendar, and content pipeline with a team of AI agents that work for you — not the other way around. Local-first, BYOK, human-in-the-loop.',
    color: '#4fc3f7',
    status: 'AVAILABLE NOW',
    href: '/',
    icon: '🤖',
  },
  {
    name: 'SYNQPOST',
    tagline: 'Content scheduling, amplified by AI.',
    description: 'Generate, schedule, and publish content across every platform from a single calendar. The Content Agent writes; you approve.',
    color: '#ffb347',
    status: 'INCLUDED IN OPERATOR+',
    href: '/#pricing',
    icon: '✍️',
  },
  {
    name: 'SYNQMIND',
    tagline: 'Your second brain, searchable.',
    description: 'Semantic memory for everything you learn and decide. Agents surface the right context at the right time. No more forgetting what you already figured out.',
    color: '#00ff9d',
    status: 'COMING SOON',
    href: '#',
    icon: '🧠',
  },
  {
    name: 'STATUSWATCH',
    tagline: 'Know before your customers do.',
    description: 'Uptime monitoring and status pages for solo operators. Get alerted before something breaks and publish a professional status page in minutes.',
    color: '#c084fc',
    status: 'COMING SOON',
    href: '#',
    icon: '📡',
  },
];

export default function ProductsPage() {
  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-8 py-5" style={{ borderBottom: '1px solid #1e2040' }}>
        <Link href="/" className="text-sm font-black tracking-widest">SYNQWORKS</Link>
        <Link href="/" className="text-xs text-gray-500 hover:text-accent tracking-widest transition-colors">← HOME</Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-xs tracking-widest mb-4" style={{ color: '#4fc3f7' }}>SYNQWORKS PRODUCTS</div>
        <h1 className="text-4xl font-black mb-4">AI tools for solo operators.</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-16 max-w-xl">
          Every SynqWorks product is built on the same principle: you stay in control. Agents propose. You decide. Nothing happens without your approval.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PRODUCTS.map(p => (
            <Link key={p.name} href={p.href}
              className="rounded-lg p-6 block transition-all hover:scale-[1.01]"
              style={{ background: '#0d0d1a', border: `1px solid ${p.color}30`, borderTop: `3px solid ${p.color}` }}>
              <div className="text-2xl mb-3">{p.icon}</div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs tracking-widest font-bold" style={{ color: p.color }}>{p.name}</div>
                <div className="text-xs tracking-widest px-2 py-0.5 rounded"
                  style={{ color: p.color, background: p.color + '15', border: `1px solid ${p.color}30` }}>
                  {p.status}
                </div>
              </div>
              <div className="text-sm font-bold mb-3">{p.tagline}</div>
              <p className="text-xs text-gray-500 leading-relaxed">{p.description}</p>
            </Link>
          ))}
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
