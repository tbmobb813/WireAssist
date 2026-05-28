'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const QUESTIONS = [
  { key: 'business_description', label: 'What does your business do?', placeholder: 'e.g. I run a print-on-demand apparel brand selling on Etsy and my own site.' },
  { key: 'target_customers', label: 'Who are your target customers?', placeholder: 'e.g. Tech-savvy millennials who like minimalist streetwear.' },
  { key: 'products_services', label: 'What products or services do you offer?', placeholder: 'e.g. T-shirts, hoodies, and digital art prints.' },
  { key: 'platforms', label: 'What platforms do you sell or operate on?', placeholder: 'e.g. Etsy, Gumroad, Instagram, LinkedIn.' },
  { key: 'goals', label: 'What are your main business goals this year?', placeholder: 'e.g. Hit $5k/month revenue and grow Instagram to 10k followers.' },
  { key: 'challenges', label: 'What is your biggest challenge right now?', placeholder: 'e.g. Finding time to create content while fulfilling orders.' },
  { key: 'content_voice', label: 'How would you describe your content style and voice?', placeholder: 'e.g. Direct, educational, no corporate fluff. I post about the behind-the-scenes of running solo.' },
  { key: 'content_topics', label: 'What topics do you most want to post about?', placeholder: 'e.g. Product drops, workflow tips, lessons from running a one-person business.' },
  { key: 'key_contacts', label: 'Who are your most important clients, partners, or collaborators?', placeholder: 'e.g. My main supplier is PrintifyPro. I collaborate with @designer_x on product drops.' },
  { key: 'success_definition', label: 'What does a successful week look like for you?', placeholder: 'e.g. 3 orders fulfilled, 2 content posts published, inbox zero by Friday.' },
];

export default function OnboardingClient() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const current = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;
  const progress = ((step) / QUESTIONS.length) * 100;

  const handleNext = () => {
    if (!answers[current.key]?.trim()) return;
    if (isLast) {
      handleSubmit();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/memory/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Failed to save — is the API server running?');
        setSubmitting(false);
        return;
      }
      router.push('/');
    } catch {
      setError('Could not reach the API server. Start it with: pnpm dev:command-center');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="text-xs tracking-widest text-accent mb-2">SYNQWORKS // SETUP</div>
          <h1 className="text-3xl font-black">TELL YOUR AGENTS ABOUT YOUR BUSINESS</h1>
          <p className="text-gray-500 text-sm mt-3">
            Your answers are stored as long-term memory so every agent starts with full context.
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-gray-600 mb-2">
            <span>Question {step + 1} of {QUESTIONS.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1 rounded-full" style={{ background: '#1e2040' }}>
            <div
              className="h-1 rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: '#4fc3f7' }}
            />
          </div>
        </div>

        {/* Question card */}
        <div
          className="rounded-xl border p-8 mb-6"
          style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
        >
          <label className="block text-sm font-bold mb-4 text-white">{current.label}</label>
          <textarea
            autoFocus
            rows={4}
            value={answers[current.key] ?? ''}
            onChange={e => setAnswers(prev => ({ ...prev, [current.key]: e.target.value }))}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleNext();
            }}
            placeholder={current.placeholder}
            className="w-full rounded-lg px-4 py-3 text-sm outline-none resize-none"
            style={{
              background: '#060612',
              border: '1px solid #1e2040',
              color: '#e2e8f0',
            }}
          />
          <p className="text-xs text-gray-600 mt-2">⌘ + Enter to continue</p>
        </div>

        {error && (
          <div className="mb-4 text-xs text-red-400 border border-red-900 rounded px-4 py-3" style={{ background: '#1a0a0a' }}>
            {error}
          </div>
        )}

        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={submitting}
              className="px-5 py-3 rounded-lg text-xs tracking-widest border"
              style={{ borderColor: '#1e2040', color: '#475569' }}
            >
              ← BACK
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!answers[current.key]?.trim() || submitting}
            className="flex-1 py-3 rounded-lg text-xs font-bold tracking-widest transition-colors"
            style={{
              background: answers[current.key]?.trim() && !submitting ? '#4fc3f720' : '#1e2040',
              border: `1px solid ${answers[current.key]?.trim() && !submitting ? '#4fc3f740' : '#1e2040'}`,
              color: answers[current.key]?.trim() && !submitting ? '#4fc3f7' : '#475569',
            }}
          >
            {submitting ? 'SAVING...' : isLast ? 'FINISH SETUP →' : 'NEXT →'}
          </button>
        </div>

        {/* Skip link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-xs text-gray-600 hover:text-gray-400"
          >
            Skip for now — I&apos;ll set this up later
          </button>
        </div>
      </div>
    </div>
  );
}
