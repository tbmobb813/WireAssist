import Link from 'next/link';

const PLATFORMS = [
  { name: 'Windows', icon: '🪟', arch: 'x64', ext: '.msi', note: 'Windows 10/11' },
  { name: 'Linux', icon: '🐧', arch: 'x64', ext: '.AppImage', note: 'Ubuntu, Fedora, Arch' },
  { name: 'Linux', icon: '🐧', arch: 'arm64', ext: '.AppImage', note: 'Raspberry Pi 4/5, ARM servers' },
];

const GH_RELEASES = 'https://github.com/tbmobb813/Linux-AI-Assistant---Project/releases/latest';

export default function DownloadPage() {
  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-8 py-5" style={{ borderBottom: '1px solid #1e2040' }}>
        <Link href="/" className="text-sm font-black tracking-widest">SYNQWORKS</Link>
        <Link href="/" className="text-xs text-gray-500 hover:text-accent tracking-widest transition-colors">← HOME</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-20">
        <div className="text-xs tracking-widest mb-4" style={{ color: '#4fc3f7' }}>DOWNLOAD</div>
        <h1 className="text-4xl font-black mb-4">Get SynqAgent.</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-12 max-w-xl">
          SynqAgent runs entirely on your machine. Your data never leaves your device.
          Download, install, add your Anthropic API key, and your workforce is ready in minutes.
        </p>

        <div className="space-y-4 mb-16">
          {PLATFORMS.map((p, i) => (
            <a key={i} href={GH_RELEASES}
              className="flex items-center justify-between rounded-lg p-5 transition-all hover:scale-[1.01] block"
              style={{ background: '#0d0d1a', border: '1px solid #1e2040' }}>
              <div className="flex items-center gap-4">
                <span className="text-2xl">{p.icon}</span>
                <div>
                  <div className="text-sm font-bold">{p.name} <span className="text-gray-500 font-normal">({p.arch})</span></div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.note}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs tracking-widest px-2 py-1 rounded"
                  style={{ background: '#4fc3f715', color: '#4fc3f7', border: '1px solid #4fc3f730' }}>
                  {p.ext}
                </span>
                <span className="text-xs text-gray-500">↓ DOWNLOAD</span>
              </div>
            </a>
          ))}
        </div>

        <div className="rounded-lg p-6 mb-8" style={{ background: '#0d0d1a', border: '1px solid #1e2040' }}>
          <div className="text-xs tracking-widest mb-4" style={{ color: '#ffb347' }}>SETUP IN 3 STEPS</div>
          {[
            { n: '1', text: 'Install SynqAgent and launch it.' },
            { n: '2', text: 'Open Settings → enter your Anthropic API key. Get one at console.anthropic.com.' },
            { n: '3', text: 'Enter your license key (from your LemonSqueezy purchase email) and click Activate.' },
          ].map(s => (
            <div key={s.n} className="flex items-start gap-4 mb-4 last:mb-0">
              <div className="text-lg font-black flex-shrink-0" style={{ color: '#ffb347' }}>{s.n}</div>
              <p className="text-sm text-gray-400 leading-relaxed pt-0.5">{s.text}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-600 leading-relaxed">
          macOS builds are coming soon (requires Apple Developer signing). In the meantime, macOS users can{' '}
          <a href="https://tauri.app/distribute/building/" className="underline hover:text-gray-400 transition-colors" target="_blank" rel="noopener noreferrer">
            build from source
          </a>.
        </p>
      </div>

      <footer className="py-8 px-8" style={{ borderTop: '1px solid #1e2040' }}>
        <div className="max-w-5xl mx-auto text-center text-xs text-gray-600 tracking-widest">
          © 2026 SYNQWORKS. ALL RIGHTS RESERVED.
        </div>
      </footer>
    </div>
  );
}
