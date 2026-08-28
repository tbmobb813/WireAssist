// Imports the idea-engine portfolio todo list into WireAssist's Command
// Center via the real Objective/Kanban REST API (objective-routes.ts).
// Deliberately bypasses the admin agent's tool-loop (capped at 6-12
// iterations) -- this is plain data entry, not something that needs
// agent reasoning, so it goes straight through the API instead.
//
// Folds cards into EXISTING objectives where one already matches
// (checked live against /api/objectives before writing this), and only
// creates new objectives for products with no existing home.
//
// Usage: COMMAND_CENTER_URL=http://100.71.202.102:3001 node scripts/import-portfolio-todos.mjs

const BASE = process.env.COMMAND_CENTER_URL || 'http://100.71.202.102:3001';

// Existing objective, confirmed live via GET /api/objectives before writing this.
const EXISTING_SEALED_OBJECTIVE_ID = 'd418e0ce96d439a69bcb7499c3e8e534';
const EXISTING_SEALED_CARDS = [
  'Send the "run your next real client project through Sealed for real, I\'ll cover platform fees" message to an existing comped user.',
  'Reconstruct payment-reliability-ledger profiles for 3-5 freelancers from their invoices, then run the interview script on whether an accumulating track record is a reason to stay.',
];

const NEW_OBJECTIVES = [
  {
    title: 'BAA-Sentinel: first customer',
    description: 'Site is fixed and live (Clerk keys + Prisma migrations resolved 2026-08-27). Real Stripe tiers coded, never tested against a buyer.',
    cards: [
      'Outreach to 10-15 healthcare-adjacent consultants offering free 60-day access for a real BAA-tracking case study.',
    ],
  },
  {
    title: 'StackWatch: beta launch',
    description: 'Self-serve status-page permission bug fixed and merged to main (2026-08-27). Product is ready.',
    cards: [
      'Post the free-lifetime-Team-tier beta offer to r/webdev / r/SaaS / Show HN.',
      'Confirm RESEND_API_KEY is a real, valid key in production Railway env.',
      'Check the Supabase egress graph dropped after the serverless/interval fix.',
      'Review the 137 Dependabot vulnerabilities (1 critical, 46 high) on GitHub.',
      'Fix the two leftover .env.example files still saying "StatusWatch" for full rebrand consistency.',
    ],
  },
  {
    title: 'RiskForm: r/thetagang launch',
    description: 'Live deployment confirmed working. Sign-up/sign-in UI just shipped -- this is the launch the repo\'s own roadmap already planned.',
    cards: [
      'Post the drafted r/thetagang copy (free simulator, asking real options traders for feedback, not selling anything).',
    ],
  },
  {
    title: 'TrendSignal: differentiator test',
    description: 'Corrected audit found the execution-fit scoring is a real, unclaimed differentiator per the repo\'s own roadmap -- never actually tested against real creators.',
    cards: [
      'Post + DM outreach in r/NewTubers / r/PartTimeYoutuber testing whether the execution-fit gap is real.',
    ],
  },
  {
    title: 'Prism: audience-narrowing RAT',
    description: 'Earliest-stage item on this list -- nothing built yet, just testing whether game devs/3D artists would want this.',
    cards: [
      'Run the audience-narrowing RAT: post + DM outreach in r/gamedev, r/3Dmodeling, engine Discords.',
    ],
  },
];

async function addCard(objectiveId, text) {
  const res = await fetch(`${BASE}/api/objectives/${objectiveId}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    console.error(`  Failed to add card "${text.slice(0, 40)}...":`, await res.text());
    return;
  }
  console.log(`  + ${text.slice(0, 70)}...`);
}

async function main() {
  console.log(`Adding to existing "Sealed: Customer retention" (${EXISTING_SEALED_OBJECTIVE_ID})`);
  for (const text of EXISTING_SEALED_CARDS) {
    await addCard(EXISTING_SEALED_OBJECTIVE_ID, text);
  }

  for (const obj of NEW_OBJECTIVES) {
    const createRes = await fetch(`${BASE}/api/objectives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: obj.title, description: obj.description }),
    });
    if (!createRes.ok) {
      console.error(`Failed to create objective "${obj.title}":`, await createRes.text());
      continue;
    }
    const { id } = await createRes.json();
    console.log(`Created objective "${obj.title}" (${id})`);
    for (const text of obj.cards) {
      await addCard(id, text);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
