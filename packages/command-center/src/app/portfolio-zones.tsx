'use client';

// Zones 1–2 of the command center: Today (weekly focus + active) and Pipelines
// (active / paused / icebox with store-enforced WIP transitions).
// The gate: if this week's focus is unset, hard-redirect to /focus.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import NewProjectForm from './new-project-form';

interface GithubRepo {
  fullName: string;
  name: string;
  url: string;
}

interface Project {
  id: string;
  name: string;
  lane: string;
  status: 'active' | 'paused' | 'icebox' | 'done';
  resumeNote: string | null;
  metadata?: { githubRepo?: { fullName: string; url: string } } | null;
}

interface Today {
  isoWeek: string;
  focus: { productProjectId: string; careerMilestone: string } | null;
  active: Project[];
}

export default function PortfolioZones() {
  const router = useRouter();
  const [today, setToday] = useState<Today | null>(null);
  const [paused, setPaused] = useState<Project[]>([]);
  const [icebox, setIcebox] = useState<Project[]>([]);
  const [showIcebox, setShowIcebox] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repos, setRepos] = useState<GithubRepo[]>([]);

  const refresh = useCallback(async () => {
    const [t, p, i] = await Promise.all([
      fetch('/api/portfolio/today').then((r) => r.json()),
      fetch('/api/portfolio/projects?status=paused').then((r) => r.json()),
      fetch('/api/portfolio/projects?status=icebox').then((r) => r.json()),
    ]);
    if (!t.focus) {
      router.replace('/focus'); // The Sunday gate. No focus, no dashboard.
      return;
    }
    setToday(t);
    setPaused(p.projects ?? []);
    setIcebox(i.projects ?? []);
  }, [router]);

  useEffect(() => {
    refresh().catch(() => setError('Portfolio API unreachable'));
    fetch('/api/github/repos')
      .then((r) => (r.ok ? r.json() : { repos: [] }))
      .then((body) => setRepos(body.repos ?? []))
      .catch(() => setRepos([]));
  }, [refresh]);

  async function linkRepo(projectId: string, fullName: string) {
    const repo = repos.find((r) => r.fullName === fullName);
    if (!repo) return;
    const res = await fetch(`/api/portfolio/projects/${projectId}/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ githubRepo: { fullName: repo.fullName, url: repo.url } }),
    });
    if (res.ok) await refresh();
  }

  async function transition(id: string, to: Project['status']) {
    setError(null);
    const res = await fetch(`/api/portfolio/projects/${id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `Transition to ${to} failed`);
      return;
    }
    await refresh();
  }

  if (error) return <p className="p-6 text-sm text-red-400">{error}</p>;
  if (!today) return <p className="p-6 text-sm opacity-60">Loading portfolio…</p>;

  const focusProject = today.active.find((p) => p.id === today.focus?.productProjectId);

  return (
    <div className="space-y-8">
      {/* ── Zone 1: Today ── */}
      <section className="rounded border border-white/20 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">This week — {today.isoWeek}</h2>
          <a href="/focus" className="text-xs opacity-60 hover:opacity-100">
            change focus
          </a>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide opacity-60">Product</p>
            <p className="mt-1 text-xl">{focusProject?.name ?? '—'}</p>
          </div>
          <div className="rounded bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide opacity-60">Career</p>
            <p className="mt-1 text-xl">{today.focus?.careerMilestone}</p>
          </div>
        </div>
      </section>

      {/* ── Zone 2: Pipelines ── */}
      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm uppercase tracking-wide opacity-60">
            Active ({today.active.length}/2)
          </h3>
          <NewProjectForm onCreated={refresh} />
        </div>
        <div className="mt-2 space-y-2">
          {today.active.map((p) => (
            <Row key={p.id} p={p} repos={repos} onLinkRepo={linkRepo}>
              <Btn onClick={() => transition(p.id, 'paused')}>Pause</Btn>
              <Btn onClick={() => transition(p.id, 'done')}>Done</Btn>
            </Row>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm uppercase tracking-wide opacity-60">Paused ({paused.length})</h3>
        <div className="mt-2 space-y-2">
          {paused.map((p) => (
            <Row key={p.id} p={p} repos={repos} onLinkRepo={linkRepo}>
              <Btn onClick={() => transition(p.id, 'active')}>Activate</Btn>
              <Btn onClick={() => transition(p.id, 'icebox')}>Icebox</Btn>
            </Row>
          ))}
        </div>
      </section>

      <section>
        <button
          onClick={() => setShowIcebox((s) => !s)}
          className="text-sm opacity-50 hover:opacity-100"
        >
          {showIcebox ? '▾' : '▸'} Icebox ({icebox.length})
        </button>
        {showIcebox && (
          <div className="mt-2 space-y-2">
            {icebox.map((p) => (
              <Row key={p.id} p={p} repos={repos} onLinkRepo={linkRepo} dim>
                <Btn onClick={() => transition(p.id, 'paused')}>Wake</Btn>
              </Row>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Row({
  p,
  dim,
  children,
  repos,
  onLinkRepo,
}: {
  p: Project;
  dim?: boolean;
  children: ReactNode;
  repos: GithubRepo[];
  onLinkRepo: (projectId: string, fullName: string) => void;
}) {
  const repo = p.metadata?.githubRepo;
  return (
    <div
      className={`flex items-center justify-between rounded border border-white/10 p-3 ${
        dim ? 'opacity-50' : ''
      }`}
    >
      <span>
        {p.name} <span className="text-xs opacity-50">({p.lane})</span>
        {p.resumeNote && <span className="block text-xs opacity-50">{p.resumeNote}</span>}
        {repo ? (
          <a
            href={repo.url}
            target="_blank"
            rel="noreferrer"
            className="block text-xs opacity-60 hover:opacity-100"
          >
            ↗ {repo.fullName}
          </a>
        ) : (
          repos.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => e.target.value && onLinkRepo(p.id, e.target.value)}
              className="mt-1 rounded border border-white/20 bg-transparent p-1 text-xs opacity-70 outline-none focus:border-white"
            >
              <option value="" className="bg-black">
                Link GitHub repo…
              </option>
              {repos.map((r) => (
                <option key={r.fullName} value={r.fullName} className="bg-black">
                  {r.fullName}
                </option>
              ))}
            </select>
          )
        )}
      </span>
      <span className="flex gap-2">{children}</span>
    </div>
  );
}

function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded border border-white/30 px-3 py-1 text-xs hover:bg-white/10"
    >
      {children}
    </button>
  );
}
