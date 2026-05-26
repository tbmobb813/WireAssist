import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Log severity levels
 */
export type LogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal"
  | "unknown";

/**
 * Supported log formats
 */
export type LogFormat =
  | "syslog"
  | "docker"
  | "nginx"
  | "apache"
  | "json"
  | "generic";

/**
 * Parsed log entry
 */
export interface LogEntry {
  id: string;
  raw: string;
  timestamp?: Date;
  level: LogLevel;
  message: string;
  source?: string;
  metadata?: Record<string, any>;
  lineNumber: number;
}

/**
 * Log session for analysis
 */
export interface LogSession {
  id: string;
  title: string;
  format: LogFormat;
  entries: LogEntry[];
  createdAt: number;
  collapsedLevels: Set<LogLevel>;
  timestampFolded: boolean;
  filters: {
    levels: LogLevel[];
    search: string;
    timeRange?: { start: Date; end: Date };
  };
}

interface LogStore {
  // State
  sessions: LogSession[];
  currentSession: LogSession | null;
  isLogViewerOpen: boolean;

  // Actions
  createSession: (title: string, rawLogs: string, format?: LogFormat) => string;
  setCurrentSession: (sessionId: string | null) => void;
  deleteSession: (sessionId: string) => void;
  toggleLogViewer: () => void;
  toggleLevelCollapse: (sessionId: string, level: LogLevel) => void;
  toggleTimestampFold: (sessionId: string) => void;
  setLevelFilter: (sessionId: string, levels: LogLevel[]) => void;
  setSearchFilter: (sessionId: string, search: string) => void;
  parseLog: (rawLogs: string, format?: LogFormat) => LogEntry[];
}

/**
 * Generate unique ID
 */
const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Detect log format from content
 */
function detectLogFormat(rawLogs: string): LogFormat {
  const firstLines = rawLogs.split("\n").slice(0, 10).join("\n");

  // JSON logs
  if (firstLines.trim().startsWith("{") && firstLines.includes('"level"')) {
    return "json";
  }

  // Docker logs (with container ID prefix)
  if (/^[a-f0-9]{12}\s/.test(firstLines)) {
    return "docker";
  }

  // Syslog format: "Jan 15 10:00:00 hostname service[pid]: message"
  if (
    /^[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\S+\s+\S+/.test(firstLines)
  ) {
    return "syslog";
  }

  // Nginx access logs
  if (/^\d+\.\d+\.\d+\.\d+\s+-\s+-\s+\[/.test(firstLines)) {
    return "nginx";
  }

  // Apache logs
  if (/^\[.*?\]\s+\[.*?:.*?\]/.test(firstLines)) {
    return "apache";
  }

  return "generic";
}

/**
 * Parse log level from text
 */
function parseLogLevel(text: string): LogLevel {
  const lower = text.toLowerCase();

  if (lower.includes("fatal") || lower.includes("critical")) return "fatal";
  if (lower.includes("error") || lower.includes("err")) return "error";
  if (lower.includes("warn") || lower.includes("warning")) return "warn";
  if (lower.includes("info")) return "info";
  if (lower.includes("debug")) return "debug";
  if (lower.includes("trace")) return "trace";

  return "unknown";
}

/**
 * Parse timestamp from various formats
 */
function parseTimestamp(text: string): Date | undefined {
  // ISO 8601: 2024-01-15T10:00:00Z
  const iso = text.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  if (iso) return new Date(iso[0]);

  // Syslog: Jan 15 10:00:00
  const syslog = text.match(
    /([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})/,
  );
  if (syslog) {
    const [, month, day, time] = syslog;
    const year = new Date().getFullYear();
    const monthMap: Record<string, number> = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
    };
    const [hour, min, sec] = time.split(":").map(Number);
    return new Date(year, monthMap[month], parseInt(day), hour, min, sec);
  }

  // Unix timestamp: 1705315200
  const unix = text.match(/\b(\d{10})\b/);
  if (unix) return new Date(parseInt(unix[1]) * 1000);

  return undefined;
}

/**
 * Parse JSON log format
 */
function parseJsonLog(line: string, lineNumber: number): LogEntry | null {
  try {
    const json = JSON.parse(line);
    return {
      id: generateId(),
      raw: line,
      timestamp: json.timestamp
        ? new Date(json.timestamp)
        : json.time
          ? new Date(json.time)
          : undefined,
      level: parseLogLevel(json.level || json.severity || json.levelname || ""),
      message: json.message || json.msg || json.text || line,
      source: json.source || json.logger || json.name,
      metadata: json,
      lineNumber,
    };
  } catch {
    return null;
  }
}

/**
 * Parse Docker log format
 */
function parseDockerLog(line: string, lineNumber: number): LogEntry {
  // Format: container_id timestamp level message
  const match = line.match(/^([a-f0-9]{12})\s+(.+)$/);
  if (match) {
    const [, containerId, rest] = match;
    return {
      id: generateId(),
      raw: line,
      timestamp: parseTimestamp(rest),
      level: parseLogLevel(rest),
      message: rest,
      source: containerId,
      lineNumber,
    };
  }

  return {
    id: generateId(),
    raw: line,
    level: parseLogLevel(line),
    message: line,
    lineNumber,
  };
}

/**
 * Parse Syslog format
 */
function parseSyslog(line: string, lineNumber: number): LogEntry {
  // Format: Jan 15 10:00:00 hostname service[pid]: message
  const match = line.match(
    /^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+?)(\[\d+\])?:\s*(.*)$/,
  );

  if (match) {
    const [, timestamp, hostname, service, , message] = match;
    return {
      id: generateId(),
      raw: line,
      timestamp: parseTimestamp(timestamp),
      level: parseLogLevel(message),
      message,
      source: `${hostname}:${service}`,
      lineNumber,
    };
  }

  return {
    id: generateId(),
    raw: line,
    timestamp: parseTimestamp(line),
    level: parseLogLevel(line),
    message: line,
    lineNumber,
  };
}

