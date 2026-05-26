import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useChatStore } from "../lib/stores/chatStore";

interface Command {
  id: string;
  title: string;
  subtitle?: string;
  category: "conversations" | "actions" | "navigation";
  icon: string;
  action: () => void | Promise<void>;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    conversations,
    currentConversation,
    createConversation,
    selectConversation,
    loadConversations,
  } = useChatStore();

  // Generate commands dynamically
  const commands = useMemo((): Command[] => {
    const conversationCommands: Command[] = conversations.map((conv: any) => ({
      id: `conv-${conv.id}`,
      title: conv.title || "Untitled Conversation",
      subtitle: `Conversation ${conv.id}`,
      category: "conversations" as const,
      icon: "💬",
      action: () => {
        selectConversation(conv.id);
        onClose();
      },
      keywords: [
        conv.title || "Untitled Conversation",
        "conversation",
        "chat",
        "messages",
      ],
    }));

    const actionCommands: Command[] = [
      {
        id: "new-conversation",
        title: "New Conversation",
        subtitle: "Start a fresh chat",
        category: "actions",
        icon: "➕",
        action: async () => {
          await createConversation("New conversation", "gpt-4", "local");
          onClose();
        },
        keywords: ["new", "create", "conversation", "chat", "fresh"],
      },
      {
        id: "reload-conversations",
        title: "Reload Conversations",
        subtitle: "Refresh conversation list",
        category: "actions",
        icon: "�",
        action: async () => {
          await loadConversations();
          onClose();
        },
        keywords: ["reload", "refresh", "conversations"],
      },
      {
        id: "code-review",
        title: "Code Review Mode",
        subtitle: "Review code changes with AI annotations",
        category: "actions",
        icon: "🔍",
        action: async () => {
          const { useReviewStore } = await import("../lib/stores/reviewStore");
          useReviewStore.getState().toggleReviewMode();
          onClose();
        },
        keywords: ["review", "code", "diff", "pr", "pull request", "changes"],
      },
      {
        id: "log-viewer",
        title: "Log Viewer Mode",
        subtitle: "Analyze logs with filtering and grouping",
        category: "actions",
        icon: "📋",
        action: async () => {
          const { useLogStore } = await import("../lib/stores/logStore");
          useLogStore.getState().toggleLogViewer();
          onClose();
        },
        keywords: ["logs", "viewer", "analyze", "filter", "syslog", "docker"],
      },
      {
        id: "memory-viewer",
        title: "Session Memory",
        subtitle: "View and manage project memories",
        category: "actions",
        icon: "🧠",
        action: async () => {
          const { useMemoryStore } = await import("../lib/stores/memoryStore");
          useMemoryStore.getState().toggleMemoryViewer();
          onClose();
        },
        keywords: ["memory", "remember", "recall", "knowledge", "session"],
      },
      {
        id: "branch-viewer",
        title: "Conversation Branches",
        subtitle:
          "View and manage conversation branches — Shortcut: Ctrl+Shift+B",
        category: "actions",
        icon: "🌲",
        action: async () => {
          const { useBranchStore } = await import("../lib/stores/branchStore");
          useBranchStore.getState().toggleBranchViewer();
          onClose();
        },
        keywords: [
          "branch",
          "fork",
          "tree",
          "conversation",
          "alternative",
          "parallel",
        ],
      },
    ];
    const navigationCommands: Command[] = [
      {
        id: "settings",
        title: "Open Settings",
        subtitle: "Configure application preferences",
        category: "navigation",
        icon: "⚙️",
        action: () => {
          // This would trigger settings modal
          document.dispatchEvent(new CustomEvent("open-settings"));
          onClose();
        },
        keywords: ["settings", "preferences", "config", "options"],
      },
      {
        id: "toggle-keyboard-debugger",
        title: "Toggle Keyboard Debugger",
        subtitle: "Show keystrokes (F12 or Ctrl+Alt+D)",
        category: "navigation",
        icon: "🧪",
        action: () => {
          document.dispatchEvent(new CustomEvent("toggle-keyboard-debugger"));
          onClose();
        },
        keywords: ["debug", "keyboard", "keys", "log", "inspector"],
      },
    ];

    return [...conversationCommands, ...actionCommands, ...navigationCommands];
  }, [
    conversations,
    selectConversation,
    createConversation,
    loadConversations,
    onClose,
  ]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;

    const lowerQuery = query.toLowerCase();
    return commands
      .filter((command) => {
        const searchText = [
          command.title,
          command.subtitle,
          ...(command.keywords || []),
        ]
          .join(" ")
          .toLowerCase();

        return searchText.includes(lowerQuery);
      })
      .slice(0, 10); // Limit results
  }, [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach((command) => {
      if (!groups[command.category]) {
        groups[command.category] = [];
      }
      groups[command.category].push(command);
    });
    return groups;
  }, [filteredCommands]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            try {
              const result = filteredCommands[selectedIndex].action();
              if (result instanceof Promise) {
                result.catch((err) =>
                  console.error("Command execution error:", err),
                );
              }
            } catch (err) {
              console.error("Command execution error:", err);
            }
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) {
    console.log("📂 CommandPalette NOT rendering (isOpen=false)");
    return null;
  }

  console.log("📂 CommandPalette IS rendering (isOpen=true)");

  const categoryLabels = {
    conversations: "Conversations",
    actions: "Actions",
    navigation: "Navigation",
  };

  const paletteContent = (
    <div
      className="fixed inset-0 z-[99998] flex items-start justify-center pt-20 px-4"
      style={{
        pointerEvents: "auto",
        background: "rgba(0, 0, 0, 0.7)",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      {/* Backdrop with stronger visual effect */}
      <div
        className="absolute inset-0 bg-red-500/30"
        onClick={onClose}
        style={{ pointerEvents: "auto" }}
      />

      {/* Command Palette with SOLID, OPAQUE styling for maximum visibility */}
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl border-8 border-red-500 shadow-2xl overflow-hidden transform transition-all duration-300 scale-100"
        style={{
          pointerEvents: "auto",
          boxShadow: "0 0 50px rgba(239, 68, 68, 1)",
        }}
      >
        {/* Enhanced Search Input */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-blue-500 dark:text-blue-400 text-xl">
              🔍
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations, actions, and commands..."
              className="w-full pl-12 pr-20 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            />
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
              ESC to close
            </div>
          </div>
        </div>{" "}
        {/* Results */}
        <div className="max-h-96 overflow-y-auto bg-white dark:bg-gray-900">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-2">🔍</div>
              <div className="text-lg font-medium mb-1">No results found</div>
              <div className="text-sm">
                Try searching for conversations, actions, or commands
              </div>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, commands]) => (
              <div key={category} className="p-2">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {categoryLabels[category as keyof typeof categoryLabels]}
                </div>
                {commands.map((command) => {
                  const globalIndex = filteredCommands.indexOf(command);
                  const isSelected = globalIndex === selectedIndex;

                  return (
                    <button
                      key={command.id}
                      onClick={() => {
                        try {
                          const result = command.action();
                          if (result instanceof Promise) {
                            result.catch((err) =>
                              console.error("Command execution error:", err),
                            );
                          }
                        } catch (err) {
                          console.error("Command execution error:", err);
                        }
                      }}
                      className={`w-full px-3 py-3 rounded-lg text-left transition-all duration-150 ${
                        isSelected
                          ? "bg-blue-500 text-white"
                          : "text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-xl">{command.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {command.title}
                          </div>
                          {command.subtitle && (
                            <div
                              className={`text-sm truncate ${isSelected ? "text-blue-100" : "text-gray-500 dark:text-gray-400"}`}
                            >
                              {command.subtitle}
                            </div>
                          )}
                        </div>
                        {command.category === "conversations" &&
                          currentConversation?.id ===
                            command.id.replace("conv-", "") && (
                            <div className="text-xs bg-green-500 text-white px-2 py-1 rounded-full font-medium">
                              Active
                            </div>
                          )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        {/* Footer */}
        {filteredCommands.length > 0 && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center space-x-4">
                <span>↑↓ Navigate</span>
                <span>⏎ Select</span>
                <span>⎋ Close</span>
              </div>
              <div>
                {filteredCommands.length} result
                {filteredCommands.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Use portal to render directly to document.body
  return createPortal(paletteContent, document.body);
};

export default CommandPalette;
