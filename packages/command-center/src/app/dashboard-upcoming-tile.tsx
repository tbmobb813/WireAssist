'use client';
import Link from 'next/link';

interface UpcomingEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
}

function formatEventWhen(iso: string): string {
  const d = new Date(iso);
  const isAllDay = !iso.includes('T');
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const time = isAllDay
    ? 'All day'
    : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) return time;
  if (isTomorrow) return `Tomorrow ${isAllDay ? '' : time}`.trim();
  return `${d.toLocaleDateString([], { weekday: 'short' })} ${isAllDay ? '' : time}`.trim();
}

export default function DashboardUpcomingTile({
  calendarReady,
  calendarEvents,
}: {
  calendarReady: boolean | null;
  calendarEvents: UpcomingEvent[];
}) {
  return (
    <div
      className="md:col-span-2 rounded-2xl border p-5"
      style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-gray-300">Upcoming</div>
        <Link href="/onboarding" className="text-xs text-gray-600 hover:text-accent">
          {calendarReady === false ? 'connect calendar' : ''}
        </Link>
      </div>
      {calendarReady === null ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : calendarReady === false ? (
        <p className="text-sm text-gray-600">
          Connect Google Calendar in Setup to see what&apos;s next here.
        </p>
      ) : calendarEvents.length === 0 ? (
        <p className="text-sm text-gray-600">Nothing on the calendar in the next 7 days.</p>
      ) : (
        <div className="space-y-3">
          {calendarEvents.map((e) => (
            <div key={e.id} className="flex items-start gap-3">
              <div className="text-xs text-accent font-mono w-16 flex-shrink-0 pt-0.5">
                {formatEventWhen(e.start)}
              </div>
              <div className="text-sm text-gray-200 leading-snug">{e.summary}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
