import { useState, useEffect, useCallback, memo } from "react";
import {
  Activity,
  Database,
  Cpu,
  HardDrive,
  Clock,
  X,
  RefreshCw,
  TrendingUp,
  Server,
} from "lucide-react";
import { database } from "../lib/api/database";

interface PerformanceMetrics {
  system: {
    cpu_usage: number;
    memory_usage: {
      total_memory: number;
      used_memory: number;
      available_memory: number;
      memory_percent: number;
      total_swap: number;
      used_swap: number;
    };
    process_info: {
      pid: number;
      cpu_usage: number;
      memory_usage: number;
      thread_count: number;
    };
    uptime: number;
    timestamp: number;
  };
  database: {
    conversation_count: number;
    message_count: number;
    database_size: number;
  };
}

interface PerformanceDashboardProps {
  onClose?: () => void;
}

function PerformanceDashboard({ onClose }: PerformanceDashboardProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      setError(null);
      const data =
        (await database.performance.getFullSnapshot()) as PerformanceMetrics;
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch metrics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchMetrics();
    }, 2000); // Refresh every 2 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, fetchMetrics]);

  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }, []);

  const formatUptime = useCallback((seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }, []);

  const getStatusColor = useCallback((percentage: number) => {
    if (percentage < 50) return "text-green-600 dark:text-green-400";
    if (percentage < 80) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  }, []);

  const getProgressColor = useCallback((percentage: number) => {
    if (percentage < 50) return "bg-green-500";
    if (percentage < 80) return "bg-yellow-500";
    return "bg-red-500";
  }, []);

  if (isLoading) {
    return (
      <div className="w-96 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">
            Loading metrics...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-96 bg-[#1a1b26] border border-[#414868] rounded-lg shadow-2xl p-6">
        <div className="text-center">
          <div className="text-[#f7768e] mb-2">Error loading metrics</div>
          <div className="text-sm text-[#9aa5ce] mb-4">{error}</div>
          <button
            onClick={fetchMetrics}
            className="px-4 py-2 bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 text-[#1a1b26] rounded-md text-sm font-medium transition-all duration-150"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="w-[500px] bg-[#1a1b26] border border-[#414868] rounded-lg shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#414868]">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#7aa2f7]" />
          <h2 className="text-lg font-semibold text-[#c0caf5]">
            Performance Dashboard
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-1 rounded transition-colors ${
              autoRefresh ? "text-[#9ece6a]" : "text-[#565f89]"
            }`}
            title={autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          >
            <RefreshCw
              className={`w-4 h-4 ${autoRefresh ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={fetchMetrics}
            className="p-1 text-[#9aa5ce] hover:text-[#c0caf5] transition-colors"
            title="Refresh now"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-[#9aa5ce] hover:text-[#c0caf5] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* System Overview */}
        <div className="grid grid-cols-2 gap-4">
          {/* CPU Usage */}
          <div className="bg-[#24283b]/50 rounded-lg p-3 border border-[#414868]">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4 text-[#7aa2f7]" />
              <span className="text-sm font-medium text-[#c0caf5]">
                CPU Usage
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[#414868] rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getProgressColor(metrics.system.cpu_usage)}`}
                  style={{
                    width: `${Math.min(metrics.system.cpu_usage, 100)}%`,
                  }}
                />
              </div>
              <span
                className={`text-sm font-mono ${getStatusColor(metrics.system.cpu_usage)}`}
              >
                {metrics.system.cpu_usage.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Memory Usage */}
          <div className="bg-[#24283b]/50 rounded-lg p-3 border border-[#414868]">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-[#9ece6a]" />
              <span className="text-sm font-medium text-[#c0caf5]">Memory</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[#414868] rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getProgressColor(metrics.system.memory_usage.memory_percent)}`}
                  style={{
                    width: `${metrics.system.memory_usage.memory_percent}%`,
                  }}
                />
              </div>
              <span
                className={`text-sm font-mono ${getStatusColor(metrics.system.memory_usage.memory_percent)}`}
              >
                {metrics.system.memory_usage.memory_percent.toFixed(1)}%
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatBytes(metrics.system.memory_usage.used_memory)} /{" "}
              {formatBytes(metrics.system.memory_usage.total_memory)}
            </div>
          </div>
        </div>

        {/* Process Information */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <Server className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Application Process
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-400">PID</div>
              <div className="font-mono text-gray-900 dark:text-white">
                {metrics.system.process_info.pid}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">CPU</div>
              <div
                className={`font-mono ${getStatusColor(metrics.system.process_info.cpu_usage)}`}
              >
                {metrics.system.process_info.cpu_usage.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Memory</div>
              <div className="font-mono text-gray-900 dark:text-white">
                {formatBytes(metrics.system.process_info.memory_usage)}
              </div>
            </div>
          </div>
        </div>

        {/* Database Information */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Database Statistics
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-400">
                Conversations
              </div>
              <div className="font-mono text-gray-900 dark:text-white">
                {metrics.database.conversation_count.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Messages</div>
              <div className="font-mono text-gray-900 dark:text-white">
                {metrics.database.message_count.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Size</div>
              <div className="font-mono text-gray-900 dark:text-white">
                {formatBytes(metrics.database.database_size)}
              </div>
            </div>
          </div>
        </div>

        {/* System Uptime */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              System Uptime
            </span>
          </div>
          <div className="text-lg font-mono text-gray-900 dark:text-white">
            {formatUptime(metrics.system.uptime)}
          </div>
        </div>

        {/* Refresh Information */}
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center border-t border-gray-200 dark:border-gray-700 pt-2">
          Auto-refresh: {autoRefresh ? "ON" : "OFF"} • Last updated:{" "}
          {new Date(metrics.system.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

export default memo(PerformanceDashboard);
