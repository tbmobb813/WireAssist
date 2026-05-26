import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Represents a single diff hunk with file context
 */
export interface DiffHunk {
  id: string;
  filePath: string;
  oldLineStart: number;
  oldLineCount: number;
  newLineStart: number;
  newLineCount: number;
  lines: DiffLine[];
  context?: string; // Function/class context
}

/**
 * Represents a single line in a diff
 */
export interface DiffLine {
  type: "add" | "remove" | "context" | "header";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  annotation?: LineAnnotation;
}

/**
 * AI-generated annotation for a specific line
 */
export interface LineAnnotation {
  id: string;
  lineIndex: number;
  severity: "info" | "warning" | "error" | "suggestion";
  message: string;
  suggestedFix?: string;
  timestamp: number;
}

/**
 * Code review session
 */
export interface ReviewSession {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  files: ReviewFile[];
  annotations: LineAnnotation[];
  status: "in-progress" | "complete" | "exported";
}

/**
 * File being reviewed
 */
export interface ReviewFile {
  path: string;
  hunks: DiffHunk[];
  language?: string;
  status: "added" | "modified" | "deleted" | "renamed";
  oldPath?: string; // For renamed files
}

interface ReviewStore {
  // State
  currentSession: ReviewSession | null;
  sessions: ReviewSession[];
  isReviewMode: boolean;
  selectedFile: string | null;
  selectedHunk: string | null;

  // Actions
  createSession: (title: string, description?: string) => string;
  addFile: (sessionId: string, file: ReviewFile) => void;
  addAnnotation: (
    sessionId: string,
    hunkId: string,
    annotation: Omit<LineAnnotation, "id" | "timestamp">,
  ) => void;
  updateAnnotation: (
    sessionId: string,
    annotationId: string,
    updates: Partial<LineAnnotation>,
  ) => void;
  deleteAnnotation: (sessionId: string, annotationId: string) => void;
  setCurrentSession: (sessionId: string | null) => void;
  setSelectedFile: (filePath: string | null) => void;
  setSelectedHunk: (hunkId: string | null) => void;
  toggleReviewMode: () => void;
  exportAsGitHubComment: (sessionId: string) => string;
  parseDiff: (diffText: string) => ReviewFile[];
  completeSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
}

/**
 * Generates a unique ID
 */
const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Parse unified diff format into ReviewFile objects
 */
function parseDiffText(diffText: string): ReviewFile[] {
  const files: ReviewFile[] = [];
  const fileBlocks = diffText.split(/^diff --git /m).filter(Boolean);

  for (const block of fileBlocks) {
    const lines = block.split("\n");
    const headerLine = lines[0];

    // Extract file paths from "a/path b/path" format
    const pathMatch = headerLine.match(/a\/(.+?) b\/(.+)/);
    if (!pathMatch) continue;

    const [, oldPath, newPath] = pathMatch;
    const hunks: DiffHunk[] = [];

    // Determine file status
    let status: ReviewFile["status"] = "modified";
    if (block.includes("new file mode")) status = "added";
    else if (block.includes("deleted file mode")) status = "deleted";
    else if (oldPath !== newPath) status = "renamed";

    // Parse hunks
    let currentHunk: DiffHunk | null = null;
    let lineIndex = 0;

    for (const line of lines) {
      // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@ context
      const hunkMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@(.*)$/);
      if (hunkMatch) {
        if (currentHunk) hunks.push(currentHunk);

        const [, oldStart, oldCount, newStart, newCount, context] = hunkMatch;
        currentHunk = {
          id: generateId(),
          filePath: newPath,
          oldLineStart: parseInt(oldStart),
          oldLineCount: parseInt(oldCount || "1"),
          newLineStart: parseInt(newStart),
          newLineCount: parseInt(newCount || "1"),
          lines: [],
          context: context.trim() || undefined,
        };
        lineIndex = 0;
        continue;
      }

      if (!currentHunk) continue;

      // Parse diff lines
      if (line.startsWith("+") && !line.startsWith("+++")) {
        currentHunk.lines.push({
          type: "add",
          content: line.slice(1),
          newLineNumber: currentHunk.newLineStart + lineIndex,
        });
        lineIndex++;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        currentHunk.lines.push({
          type: "remove",
          content: line.slice(1),
          oldLineNumber: currentHunk.oldLineStart + lineIndex,
        });
        lineIndex++;
      } else if (line.startsWith(" ")) {
        currentHunk.lines.push({
          type: "context",
          content: line.slice(1),
          oldLineNumber: currentHunk.oldLineStart + lineIndex,
          newLineNumber: currentHunk.newLineStart + lineIndex,
        });
        lineIndex++;
      }
    }

    if (currentHunk) hunks.push(currentHunk);

    // Detect language from file extension
    const ext = newPath.split(".").pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      py: "python",
      rs: "rust",
      go: "go",
      java: "java",
      cpp: "cpp",
      c: "c",
      css: "css",
      scss: "scss",
      html: "html",
      json: "json",
      md: "markdown",
    };

    files.push({
      path: newPath,
      hunks,
      language: ext ? langMap[ext] : undefined,
      status,
      oldPath: status === "renamed" ? oldPath : undefined,
    });
  }

  return files;
}

/**
 * Export review session as GitHub-style markdown comment
 */
