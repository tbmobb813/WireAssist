'use client';
// Persistent navigation shell: a fixed left sidebar on desktop, a
// hamburger-triggered slide-out drawer on mobile (9 destinations is too many
// for a bottom tab bar). Wraps every route via layout.tsx, and owns
// min-h-screen once so individual pages don't need to redeclare it.
// /focus and /onboarding are chromeless — neither was designed with app nav
// in mind (the former is a mandatory redirect-gate, the latter a first-run
// flow), so both render bare with no sidebar/drawer.
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAgentEvents } from '@/hooks/useAgentEvents';

interface NavItem {
  href: string;
  label: string;
}

interface NavGroup {
  department: string;
  items: NavItem[];
}

// Departments, not individual agents, are the top-level nav concept — each
// agent-specific page lives inside the department it belongs to. "Overview"
// isn't a real department (nothing here is agent-specific), so it renders
// without the department-heading treatment the real departments get below.
const NAV_GROUPS: NavGroup[] = [
  {
    department: 'Overview',
    items: [
      { href: '/', label: 'Dashboard' },
      { href: '/objectives', label: 'Objectives' },
      { href: '/approvals', label: 'Approvals' },
      { href: '/chat', label: 'Chat' },
      { href: '/history', label: 'History' },
      { href: '/settings', label: 'Settings' },
    ],
  },
  {
    department: 'Administration',
    items: [{ href: '/admin', label: 'Admin' }],
  },
  {
    department: 'Marketing',
    items: [
      { href: '/content', label: 'Content' },
      { href: '/gtm', label: 'GTM' },
    ],
  },
  {
    department: 'Research',
    items: [{ href: '/research', label: 'Research' }],
  },
  {
    department: 'Engineering',
    items: [{ href: '/github', label: 'GitHub' }],
  },
  {
    department: 'Operations',
    items: [
      { href: '/ops', label: 'Ops' },
      { href: '/automations', label: 'Automations' },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

// The mobile hamburger used to be the only way to reach any of the 9
// destinations, and it sat at the hardest one-handed corner (fixed
// top-4 left-4). A bottom tab bar promotes the 3 pages JNix actually
// reaches for on his phone (Home, Approvals, Chat); everything else —
// Objectives, History, Settings, Admin, Content, GTM, Research, GitHub, Ops —
// still lives one tap away behind "More", which reuses the old drawer.
const MOBILE_PRIMARY_TABS: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/chat', label: 'Chat' },
];

const MOBILE_PRIMARY_HREFS = new Set(MOBILE_PRIMARY_TABS.map((t) => t.href));

// "More" drawer only needs the destinations not already promoted to a
// tab — otherwise Home/Approvals/Chat would appear twice on mobile.
const MORE_NAV_GROUPS: NavGroup[] = NAV_GROUPS.map((group) => ({
  department: group.department,
  items: group.items.filter((item) => !MOBILE_PRIMARY_HREFS.has(item.href)),
})).filter((group) => group.items.length > 0);

// How many nav items the desktop sidebar shows before tucking the rest
// behind a toggle. Groups are never split, so this lands on a group boundary
// (Overview is exactly this many items today).
const VISIBLE_NAV_ITEMS = 6;
const NAV_OPEN_KEY = 'wireassist.nav.departmentsOpen';

function NavGroupBlock({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {group.department !== 'Overview' && (
        // text-gray-600 (#4b5563) against this sidebar's #0d0d1a
        // background computes to ~2.4:1 — well under WCAG AA's 4.5:1
        // minimum for normal text. text-gray-400 (#9ca3af) computes to
        // ~7.6:1 against the same background.
        <div className="px-3 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
          {group.department}
        </div>
      )}
      {group.items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`rounded-lg px-3 py-2 text-sm tracking-wide transition-colors ${
              active ? 'bg-accent/10 text-accent' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function NavLinks({
  pathname,
  onNavigate,
  groups = NAV_GROUPS,
  collapseAfter,
}: {
  pathname: string;
  onNavigate?: () => void;
  groups?: NavGroup[];
  // When set, groups past this many items sit behind a "Departments" toggle.
  collapseAfter?: number;
}) {
  let shownItems = 0;
  let splitAt = groups.length;
  if (collapseAfter !== undefined) {
    splitAt = 0;
    for (const group of groups) {
      if (splitAt > 0 && shownItems >= collapseAfter) break;
      shownItems += group.items.length;
      splitAt += 1;
    }
  }
  const visible = groups.slice(0, splitAt);
  const hidden = groups.slice(splitAt);
  const hiddenCount = hidden.reduce((n, g) => n + g.items.length, 0);
  const activeInHidden = hidden.some((g) => g.items.some((i) => isActive(pathname, i.href)));

  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(NAV_OPEN_KEY) === '1') setOpen(true);
    } catch {
      // storage can be blocked; the toggle still works for this visit
    }
  }, []);
  // Never hide the page you're on, whatever the saved preference says.
  const expanded = open || activeInHidden;

  const toggle = () => {
    const next = !expanded;
    setOpen(next);
    try {
      window.localStorage.setItem(NAV_OPEN_KEY, next ? '1' : '0');
    } catch {
      // see above
    }
  };

  return (
    <nav className="flex flex-col gap-4">
      {visible.map((group) => (
        <NavGroupBlock
          key={group.department}
          group={group}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ))}
      {hidden.length > 0 && (
        <>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={expanded}
            // Can't collapse while you're standing on a page inside it.
            disabled={activeInHidden}
            className="flex items-center justify-between rounded-lg px-3 py-2 text-sm tracking-wide text-gray-400 hover:text-gray-200 disabled:cursor-default disabled:hover:text-gray-400"
          >
            <span>Departments ({hiddenCount})</span>
            <span aria-hidden>{expanded ? '▾' : '▸'}</span>
          </button>
          {expanded &&
            hidden.map((group) => (
              <NavGroupBlock
                key={group.department}
                group={group}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
        </>
      )}
    </nav>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  const fetchApprovalCount = useCallback(async () => {
    try {
      const res = await fetch('/api/approvals');
      const data = await res.json();
      setPendingApprovals(Array.isArray(data) ? data.length : 0);
    } catch {
      // badge just stays at its last known value — not worth surfacing
      // an error for a nav-chrome count
    }
  }, []);

  useEffect(() => {
    fetchApprovalCount();
  }, [fetchApprovalCount]);

  useAgentEvents(
    useCallback(
      (e) => {
        if (e.event === 'waiting_approval' || e.event === 'approval_resolved') {
          fetchApprovalCount();
        }
      },
      [fetchApprovalCount]
    )
  );

  if (pathname === '/focus' || pathname === '/onboarding') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col gap-6 p-4 border-r bg-surface border-border">
        <div className="px-2 pt-2">
          <div className="text-xs tracking-widest text-accent">WIREASSIST</div>
          <div className="text-sm font-bold">Command Center</div>
        </div>
        <NavLinks pathname={pathname} collapseAfter={VISIBLE_NAV_ITEMS} />
      </aside>

      {/* Mobile "More" drawer — holds everything not promoted to a
          bottom-tab destination. Same drawer as before, just opened
          from the tab bar instead of a top-left hamburger. */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 p-4 flex flex-col gap-6 border-r bg-surface border-border">
            <div className="flex items-center justify-between px-2 pt-2">
              <div>
                <div className="text-xs tracking-widest text-accent">WIREASSIST</div>
                <div className="text-sm font-bold">Command Center</div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-gray-500 hover:text-gray-300"
                aria-label="Close navigation"
              >
                ✕
              </button>
            </div>
            <NavLinks
              pathname={pathname}
              onNavigate={() => setDrawerOpen(false)}
              groups={MORE_NAV_GROUPS}
            />
          </div>
        </div>
      )}

      {/* pb-20 reserves room for the fixed bottom tab bar below so the
          last bit of page content isn't hidden behind it on mobile. */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>

      {/* Mobile bottom tab bar — replaces the old top-left hamburger.
          Thumb-reachable, and the Approvals badge surfaces the pending
          count without needing to open the page. */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t bg-surface border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {MOBILE_PRIMARY_TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
                active ? 'text-accent' : 'text-gray-500'
              }`}
            >
              {tab.label}
              {tab.href === '/approvals' && pendingApprovals > 0 && (
                <span
                  className="absolute top-1 right-1/4 min-w-[16px] h-4 px-1 rounded-full text-[10px] leading-4 text-center font-bold"
                  style={{ background: '#ffb347', color: '#0d0d1a' }}
                >
                  {pendingApprovals}
                </span>
              )}
            </Link>
          );
        })}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium text-gray-500"
          aria-label="Open more navigation"
        >
          More
        </button>
      </nav>
    </div>
  );
}
