'use client';

interface QuickNote {
  id: string;
  text: string;
  createdAt: string;
}

export default function DashboardQuickNoteTile({
  notes,
  noteDraft,
  onNoteDraftChange,
  onSaveNote,
  onRemoveNote,
}: {
  notes: QuickNote[];
  noteDraft: string;
  onNoteDraftChange: (value: string) => void;
  onSaveNote: () => void;
  onRemoveNote: (id: string) => void;
}) {
  return (
    <div
      className="md:col-span-2 rounded-2xl border p-5"
      style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
    >
      <div className="text-sm font-semibold text-gray-300 mb-3">Quick note</div>
      <div className="flex gap-2 mb-3">
        <input
          value={noteDraft}
          onChange={(e) => onNoteDraftChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSaveNote()}
          placeholder="Jot something down…"
          className="flex-1 text-sm rounded-lg px-3 py-2 outline-none"
          style={{ background: '#080810', border: '1px solid #1e2040', color: '#e2e8f0' }}
        />
        <button
          onClick={onSaveNote}
          disabled={!noteDraft.trim()}
          className="text-xs px-3 rounded-lg text-accent border border-accent/30 hover:bg-accent/10 transition-colors disabled:opacity-30"
        >
          Save
        </button>
      </div>
      {notes.length === 0 ? (
        <p className="text-xs text-gray-600">Nothing saved yet.</p>
      ) : (
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {notes.map((n) => (
            <div key={n.id} className="flex items-start justify-between gap-2 group">
              <span className="text-sm text-gray-300 leading-snug">{n.text}</span>
              <button
                onClick={() => onRemoveNote(n.id)}
                className="text-xs text-gray-700 hover:text-gray-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
