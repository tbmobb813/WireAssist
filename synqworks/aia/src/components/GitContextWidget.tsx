import { useState, useEffect } from "react";
import { getInvoke } from "../lib/tauri-shim";
import { FadeIn } from "./Animations";

interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

interface GitContext {
  is_repo: boolean;
  branch: string | null;
  dirty: boolean;
  uncommitted_changes: number;
  recent_commits: GitCommit[];
  remote_url: string | null;
}

interface ProjectInfo {
  project_type: string;
  name: string | null;
  version: string | null;
  description: string | null;
}

interface GitContextWidgetProps {
  projectPath?: string;
  onIncludeContext?: (context: string) => void;
}

export default function GitContextWidget({
  projectPath,
  onIncludeContext,
}: GitContextWidgetProps) {
  const [gitContext, setGitContext] = useState<GitContext | null>(null);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadGitContext();
    loadProjectInfo();
  }, [projectPath]);

  const loadGitContext = async () => {
    setIsLoading(true);
    try {
      const invoke = await getInvoke();
      if (!invoke) {
        // Not in Tauri environment - hide widget
        setGitContext(null);
        setIsLoading(false);
        return;
      }

      const context = await invoke<GitContext>("get_git_context", {
        path: projectPath || undefined,
      });
      setGitContext(context);
    } catch (error) {
      console.debug("Failed to load git context:", error);
      setGitContext(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProjectInfo = async () => {
    try {
      const invoke = await getInvoke();
      if (!invoke) {
        setProjectInfo(null);
        return;
      }

      const info = await invoke<ProjectInfo>("detect_project_type", {
        path: projectPath || undefined,
      });
      setProjectInfo(info);
    } catch (error) {
      console.debug("Failed to detect project type:", error);
      setProjectInfo(null);
    }
  };

  const getProjectIcon = (type: string): string => {
    const icons: Record<string, string> = {
      Node: "📦",
      Rust: "🦀",
      Python: "🐍",
      Go: "🐹",
      Java: "☕",
      Ruby: "💎",
      Php: "🐘",
      CSharp: "#️⃣",
      Unknown: "📁",
    };
    return icons[type] || "📁";
  };

  const handleIncludeContext = async () => {
    if (!onIncludeContext || !gitContext?.is_repo) return;

    try {
      const invoke = await getInvoke();
      if (!invoke) return;

      const formatted = await invoke<string>("format_git_context", {
        path: projectPath || undefined,
      });

      // Add project info if available
      let fullContext = formatted;
      if (projectInfo && projectInfo.project_type !== "Unknown") {
        const projectHeader = `\n## 📦 Project Information\n\n**Type:** ${projectInfo.project_type}\n**Name:** ${projectInfo.name || "Unknown"}\n${projectInfo.version ? `**Version:** ${projectInfo.version}\n` : ""}${projectInfo.description ? `**Description:** ${projectInfo.description}\n` : ""}\n---\n`;
        fullContext = projectHeader + formatted;
      }

      onIncludeContext(fullContext);
    } catch (error) {
      console.debug("Failed to format git context:", error);
    }
  };
  if (isLoading) {
    return (
      <div className="p-3 rounded-lg bg-[#24283b]/50 animate-pulse">
        <div className="h-4 bg-[#414868] rounded w-32"></div>
      </div>
    );
  }

  if (!gitContext || !gitContext.is_repo) {
    return null; // Don't show widget if not in a git repo
  }

  return (
    <FadeIn>
      <div className="rounded-xl bg-gradient-to-br from-[#7aa2f7]/10 to-[#bb9af7]/10 backdrop-blur-sm border border-[#7aa2f7]/30 overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#24283b]/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {projectInfo && projectInfo.project_type !== "Unknown" && (
                <span className="text-2xl">
                  {getProjectIcon(projectInfo.project_type)}
                </span>
              )}
              <span className="text-2xl">🔀</span>
            </div>
            <div className="text-left">
              <div className="font-semibold text-[#c0caf5] text-sm">
                {projectInfo && projectInfo.project_type !== "Unknown"
                  ? `${projectInfo.project_type} Project`
                  : "Git Context"}
              </div>
              {gitContext.branch && (
                <div className="text-xs text-[#9aa5ce] flex items-center gap-2">
                  <span className="font-mono">{gitContext.branch}</span>
                  {projectInfo?.name && (
                    <>
                      <span>•</span>
                      <span>{projectInfo.name}</span>
                    </>
                  )}
                  {gitContext.uncommitted_changes > 0 && (
                    <span className="px-1.5 py-0.5 bg-[#e0af68]/20 text-[#e0af68] border border-[#e0af68]/30 rounded text-xs">
                      {gitContext.uncommitted_changes} uncommitted
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-[#9aa5ce] transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-[#7aa2f7]/20 pt-3">
            {/* Project Info */}
            {projectInfo && projectInfo.project_type !== "Unknown" && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#9aa5ce] uppercase tracking-wide">
                  Project Info
                </div>
                <div className="text-sm p-2 rounded bg-[#24283b]/50">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">
                      {getProjectIcon(projectInfo.project_type)}
                    </span>
                    <div>
                      <div className="font-semibold text-[#c0caf5]">
                        {projectInfo.name || "Unknown"}
                        {projectInfo.version && (
                          <span className="ml-2 text-xs text-[#9aa5ce]">
                            v{projectInfo.version}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#9aa5ce]">
                        {projectInfo.project_type}
                        {projectInfo.description && (
                          <span className="ml-1">
                            • {projectInfo.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Status */}
            <div className="flex items-center gap-2 text-sm">
              {gitContext.uncommitted_changes === 0 ? (
                <>
                  <span className="text-[#9ece6a]">✓</span>
                  <span className="text-[#c0caf5]">
                    Working directory clean
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[#e0af68]">⚠</span>
                  <span className="text-[#c0caf5]">
                    {gitContext.uncommitted_changes} file
                    {gitContext.uncommitted_changes !== 1 ? "s" : ""} modified
                  </span>
                </>
              )}
            </div>

            {/* Remote URL */}
            {gitContext.remote_url && (
              <div className="text-xs text-[#9aa5ce] font-mono truncate">
                🔗 {gitContext.remote_url}
              </div>
            )}

            {/* Recent Commits */}
            {gitContext.recent_commits.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#9aa5ce] uppercase tracking-wide">
                  Recent Commits
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {gitContext.recent_commits.slice(0, 3).map((commit) => (
                    <div
                      key={commit.hash}
                      className="text-xs p-2 rounded bg-[#24283b]/50 border border-[#414868]/30"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[#565f89]">
                          {commit.hash.slice(0, 7)}
                        </span>
                        <span className="text-[#565f89]">•</span>
                        <span className="text-[#9aa5ce]">{commit.date}</span>
                      </div>
                      <div className="text-[#c0caf5] line-clamp-2">
                        {commit.message}
                      </div>
                      <div className="text-[#565f89] text-xs mt-1">
                        {commit.author}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Include Context Button */}
            {onIncludeContext && (
              <button
                onClick={handleIncludeContext}
                className="w-full mt-2 px-3 py-2 rounded-lg bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 text-[#1a1b26] text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Include Git Context in Next Message
              </button>
            )}
          </div>
        )}
      </div>
    </FadeIn>
  );
}
