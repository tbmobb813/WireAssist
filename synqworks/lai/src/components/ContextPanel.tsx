import { useState, useEffect } from "react";
import {
  Folder,
  GitBranch,
  Zap,
  FileText,
  ChevronRight,
  DollarSign,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";
import { useProjectStore } from "../lib/stores/projectStore";
import { isTauriEnvironment, invokeSafe } from "../lib/utils/tauri";
import CostDashboard from "./CostDashboard";

// Storage keys for all sections
const SECTION_KEYS = [
  "usage-cost",
  "project-files",
  "git-status",
  "quick-actions",
  "recent-files",
];

// Context Panel - Right sidebar with project context
export default function ContextPanel() {
  const [allExpanded, setAllExpanded] = useState(true);

  // Toggle all sections
  const toggleAll = () => {
    const newState = !allExpanded;
    setAllExpanded(newState);

    // Update all section states in localStorage
    SECTION_KEYS.forEach((key) => {
      try {
        localStorage.setItem(
          `context-section:${key}`,
          newState ? "open" : "closed",
        );
      } catch {
        // ignore storage errors
      }
    });

    // Trigger re-render by dispatching a custom event
    window.dispatchEvent(
      new CustomEvent("context-panel-toggle-all", {
        detail: { expanded: newState },
      }),
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 border-l border-gray-800 panel-slide-in-right">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-200">Context</h2>
        <button
          onClick={toggleAll}
          className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors flex-shrink-0"
          title={allExpanded ? "Collapse All Sections" : "Expand All Sections"}
          aria-label={allExpanded ? "Collapse All" : "Expand All"}
        >
          {allExpanded ? (
            <ChevronsDownUp size={16} />
          ) : (
            <ChevronsUpDown size={16} />
          )}
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto smooth-scroll">
        <CostSection />
        <ProjectFilesSection />
        <GitStatusSection />
        <QuickActionsSection />
        <RecentFilesSection />
      </div>
    </div>
  );
}

// Collapsible Section Component
interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  storageKey?: string; // persist open/closed state when provided
}

function Section({
  icon,
  title,
  children,
  defaultOpen = true,
  storageKey,
}: SectionProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (!storageKey) return defaultOpen;
    try {
      const raw = localStorage.getItem(`context-section:${storageKey}`);
      return raw === null ? defaultOpen : raw === "open";
    } catch {
      return defaultOpen;
    }
  });

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(
        `context-section:${storageKey}`,
        isOpen ? "open" : "closed",
      );
    } catch {
      // ignore storage errors
    }
  }, [isOpen, storageKey]);

  // Listen for toggle-all events
  useEffect(() => {
    const handleToggleAll = (e: Event) => {
      const customEvent = e as CustomEvent<{ expanded: boolean }>;
      setIsOpen(customEvent.detail.expanded);
    };

    window.addEventListener("context-panel-toggle-all", handleToggleAll);
    return () =>
      window.removeEventListener("context-panel-toggle-all", handleToggleAll);
  }, []);

  return (
    <div className="border-b border-gray-800">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors-smooth gpu-accelerated"
        aria-expanded={isOpen}
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        <ChevronRight
          size={14}
          className={`transform transition-transform-smooth ${
            isOpen ? "rotate-90" : ""
          }`}
        />
      </button>
      {isOpen && <div className="px-4 py-3 panel-fade-in">{children}</div>}
    </div>
  );
}

// Cost Section
function CostSection() {
  return (
    <Section
      icon={<DollarSign size={16} />}
      title="Usage & Cost"
      defaultOpen={true}
      storageKey="usage-cost"
    >
      <CostDashboard />
    </Section>
  );
}

// Project Files Section
function ProjectFilesSection() {
  const { events } = useProjectStore();
  const [fileTree, setFileTree] = useState<any[]>([]);

  useEffect(() => {
    if (events.length > 0) {
      // Build simple file tree from recent events
      const uniquePaths = Array.from(new Set(events.map((e) => e.path)));
      const tree = buildFileTree(uniquePaths);
      setFileTree(tree);
    }
  }, [events]);

  if (events.length === 0) {
    return (
      <Section
        icon={<Folder size={16} />}
        title="Project Files"
        storageKey="project-files"
      >
        <div className="text-sm text-gray-500">No files detected</div>
      </Section>
    );
  }

  return (
    <Section
      icon={<Folder size={16} />}
      title="Project Files"
      storageKey="project-files"
    >
      <div className="space-y-1 text-sm">
        {fileTree.length > 0 ? (
          fileTree.map((item, idx) => (
            <FileTreeItem key={idx} item={item} depth={0} />
          ))
        ) : (
          <div className="text-gray-500">No files detected</div>
        )}
      </div>
    </Section>
  );
} // File Tree Item
interface FileTreeItemProps {
  item: any;
  depth: number;
}

