import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

// Same WIREASSIST_HOME/homedir()/~/.wireassist convention as
// packages/agents/ops/src/trust-stage.ts's ops-trust.json and
// wireassist/core/src/context/business-profile.ts.
function filePath(): string {
  const base = process.env.WIREASSIST_HOME ?? homedir();
  return (
    process.env.WIREASSIST_AUTOMATION_RUNS_FILE ?? join(base, '.wireassist', 'automation-runs.json')
  );
}

export interface AutomationRun {
  lastRunAt: string;
  status: 'ok' | 'error';
  detail?: string;
}

function readAll(): Record<string, AutomationRun> {
  const path = filePath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, AutomationRun>;
  } catch {
    return {};
  }
}

export function recordAutomationRun(job: string, run: Omit<AutomationRun, 'lastRunAt'>): void {
  const all = readAll();
  all[job] = { ...run, lastRunAt: new Date().toISOString() };
  const path = filePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(all, null, 2));
}

export function getAutomationRun(job: string): AutomationRun | undefined {
  return readAll()[job];
}

// The full list of cron-driven agent automations — deliberately excludes
// dev/backup.sh (infra, not an agent task) and dev/smoke.sh/smoke_api.sh
// (CI checks, never actually scheduled via cron). Schedules copied
// verbatim from the crontab lines documented in docs/DEPLOYMENT.md — this
// list and that doc must be kept in sync by hand, same as the 1:1 mapping
// between a skill's task-factory entry and its server.ts route already is.
export interface AutomationDef {
  job: string;
  label: string;
  agentRole: string;
  schedule: string;
  script: string;
}

export const AUTOMATION_REGISTRY: AutomationDef[] = [
  {
    job: 'auto-publish',
    label: 'Publish due posts',
    agentRole: 'content',
    schedule: '*/5 * * * *',
    script: 'dev/auto-publish.sh',
  },
  {
    job: 'heartbeat',
    label: 'Heartbeat (stage-4 ops workflows)',
    agentRole: 'ops',
    schedule: '0 * * * *',
    script: 'dev/heartbeat.sh',
  },
  {
    job: 'check-post-metrics',
    label: 'Check post metrics',
    agentRole: 'content',
    schedule: '0 * * * *',
    script: 'dev/check-post-metrics.sh',
  },
  {
    job: 'meeting-prep',
    label: 'Meeting prep',
    agentRole: 'admin',
    schedule: '*/30 * * * *',
    script: 'dev/meeting-prep.sh',
  },
  {
    job: 'meeting-followup',
    label: 'Meeting follow-up',
    agentRole: 'admin',
    schedule: '*/30 * * * *',
    script: 'dev/meeting-followup.sh',
  },
  {
    job: 'daily-briefing',
    label: 'Daily briefing',
    agentRole: 'admin',
    schedule: '0 7 * * *',
    script: 'dev/daily-briefing.sh',
  },
  {
    job: 'travel-itinerary',
    label: 'Travel itinerary digest',
    agentRole: 'admin',
    schedule: '0 7 * * *',
    script: 'dev/travel-itinerary.sh',
  },
  {
    job: 'budget-warning',
    label: 'Budget warning',
    agentRole: 'admin',
    schedule: '0 9 * * *',
    script: 'dev/budget-warning.sh',
  },
  {
    job: 'stale-approvals',
    label: 'Stale approvals nudge',
    agentRole: 'admin',
    schedule: '0 9 * * *',
    script: 'dev/stale-approvals.sh',
  },
  {
    job: 'stale-prs',
    label: 'Stale PR nudge',
    agentRole: 'github',
    schedule: '0 9 * * *',
    script: 'dev/stale-prs.sh',
  },
  {
    job: 'proactive-insights',
    label: 'Proactive insights',
    agentRole: 'admin',
    schedule: '0 8 * * 1',
    script: 'dev/proactive-insights.sh',
  },
  {
    job: 'trust-graduation-nudges',
    label: 'Trust graduation nudges',
    agentRole: 'ops',
    schedule: '0 8 * * 1',
    script: 'dev/trust-graduation-nudges.sh',
  },
  {
    job: 'objective-health-check',
    label: 'Objective health check',
    agentRole: 'admin',
    schedule: '0 8 * * 1',
    script: 'dev/objective-health-check.sh',
  },
  {
    job: 'detect-skill-opportunities',
    label: 'Detect skill opportunities',
    agentRole: 'admin',
    schedule: '0 8 * * 2',
    script: 'dev/detect-skill-opportunities.sh',
  },
  {
    job: 'content-retro',
    label: 'Content performance retro',
    agentRole: 'content',
    schedule: '0 8 1 * *',
    script: 'dev/content-retro.sh',
  },
  {
    job: 'expense-digest',
    label: 'Expense digest',
    agentRole: 'admin',
    schedule: '0 8 2 * *',
    script: 'dev/expense-digest.sh',
  },
  {
    job: 'sync-scoreboard-metrics',
    label: 'Sync content scoreboard metrics',
    agentRole: 'content',
    schedule: '0 6 * * *',
    script: 'dev/sync-scoreboard-metrics.sh',
  },
  {
    job: 'sync-lead-signups',
    label: 'Sync lead signups',
    agentRole: 'admin',
    schedule: '0 6 * * *',
    script: 'dev/sync-lead-signups.sh',
  },
  {
    job: 'scoreboard-digest',
    label: 'Weekly scoreboard digest',
    agentRole: 'admin',
    schedule: '0 8 * * 1',
    script: 'dev/scoreboard-digest.sh',
  },
];

const VALID_JOBS = new Set(AUTOMATION_REGISTRY.map((a) => a.job));
export function isValidAutomationJob(job: string): boolean {
  return VALID_JOBS.has(job);
}

// Brute-force minute-by-minute search rather than a general cron-expression
// library — every schedule in AUTOMATION_REGISTRY is one of a handful of
// shapes (*/N, a fixed hour daily/weekly/monthly), so a full parser would
// be solving a much more general problem than this actually has. Capped at
// ~13 months out so a malformed expression can't spin forever; every real
// schedule here resolves in well under a second.
function matchesField(value: number, field: string): boolean {
  if (field === '*') return true;
  if (field.startsWith('*/')) return value % Number(field.slice(2)) === 0;
  return value === Number(field);
}

export function computeNextRun(cronExpr: string, from: Date = new Date()): Date | null {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minField, hourField, domField, , dowField] = parts;

  const candidate = new Date(from.getTime());
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  const maxIterations = 60 * 24 * 400; // ~400 days of minutes
  for (let i = 0; i < maxIterations; i++) {
    if (
      matchesField(candidate.getMinutes(), minField) &&
      matchesField(candidate.getHours(), hourField) &&
      matchesField(candidate.getDate(), domField) &&
      matchesField(candidate.getDay(), dowField)
    ) {
      return candidate;
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }
  return null;
}
