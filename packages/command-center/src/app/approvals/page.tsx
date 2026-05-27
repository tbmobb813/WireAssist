'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAgentEvents } from '@/hooks/useAgentEvents';
import Link from 'next/link';

interface ApprovalRequest {
  id: string;
  taskId: string;
  agentRole: string;
  action: string;
  payload: Record<string, unknown>;
  status: string;
  createdAt: string;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    const res = await fetch('/api/approvals');
    const data = await res.json();
    setApprovals(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  useAgentEvents(useCallback((e) => {
    if (e.event === 'waiting_approval') {
      fetchApprovals();
    }
    if (e.event === 'approval_resolved') {
      fetchApprovals();
    }
  }, [fetchApprovals]));

  const resolve = async (id: string, approved: boolean) => {
    setActing(id);
    await fetch(`/api/approvals/${id}/${approved ? 'approve' : 'reject'}`, {
      method: 'POST',
    });
    setApprovals(prev => prev.filter(a => a.id !== id));
    setActing(null);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="mb-8">
        <Link href="/" className="text-xs text-gray-600 hover:text-accent tracking-widest">
          ← COMMAND CENTER
        </Link>
      </div>

      <div className="mb-8">
        <div className="text-xs tracking-widest text-amber mb-2">SYNQWORKS // APPROVALS</div>
        <h1 className="text-3xl font-black">APPROVAL QUEUE</h1>
        <p className="text-gray-500 text-sm mt-2">
          {approvals.length === 0
            ? 'No pending approvals.'
            : `${approvals.length} action${approvals.length > 1 ? 's' : ''} waiting for your review.`}
        </p>
      </div>

      {loading ? (
        <div className="text-gray-600 text-sm">Loading...</div>
      ) : approvals.length === 0 ? (
        <div
          className="rounded-lg border p-12 text-center"
          style={{ background: '#0d0d1a', borderColor: '#1e2040' }}
        >
          <div className="text-4xl mb-4">✓</div>
          <div className="text-gray-400 text-sm">All clear. No pending approvals.</div>
          <Link href="/" className="mt-4 inline-block text-xs text-accent hover:underline">
            Back to dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {approvals.map(approval => (
            <div
              key={approval.id}
              className="rounded-lg border overflow-hidden"
              style={{ background: '#0d0d1a', borderColor: '#ffb34740' }}
            >
              {/* Header */}
              <div
                className="px-5 py-3 flex items-center justify-between"
                style={{ borderBottom: '1px solid #1e2040', background: '#0f0e1a' }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs tracking-widest px-2 py-0.5 rounded"
                    style={{ color: '#ffb347', background: '#ffb34720', border: '1px solid #ffb34740' }}
                  >
                    {approval.agentRole.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(approval.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Action */}
              <div className="px-5 py-4">
                <div className="text-xs tracking-widest text-gray-500 mb-2">PROPOSED ACTION</div>
                <div className="text-sm font-bold mb-4">{approval.action}</div>

                {/* Payload preview */}
                <div className="text-xs tracking-widest text-gray-500 mb-2">PAYLOAD</div>
                <pre
                  className="text-xs text-gray-400 rounded p-3 overflow-x-auto"
                  style={{ background: '#080810', border: '1px solid #1e2040' }}
                >
                  {JSON.stringify(approval.payload, null, 2)}
                </pre>
              </div>

              {/* Actions */}
              <div
                className="px-5 py-3 flex gap-3"
                style={{ borderTop: '1px solid #1e2040' }}
              >
                <button
                  onClick={() => resolve(approval.id, true)}
                  disabled={acting === approval.id}
                  className="flex-1 py-2 rounded text-xs font-bold tracking-widest transition-colors"
                  style={{
                    background: '#00ff9d20',
                    border: '1px solid #00ff9d40',
                    color: '#00ff9d',
                  }}
                >
                  {acting === approval.id ? '...' : '✓ APPROVE'}
                </button>
                <button
                  onClick={() => resolve(approval.id, false)}
                  disabled={acting === approval.id}
                  className="flex-1 py-2 rounded text-xs font-bold tracking-widest transition-colors"
                  style={{
                    background: '#ef444420',
                    border: '1px solid #ef444440',
                    color: '#ef4444',
                  }}
                >
                  {acting === approval.id ? '...' : '✕ REJECT'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}