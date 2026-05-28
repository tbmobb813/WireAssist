import { useState, useEffect, useMemo } from "react";
import {
  DollarSign,
  Zap,
  TrendingUp,
  TrendingDown,
  Calendar,
  PieChart,
  AlertCircle,
} from "lucide-react";
import { useChatStore } from "../lib/stores/chatStore";
import { useRoutingStore } from "../lib/stores/routingStore";
import { useSettingsStore } from "../lib/stores/settingsStore";
import { calculateCost, formatCost, formatTokens } from "./CostBadge";

interface ConversationCost {
  conversationId: string;
  title: string;
  tokens: number;
  cost: number;
  messageCount: number;
}

interface MonthlySpend {
  month: string; // YYYY-MM
  cost: number;
  tokens: number;
}

export default function CostDashboard() {
  const { conversations, messages } = useChatStore();
  const { getTotalCostSavings, getModelUsageStats } = useRoutingStore();
  const budgetMonthly = useSettingsStore((s) => s.budgetMonthly);

  const [totalTokens, setTotalTokens] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [topConversations, setTopConversations] = useState<ConversationCost[]>(
    [],
  );
  const [monthlySpends, setMonthlySpends] = useState<MonthlySpend[]>([]);

  const costSavings = getTotalCostSavings();
  const modelUsage = getModelUsageStats();

  useEffect(() => {
    // Calculate costs from all conversations
    let tokens = 0;
    let cost = 0;
    const conversationCosts: Record<string, ConversationCost> = {};
    const monthlyMap: Record<string, MonthlySpend> = {};

    // Group messages by conversation and month
    Object.values(messages).forEach((message) => {
      const msgTokens = (message as any).tokens_used || 0;
      tokens += msgTokens;

      const conversation = conversations.find(
        (c) => c.id === message.conversation_id,
      );
      const model = conversation?.model || "gpt-4";
      const msgCost = calculateCost(msgTokens, model);
      cost += msgCost;

      // Track per-conversation costs
      if (!conversationCosts[message.conversation_id]) {
        conversationCosts[message.conversation_id] = {
          conversationId: message.conversation_id,
          title: conversation?.title || "Untitled",
          tokens: 0,
          cost: 0,
          messageCount: 0,
        };
      }
      conversationCosts[message.conversation_id].tokens += msgTokens;
      conversationCosts[message.conversation_id].cost += msgCost;
      conversationCosts[message.conversation_id].messageCount += 1;

      // Track monthly costs
      const messageDate = new Date(message.timestamp);
      const monthKey = `${messageDate.getFullYear()}-${String(messageDate.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { month: monthKey, cost: 0, tokens: 0 };
      }
      monthlyMap[monthKey].cost += msgCost;
      monthlyMap[monthKey].tokens += msgTokens;
    });

    setTotalTokens(tokens);
    setTotalCost(cost);

    // Get top 5 costliest conversations
    const sorted = Object.values(conversationCosts)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);
    setTopConversations(sorted);

    // Sort monthly spends by month (most recent first)
    const sortedMonths = Object.values(monthlyMap)
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 6);
    setMonthlySpends(sortedMonths);
  }, [conversations, messages]);

  // Budget alert
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const currentMonthSpend = useMemo(() => {
    return monthlySpends.find((m) => m.month === currentMonth)?.cost || 0;
  }, [monthlySpends, currentMonth]);

  const budgetPercent =
    budgetMonthly > 0 ? (currentMonthSpend / budgetMonthly) * 100 : 0;
  const overBudget = currentMonthSpend > budgetMonthly;

  // Model usage pie chart data
  const modelUsageList = useMemo(() => {
    const total = Object.values(modelUsage).reduce(
      (sum, count) => sum + count,
      0,
    );
    return Object.entries(modelUsage).map(([model, count]) => ({
      model,
      count,
      percent: total > 0 ? (count / total) * 100 : 0,
    }));
  }, [modelUsage]);

  return (
    <div className="space-y-4">
      {/* Total Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-[#7aa2f7]/10 to-[#7aa2f7]/5 border border-[#7aa2f7]/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-[#7aa2f7] mb-2">
            <Zap size={16} />
            <span className="text-xs font-medium">Total Tokens</span>
          </div>
          <div className="text-2xl font-bold text-[#c0caf5] font-mono">
            {formatTokens(totalTokens)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#9ece6a]/10 to-[#9ece6a]/5 border border-[#9ece6a]/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-[#9ece6a] mb-2">
            <DollarSign size={16} />
            <span className="text-xs font-medium">Total Cost</span>
          </div>
          <div className="text-2xl font-bold text-[#c0caf5] font-mono">
            {formatCost(totalCost)}
          </div>
        </div>
      </div>

      {/* Savings Badge */}
      {costSavings > 0 && (
        <div className="bg-gradient-to-br from-[#73daca]/10 to-[#73daca]/5 border border-[#73daca]/30 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#73daca]">
              <TrendingDown size={16} />
              <span className="text-xs font-medium">
                Cost Savings (via Smart Routing)
              </span>
            </div>
            <div className="text-xl font-bold text-[#73daca] font-mono">
              {formatCost(costSavings)}
            </div>
          </div>
        </div>
      )}

      {/* Monthly Budget Alert */}
      {budgetMonthly > 0 && (
        <div
          className={`rounded-lg p-3 border ${
            overBudget
              ? "bg-gradient-to-br from-[#f7768e]/10 to-[#f7768e]/5 border-[#f7768e]/30"
              : budgetPercent > 80
                ? "bg-gradient-to-br from-[#e0af68]/10 to-[#e0af68]/5 border-[#e0af68]/30"
                : "bg-gradient-to-br from-[#9ece6a]/10 to-[#9ece6a]/5 border-[#9ece6a]/30"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div
              className={`flex items-center gap-2 ${
                overBudget
                  ? "text-[#f7768e]"
                  : budgetPercent > 80
                    ? "text-[#e0af68]"
                    : "text-[#9ece6a]"
              }`}
            >
              {overBudget && <AlertCircle size={16} />}
              <span className="text-xs font-medium">
                This Month: {currentMonth}
              </span>
            </div>
            <div
              className={`text-sm font-bold font-mono ${
                overBudget ? "text-[#f7768e]" : "text-[#c0caf5]"
              }`}
            >
              {formatCost(currentMonthSpend)} / {formatCost(budgetMonthly)}
            </div>
          </div>
          <div className="w-full bg-[#24283b] rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                overBudget
                  ? "bg-[#f7768e]"
                  : budgetPercent > 80
                    ? "bg-[#e0af68]"
                    : "bg-[#9ece6a]"
              }`}
              style={{ width: `${Math.min(budgetPercent, 100)}%` }}
            />
          </div>
          {overBudget && (
            <p className="text-xs text-[#f7768e] mt-2">
              ⚠️ Over budget by {formatCost(currentMonthSpend - budgetMonthly)}
            </p>
          )}
        </div>
      )}

      {/* Monthly Spend Chart */}
      {monthlySpends.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-[#9aa5ce] mb-3">
            <Calendar size={14} />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Monthly Spend (Last 6 Months)
            </span>
          </div>
          <div className="space-y-2">
            {monthlySpends.map((month) => {
              const isCurrentMonth = month.month === currentMonth;
              const maxSpend = Math.max(
                ...monthlySpends.map((m) => m.cost),
                budgetMonthly,
              );
              const widthPercent =
                maxSpend > 0 ? (month.cost / maxSpend) * 100 : 0;

              return (
                <div
                  key={month.month}
                  className="bg-[#24283b] border border-[#414868] rounded-lg p-3 hover:border-[#565f89] transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-sm font-medium ${
                        isCurrentMonth ? "text-[#7aa2f7]" : "text-[#c0caf5]"
                      }`}
                    >
                      {month.month}
                      {isCurrentMonth && (
                        <span className="ml-2 text-xs text-[#9aa5ce]">
                          (current)
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#9aa5ce] font-mono">
                        {formatTokens(month.tokens)}
                      </span>
                      <span className="text-sm font-bold text-[#9ece6a] font-mono">
                        {formatCost(month.cost)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-[#1a1b26] rounded-full h-1.5">
                    <div
                      className="bg-gradient-to-r from-[#7aa2f7] to-[#bb9af7] h-1.5 rounded-full transition-all"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Model Usage Distribution */}
      {modelUsageList.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-[#9aa5ce] mb-3">
            <PieChart size={14} />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Model Usage Distribution
            </span>
          </div>
          <div className="space-y-2">
            {modelUsageList.slice(0, 5).map((item, idx) => (
              <div
                key={item.model}
                className="bg-[#24283b] border border-[#414868] rounded-lg p-3 hover:border-[#565f89] transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#c0caf5] font-medium">
                    {item.model}
                  </span>
                  <span className="text-xs text-[#9aa5ce] font-mono">
                    {item.count} calls • {item.percent.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-[#1a1b26] rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      idx === 0
                        ? "bg-[#7aa2f7]"
                        : idx === 1
                          ? "bg-[#9ece6a]"
                          : idx === 2
                            ? "bg-[#e0af68]"
                            : "bg-[#bb9af7]"
                    }`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Conversations */}
      {topConversations.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-[#9aa5ce] mb-3">
            <TrendingUp size={14} />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Top Conversations
            </span>
          </div>
          <div className="space-y-2">
            {topConversations.map((conv) => (
              <div
                key={conv.conversationId}
                className="bg-[#24283b] border border-[#414868] rounded-lg p-3 hover:border-[#565f89] transition-colors"
              >
                <div className="text-sm text-[#c0caf5] font-medium truncate mb-2">
                  {conv.title}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-[#7aa2f7] font-mono">
                      {formatTokens(conv.tokens)}
                    </span>
                    <span className="text-[#565f89]">•</span>
                    <span className="text-[#9aa5ce]">
                      {conv.messageCount} msgs
                    </span>
                  </div>
                  <span className="text-[#9ece6a] font-mono font-semibold">
                    {formatCost(conv.cost)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Average Cost Info */}
      {totalTokens > 0 && (
        <div className="bg-[#24283b]/50 border border-[#414868]/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-[#9aa5ce] mb-2">
            <Calendar size={14} />
            <span className="text-xs font-medium">Usage Insights</span>
          </div>
          <div className="text-xs text-[#9aa5ce] space-y-1">
            <div>
              Average:{" "}
              {formatCost(totalCost / Math.max(conversations.length, 1))} per
              conversation
            </div>
            <div>Messages: {Object.keys(messages).length} total</div>
          </div>
        </div>
      )}

      {totalTokens === 0 && (
        <div className="text-center py-8 text-[#565f89] text-sm">
          <Zap className="mx-auto mb-2 opacity-50" size={24} />
          <p>No usage data yet</p>
          <p className="text-xs mt-1">Start a conversation to track costs</p>
        </div>
      )}
    </div>
  );
}