function FileTreeItem({ item, depth }: FileTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 1); // Auto-expand first level

  if (item.type === "file") {
    return (
      <div
        className="flex items-center gap-2 py-1 px-2 hover:bg-gray-800 rounded cursor-pointer transition-colors duration-150"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="text-gray-500">📄</span>
        <span className="text-gray-400 hover:text-gray-200 truncate">
          {item.name}
        </span>
        {item.modified && (
          <span className="ml-auto w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 py-1 px-2 hover:bg-gray-800 rounded transition-colors duration-150"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <ChevronRight
          size={12}
          className={`transform transition-transform duration-150 ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
        <span className="text-gray-500">📁</span>
        <span className="text-gray-400 hover:text-gray-200">{item.name}</span>
      </button>
      {isExpanded && item.children && (
        <div>
          {item.children.map((child: any, idx: number) => (
            <FileTreeItem key={idx} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// Git Status Section
function GitStatusSection() {
  const [gitContext, setGitContext] = useState<{
    is_repo: boolean;
    branch?: string | null;
    dirty?: boolean;
    ahead?: number;
    behind?: number;
    staged?: number;
    unstaged?: number;
  } | null>(null);

  useEffect(() => {
    const fetchGitContext = async () => {
      if (!isTauriEnvironment()) return;
      try {
        const res = await invokeSafe("get_git_context", {});
        if (res) setGitContext(res as any);
      } catch {
        // Ignore - not a git repo
      }
    };

    fetchGitContext();
    // Refresh every 5 seconds
    const interval = setInterval(fetchGitContext, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!gitContext?.is_repo) {
    return (
      <Section
        icon={<GitBranch size={16} />}
        title="Git Status"
        storageKey="git-status"
      >
        <div className="text-sm text-gray-500">Not a git repository</div>
      </Section>
    );
  }

  const changedFiles = (gitContext.staged || 0) + (gitContext.unstaged || 0);

  return (
    <Section
      icon={<GitBranch size={16} />}
      title="Git Status"
      storageKey="git-status"
    >
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between text-gray-300">
          <span>Branch:</span>
          <span className="font-mono text-blue-400">
            {gitContext.branch || "main"}
          </span>
        </div>

        {changedFiles > 0 && (
          <div className="flex items-center justify-between text-gray-300">
            <span>Status:</span>
            <span className="text-yellow-500">
              {changedFiles} file{changedFiles !== 1 ? "s" : ""} changed
            </span>
          </div>
        )}

        {((gitContext.ahead || 0) > 0 || (gitContext.behind || 0) > 0) && (
          <div className="flex gap-4 text-xs">
            {(gitContext.ahead || 0) > 0 && (
              <span className="text-green-500">↑ {gitContext.ahead} ahead</span>
            )}
            {(gitContext.behind || 0) > 0 && (
              <span className="text-red-500">↓ {gitContext.behind} behind</span>
            )}
          </div>
        )}

        {!gitContext.dirty && changedFiles === 0 && (
          <div className="text-green-500 text-xs">✓ Working tree clean</div>
        )}
      </div>
    </Section>
  );
}

// Quick Actions Section
function QuickActionsSection() {
  const actions = [
    { label: "Explain Code", icon: "💡", command: "/explain" },
    { label: "Debug Error", icon: "🐛", command: "/debug" },
    { label: "Write Tests", icon: "🧪", command: "/test" },
    { label: "Add Comments", icon: "📝", command: "/document" },
  ];

  const handleAction = (command: string) => {
    // Dispatch event to insert command into chat input
    window.dispatchEvent(
      new CustomEvent("insert-command", { detail: { command } }),
    );
  };

  return (
    <Section
      icon={<Zap size={16} />}
      title="Quick Actions"
      storageKey="quick-actions"
    >
      <div className="space-y-2">
        {actions.map((action) => (
          <button
            key={action.command}
            onClick={() => handleAction(action.command)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors duration-150"
          >
            <span>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

// Recent Files Section
function RecentFilesSection() {
  const { events } = useProjectStore();
  const [files, setFiles] = useState<
    Array<{ name: string; time: string; path?: string }>
  >([]);

  useEffect(() => {
    if (events && events.length > 0) {
      // Format recent files with relative time
      const now = Date.now();
      const formatted = events
        .slice(-5)
        .reverse()
        .map((event: { path: string; ts: number }) => ({
          name: event.path.split("/").pop() || event.path,
          time: formatRelativeTime(now - event.ts),
          path: event.path,
        }));
      setFiles(formatted);
    } else {
      // Mock data for demo
      setFiles([
        { name: "main.rs", time: "2min ago" },
        { name: "database.rs", time: "15min ago" },
        { name: "types.ts", time: "1hr ago" },
      ]);
    }
  }, [events]);

  return (
    <Section
      icon={<FileText size={16} />}
      title="Recent Files"
      storageKey="recent-files"
    >
      <div className="space-y-2 text-sm">
        {files.map((file, idx) => (
          <button
            key={idx}
            className="w-full flex items-center justify-between text-gray-400 hover:text-gray-200 transition-colors duration-150 py-1"
            title={file.path}
          >
            <span className="font-mono truncate">{file.name}</span>
            <span className="text-xs flex-shrink-0 ml-2">{file.time}</span>
          </button>
        ))}
      </div>
    </Section>
  );
} // Helper function to build file tree
function buildFileTree(files: string[]): any[] {
  const tree: any[] = [];

  files.forEach((file) => {
    const parts = file.split("/");
    let current = tree;

    parts.forEach((part, idx) => {
      const isFile = idx === parts.length - 1;
      let node = current.find((n) => n.name === part);

      if (!node) {
        node = {
          name: part,
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : [],
          modified: false,
        };
        current.push(node);
      }

      if (!isFile) {
        current = node.children;
      }
    });
  });

  return tree;
}

// Helper function to format relative time
function formatRelativeTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}min ago`;
  return "Just now";
}
