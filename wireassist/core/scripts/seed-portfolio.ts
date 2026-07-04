// One-time portfolio seed. Run: npx tsx scripts/seed-portfolio.ts [dbPath]
// Idempotent-ish: UNIQUE(name) makes re-runs fail loudly rather than duplicate.
import { PortfolioStore } from '../src/portfolio/store';

const db = process.argv[2] ?? './data/aia.db';
const store = new PortfolioStore(db);

async function main() {
  // ACTIVE (WIP limit = 2). Edit these two lines if the picks change.
  const wireassist = await store.createProject({
    name: 'WireAssist',
    lane: 'product',
    status: 'active',
    metadata: { repo: 'tbmobb813/WireAssist' },
  });
  await store.createProject({
    name: "Jennifer's HR App",
    lane: 'client',
    status: 'active',
    metadata: { stack: 'Next15/Tailwind4/Supabase/Tauri2' },
  });

  // PAUSED — each with a resume note so context survives the pause.
  const paused: Array<[string, string]> = [
    ['RiskForm', 'Options app in Dart; last state: HMM regime detection design'],
    ['PathWay', 'RN + MapLibre + Supabase/PostGIS; schema implemented, app WIP'],
    ['AccordFlow', 'Nine-service Turborepo; event-ledger pattern already reused in core'],
    ['SpecPilot', 'Tauri/Rust requirements checker'],
    ['UDP', 'Yjs collaborative editor; needs a "why" before more investment'],
    ['TrendWatch', 'Uptime SaaS; future Signals-zone data source'],
    ['TrendPost', 'Social automation; trendpost-mcp package lives in this repo'],
    ['TechBlueprint', 'Agent consulting; blocked on customer validation (5-10 freelancers)'],
    ['nestnYC', 'Affordable housing finder'],
  ];
  for (const [name, note] of paused) {
    await store.createProject({ name, lane: 'product', status: 'paused', resumeNote: note });
  }

  // CAREER lane — tracked as a project so focus/events apply to it too.
  await store.createProject({
    name: 'DC Tech -> Network Automation',
    lane: 'career',
    status: 'paused',
    resumeNote: 'Security+ via Professor Messer; DC tech applications; 12-18mo path',
  });

  // ICEBOX — concepts. Visible on click only.
  for (const name of [
    'blurapp',
    'Trend-Tracker',
    'GameTranslationTool',
    'Clarity-News',
    'ADHD-Focus-Music-App',
    'CodeConvertorDesktop',
    'Modstack',
    'LicenseRenewalTracker',
    'mintype.studio',
  ]) {
    await store.createProject({ name, lane: 'product', status: 'icebox' });
  }

  // Week 1 focus — the forcing function, pre-answered for this week only.
  await store.setWeeklyFocus({
    productProjectId: wireassist,
    careerMilestone: 'Pick 3 DC-tech postings and submit 1 application',
  });

  const t = await store.today();
  console.log(`Seeded. Week ${t.isoWeek}; active: ${t.active.map((p) => p.name).join(', ')}`);
  store.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
