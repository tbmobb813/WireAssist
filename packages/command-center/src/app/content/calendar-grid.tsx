'use client';
import { useState } from 'react';
import type { CalendarItem } from './types';
import { platformColor } from './types';

export type CalendarGridMode = 'week' | '2week' | 'month';

interface CalendarGridProps {
  mode: CalendarGridMode;
  items: CalendarItem[];
  onMarkPublished: (postId: string) => void;
  actingId: string | null;
  campaignName: (id?: string) => string | undefined;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

// Sunday-start week, matching the grid's day-of-week column order below.
function startOfWeek(d: Date): Date {
  const out = startOfDay(d);
  out.setDate(out.getDate() - out.getDay());
  return out;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE_PER_DAY = 3;

// Renders scheduled posts/ideas as an actual grid (week / 2-week / month),
// not the date-headered agenda list already elsewhere on this page — the
// two views serve different questions ("what's the shape of my week" vs.
// "what's next"), so this is additive, not a replacement.
export function CalendarGrid({
  mode,
  items,
  onMarkPublished,
  actingId,
  campaignName,
}: CalendarGridProps) {
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));

  const rangeStart =
    mode === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth(), 1) : startOfWeek(anchor);
  const gridStart = mode === 'month' ? startOfWeek(rangeStart) : rangeStart;
  const dayCount = mode === 'week' ? 7 : mode === '2week' ? 14 : 42; // month = fixed 6-week grid
  const days = Array.from({ length: dayCount }, (_, i) => addDays(gridStart, i));

  const today = startOfDay(new Date());

  const itemsForDay = (day: Date) => items.filter((item) => isSameDay(item.date, day));

  const step = mode === 'week' ? 7 : mode === '2week' ? 14 : 1;
  const stepUnit = mode === 'month' ? 'month' : 'day';
  const shiftAnchor = (dir: 1 | -1) => {
    setAnchor((prev) =>
      stepUnit === 'month'
        ? new Date(prev.getFullYear(), prev.getMonth() + dir, 1)
        : addDays(prev, dir * step)
    );
  };

  const rangeLabel =
    mode === 'month'
      ? rangeStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : `${gridStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${addDays(
          gridStart,
          dayCount - 1
        ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
    >
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: '1px solid #1e2040', background: '#0f0e1a' }}
      >
        <button
          onClick={() => shiftAnchor(-1)}
          className="text-xs px-2 py-1 rounded text-gray-500 hover:text-gray-300"
        >
          ← prev
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs tracking-widest text-gray-400">{rangeLabel}</span>
          <button
            onClick={() => setAnchor(startOfDay(new Date()))}
            className="text-xs px-2 py-0.5 rounded"
            style={{ border: '1px solid #1e2040', color: '#475569' }}
          >
            today
          </button>
        </div>
        <button
          onClick={() => shiftAnchor(1)}
          className="text-xs px-2 py-1 rounded text-gray-500 hover:text-gray-300"
        >
          next →
        </button>
      </div>

      <div className="grid grid-cols-7" style={{ borderBottom: '1px solid #1e2040' }}>
        {DAY_LABELS.map((label) => (
          <div key={label} className="px-2 py-1 text-xs text-gray-600 text-center">
            {label}
          </div>
        ))}
      </div>

      <div
        className="grid grid-cols-7"
        style={{ gridAutoRows: mode === 'week' ? '160px' : mode === '2week' ? '130px' : '96px' }}
      >
        {days.map((day, i) => {
          const dayItems = itemsForDay(day);
          const inCurrentMonth = mode !== 'month' || day.getMonth() === rangeStart.getMonth();
          const visible = dayItems.slice(0, MAX_VISIBLE_PER_DAY);
          const overflow = dayItems.length - visible.length;
          return (
            <div
              key={i}
              className="p-1.5 overflow-hidden flex flex-col"
              style={{
                border: '1px solid #14152a',
                background: isSameDay(day, today)
                  ? '#4fc3f710'
                  : inCurrentMonth
                    ? 'transparent'
                    : '#08080f',
              }}
            >
              <div
                className="text-xs mb-1 flex-shrink-0"
                style={{
                  color: isSameDay(day, today) ? '#4fc3f7' : inCurrentMonth ? '#64748b' : '#334155',
                }}
              >
                {day.getDate()}
                {(mode === 'month' ? day.getDate() === 1 : i === 0) && (
                  <span className="ml-1">
                    {day.toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                )}
              </div>
              <div className="space-y-1 overflow-hidden flex-1">
                {visible.map((item) => {
                  const platform = item.kind === 'post' ? item.post.platform : item.idea.platform;
                  const label = item.kind === 'post' ? item.post.content : item.idea.topic;
                  const key = item.kind === 'post' ? item.post.id : item.idea.id;
                  const campaignId =
                    item.kind === 'post' ? item.post.campaignId : item.idea.campaignId;
                  const isPublished = item.kind === 'post' && item.post.status === 'published';
                  return (
                    <div
                      key={key}
                      title={`${label}${campaignName(campaignId) ? ` · ${campaignName(campaignId)}` : ''}`}
                      className="text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1"
                      style={{
                        background: `${platformColor[platform]}20`,
                        border: `1px solid ${platformColor[platform]}40`,
                        color: platformColor[platform],
                      }}
                    >
                      <span className="truncate flex-1">{label}</span>
                      {item.kind === 'post' && !isPublished && (
                        <button
                          onClick={() => onMarkPublished(item.post.id)}
                          disabled={actingId === item.post.id}
                          title="Mark as posted"
                          className="flex-shrink-0"
                          style={{ color: '#00ff9d' }}
                        >
                          {actingId === item.post.id ? '…' : '✓'}
                        </button>
                      )}
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <div className="text-xs text-gray-600 px-1.5">+{overflow} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
