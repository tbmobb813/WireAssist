import React, { useState, useMemo } from "react";
import {
  FileCode,
  Plus,
  Minus,
  MessageSquare,
  AlertCircle,
  AlertTriangle,
  Info,
  Lightbulb,
  X,
  Copy,
  Check,
} from "lucide-react";
import { useReviewStore, DiffLine, DiffHunk } from "../lib/stores/reviewStore";
import { AnimatedButton } from "./Animations";
import hljs from "highlight.js/lib/core";

// Import commonly used languages for code review
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import sql from "highlight.js/lib/languages/sql";

// Register languages
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("go", go);
hljs.registerLanguage("java", java);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c", cpp);
hljs.registerLanguage("css", css);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("sql", sql);

/**
 * Detect language from file path
 */
const detectLanguageFromPath = (path: string): string | null => {
  const ext = path.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    cpp: "cpp",
    cc: "cpp",
    c: "c",
    h: "cpp",
    hpp: "cpp",
    css: "css",
    scss: "css",
    json: "json",
    xml: "xml",
    html: "html",
    sh: "bash",
    bash: "bash",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sql: "sql",
  };
  return ext && langMap[ext] ? langMap[ext] : null;
};

/**
 * Apply syntax highlighting to code line
 */
const highlightCode = (code: string, language: string | null): string => {
  if (!language || !code.trim()) return code;

  try {
    const result = hljs.highlight(code, { language, ignoreIllegals: true });
    return result.value;
  } catch {
    // If highlighting fails, return original code
    return code;
  }
};