/**
 * Parse generic log format
 */
function parseGenericLog(line: string, lineNumber: number): LogEntry {
  return {
    id: generateId(),
    raw: line,
    timestamp: parseTimestamp(line),
    level: parseLogLevel(line),
    message: line,
    lineNumber,
  };
}

/**
 * Parse raw logs into structured entries
 */
function parseLogs(rawLogs: string, format?: LogFormat): LogEntry[] {
  const lines = rawLogs.split("\n").filter((line) => line.trim());
  const detectedFormat = format || detectLogFormat(rawLogs);

  return lines
    .map((line, idx) => {
      const lineNumber = idx + 1;

      switch (detectedFormat) {
        case "json":
          return (
            parseJsonLog(line, lineNumber) || parseGenericLog(line, lineNumber)
          );
        case "docker":
          return parseDockerLog(line, lineNumber);
        case "syslog":
          return parseSyslog(line, lineNumber);
        case "nginx":
        case "apache":
        case "generic":
        default:
          return parseGenericLog(line, lineNumber);
      }
    })
    .filter((entry): entry is LogEntry => entry !== null);
}

export const useLogStore = create<LogStore>()(
  persist(
    (set, get) => ({
      // Initial state
      sessions: [],
      currentSession: null,
      isLogViewerOpen: false,

      // Create a new log session
      createSession: (title, rawLogs, format) => {
        const id = generateId();
        const entries = parseLogs(rawLogs, format);
        const detectedFormat = format || detectLogFormat(rawLogs);

        const session: LogSession = {
          id,
          title,
          format: detectedFormat,
          entries,
          createdAt: Date.now(),
          collapsedLevels: new Set(),
          timestampFolded: false,
          filters: {
            levels: [
              "trace",
              "debug",
              "info",
              "warn",
              "error",
              "fatal",
              "unknown",
            ],
            search: "",
          },
        };

        set((state) => ({
          sessions: [...state.sessions, session],
          currentSession: session,
          isLogViewerOpen: true,
        }));

        return id;
      },

      // Set current session
      setCurrentSession: (sessionId) => {
        const session = get().sessions.find((s) => s.id === sessionId) || null;
        set({ currentSession: session, isLogViewerOpen: !!session });
      },

      // Delete a session
      deleteSession: (sessionId) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          currentSession:
            state.currentSession?.id === sessionId
              ? null
              : state.currentSession,
          isLogViewerOpen:
            state.currentSession?.id === sessionId
              ? false
              : state.isLogViewerOpen,
        }));
      },

      // Toggle log viewer
      toggleLogViewer: () => {
        set((state) => ({ isLogViewerOpen: !state.isLogViewerOpen }));
      },

      // Toggle level collapse
      toggleLevelCollapse: (sessionId, level) => {
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== sessionId) return session;

            const collapsed = new Set(session.collapsedLevels);
            if (collapsed.has(level)) {
              collapsed.delete(level);
            } else {
              collapsed.add(level);
            }

            return { ...session, collapsedLevels: collapsed };
          }),
          currentSession:
            state.currentSession?.id === sessionId
              ? {
                  ...state.currentSession,
                  collapsedLevels: (() => {
                    const collapsed = new Set(
                      state.currentSession.collapsedLevels,
                    );
                    if (collapsed.has(level)) {
                      collapsed.delete(level);
                    } else {
                      collapsed.add(level);
                    }
                    return collapsed;
                  })(),
                }
              : state.currentSession,
        }));
      },

      // Toggle timestamp folding
      toggleTimestampFold: (sessionId) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, timestampFolded: !session.timestampFolded }
              : session,
          ),
          currentSession:
            state.currentSession?.id === sessionId
              ? {
                  ...state.currentSession,
                  timestampFolded: !state.currentSession.timestampFolded,
                }
              : state.currentSession,
        }));
      },

      // Set level filter
      setLevelFilter: (sessionId, levels) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, filters: { ...session.filters, levels } }
              : session,
          ),
          currentSession:
            state.currentSession?.id === sessionId
              ? {
                  ...state.currentSession,
                  filters: { ...state.currentSession.filters, levels },
                }
              : state.currentSession,
        }));
      },

      // Set search filter
      setSearchFilter: (sessionId, search) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, filters: { ...session.filters, search } }
              : session,
          ),
          currentSession:
            state.currentSession?.id === sessionId
              ? {
                  ...state.currentSession,
                  filters: { ...state.currentSession.filters, search },
                }
              : state.currentSession,
        }));
      },

      // Parse logs (utility exposed)
      parseLog: parseLogs,
    }),
    {
      name: "linux-ai-assistant-logs",
      partialize: (state) => ({
        sessions: state.sessions.map((s) => ({
          ...s,
          // Convert Set to Array for serialization
          collapsedLevels: Array.from(s.collapsedLevels),
        })),
      }),
      // Deserialize Sets properly
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.sessions = state.sessions.map((s: any) => ({
            ...s,
            collapsedLevels: new Set(s.collapsedLevels || []),
          }));
        }
      },
    },
  ),
);
