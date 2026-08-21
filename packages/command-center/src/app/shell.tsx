'use client';
// Persistent navigation shell: a fixed left sidebar on desktop, a
// hamburger-triggered slide-out drawer on mobile (9 destinations is too many
// for a bottom tab bar). Wraps every route via layout.tsx, and owns
// min-h-screen once so individual pages don't need to redeclare it.
// /focus and /onboarding are chromeless — neither was designed with app nav
// in mind (the former is a mandatory redirect-gate, the latter a first-run
// flow), so both render bare with no sidebar/drawer.
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
      { href: '/memory', label: 'Memory' },
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
    items: [{ href: '/ops', label: 'Ops' }],
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.department} className="flex flex-col gap-1">
          {group.department !== 'Overview' && (
            <div className="px-3 text-[10px] font-semibold tracking-widest text-gray-600 uppercase">
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
      ))}
    </nav>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

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
        <NavLinks pathname={pathname} />
      </aside>

      {/* Mobile hamburger */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 rounded-lg p-2 border bg-surface border-border"
        aria-label="Open navigation"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M2 4h14M2 9h14M2 14h14"
            stroke="#e2e8f0"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Mobile drawer */}
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
            <NavLinks pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
