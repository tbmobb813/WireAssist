import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const WAITLIST_AUDIENCE = process.env.RESEND_AUDIENCE_ID;

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email?: string };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    // Dev fallback — log and return success so the UI works without a key
    console.log('[waitlist] no RESEND_API_KEY set, skipping send. email:', email);
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
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[waitlist] resend error:', err);
    return NextResponse.json({ error: 'Failed to add to waitlist' }, { status: 500 });
  }
}
