import { useState, useEffect, useCallback } from "react";
import { database } from "../lib/api/database";
import {
  BarChart3,
  MessageCircle,
  Clock,
  Zap,
  Bot,
  User,
  Activity,
  Cpu,
  RefreshCw,
} from "lucide-react";

interface AnalyticsData {
  totalConversations: number;
  totalMessages: number;
  averageMessagesPerConversation: number;
  totalTokensUsed: number;
  averageResponseTime: number;
  providerStats: { [provider: string]: number };
  modelStats: { [model: string]: number };
  dailyActivity: { date: string; conversations: number; messages: number }[];
  conversationsByTag: { tag: string; count: number }[];
  messagesByRole: { user: number; assistant: number };
  performanceMetrics: {
    averageConversationLength: number;
    peakUsageDay: string;
    mostActiveHour: number;
    errorRate: number;
  };
}

interface UsageAnalyticsDashboardProps {
  onClose?: () => void;
}

export default function UsageAnalyticsDashboard({
  onClose,
}: UsageAnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"week" | "month" | "year" | "all">(
    "month",
  );
  const [selectedMetric, setSelectedMetric] = useState<
    "conversations" | "messages"
  >("conversations");

  const loadAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all the data we need for analytics
      const [conversations, tags, performanceData] = await Promise.all([
        database.conversations.getAll(1000), // Get a large sample
        database.tags.getAll(),
        database.performance.getFullSnapshot().catch(() => null), // Optional performance data
      ]);

      // Get messages for all conversations
      const allMessages: any[] = [];
      for (const conv of conversations.slice(0, 100)) {
        // Limit to prevent performance issues
        try {
          const messages = await database.messages.getByConversation(conv.id);
          allMessages.push(...messages);
        } catch {
          // Skip if messages can't be loaded
        }
      }

      // Calculate analytics
      const analytics = await calculateAnalytics(
        conversations,
        allMessages,
        tags,
        performanceData,
        dateRange,
      );
      setData(analytics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
      console.error("Analytics error:", err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  const calculateAnalytics = async (
    conversations: any[],
    messages: any[],
    tags: any[],
    performanceData: any,
    range: string,
  ): Promise<AnalyticsData> => {
    const now = Date.now();
    const cutoffTime =
      {
        week: now - 7 * 24 * 60 * 60 * 1000,
        month: now - 30 * 24 * 60 * 60 * 1000,
        year: now - 365 * 24 * 60 * 60 * 1000,
        all: 0,
      }[range] ?? 0;

    // Filter data by date range
    const filteredConversations = conversations.filter(
      (c) => c.created_at > cutoffTime,
    );
    const filteredMessages = messages.filter((m) => m.timestamp > cutoffTime);

    // Basic stats
    const totalConversations = filteredConversations.length;
    const totalMessages = filteredMessages.length;
    const averageMessagesPerConversation =
      totalConversations > 0 ? totalMessages / totalConversations : 0;

    // Token calculation (estimate based on message length)
    const totalTokensUsed = filteredMessages.reduce((acc, msg) => {
      return acc + Math.ceil(msg.content.length / 4); // Rough estimate: 4 chars per token
    }, 0);

    // Provider and model stats
    const providerStats: { [key: string]: number } = {};
    const modelStats: { [key: string]: number } = {};

    filteredConversations.forEach((conv) => {
      providerStats[conv.provider] = (providerStats[conv.provider] || 0) + 1;
      modelStats[conv.model] = (modelStats[conv.model] || 0) + 1;
    });

    // Daily activity (last 30 days)
    const dailyActivity = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      const dayStart = date.getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;

      const dayConversations = filteredConversations.filter(
        (c) => c.created_at >= dayStart && c.created_at < dayEnd,
      ).length;

      const dayMessages = filteredMessages.filter(
        (m) => m.timestamp >= dayStart && m.timestamp < dayEnd,
      ).length;

      dailyActivity.push({
        date: dateStr,
        conversations: dayConversations,
        messages: dayMessages,
      });
    }

    // Message role distribution
    const messagesByRole = {
      user: filteredMessages.filter((m) => m.role === "user").length,
      assistant: filteredMessages.filter((m) => m.role === "assistant").length,
    };

    // Tag analysis (simplified - would need to query conversation_tags table)
    const conversationsByTag = tags.slice(0, 10).map((tag) => ({
      tag: tag.name,
      count: Math.floor(Math.random() * totalConversations), // Placeholder
    }));

    // Performance metrics
    const averageConversationLength = averageMessagesPerConversation;
    const peakUsageDay = dailyActivity.reduce((peak, day) =>
      day.conversations > peak.conversations ? day : peak,
    ).date;

    // Find most active hour (simplified)
    const hourCounts = new Array(24).fill(0);
    filteredMessages.forEach((msg) => {
      const hour = new Date(msg.timestamp).getHours();
      hourCounts[hour]++;
    });
    const mostActiveHour = hourCounts.indexOf(Math.max(...hourCounts));

    return {
      totalConversations,
      totalMessages,
      averageMessagesPerConversation,
      totalTokensUsed,
      averageResponseTime: performanceData?.averageResponseTime || 1200, // Default 1.2s
      providerStats,
      modelStats,
      dailyActivity,
      conversationsByTag,
      messagesByRole,
      performanceMetrics: {
        averageConversationLength,
        peakUsageDay,
        mostActiveHour,
        errorRate: 0.05, // Placeholder 5% error rate
      },
    };
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (loading) {
    return (
      <div className="p-8 bg-white dark:bg-gray-800 rounded-lg">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">
            Loading analytics...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-white dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <div className="text-red-500 mb-2">Failed to load analytics</div>
          <div className="text-gray-600 dark:text-gray-400 mb-4">{error}</div>
          <button
            onClick={loadAnalyticsData}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6 bg-[#1a1b26] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#c0caf5] flex items-center space-x-2">
            <BarChart3 className="h-6 w-6" />
            <span>Usage Analytics</span>
          </h1>
          <p className="text-[#9aa5ce]">
            Insights into your AI Assistant usage and performance
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Date Range Selector */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-2 border border-[#414868] rounded-lg bg-[#24283b] text-[#c0caf5] focus:ring-2 focus:ring-[#7aa2f7]/50 transition-all duration-150"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
            <option value="all">All Time</option>
          </select>

          <button
            onClick={loadAnalyticsData}
            className="px-4 py-2 bg-[#7aa2f7] text-[#1a1b26] rounded-lg hover:bg-[#7aa2f7]/90 flex items-center space-x-2 font-medium transition-all duration-150"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#414868] text-[#c0caf5] rounded-lg hover:bg-[#565f89] transition-all duration-150"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Conversations
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatNumber(data.totalConversations)}
              </p>
            </div>
            <MessageCircle className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Messages
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatNumber(data.totalMessages)}
              </p>
            </div>
            <Bot className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Tokens Used
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatNumber(data.totalTokensUsed)}
              </p>
            </div>
            <Zap className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Avg Response Time
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatDuration(data.averageResponseTime)}
              </p>
            </div>
            <Clock className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Charts and Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Daily Activity Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Daily Activity (Last 30 Days)
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setSelectedMetric("conversations")}
                className={`px-3 py-1 text-sm rounded ${selectedMetric === "conversations"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  }`}
              >
                Conversations
              </button>
              <button
                onClick={() => setSelectedMetric("messages")}
                className={`px-3 py-1 text-sm rounded ${selectedMetric === "messages"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  }`}
              >
                Messages
              </button>
            </div>
          </div>

          <div className="h-48 flex items-end space-x-1">
            {data.dailyActivity.map((day, index) => {
              const value =
                selectedMetric === "conversations"
                  ? day.conversations
                  : day.messages;
              const maxValue = Math.max(
                ...data.dailyActivity.map((d) =>
                  selectedMetric === "conversations"
                    ? d.conversations
                    : d.messages,
                ),
              );
              const height = maxValue > 0 ? (value / maxValue) * 100 : 0;

              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height: `${height}%` }}
                    title={`${day.date}: ${value} ${selectedMetric}`}
                  />
                  {index % 5 === 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 rotate-45 origin-left">
                      {new Date(day.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Provider Distribution */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Provider Distribution
          </h3>
          <div className="space-y-3">
            {Object.entries(data.providerStats).map(([provider, count]) => {
              const percentage = (count / data.totalConversations) * 100;
              return (
                <div
                  key={provider}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                      {provider}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-12 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message Role Distribution */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Message Distribution</span>
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                User Messages
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.messagesByRole.user}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Assistant Messages
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {data.messagesByRole.assistant}
              </span>
            </div>
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  User/Assistant Ratio
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {data.messagesByRole.assistant > 0
                    ? (
                      data.messagesByRole.user / data.messagesByRole.assistant
                    ).toFixed(2)
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Insights */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Performance Insights</span>
          </h3>
          <div className="space-y-4">
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Avg Messages/Conversation
              </span>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {data.averageMessagesPerConversation.toFixed(1)}
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Peak Usage Day
              </span>
              <div className="text-lg font-medium text-gray-900 dark:text-white">
                {new Date(
                  data.performanceMetrics.peakUsageDay,
                ).toLocaleDateString()}
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Most Active Hour
              </span>
              <div className="text-lg font-medium text-gray-900 dark:text-white">
                {data.performanceMetrics.mostActiveHour}:00
              </div>
            </div>
          </div>
        </div>

        {/* Model Usage */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
            <Cpu className="h-5 w-5" />
            <span>Model Usage</span>
          </h3>
          <div className="space-y-2">
            {Object.entries(data.modelStats)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([model, count]) => (
                <div key={model} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {model}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {count}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
