import React, { useState } from "react";
import {
  FileCode,
  X,
  Plus,
  GitPullRequest,
  Trash2,
  CheckCircle,
  Clock,
  Download,
} from "lucide-react";
import { useReviewStore } from "../lib/stores/reviewStore";
import { AnimatedButton, FadeIn } from "./Animations";
import DiffViewer from "./DiffViewer";

export const CodeReviewPanel: React.FC = () => {
  const {
    sessions,
    currentSession,
    isReviewMode,
    toggleReviewMode,
    createSession,
    setCurrentSession,
    deleteSession,
    completeSession,
    parseDiff,
    addFile,
    exportAsGitHubComment,
  } = useReviewStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [newSessionDescription, setNewSessionDescription] = useState("");
  const [diffInput, setDiffInput] = useState("");

  const handleCreateSession = () => {
    if (!newSessionTitle.trim()) return;

    const sessionId = createSession(newSessionTitle, newSessionDescription);

    // If there's diff input, parse and add files
    if (diffInput.trim()) {
      const files = parseDiff(diffInput);
      files.forEach((file) => addFile(sessionId, file));
    }

    setNewSessionTitle("");
    setNewSessionDescription("");
    setDiffInput("");
    setShowCreateModal(false);
  };

  const handleExport = async (sessionId: string) => {
    const markdown = exportAsGitHubComment(sessionId);
    await navigator.clipboard.writeText(markdown);
    // Show toast notification
    const event = new CustomEvent("show-toast", {
      detail: {
        message: "Review exported to clipboard!",
        type: "success",
      },
    });
    window.dispatchEvent(event);
  };

  if (!isReviewMode) {
    return null;
  }

  return (
    <FadeIn>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <GitPullRequest className="w-6 h-6 text-purple-500" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Code Review Mode
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {currentSession
                    ? currentSession.title
                    : "Select or create a review session"}
                </p>
              </div>
            </div>
            <button
              onClick={toggleReviewMode}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close review mode"
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
                  New Review Session
                </AnimatedButton>

                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Review Sessions ({sessions.length})
                </h3>

                <div className="space-y-2">
                  {sessions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                      <FileCode className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No review sessions yet</p>
                      <p className="text-xs mt-1">Create one to get started</p>
                    </div>
                  ) : (
                    sessions.map((session) => (
                      <div
                        key={session.id}
                        className={`p-3 rounded-lg border transition-all ${
                          currentSession?.id === session.id
                            ? "bg-white dark:bg-gray-900 border-purple-500 shadow-md"
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
                            {session.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                {session.description}
                              </p>
                            )}
                          </button>
                          <button
                            onClick={() => deleteSession(session.id)}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                            title="Delete session"
                          >
                            <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
                              session.status === "complete"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                : session.status === "exported"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                            }`}
                          >
                            {session.status === "complete" ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : session.status === "exported" ? (
                              <Download className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            {session.status}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {session.files.length} files
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {session.annotations.length} comments
                          </span>
                        </div>

                        {currentSession?.id === session.id && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 flex gap-2">
                            <AnimatedButton
                              onClick={() => completeSession(session.id)}
                              variant="secondary"
                              size="sm"
                              className="flex-1 !text-xs"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Complete
                            </AnimatedButton>
                            <AnimatedButton
                              onClick={() => handleExport(session.id)}
                              variant="primary"
                              size="sm"
                              className="flex-1 !text-xs"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Export
                            </AnimatedButton>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Diff Viewer */}
            <div className="flex-1 overflow-hidden">
              {currentSession ? (
                <DiffViewer sessionId={currentSession.id} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <GitPullRequest className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-semibold mb-2">
                      Select a Review Session
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
                      Create Review Session
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
                        placeholder="e.g., Review authentication refactor"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Description (optional)
                      </label>
                      <textarea
                        value={newSessionDescription}
                        onChange={(e) =>
                          setNewSessionDescription(e.target.value)
                        }
                        placeholder="Brief description of what's being reviewed..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Paste Diff (optional)
                      </label>
                      <textarea
                        value={diffInput}
                        onChange={(e) => setDiffInput(e.target.value)}
                        placeholder="Paste git diff output here..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                        rows={10}
                      />
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Tip: Run{" "}
                        <code className="px-1 bg-gray-100 dark:bg-gray-700 rounded">
                          git diff
                        </code>{" "}
                        and paste the output here
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

export default CodeReviewPanel;