interface DiffViewerProps {
  sessionId: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ sessionId }) => {
  const {
    currentSession,
    selectedFile,
    setSelectedFile,
    addAnnotation,
    deleteAnnotation,
  } = useReviewStore();

  const [annotatingLine, setAnnotatingLine] = useState<{
    hunkId: string;
    lineIndex: number;
  } | null>(null);
  const [annotationText, setAnnotationText] = useState("");
  const [annotationSeverity, setAnnotationSeverity] = useState<
    "info" | "warning" | "error" | "suggestion"
  >("info");
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  if (!currentSession || currentSession.id !== sessionId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <FileCode className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No review session loaded</p>
        </div>
      </div>
    );
  }

  const currentFile = currentSession.files.find((f: { path: string }) => f.path === selectedFile);

  const handleAddAnnotation = (hunkId: string, lineIndex: number) => {
    if (!annotationText.trim()) return;

    addAnnotation(sessionId, hunkId, {
      lineIndex,
      severity: annotationSeverity,
      message: annotationText,
    });

    setAnnotationText("");
    setAnnotatingLine(null);
  };

  const handleCopyMarkdown = async () => {
    const markdown = useReviewStore.getState().exportAsGitHubComment(sessionId);
    await navigator.clipboard.writeText(markdown);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      {/* File List Sidebar */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">
            Files Changed ({currentSession.files.length})
          </h3>

          {/* Overall Statistics */}
          {(() => {
            const overallStats = currentSession.files.reduce(
              (acc: { added: number; removed: number }, file: { hunks: DiffHunk[] }) => {
                file.hunks.forEach((hunk: DiffHunk) => {
                  hunk.lines.forEach((line: DiffLine) => {
                    if (line.type === "add") acc.added++;
                    else if (line.type === "remove") acc.removed++;
                  });
                });
                return acc;
              },
              { added: 0, removed: 0 },
            );
            return (
              <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-900/50 rounded text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-600 dark:text-gray-400">
                    Total Changes
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Plus className="w-3 h-3 text-green-600 dark:text-green-400" />
                    <span className="font-mono text-green-700 dark:text-green-300">
                      {overallStats.added}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Minus className="w-3 h-3 text-red-600 dark:text-red-400" />
                    <span className="font-mono text-red-700 dark:text-red-300">
                      {overallStats.removed}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          <AnimatedButton
            onClick={handleCopyMarkdown}
            variant="secondary"
            size="sm"
            className="w-full !text-xs"
          >
            {copiedMarkdown ? (
              <>
                <Check className="w-3 h-3 mr-1" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 mr-1" />
                Export as Markdown
              </>
            )}
          </AnimatedButton>
        </div>

        <div className="p-2">
          {currentSession.files.map((file: { path: string; hunks: DiffHunk[]; status?: string }) => {
            const annotationCount = currentSession.annotations.filter((ann: { id: string }) =>
              file.hunks.some((h: DiffHunk) =>
                h.lines.some((l: DiffLine) => l.annotation?.id === ann.id),
              ),
            ).length;

            return (
              <button
                key={file.path}
                onClick={() => setSelectedFile(file.path)}
                className={`w-full text-left p-2 rounded mb-1 text-sm transition-colors ${selectedFile === file.path
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  }`}
              >
                <div className="flex items-start gap-2">
                  <FileCode className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-mono text-xs">
                      {file.path}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <span
                        className={`px-1 rounded ${file.status === "added"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : file.status === "deleted"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                            : file.status === "renamed"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                          }`}
                      >
                        {file.status}
                      </span>
                      {annotationCount > 0 && (
                        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                          <MessageSquare className="w-3 h-3" />
                          {annotationCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Diff Content Area */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
        {!currentFile ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <FileCode className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a file to review</p>
            </div>
          </div>
        ) : (
          <div className="p-6">
            {/* File Header with Stats */}
            <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <FileCode className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white font-mono">
                  {currentFile.path}
                </h2>
                <span
                  className={`px-2 py-1 text-xs rounded ${currentFile.status === "added"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : currentFile.status === "deleted"
                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                      : currentFile.status === "renamed"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                >
                  {currentFile.status}
                </span>
                {currentFile.language && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {currentFile.language}
                  </span>
                )}
              </div>

              {/* Diff Statistics */}
              {(() => {
                const stats = currentFile.hunks.reduce(
                  (acc: { added: number; removed: number }, hunk: DiffHunk) => {
                    hunk.lines.forEach((line: DiffLine) => {
                      if (line.type === "add") acc.added++;
                      else if (line.type === "remove") acc.removed++;
                    });
                    return acc;
                  },
                  { added: 0, removed: 0 },
                );
                return (
                  <div className="flex items-center gap-4 text-sm mb-2">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="font-mono text-green-700 dark:text-green-300">
                        +{stats.added}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Minus className="w-4 h-4 text-red-600 dark:text-red-400" />
                      <span className="font-mono text-red-700 dark:text-red-300">
                        -{stats.removed}
                      </span>
                    </div>
                    <span className="text-gray-500 dark:text-gray-400">
                      ({stats.added + stats.removed} lines changed)
                    </span>
                  </div>
                );
              })()}

              {currentFile.oldPath && currentFile.status === "renamed" && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Renamed from:{" "}
                  <code className="font-mono">{currentFile.oldPath}</code>
                </div>
              )}
            </div>

            {/* Hunks */}
            {currentFile.hunks.map((hunk: DiffHunk) => (
              <DiffHunkView
                key={hunk.id}
                hunk={hunk}
                filePath={currentFile.path}
                language={currentFile.language || null}
                sessionId={sessionId}
                annotatingLine={annotatingLine}
                setAnnotatingLine={setAnnotatingLine}
                annotationText={annotationText}
                setAnnotationText={setAnnotationText}
                annotationSeverity={annotationSeverity}
                setAnnotationSeverity={setAnnotationSeverity}
                handleAddAnnotation={handleAddAnnotation}
                deleteAnnotation={deleteAnnotation}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface DiffHunkViewProps {
  hunk: DiffHunk;
  filePath: string;
  language: string | null;
  sessionId: string;
  annotatingLine: { hunkId: string; lineIndex: number } | null;
  setAnnotatingLine: (
    value: { hunkId: string; lineIndex: number } | null,
  ) => void;
  annotationText: string;
  setAnnotationText: (text: string) => void;
  annotationSeverity: "info" | "warning" | "error" | "suggestion";
  setAnnotationSeverity: (
    severity: "info" | "warning" | "error" | "suggestion",
  ) => void;
  handleAddAnnotation: (hunkId: string, lineIndex: number) => void;
  deleteAnnotation: (sessionId: string, annotationId: string) => void;
}

const DiffHunkView: React.FC<DiffHunkViewProps> = ({
  hunk,
  filePath,
  language,
  sessionId,
  annotatingLine,
  setAnnotatingLine,
  annotationText,
  setAnnotationText,
  annotationSeverity,
  setAnnotationSeverity,
  handleAddAnnotation,
  deleteAnnotation,
}) => {
  // Detect language from file path if not provided
  const detectedLang = useMemo(
    () => language || detectLanguageFromPath(filePath),
    [language, filePath],
  );
  return (
    <div className="mb-8 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Hunk Header */}
      <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 text-sm font-mono text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
        <span className="text-blue-600 dark:text-blue-400">
          @@ -{hunk.oldLineStart},{hunk.oldLineCount} +{hunk.newLineStart},
          {hunk.newLineCount} @@
        </span>
        {hunk.context && (
          <span className="ml-2 text-gray-500 dark:text-gray-400">
            {hunk.context}
          </span>
        )}
      </div>

      {/* Diff Lines */}
      <div className="bg-white dark:bg-gray-900">
        {hunk.lines.map((line: DiffLine, idx: number) => (
          <DiffLineView
            key={idx}
            line={line}
            lineIndex={idx}
            hunk={hunk}
            language={detectedLang}
            sessionId={sessionId}
            annotatingLine={annotatingLine}
            setAnnotatingLine={setAnnotatingLine}
            annotationText={annotationText}
            setAnnotationText={setAnnotationText}
            annotationSeverity={annotationSeverity}
            setAnnotationSeverity={setAnnotationSeverity}
            handleAddAnnotation={handleAddAnnotation}
            deleteAnnotation={deleteAnnotation}
          />
        ))}
      </div>
    </div>
  );
};

interface DiffLineViewProps {
  line: DiffLine;
  lineIndex: number;
  hunk: DiffHunk;
  language: string | null;
  sessionId: string;
  annotatingLine: { hunkId: string; lineIndex: number } | null;
  setAnnotatingLine: (
    value: { hunkId: string; lineIndex: number } | null,
  ) => void;
  annotationText: string;
  setAnnotationText: (text: string) => void;
  annotationSeverity: "info" | "warning" | "error" | "suggestion";
  setAnnotationSeverity: (
    severity: "info" | "warning" | "error" | "suggestion",
  ) => void;
  handleAddAnnotation: (hunkId: string, lineIndex: number) => void;
  deleteAnnotation: (sessionId: string, annotationId: string) => void;
}

const DiffLineView: React.FC<DiffLineViewProps> = ({
  line,
  lineIndex,
  hunk,
  language,
  sessionId,
  annotatingLine,
  setAnnotatingLine,
  annotationText,
  setAnnotationText,
  annotationSeverity,
  setAnnotationSeverity,
  handleAddAnnotation,
  deleteAnnotation,
}) => {
  const isAnnotating =
    annotatingLine?.hunkId === hunk.id &&
    annotatingLine?.lineIndex === lineIndex;

  const getLineColor = () => {
    if (line.type === "add")
      return "bg-green-50 dark:bg-green-900/10 border-l-4 border-green-500";
    if (line.type === "remove")
      return "bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500";
    return "bg-gray-50 dark:bg-gray-800/50";
  };

  const getLineIcon = () => {
    if (line.type === "add")
      return <Plus className="w-3 h-3 text-green-600 dark:text-green-400" />;
    if (line.type === "remove")
      return <Minus className="w-3 h-3 text-red-600 dark:text-red-400" />;
    return null;
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "suggestion":
        return <Lightbulb className="w-4 h-4 text-blue-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  // Apply syntax highlighting to line content
  const highlightedContent = useMemo(() => {
    // Strip diff prefix (+, -, space) for highlighting
    const cleanContent = line.content.replace(/^[+\-\s]/, "");
    return highlightCode(cleanContent, language);
  }, [line.content, language]);

  return (
    <>
      <div
        className={`flex items-start group hover:bg-gray-100 dark:hover:bg-gray-800 ${getLineColor()}`}
      >
        {/* Line Numbers */}
        <div className="flex-shrink-0 w-24 px-2 py-1 text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 select-none">
          <span className="inline-block w-10 text-right">
            {line.oldLineNumber || ""}
          </span>
          <span className="inline-block w-10 text-right ml-2">
            {line.newLineNumber || ""}
          </span>
        </div>

        {/* Line Content */}
        <div className="flex-1 flex items-start gap-2 px-3 py-1 font-mono text-sm">
          <span className="flex-shrink-0 mt-1">{getLineIcon()}</span>
          <pre
            className="flex-1 whitespace-pre-wrap text-gray-800 dark:text-gray-200 hljs"
            dangerouslySetInnerHTML={{ __html: highlightedContent }}
          />

          {/* Add Comment Button */}
          <button
            onClick={() => setAnnotatingLine({ hunkId: hunk.id, lineIndex })}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Add comment"
          >
            <MessageSquare className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Existing Annotation */}
      {line.annotation && (
        <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 ml-24">
          <div className="flex items-start gap-3">
            {getSeverityIcon(line.annotation.severity)}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase text-gray-700 dark:text-gray-300">
                  {line.annotation.severity}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(line.annotation.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {line.annotation.message}
              </p>
              {line.annotation.suggestedFix && (
                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono overflow-x-auto">
                  {line.annotation.suggestedFix}
                </pre>
              )}
            </div>
            <button
              onClick={() => deleteAnnotation(sessionId, line.annotation!.id)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Delete comment"
            >
              <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      )}

      {/* Annotation Form */}
      {isAnnotating && (
        <div className="border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-900/20 px-4 py-3 ml-24">
          <div className="space-y-3">
            <div className="flex gap-2">
              {(["info", "warning", "error", "suggestion"] as const).map(
                (severity) => (
                  <button
                    key={severity}
                    onClick={() => setAnnotationSeverity(severity)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${annotationSeverity === severity
                      ? "bg-purple-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                      }`}
                  >
                    {severity}
                  </button>
                ),
              )}
            </div>
            <textarea
              value={annotationText}
              onChange={(e) => setAnnotationText(e.target.value)}
              placeholder="Add your review comment..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2">
              <AnimatedButton
                onClick={() => handleAddAnnotation(hunk.id, lineIndex)}
                variant="primary"
                size="sm"
              >
                Add Comment
              </AnimatedButton>
              <AnimatedButton
                onClick={() => setAnnotatingLine(null)}
                variant="secondary"
                size="sm"
              >
                Cancel
              </AnimatedButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DiffViewer;
