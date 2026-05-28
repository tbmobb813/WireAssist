import { DollarSign, Zap } from "lucide-react";

interface CostBadgeProps {
  tokens?: number;
  model?: string;
  compact?: boolean;
}

// Token pricing per 1K tokens (in USD)
const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4": { input: 0.03, output: 0.06 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-3.5-turbo": { input: 0.0015, output: 0.002 },
  "claude-3-opus": { input: 0.015, output: 0.075 },
  "claude-3-sonnet": { input: 0.003, output: 0.015 },
  "claude-3-haiku": { input: 0.00025, output: 0.00125 },
  "gemini-pro": { input: 0.00025, output: 0.0005 },
};

function calculateCost(tokens: number, model: string): number {
  const pricing = TOKEN_PRICING[model] || { input: 0.001, output: 0.002 };
  // Assume 50/50 split between input and output tokens
  const inputTokens = tokens * 0.5;
  const outputTokens = tokens * 0.5;
  const cost =
    (inputTokens / 1000) * pricing.input +
    (outputTokens / 1000) * pricing.output;
  return cost;
}

function formatCost(cost: number): string {
  if (cost < 0.001) return "<$0.001";
  if (cost < 0.01) return `$${cost.toFixed(3)}`;
  if (cost < 1) return `$${cost.toFixed(2)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  return `${(tokens / 1000).toFixed(1)}K`;
}

export default function CostBadge({
  tokens,
  model = "gpt-4",
  compact = false,
}: CostBadgeProps) {
  if (!tokens || tokens === 0) return null;

  const cost = calculateCost(tokens, model);

  if (compact) {
    return (
      <div
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#7aa2f7]/10 border border-[#7aa2f7]/30 text-[#7aa2f7] text-xs"
        title={`${tokens.toLocaleString()} tokens • ${formatCost(cost)}`}
      >
        <Zap size={10} />
        <span className="font-mono">{formatTokens(tokens)}</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#24283b] border border-[#414868] text-sm">
      <div className="flex items-center gap-1 text-[#7aa2f7]">
        <Zap size={14} />
        <span className="font-mono">{formatTokens(tokens)}</span>
      </div>
      <div className="w-px h-4 bg-[#414868]" />
      <div className="flex items-center gap-1 text-[#9ece6a]">
        <DollarSign size={14} />
        <span className="font-mono">{formatCost(cost)}</span>
      </div>
    </div>
  );
}

export { calculateCost, formatCost, formatTokens };