function exportReviewAsMarkdown(session: ReviewSession): string {
  let markdown = `# Code Review: ${session.title}\n\n`;

  if (session.description) {
    markdown += `${session.description}\n\n`;
  }

  markdown += `**Reviewed**: ${new Date(session.createdAt).toLocaleString()}\n`;
  markdown += `**Files**: ${session.files.length}\n`;
  markdown += `**Comments**: ${session.annotations.length}\n\n`;

  markdown += "---\n\n";

  // Group annotations by file
  const annotationsByFile = new Map<string, LineAnnotation[]>();
  for (const annotation of session.annotations) {
    // Find which file this annotation belongs to
    for (const file of session.files) {
      for (const hunk of file.hunks) {
        const lineExists = hunk.lines.some(
          (line) => line.annotation?.id === annotation.id,
        );
        if (lineExists) {
          const existing = annotationsByFile.get(file.path) || [];
          existing.push(annotation);
          annotationsByFile.set(file.path, existing);
          break;
        }
      }
    }
  }

  // Generate comments per file
  for (const [filePath, annotations] of annotationsByFile) {
    markdown += `## 📄 \`${filePath}\`\n\n`;

    for (const annotation of annotations) {
      const icon =
        annotation.severity === "error"
          ? "🔴"
          : annotation.severity === "warning"
            ? "⚠️"
            : annotation.severity === "suggestion"
              ? "💡"
              : "ℹ️";

      markdown += `### ${icon} Line ${annotation.lineIndex + 1} - ${annotation.severity.toUpperCase()}\n\n`;
      markdown += `${annotation.message}\n\n`;

      if (annotation.suggestedFix) {
        markdown += "**Suggested fix:**\n\n";
        markdown += "```\n";
        markdown += annotation.suggestedFix;
        markdown += "\n```\n\n";
      }
    }
  }

  markdown += "---\n\n";
  markdown += `*Generated by Linux AI Assistant - Code Review Mode*\n`;

  return markdown;
}

export const useReviewStore = create<ReviewStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentSession: null,
      sessions: [],
      isReviewMode: false,
      selectedFile: null,
      selectedHunk: null,

      // Create a new review session
      createSession: (title, description) => {
        const id = generateId();
        const session: ReviewSession = {
          id,
          title,
          description,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          files: [],
          annotations: [],
          status: "in-progress",
        };

        set((state) => ({
          sessions: [...state.sessions, session],
          currentSession: session,
          isReviewMode: true,
        }));

        return id;
      },

      // Add a file to a session
      addFile: (sessionId, file) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  files: [...session.files, file],
                  updatedAt: Date.now(),
                }
              : session,
          ),
          currentSession:
            state.currentSession?.id === sessionId
              ? {
                  ...state.currentSession,
                  files: [...state.currentSession.files, file],
                  updatedAt: Date.now(),
                }
              : state.currentSession,
        }));
      },

      // Add an annotation to a line
      addAnnotation: (sessionId, hunkId, annotation) => {
        const newAnnotation: LineAnnotation = {
          ...annotation,
          id: generateId(),
          timestamp: Date.now(),
        };

        set((state) => {
          const sessions = state.sessions.map((session) => {
            if (session.id !== sessionId) return session;

            // Add annotation to the session
            const updatedSession = {
              ...session,
              annotations: [...session.annotations, newAnnotation],
              updatedAt: Date.now(),
            };

            // Also add it to the specific line in the hunk
            updatedSession.files = session.files.map((file) => ({
              ...file,
              hunks: file.hunks.map((hunk) => {
                if (hunk.id !== hunkId) return hunk;
                return {
                  ...hunk,
                  lines: hunk.lines.map((line, idx) =>
                    idx === annotation.lineIndex
                      ? { ...line, annotation: newAnnotation }
                      : line,
                  ),
                };
              }),
            }));

            return updatedSession;
          });

          return {
            sessions,
            currentSession:
              state.currentSession?.id === sessionId
                ? sessions.find((s) => s.id === sessionId) || null
                : state.currentSession,
          };
        });
      },

      // Update an existing annotation
      updateAnnotation: (sessionId, annotationId, updates) => {
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== sessionId) return session;
            return {
              ...session,
              annotations: session.annotations.map((ann) =>
                ann.id === annotationId ? { ...ann, ...updates } : ann,
              ),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      // Delete an annotation
      deleteAnnotation: (sessionId, annotationId) => {
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== sessionId) return session;
            return {
              ...session,
              annotations: session.annotations.filter(
                (ann) => ann.id !== annotationId,
              ),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      // Set current session
      setCurrentSession: (sessionId) => {
        const session = get().sessions.find((s) => s.id === sessionId) || null;
        set({ currentSession: session, isReviewMode: !!session });
      },

      // Set selected file
      setSelectedFile: (filePath) => {
        set({ selectedFile: filePath });
      },

      // Set selected hunk
      setSelectedHunk: (hunkId) => {
        set({ selectedHunk: hunkId });
      },

      // Toggle review mode
      toggleReviewMode: () => {
        set((state) => ({ isReviewMode: !state.isReviewMode }));
      },

      // Export session as GitHub comment markdown
      exportAsGitHubComment: (sessionId) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (!session) return "";

        // Mark as exported
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, status: "exported" as const } : s,
          ),
        }));

        return exportReviewAsMarkdown(session);
      },

      // Parse diff text into ReviewFile objects
      parseDiff: (diffText) => {
        return parseDiffText(diffText);
      },

      // Complete a review session
      completeSession: (sessionId) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, status: "complete" as const, updatedAt: Date.now() }
              : s,
          ),
        }));
      },

      // Delete a review session
      deleteSession: (sessionId) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          currentSession:
            state.currentSession?.id === sessionId
              ? null
              : state.currentSession,
          isReviewMode:
            state.currentSession?.id === sessionId ? false : state.isReviewMode,
        }));
      },
    }),
    {
      name: "linux-ai-assistant-review",
      partialize: (state) => ({
        sessions: state.sessions,
        currentSession: state.currentSession,
      }),
    },
  ),
);
