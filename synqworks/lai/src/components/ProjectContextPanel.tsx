import { useState } from "react";
import { useProjectStore } from "../lib/stores/projectStore";
import { useSettingsStore } from "../lib/stores/settingsStore";
import { FolderOpen, Clock, FileText, X, RefreshCw } from "lucide-react";

interface ProjectContextPanelProps {
  onClose?: () => void;
}

export default function ProjectContextPanel({
  onClose,
}: ProjectContextPanelProps) {
  const { events } = useProjectStore();
  const { projectRoot } = useSettingsStore();
  const [timeWindow, setTimeWindow] = useState<number>(2 * 60 * 1000); // 2 minutes default

  // Get recent events within the time window
  const now = Date.now();
  const recentEvents = events
    .filter((e) => now - e.ts <= timeWindow)
    .slice(-20) // Show last 20 events
    .reverse(); // Most recent first

  const formatRelativeTime = (timestamp: number): string => {
    const seconds = Math.floor((now - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const formatPath = (path: string): string => {
    if (!projectRoot) return path;
    // Remove project root prefix for cleaner display
    if (path.startsWith(projectRoot)) {
      return path.slice(projectRoot.length).replace(/^\//, "");
    }
    return path;
  };

  const getFileIcon = (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "ts":
      case "tsx":
      case "js":
      case "jsx":
        return "🔷";
      case "rs":
        return "🦀";
      case "py":
        return "🐍";
      case "md":
        return "📝";
      case "json":
        return "📋";
      case "css":
      case "scss":
        return "🎨";
      default:
        return "📄";
    }
  };

  const timeWindows = [
    { label: "30s", value: 30 * 1000 },
    { label: "2m", value: 2 * 60 * 1000 },
    { label: "5m", value: 5 * 60 * 1000 },
    { label: "15m", value: 15 * 60 * 1000 },
    { label: "1h", value: 60 * 60 * 1000 },
  ];

  return (
    <div className="fixed right-4 top-16 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-40 max-h-96 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Project Context
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => useProjectStore.getState().clear()}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            title="Clear events"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Time Window Selector */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1 text-xs">
          <Clock className="w-3 h-3 text-gray-400" />
          <span className="text-gray-500 dark:text-gray-400">
            Show changes from:
          </span>
        </div>
        <div className="flex gap-1 mt-1">
          {timeWindows.map((window) => (
            <button
              key={window.value}
              onClick={() => setTimeWindow(window.value)}
              className={`px-2 py-1 text-xs rounded ${
                timeWindow === window.value
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
              }`}
            >
              {window.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project Root */}
      {projectRoot && (
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Watching:
          </div>
          <div className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
            {projectRoot}
          </div>
        </div>
      )}

      {/* Recent Events */}
      <div className="overflow-y-auto max-h-64">
        {recentEvents.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <div className="text-sm">No recent file changes</div>
            <div className="text-xs mt-1">
              {projectRoot
                ? "Make changes to see them here"
                : "Set a project root to start watching"}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {recentEvents.map((event, index) => (
              <div
                key={`${event.path}-${event.ts}-${index}`}
                className="p-3 hover:bg-gray-50 dark:hover:bg-gray-750"
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm mt-0.5">
                    {getFileIcon(event.path)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate">
                      {formatPath(event.path)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatRelativeTime(event.ts)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {recentEvents.length > 0 && (
        <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {recentEvents.length} changes in the last{" "}
            {timeWindows.find((w) => w.value === timeWindow)?.label}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">
            Context automatically included in AI messages
          </div>
        </div>
      )}
    </div>
  );
}
