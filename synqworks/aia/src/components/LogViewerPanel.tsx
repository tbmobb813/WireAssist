import React, { useState, useMemo } from "react";
import {
  FileText,
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Search,
  Clock,
  Filter,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  Zap,
  HelpCircle,
  Download,
} from "lucide-react";
import {
  useLogStore,
  LogEntry,
  LogLevel,
  LogSession,
} from "../lib/stores/logStore";
import { AnimatedButton, FadeIn } from "./Animations";

const LOG_LEVEL_CONFIG: Record<
  LogLevel,
  { icon: React.ReactNode; color: string; bgColor: string; label: string }
> = {
  fatal: {
    icon: <Zap className="w-4 h-4" />,
    color: "text-red-900 dark:text-red-100",
    bgColor: "bg-red-100 dark:bg-red-900/30 border-l-4 border-red-600",
    label: "FATAL",
  },
  error: {
    icon: <AlertCircle className="w-4 h-4" />,
    color: "text-red-800 dark:text-red-200",
    bgColor: "bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500",
    label: "ERROR",
  },
  warn: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "text-yellow-800 dark:text-yellow-200",
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500",
    label: "WARN",
  },
  info: {
    icon: <Info className="w-4 h-4" />,
    color: "text-blue-800 dark:text-blue-200",
    bgColor: "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500",
    label: "INFO",
  },
  debug: {
    icon: <Bug className="w-4 h-4" />,
    color: "text-gray-800 dark:text-gray-200",
    bgColor: "bg-gray-50 dark:bg-gray-800 border-l-4 border-gray-400",
    label: "DEBUG",
  },
  trace: {
    icon: <Search className="w-4 h-4" />,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-900 border-l-4 border-gray-300",
    label: "TRACE",
  },
  unknown: {
    icon: <HelpCircle className="w-4 h-4" />,
    color: "text-gray-700 dark:text-gray-300",
    bgColor: "bg-gray-100 dark:bg-gray-800 border-l-4 border-gray-500",
    label: "UNKNOWN",
  },
};

/**
 * Export log entries to JSON format
 */
const exportAsJSON = (entries: LogEntry[], title: string) => {
  const data = JSON.stringify(
    { title, entries, exportedAt: new Date().toISOString() },
    null,
    2,
  );
  downloadFile(data, `${sanitizeFilename(title)}.json`, "application/json");
};

/**
 * Export log entries to CSV format
 */
