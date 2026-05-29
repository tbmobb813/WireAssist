import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const WAITLIST_AUDIENCE = process.env.RESEND_AUDIENCE_ID;

// In-memory rate limiter: max 3 submissions per IP per 10 minutes, 1 per email ever
const ipHits = new Map<string, { count: number; resetAt: number }>();
const seenEmails = new Set<string>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 3;

function checkRateLimit(ip: string, email: string): 'ok' | 'ip' | 'duplicate' {
  if (seenEmails.has(email)) return 'duplicate';

  const now = Date.now();
  const hit = ipHits.get(ip);
  if (!hit || now > hit.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return 'ok';
  }
  if (hit.count >= MAX_PER_IP) return 'ip';
  hit.count++;
  return 'ok';
}

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email?: string };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limit = checkRateLimit(ip, email.toLowerCase());

  if (limit === 'ip') {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  // Return 200 for duplicates so the UI shows success without leaking whether an email is registered
  if (limit === 'duplicate') {
    return NextResponse.json({ ok: true });
  }

  if (!process.env.RESEND_API_KEY) {
    // Dev fallback — log and return success so the UI works without a key
    console.log('[waitlist] no RESEND_API_KEY set, skipping send. email:', email);
    seenEmails.add(email.toLowerCase());
    return NextResponse.json({ ok: true });
  }

  try {
    if (WAITLIST_AUDIENCE) {
      await resend.contacts.create({ email, audienceId: WAITLIST_AUDIENCE });
    } else {
      await resend.emails.send({
        from: 'SynqWorks <waitlist@synqworks.techtrendwire.com>',
        to: email,
        subject: "You're on the SynqWorks waitlist",
        text: `Hey,\n\nYou're on the SynqWorks waitlist. We'll reach out when we launch.\n\n— The SynqWorks Team`,
      });
    }
    seenEmails.add(email.toLowerCase());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[waitlist] resend error:', err);
    return NextResponse.json({ error: 'Failed to add to waitlist' }, { status: 500 });
  }
}
