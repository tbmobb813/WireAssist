// Read-only pull from the lead-capture-service's Supabase `leads` table
// (see ATS-Resume Suite/lead-capture-service/README.md — email capture +
// drip sequence for the free Grounded Resume Checker extension). Deliberately
// NOT using the Supabase JS client or a real-time subscription — this is one
// cheap PostgREST GET a day, so a raw fetch avoids a new dependency for a
// single call.
//
// SUPABASE_URL / SUPABASE_ANON_KEY here must NOT be the service_role key
// lead-capture-service's own backend uses (that bypasses Row Level
// Security entirely) — this needs its own read-only path:
//   1. In the Supabase dashboard for this project, enable RLS on `leads`
//      (Table Editor -> leads -> RLS) if not already on.
//   2. Add a SELECT-only policy for the `anon` role (e.g. USING (true) —
//      the leads table holds only email/source/sequence state, not
//      anything more sensitive, but scope the policy tighter if that
//      changes later).
//   3. Copy the project's anon/public key (Project Settings -> API) into
//      SUPABASE_ANON_KEY — never the secret/service_role key.
// See docs/DEPLOYMENT.md's "Real post metrics" section neighbor for the
// full write-up. Without RLS + a SELECT policy, the anon key can read
// (or worse, without RLS at all, write) far more than intended.
const REQUIRED_VARS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] as const;

export async function fetchLeadSignupCount(sinceISO: string): Promise<number> {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing Supabase credentials: ${missing.join(', ')}. Set them in .env — see ` +
        `docs/DEPLOYMENT.md's scoreboard section.`
    );
  }

  const url = new URL('/rest/v1/leads', process.env.SUPABASE_URL);
  url.searchParams.set('select', 'id');
  url.searchParams.set('created_at', `gte.${sinceISO}`);

  const res = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      // Returns just the count in Content-Range, not the full row set —
      // cheaper than fetching every lead's data just to count them.
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });

  if (!res.ok) {
    throw new Error(
      `Supabase leads query failed (${res.status}): ${await res.text()} — check RLS/SELECT ` +
        'policy on the leads table and that SUPABASE_ANON_KEY is the anon key, not service_role.'
    );
  }

  // e.g. "0-0/42" — the total after the slash is what count=exact returns.
  const contentRange = res.headers.get('content-range');
  const total = contentRange?.split('/')[1];
  if (!total || total === '*') {
    throw new Error('Supabase did not return a count (missing Content-Range header).');
  }
  return Number(total);
}