const exportAsCSV = (entries: LogEntry[], title: string) => {
  const headers = ["LineNumber", "Timestamp", "Level", "Source", "Message"];
  const rows = entries.map((entry) => [
    entry.lineNumber,
    entry.timestamp || "",
    entry.level,
    entry.source || "",
    `"${entry.message.replace(/"/g, '""')}"`, // Escape quotes
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  downloadFile(csv, `${sanitizeFilename(title)}.csv`, "text/csv");
};

/**
 * Export log entries to plain text format
 */
const exportAsText = (entries: LogEntry[], title: string) => {
  const lines = entries.map((entry) => {
    const parts = [
      `[${entry.lineNumber}]`,
      entry.timestamp,
      entry.level.toUpperCase(),
      entry.source,
      entry.message,
    ].filter(Boolean);
    return parts.join(" ");
  });

  const text = `# ${title}\n# Exported: ${new Date().toISOString()}\n\n${lines.join("\n")}`;
  downloadFile(text, `${sanitizeFilename(title)}.txt`, "text/plain");
};

/**
 * Download a file with given content
 */
const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Sanitize filename by removing invalid characters
 */
const sanitizeFilename = (name: string): string => {
  return name.replace(/[^a-z0-9_-]/gi, "_").substring(0, 100);
};

export const LogViewerPanel: React.FC = () => {
  const {
    sessions,
    currentSession,
    isLogViewerOpen,
    toggleLogViewer,
    createSession,
    setCurrentSession,
    deleteSession,
  } = useLogStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [logInput, setLogInput] = useState("");

  const handleCreateSession = () => {
    if (!newSessionTitle.trim() || !logInput.trim()) return;

    createSession(newSessionTitle, logInput);
    setNewSessionTitle("");
    setLogInput("");
    setShowCreateModal(false);
  };

  if (!isLogViewerOpen) {
    return null;
  }

  return (
    <FadeIn>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-green-500" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Log Viewer Mode
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {currentSession
                    ? `${currentSession.title} (${currentSession.format})`
                    : "Select or create a log session"}
                </p>
              </div>
            </div>
            <button
              onClick={toggleLogViewer}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close log viewer"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden flex">
            {/* Sessions Sidebar */}
            <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-y-auto">
              <div className="p-4">
                <AnimatedButton
                  onClick={() => setShowCreateModal(true)}
                  variant="primary"
                  size="sm"
                  className="w-full mb-4"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Log Session
                </AnimatedButton>

                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Log Sessions ({sessions.length})
                </h3>

                <div className="space-y-2">
                  {sessions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No log sessions yet</p>
                      <p className="text-xs mt-1">Create one to get started</p>
                    </div>
                  ) : (
                    sessions.map((session) => (
                      <div
                        key={session.id}
                        className={`p-3 rounded-lg border transition-all ${
                          currentSession?.id === session.id
                            ? "bg-white dark:bg-gray-900 border-green-500 shadow-md"
                            : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <button
                            onClick={() => setCurrentSession(session.id)}
                            className="flex-1 text-left"
                          >
                            <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                              {session.title}
                            </h4>
                            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                              <span className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 font-mono">
                                {session.format}
                              </span>
                              <span>{session.entries.length} entries</span>
                            </div>
                          </button>
                          <button
                            onClick={() => deleteSession(session.id)}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                            title="Delete session"
                          >
                            <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
                          </button>
                        </div>

                        {/* Export options (shown when this is current session) */}
                        {currentSession?.id === session.id && (
                          <div className="mt-2 flex items-center gap-1">
                            <span className="text-xs text-gray-600 dark:text-gray-400 mr-1">
                              Export:
                            </span>
                            <button
                              onClick={() =>
                                exportAsJSON(session.entries, session.title)
                              }
                              className="px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                              title="Export as JSON"
                            >
                              JSON
                            </button>
                            <button
                              onClick={() =>
                                exportAsCSV(session.entries, session.title)
                              }
                              className="px-2 py-1 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50"
                              title="Export as CSV"
                            >
                              CSV
                            </button>
                            <button
                              onClick={() =>
                                exportAsText(session.entries, session.title)
                              }
                              className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                              title="Export as plain text"
                            >
                              TXT
                            </button>
                          </div>
                        )}

                        {/* Level breakdown */}
                        {currentSession?.id === session.id && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 grid grid-cols-2 gap-1 text-xs">
                            {Object.entries(
                              session.entries.reduce(
                                (acc, entry) => {
                                  acc[entry.level] =
                                    (acc[entry.level] || 0) + 1;
                                  return acc;
                                },
                                {} as Record<LogLevel, number>,
                              ),
                            ).map(([level, count]) => (
                              <div
                                key={level}
                                className="flex items-center gap-1"
                              >
                                {LOG_LEVEL_CONFIG[level as LogLevel].icon}
                                <span className="text-gray-700 dark:text-gray-300">
                                  {level}: {count}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Log Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {currentSession ? (
                <LogContent session={currentSession} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-semibold mb-2">
                      Select a Log Session
                    </p>
                    <p className="text-sm">
                      Choose an existing session or create a new one
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Create Session Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <FadeIn>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Create Log Session
                    </h3>
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={newSessionTitle}
                        onChange={(e) => setNewSessionTitle(e.target.value)}
                        placeholder="e.g., Application startup logs"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Paste Logs *
                      </label>
                      <textarea
                        value={logInput}
                        onChange={(e) => setLogInput(e.target.value)}
                        placeholder="Paste log output here..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
                        rows={15}
                      />
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Supports: JSON, Docker, Syslog, Nginx, Apache, and
                        generic log formats
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <AnimatedButton
                      onClick={handleCreateSession}
                      variant="primary"
                      size="md"
                      className="flex-1"
                    >
                      Create Session
                    </AnimatedButton>
                    <AnimatedButton
                      onClick={() => setShowCreateModal(false)}
                      variant="secondary"
                      size="md"
                    >
                      Cancel
                    </AnimatedButton>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        )}
      </div>
    </FadeIn>
  );
};

interface LogContentProps {
  session: LogSession;
}

const LogContent: React.FC<LogContentProps> = ({ session }) => {
  if (!session) return null;

  const {
    toggleLevelCollapse,
    toggleTimestampFold,
    setLevelFilter,
    setSearchFilter,
  } = useLogStore();

  // Filter entries
  const filteredEntries = useMemo(() => {
    return session.entries.filter((entry: LogEntry) => {
      // Level filter
      if (!session.filters.levels.includes(entry.level)) return false;

      // Search filter
      if (
        session.filters.search &&
        !entry.message
          .toLowerCase()
          .includes(session.filters.search.toLowerCase())
      ) {
        return false;
      }

      return true;
    });
  }, [session]);

  // Group by level
  const groupedByLevel = useMemo(() => {
    return filteredEntries.reduce<Record<LogLevel, LogEntry[]>>(
      (acc: Record<LogLevel, LogEntry[]>, entry: LogEntry) => {
        if (!acc[entry.level]) acc[entry.level] = [];
        acc[entry.level].push(entry);
        return acc;
      },
      {} as Record<LogLevel, LogEntry[]>,
    );
  }, [filteredEntries]);

  const allLevels: LogLevel[] = [
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
    "unknown",
  ];

  return (
    <>
      {/* Toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={session.filters.search}
            onChange={(e) => setSearchFilter(session.id, e.target.value)}
            placeholder="Search logs..."
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={() => toggleTimestampFold(session.id)}
            className={`p-2 rounded transition-colors ${
              session.timestampFolded
                ? "bg-green-500 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            }`}
            title="Toggle timestamp folding"
          >
            <Clock className="w-4 h-4" />
          </button>

          {/* Export filtered logs */}
          <div className="relative group">
            <button
              className="p-2 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
              title="Export filtered logs"
            >
              <Download className="w-4 h-4" />
            </button>
            <div className="absolute right-0 mt-1 hidden group-hover:block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-10">
              <button
                onClick={() =>
                  exportAsJSON(filteredEntries, `${session.title}_filtered`)
                }
                className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white whitespace-nowrap"
              >
                Export as JSON
              </button>
              <button
                onClick={() =>
                  exportAsCSV(filteredEntries, `${session.title}_filtered`)
                }
                className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white whitespace-nowrap"
              >
                Export as CSV
              </button>
              <button
                onClick={() =>
                  exportAsText(filteredEntries, `${session.title}_filtered`)
                }
                className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white whitespace-nowrap"
              >
                Export as TXT
              </button>
            </div>
          </div>
        </div>

        {/* Level filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-500" />
          {allLevels.map((level) => {
            const config = LOG_LEVEL_CONFIG[level];
            const isActive = session.filters.levels.includes(level);
            const count = session.entries.filter(
              (e: LogEntry) => e.level === level,
            ).length;

            if (count === 0) return null;

            return (
              <button
                key={level}
                onClick={() => {
                  const newLevels = isActive
                    ? session.filters.levels.filter(
                        (l: LogLevel) => l !== level,
                      )
                    : [...session.filters.levels, level];
                  setLevelFilter(session.id, newLevels);
                }}
                className={`px-2 py-1 text-xs rounded flex items-center gap-1.5 transition-all ${
                  isActive
                    ? "bg-green-500 text-white shadow-md"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 opacity-50"
                }`}
              >
                {config.icon}
                <span>{config.label}</span>
                <span className="font-semibold">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Showing {filteredEntries.length} of {session.entries.length} entries
        </div>
      </div>

      {/* Log Entries */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 font-mono text-sm">
        {allLevels.map((level) => {
          const entries = groupedByLevel[level] || [];
          if (entries.length === 0) return null;

          const config = LOG_LEVEL_CONFIG[level];
          const isCollapsed = session.collapsedLevels.has(level);

          return (
            <div
              key={level}
              className="border-b border-gray-200 dark:border-gray-700"
            >
              {/* Level header */}
              <button
                onClick={() => toggleLevelCollapse(session.id, level)}
                className={`w-full px-4 py-2 flex items-center gap-2 ${config.color} hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors`}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                {config.icon}
                <span className="font-semibold">{config.label}</span>
                <span className="text-xs opacity-75">({entries.length})</span>
              </button>

              {/* Entries */}
              {!isCollapsed &&
                entries.map((entry: LogEntry) => (
                  <div
                    key={entry.id}
                    className={`px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 ${config.bgColor}`}
                  >
                    <div className="flex items-start gap-3 text-gray-800 dark:text-gray-200">
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-12 flex-shrink-0">
                        {entry.lineNumber}
                      </span>
                      {entry.timestamp && !session.timestampFolded && (
                        <span className="text-xs text-gray-600 dark:text-gray-400 w-44 flex-shrink-0">
                          {entry.timestamp.toLocaleString()}
                        </span>
                      )}
                      {entry.source && (
                        <span className="text-xs text-purple-600 dark:text-purple-400 max-w-xs truncate">
                          [{entry.source}]
                        </span>
                      )}
                      <pre className="flex-1 whitespace-pre-wrap break-words">
                        {entry.message}
                      </pre>
                    </div>
                  </div>
                ))}
            </div>
          );
        })}

        {filteredEntries.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No matching log entries</p>
              <p className="text-xs mt-1">Try adjusting your filters</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default LogViewerPanel;
