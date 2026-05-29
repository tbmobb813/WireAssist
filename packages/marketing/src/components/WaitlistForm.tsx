'use client';
import { useState } from 'react';

export default function WaitlistForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === 'loading') return;
    setStatus('loading');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus('success');
        setMessage("You're on the list. We'll reach out when we launch.");
        setEmail('');
      } else {
        throw new Error('Failed');
      }
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Try again.');
    }
  };

  if (status === 'success') {
    return (
      <p className="text-xs tracking-widest" style={{ color: '#00ff9d' }}>
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={`flex ${compact ? 'flex-row gap-2' : 'flex-col sm:flex-row gap-3'} justify-center`}>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        className={`rounded-lg px-4 py-3 text-sm outline-none ${compact ? 'w-48' : 'w-full sm:w-72'}`}
        style={{ background: '#0d0d1a', border: '1px solid #1e2040', color: '#e2e8f0' }}
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="px-6 py-3 rounded-lg text-sm font-black tracking-widest transition-colors whitespace-nowrap"
        style={{ background: '#4fc3f7', color: '#080810' }}
      >
        {status === 'loading' ? '...' : 'JOIN WAITLIST →'}
      </button>
      {status === 'error' && (
        <p className="text-xs mt-1 w-full" style={{ color: '#ef4444' }}>{message}</p>
      )}
    </form>
  );
}
