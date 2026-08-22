'use client';
// Small reusable "(none) | <active objectives>" <select>, sourced from
// GET /api/objectives?status=active — used identically on the Content,
// Research, GTM, and Ops task-creation forms so a task can be tagged to a
// shared cross-agent Objective at creation time.
import { useEffect, useState } from 'react';

interface ObjectiveOption {
  id: string;
  title: string;
}

export function useActiveObjectives(): ObjectiveOption[] {
  const [objectives, setObjectives] = useState<ObjectiveOption[]>([]);
  useEffect(() => {
    fetch('/api/objectives?status=active')
      .then((r) => r.json())
      .then((d) => Array.isArray(d.objectives) && setObjectives(d.objectives))
      .catch(() => {});
  }, []);
  return objectives;
}

export function ObjectivePicker({
  objectives,
  value,
  onChange,
}: {
  objectives: ObjectiveOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded px-3 py-2 text-sm mb-3 outline-none"
      style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
    >
      <option value="" style={{ background: '#080810' }}>
        (no objective)
      </option>
      {objectives.map((o) => (
        <option key={o.id} value={o.id} style={{ background: '#080810' }}>
          {o.title}
        </option>
      ))}
    </select>
  );
}
