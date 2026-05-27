'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface MemoryEntry {
  id: string;
  content: string;
  agentRole: string;
  tags: string[];
  createdAt: string;
}

export default function MemoryPage() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      const res = await fetch(`/api/memory${query ? `?q=${encodeURIComponent(query)}` : ''}`);
      const data = await res.json();
      setEntries(data);
      setLoading(false);
    };
    const t = setTimeout(fetch_, 300);
    return () => clearTimeout(t);
  }, [query]);

  const roleColor = (role: string) => ({
    admin: '#4fc3f7',
    content: '#ffb347',
    research: '#c084fc',
    strategy: '#00ff9d',
  }[role] ?? '#475569');

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href="/" className="text-xs text-gray-600 hover:text-accent tracking-widest">
          ← COMMAND CENTER
        </Link>
      </div>

      <div className="mb-8">
        <div className="text-xs tracking-widest text-purple mb-2">SYNQWORKS // MEMORY</div>
        <h1 className="text-3xl font-black">AGENT MEMORY</h1>
        <p className="text-gray-500 text-sm mt-2">What your agents have learned and remembered.</p>
      </div>

      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search memories..."
        className="w-full max-w-xl rounded-lg px-4 py-3 text-sm outline-none mb-8"
        style={{ background: '#0d0d1a', border: '1px solid #1e2040', color: '#e2e8f0' }}
      />

      {loading ? (
        <div className="text-gray-600 text-sm">Searching...</div>
      ) : entries.length === 0 ? (
        <div className="text-gray-600 text-sm">
          {query ? 'No memories match that search.' : 'No memories stored yet. Run some tasks first.'}
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {entries.map(entry => (
            <div
              key={entry.id}
              className="rounded-lg border p-4"
              style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
            >
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="text-xs tracking-widest px-2 py-0.5 rounded"
                  style={{
                    color: roleColor(entry.agentRole),
                    background: `${roleColor(entry.agentRole)}15`,
                    border: `1px solid ${roleColor(entry.agentRole)}30`,
                  }}
                >
                  {entry.agentRole.toUpperCase()}
                </span>
                <span className="text-xs text-gray-600">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-gray-300">{entry.content}</p>
              {entry.tags.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {entry.tags.map(tag => (
                    <span key={tag} className="text-xs text-gray-600 border border-border rounded px-2 py-0.5">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}