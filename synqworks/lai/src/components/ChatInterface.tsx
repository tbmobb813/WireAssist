import { useEffect, useRef, useState, useMemo } from "react";
import type { ApiMessage } from "../lib/api/types";
import { useChatStore } from "../lib/stores/chatStore";
import { useUiStore } from "../lib/stores/uiStore";
import { useBranchStore } from "../lib/stores/branchStore";
import MessageBubble from "./MessageBubble";
import MessageSearch from "./MessageSearch";
import { LoadingSpinner, FadeIn } from "./Animations";
import { database } from "../lib/api/database";
import { isTauriEnvironment, invokeSafe } from "../lib/utils/tauri";
import { getProvider } from "../lib/providers/provider";
import { useProjectStore } from "../lib/stores/projectStore";
import CommandSuggestionsModal from "./CommandSuggestionsModal";
import GitContextWidget from "./GitContextWidget";
import RoutingIndicator from "./RoutingIndicator";
import { withErrorHandling } from "../lib/utils/errorHandler";
import { calculateCost, formatCost } from "./CostBadge";
import { copyConversationToClipboard } from "../lib/utils/conversationExport";
import { Copy, Check, Sparkles, Clipboard, GitBranch } from "lucide-react";
import {
  parseSlashCommand,
  executeSlashCommand,
  getSlashCommandSuggestions,
  type SlashCommandContext,
} from "../lib/slashCommands";
import { readClipboardText } from "../lib/clipboard";
import { useVimNavigation } from "../lib/hooks/useVimNavigation";
import VimModeIndicator from "./VimModeIndicator";

// Use the API message shape for messages
type Message = ApiMessage;

type SlashSuggestion = {
  name: string;
  description?: string;
  parameters?: string;
};

export default function ChatInterface(): JSX.Element {
  const { currentConversation, messages, sendMessage, isLoading } =
    useChatStore();
  const getActiveBranch = useBranchStore((s) => s.getActiveBranch);
  const addToast = useUiStore((s) => s.addToast);
  const [value, setValue] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [slashSuggestions, setSlashSuggestions] = useState<SlashSuggestion[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Filter messages based on active branch
  const visibleMessages = useMemo<Message[]>(() => {
    if (!currentConversation?.id) return messages;

    const activeBranch = getActiveBranch(currentConversation.id);
    if (!activeBranch) return messages;

    // Root branch shows all messages
    if (!activeBranch.parentBranchId) return messages;

    // For other branches, show messages up to fork point + branch-specific messages
    const forkPointId = activeBranch.forkPointMessageId;
    if (!forkPointId) return messages;

    const forkPointIndex = messages.findIndex((m: Message) => m.id === forkPointId);
    if (forkPointIndex === -1) return messages;

    // Include all messages up to and including the fork point
    const messagesUpToFork = messages.slice(0, forkPointIndex + 1);

    // Add branch-specific messages
    const branchMessageIds = new Set(activeBranch.messageIds);
    const branchMessages = messages.filter((m: Message) => branchMessageIds.has(m.id));

    return [...messagesUpToFork, ...branchMessages];
  }, [currentConversation?.id, messages, getActiveBranch]);

  // Handle copy conversation to clipboard
  const handleCopyConversation = async () => {
    if (!currentConversation) return;

    try {
      // Respect active branch filtering when copying
      // visibleMessages includes messages up to fork point + branch-specific
      await copyConversationToClipboard(currentConversation, visibleMessages);
      setIsCopied(true);
      addToast({
        message: "Conversation copied to clipboard!",
        type: "success",
        ttl: 2000,
      });
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      addToast({
        message: "Failed to copy conversation",
        type: "error",
        ttl: 3000,
      });
    }
  };

  // Handle analyze clipboard
  const handleAnalyzeClipboard = async () => {
    try {
      const clipboardText = await readClipboardText();

      if (!clipboardText?.trim()) {
        addToast({
          message: "Clipboard is empty",
          type: "error",
          ttl: 2000,
        });
        return;
      }

      // Auto-detect content type and create appropriate prompt
      let prompt = "";
      const content = clipboardText.trim();

      // Detect error patterns
      if (
        content.includes("Error:") ||
        content.includes("Exception:") ||
        content.includes("Traceback") ||
        content.match(/at .+:\d+:\d+/)
      ) {
        prompt = `I encountered this error:\n\n\`\`\`\n${content}\n\`\`\`\n\nCan you help me understand and fix it?`;
      }
      // Detect code (has braces, semicolons, or indentation patterns)
      else if (
        content.match(/[{};]/) ||
        content.match(/^\s{2,}/m) ||
        content.match(/^(function|const|let|var|class|def|import|from)/m)
      ) {
        prompt = `Can you review and explain this code?\n\n\`\`\`\n${content}\n\`\`\``;
      }
      // Detect shell commands (starts with $ or has common command patterns)
      else if (
        content.match(/^\$\s/) ||
        content.match(/^(npm|yarn|pnpm|cargo|git|docker|kubectl)\s/)
      ) {
        prompt = `Can you explain this command?\n\n\`\`\`bash\n${content}\n\`\`\``;
      }
      // Default: ask for analysis
      else {
        prompt = `Can you analyze this?\n\n${content}`;
      }

      setValue(prompt);
      inputRef.current?.focus();

      addToast({
        message: "Clipboard content analyzed!",
        type: "success",
        ttl: 2000,
      });
    } catch {
      addToast({
        message: "Failed to read clipboard",
        type: "error",
        ttl: 3000,
      });
    }
  };

  useEffect(() => {
    if (currentConversation && currentConversation.id) {
      // focus the message input when conversation changes
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [currentConversation]);

  // Git context for current workspace (populates header)
  const [gitContext, setGitContext] = useState<{
    is_repo: boolean;
    branch?: string | null;
    dirty?: boolean;
  } | null>(null);

  useEffect(() => {
    (async () => {
      if (!isTauriEnvironment()) return;
      try {
        const res = await invokeSafe("get_git_context", {});
        if (res) setGitContext(res as any);
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    // keyboard shortcut: Ctrl+K focuses the message input
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Ctrl+Shift+V to paste from clipboard
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "v"
      ) {
        e.preventDefault();
        handlePasteFromClipboard();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value]);

  // TODO: Add event listener for ContextPanel quick actions
  useEffect(() => {
    const handleInsertCommand = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { command } = customEvent.detail;
      setValue(command);
      // Auto-focus input after command insertion
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };
    window.addEventListener("insert-command", handleInsertCommand as any);
    return () =>
      window.removeEventListener("insert-command", handleInsertCommand as any);
  }, []);

  const handlePasteFromClipboard = async () => {
    await withErrorHandling(
      async () => {
        let clipText = "";
        try {
          clipText = await readClipboardText();
        } catch (err) {
          // Clipboard access denied - silently ignore and let user paste normally
          console.debug("Clipboard access not available:", err);
          return;
        }

        if (clipText) {
          // Auto-detect and format code blocks
          let formattedText = clipText;

          // Check if it looks like code (has typical code patterns)
          const looksLikeCode =
            clipText.includes("function") ||
            clipText.includes("const ") ||
            clipText.includes("let ") ||
            clipText.includes("import ") ||
            clipText.includes("export ") ||
            clipText.includes("class ") ||
            clipText.includes("def ") ||
            clipText.includes("=>") ||
            (clipText.includes("{") && clipText.includes("}")) ||
            (clipText.split("\n").length > 3 && clipText.includes("  ")); // Multi-line with indentation

          // If it looks like code and isn't already in code blocks, wrap it
          if (looksLikeCode && !clipText.startsWith("```")) {
            // Try to detect language
            let language = "";
            if (
              clipText.includes("function") ||
              clipText.includes("const ") ||
              clipText.includes("=>")
            ) {
              language = "javascript";
            } else if (
              clipText.includes("def ") ||
              clipText.includes("import ")
            ) {
              language = "python";
            } else if (
              clipText.includes("fn ") ||
              clipText.includes("let mut ")
            ) {
              language = "rust";
            }

            formattedText = "```" + language + "\n" + clipText + "\n```";
          }

          setValue((prev) =>
            prev ? prev + "\n\n" + formattedText : formattedText,
          );
          addToast({
            message:
              looksLikeCode && !clipText.startsWith("```")
                ? "Code pasted and formatted"
                : "Pasted from clipboard",
            type: "success",
            ttl: 1500,
          });
        } else {
          addToast({
            message: "Clipboard is empty",
            type: "info",
            ttl: 1500,
          });
        }
      },
      "ChatInterface.handlePasteFromClipboard",
      "Failed to paste from clipboard",
    );
  };

  const handleSmartClipboard = async () => {
    await withErrorHandling(
      async () => {
        let clipText = "";
        try {
          clipText = await readClipboardText();
        } catch {
          addToast({
            message: "Could not access clipboard",
            type: "error",
            ttl: 2000,
          });
          return;
        }

        if (!clipText.trim()) {
          addToast({
            message: "Clipboard is empty",
            type: "info",
            ttl: 1500,
          });
          return;
        }

        // Detect clipboard type
        let detectedType = "text";
        let prefill = "";

        // Error patterns (stack traces, error messages)
        if (
          clipText.includes("Error:") ||
          clipText.includes("Exception") ||
          clipText.includes("at ") ||
          clipText.match(/\w+Error:/) ||
          clipText.includes("Traceback")
        ) {
          detectedType = "error";
          prefill = `/analyze error\n\`\`\`\n${clipText}\n\`\`\`\n\nWhat's causing this error and how can I fix it?`;
        }
        // Code patterns
        else if (
          clipText.includes("function") ||
          clipText.includes("const ") ||
          clipText.includes("def ") ||
          clipText.includes("class ") ||
          clipText.includes("import ") ||
          (clipText.includes("{") && clipText.includes("}"))
        ) {
          detectedType = "code";
          // Detect language
          let language = "";
          if (clipText.includes("function") || clipText.includes("=>"))
            language = "javascript";
          else if (clipText.includes("def ")) language = "python";
          else if (clipText.includes("fn ")) language = "rust";

          prefill = `/analyze code\n\`\`\`${language}\n${clipText}\n\`\`\`\n\nPlease review this code and suggest improvements.`;
        }
        // Shell command
        else if (
          clipText.startsWith("$") ||
          clipText.startsWith("#") ||
          clipText.match(
            /^(npm|yarn|pnpm|cargo|git|docker|kubectl|python|node)/,
          )
        ) {
          detectedType = "command";
          prefill = `/explain command\n\`\`\`bash\n${clipText}\n\`\`\`\n\nWhat does this command do?`;
        }
        // Plain text
        else {
          prefill = `Analyze this:\n\n${clipText}`;
        }

        setValue(prefill);
        addToast({
          message: `Smart Clipboard: detected ${detectedType}`,
          type: "success",
          ttl: 2000,
        });
      },
      "ChatInterface.handleSmartClipboard",
      "Failed to analyze clipboard",
    );
  };

  useEffect(() => {
    if (scrollRef.current) {
      // Smooth scroll to bottom for new messages
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  // Vim-style navigation and quick actions
  const { vimMode } = useVimNavigation({
    enabled: true,
    scrollRef,
    onSearch: () => {
      // Focus the message search input
      const searchInput = document.querySelector<HTMLInputElement>(
        'input[placeholder*="Search"]',
      );
      searchInput?.focus();
    },
    onExplain: () => {
      if (!value.trim() && messages.length > 0) {
        // Get the last AI message to explain
        const lastAssistant = [...messages]
          .reverse()
          .find((m) => m.role === "assistant");
        if (lastAssistant) {
          setValue(
            `Can you explain this in more detail:\n\n"${lastAssistant.content.slice(0, 200)}..."`,
          );
          inputRef.current?.focus();
        }
      } else if (value.trim()) {
        // Prepend "Explain: " to current input
        setValue(`Explain: ${value}`);
      }
      addToast({
        message: "Explain mode activated (Ctrl+Shift+E)",
        type: "info",
        ttl: 1500,
      });
    },
    onDebug: () => {
      if (!value.trim() && messages.length > 0) {
        // Get the last user message to debug
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        if (lastUser) {
          setValue(`Debug this:\n\n${lastUser.content}`);
          inputRef.current?.focus();
        }
      } else if (value.trim()) {
        // Prepend "Debug: " to current input
        setValue(`Debug: ${value}`);
      }
      addToast({
        message: "Debug mode activated (Ctrl+Shift+D)",
        type: "info",
        ttl: 1500,
      });
    },
    onPrevConversation: () => {
      const { conversations, currentConversation, selectConversation } =
        useChatStore.getState();
      if (!currentConversation || conversations.length <= 1) return;
      const currentIndex = conversations.findIndex(
        (c) => c.id === currentConversation.id,
      );
      const prevIndex =
        currentIndex > 0 ? currentIndex - 1 : conversations.length - 1;
      selectConversation(conversations[prevIndex].id);
      addToast({
        message: `Switched to: ${conversations[prevIndex].title}`,
        type: "success",
        ttl: 1500,
      });
    },
    onNextConversation: () => {
      const { conversations, currentConversation, selectConversation } =
        useChatStore.getState();
      if (!currentConversation || conversations.length <= 1) return;
      const currentIndex = conversations.findIndex(
        (c) => c.id === currentConversation.id,
      );
      const nextIndex =
        currentIndex < conversations.length - 1 ? currentIndex + 1 : 0;
      selectConversation(conversations[nextIndex].id);
      addToast({
        message: `Switched to: ${conversations[nextIndex].title}`,
        type: "success",
        ttl: 1500,
      });
    },
  });

  // Calculate conversation cost (must be before early return to follow hooks rules)
  const conversationCost = useMemo(() => {
    if (!currentConversation) {
      return { tokens: 0, cost: 0 };
    }

    let totalTokens = 0;
    let totalCost = 0;

    messages.forEach((msg: Message) => {
      const tokens = (msg as any).tokens_used || 0;
      totalTokens += tokens;
      totalCost += calculateCost(tokens, currentConversation?.model);
    });

    return { tokens: totalTokens, cost: totalCost };
  }, [messages, currentConversation?.model]);

  if (!currentConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
            <span className="text-2xl">💬</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Ready to Chat
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm">
            Select or create a conversation to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#1a1b26]">
      {/* Modern Chat Header */}
      <div className="bg-[#1a1b26]/95 backdrop-blur-lg border-b border-[#414868] p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-white text-lg">🤖</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#c0caf5]">
                  {currentConversation.title || "Untitled Conversation"}
                </h3>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-sm text-[#9aa5ce]">
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#24283b] text-xs font-medium text-[#c0caf5]">
                      {currentConversation.model}
                    </span>
                    <span className="text-[#565f89]">•</span>
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#24283b] text-xs font-medium text-[#c0caf5]">
                      {currentConversation.provider}
                    </span>
                  </div>
                  {/* Active Branch Badge */}
                  {(() => {
                    const ab = getActiveBranch(currentConversation.id);
                    return ab && ab.parentBranchId ? (
                      <div
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#bb9af7]/20 border border-[#bb9af7]/30"
                        title={`Active branch: ${ab.name}`}
                      >
                        <GitBranch className="w-3.5 h-3.5 text-[#bb9af7]" />
                        <span className="text-xs font-medium text-[#bb9af7] max-w-[12rem] truncate">
                          {ab.name}
                        </span>
                      </div>
                    ) : null;
                  })()}
                  {gitContext && gitContext.is_repo && (
                    <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-gradient-to-r from-[#9ece6a]/20 to-[#73daca]/20 border border-[#9ece6a]/30">
                      <span className="text-xs font-medium text-[#9ece6a]">
                        {gitContext.branch || "HEAD"}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${gitContext.dirty
                          ? "bg-[#f7768e] animate-pulse"
                          : "bg-[#9ece6a]"
                          }`}
                        title={
                          gitContext.dirty
                            ? "Uncommitted changes"
                            : "Clean working directory"
                        }
                      />
                    </div>
                  )}
                  {conversationCost.tokens > 0 && (
                    <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-gradient-to-r from-[#7aa2f7]/20 to-[#bb9af7]/20 border border-[#7aa2f7]/30">
                      <span className="text-xs font-medium text-[#7aa2f7]">
                        {formatCost(conversationCost.cost)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Copy Conversation Button */}
            <button
              onClick={handleCopyConversation}
              disabled={messages.length === 0}
              className="
                flex items-center space-x-2 px-3 py-2 rounded-lg
                bg-[#7aa2f7] hover:bg-[#7aa2f7]/90
                disabled:opacity-50 disabled:cursor-not-allowed
                text-white transition-all duration-150 gpu-accelerated
                text-sm font-medium
              "
              title="Copy entire conversation as Markdown"
            >
              {isCopied ? (
                <>
                  <Check size={16} />
                  <span className="hidden md:inline">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span className="hidden md:inline">Copy All</span>
                </>
              )}
            </button>

            {/* Toggle Window Button */}
            <button
              onClick={async () => {
                try {
                  await database.window.toggle();
                } catch (e) {
                  console.error("failed to toggle window", e);
                }
              }}
              className="
                flex items-center space-x-2 px-3 py-2 rounded-lg
                bg-[#414868] hover:bg-[#565f89]
                text-[#c0caf5]
                transition-all duration-150 gpu-accelerated
                text-sm font-medium
              "
              title="Toggle window"
              aria-label="Toggle window"
            >
              <span>🪟</span>
              <span className="hidden md:inline">Toggle</span>
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Message Search */}
      {messages.length > 0 && (
        <div className="bg-[#1a1b26]/50 border-b border-[#414868] p-3">
          <MessageSearch
            messages={messages}
            onMessageSelect={(messageId) => {
              setSelectedMessageId(messageId);
              // Scroll to the selected message
              const messageElement = document.getElementById(
                `message-${messageId}`,
              );
              if (messageElement) {
                messageElement.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }
            }}
          />
        </div>
      )}

      {/* Modern Messages Container */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-transparent to-[#1a1b26]/30 message-scroll"
      >
        {isLoading && messages.length === 0 && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`max-w-[70%] px-4 py-3 rounded-2xl bg-[#24283b]/60 animate-pulse h-16 ${i % 2 === 0 ? "ml-auto" : ""
                  }`}
              />
            ))}
          </div>
        )}

        {!isLoading &&
          visibleMessages.map((m: Message) => (
            <MessageBubble
              key={m.id}
              message={m}
              isHighlighted={selectedMessageId === m.id}
            />
          ))}
        {!isLoading && visibleMessages.length === 0 && (
          <FadeIn delay={300}>
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-[#7aa2f7]/20 rounded-full flex items-center justify-center border border-[#7aa2f7]/30">
                <span className="text-2xl">✨</span>
              </div>
              <h4 className="text-lg font-medium text-[#c0caf5] mb-2">
                Start the Conversation
              </h4>
              <p className="text-sm text-[#9aa5ce] max-w-sm mx-auto">
                Ask a question, request help with code, or start a discussion.
                Your AI assistant is ready to help!
              </p>
            </div>
          </FadeIn>
        )}
        {isLoading &&
          visibleMessages.length > 0 &&
          visibleMessages.map((m: Message) => <MessageBubble key={m.id} message={m} />)}
      </div>

      {/* Git Context Widget */}
      <div className="px-4 pb-2">
        <GitContextWidget
          onIncludeContext={(context) => {
            setValue((prev) => {
              const prefix = prev.trim() ? prev + "\n\n" : "";
              return prefix + "```\nProject Context:\n" + context + "\n```\n\n";
            });
          }}
        />
      </div>

      {/* Modern Input Area */}
      <div className="bg-[#1a1b26]/95 backdrop-blur-lg border-t border-[#414868] p-4">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!value.trim()) return;
            const toSend = value.trim();

            // Check if this is a slash command
            const slashResult = parseSlashCommand(toSend);

            if (slashResult.isSlashCommand) {
              // Clear input immediately for slash commands
              setValue("");
              setSlashSuggestions([]);

              if (slashResult.command) {
                // Execute the slash command
                const context: SlashCommandContext = {
                  conversationId: currentConversation?.id || null,
                  currentInput: toSend,
                  addToast,
                  clearInput: () => setValue(""),
                };

                const success = await executeSlashCommand(
                  slashResult.command,
                  slashResult.args || [],
                  context,
                );

                if (!success) {
                  // If command failed, restore input
                  setValue(toSend);
                }
              } else {
                // Unknown slash command
                addToast({
                  message: `Unknown command: ${toSend}. Type /help for available commands.`,
                  type: "error",
                  ttl: 3000,
                });
              }
              return;
            }

            // Regular message handling
            // Clear input immediately for snappier UX and to satisfy tests
            setValue("");

            // Enhanced error handling for message sending
            const result = await withErrorHandling(
              () => sendMessage(toSend),
              "ChatInterface.sendMessage",
              "Failed to send message. Please try again.",
            );

            // If message failed, restore the input value
            if (result === null) {
              setValue(toSend);
            }
          }}
        >
          <div className="flex items-center gap-2">
            {/* Routing Indicator */}
            <RoutingIndicator />

            {/* Action Buttons - Compact horizontal layout */}
            <button
              type="button"
              onClick={handleSmartClipboard}
              className="flex-shrink-0 p-2 rounded-lg bg-gradient-to-r from-[#7aa2f7]/20 to-[#bb9af7]/20 border border-[#7aa2f7]/40 text-[#7aa2f7] hover:from-[#7aa2f7]/30 hover:to-[#bb9af7]/30 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
              title="Smart Clipboard: Analyze clipboard content"
              aria-label="Analyze clipboard"
            >
              <Sparkles size={18} />
            </button>
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="flex-shrink-0 p-2 rounded-lg bg-[#414868] text-[#9aa5ce] hover:bg-[#565f89] hover:text-[#c0caf5] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
              title="Paste from clipboard (Ctrl+Shift+V)"
              aria-label="Paste from clipboard"
            >
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
              >
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
            </button>
            <button
              type="button"
              onClick={async () => {
                const lastUser = [...messages]
                  .reverse()
                  .find((m) => m.role === "user");
                const base = lastUser?.content || value.trim();
                if (!base) return;
                const provider = getProvider();
                const project = useProjectStore.getState();
                const ctx = project.getRecentSummary(8, 2 * 60 * 1000); // last 2 min, up to 8 events
                const prompt = `Suggest 3 concise shell commands relevant to the following context.\n- User intent: "${base}"\n${ctx ? `- Recent file changes:\n${ctx}\n` : ""}- Output format: one command per line, no explanations, no code fences.`;
                try {
                  const resp = await provider.generateResponse(
                    currentConversation?.id || "suggestions",
                    [{ role: "user", content: prompt }],
                  );
                  const items = resp
                    .split(/\r?\n/)
                    .map((s) => s.replace(/^[-•]\s*/, "").trim())
                    .filter(Boolean)
                    .slice(0, 5);
                  useUiStore.getState().showSuggestions(items);
                } catch {
                  addToast({
                    message: "Failed to get suggestions",
                    type: "error",
                    ttl: 1600,
                  });
                }
              }}
              className="flex-shrink-0 p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 hover:text-purple-700 dark:hover:text-purple-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
              title="Suggest terminal commands"
              aria-label="Suggest terminal commands"
            >
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
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" />
              </svg>
            </button>

            {/* Enhanced Input Field with inline send button */}
            <div className="flex-1 flex items-center gap-2 border border-[#414868] rounded-xl bg-[#24283b] px-3 py-2 focus-within:ring-2 focus-within:ring-[#7aa2f7]/50 transition-all duration-150">
              <textarea
                ref={inputRef as any}
                className="flex-1 bg-transparent text-[#c0caf5] placeholder-[#565f89] focus:outline-none resize-none min-h-[3rem] max-h-[200px] disabled:opacity-50 disabled:cursor-not-allowed"
                value={value}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setValue(newValue);

                  // Show slash command suggestions
                  if (newValue.startsWith("/")) {
                    const suggestions = getSlashCommandSuggestions(newValue);
                    // Map SlashCommand -> SlashSuggestion expected shape
                    setSlashSuggestions(
                      suggestions.map((s) => ({
                        name: s.command,
                        description: s.description,
                        parameters: s.parameters ? s.parameters.join(", ") : undefined,
                      })),
                    );
                  } else {
                    setSlashSuggestions([]);
                  }

                  // Auto-resize textarea from 48px to 200px
                  const textarea = e.target;
                  textarea.style.height = "auto";
                  textarea.style.height =
                    Math.min(textarea.scrollHeight, 200) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) {
                    // Ctrl+Enter to send
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  } else if (e.key === "Enter" && !e.shiftKey) {
                    // Enter for new line (updated behavior)
                    // Allow default behavior
                  }
                }}
                placeholder="Type a message... (Ctrl+Enter to send, Shift+V to paste)"
                disabled={isLoading}
                aria-label="Message input"
                rows={1}
              />

              {/* Clipboard Analysis Button */}
              <button
                type="button"
                onClick={handleAnalyzeClipboard}
                disabled={isLoading}
                className={`
                    flex-shrink-0 p-2 rounded-lg
                    transition-all duration-150
                    hover:bg-[#414868] active:scale-95
                    focus:outline-none focus:ring-2 focus:ring-[#7aa2f7]/50
                    disabled:opacity-50 disabled:cursor-not-allowed
                    text-[#9aa5ce] hover:text-[#c0caf5]
                  `}
                title="Analyze clipboard content (Shift+V)"
                aria-label="Analyze clipboard"
              >
                <Clipboard className="w-4 h-4" />
              </button>

              {/* Send Button - Inline within input container */}
              <button
                type="submit"
                disabled={isLoading || !value.trim()}
                className={`
                  flex-shrink-0 p-2 rounded-lg font-medium
                  transition-all duration-150 ease-out gpu-accelerated
                  transform hover:scale-105 active:scale-95
                  focus:outline-none focus:ring-2 focus:ring-[#7aa2f7]/50
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                  ${value.trim()
                    ? "bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 text-[#1a1b26] shadow-sm"
                    : "bg-[#414868] text-[#565f89]"
                  }
                `}
                aria-label="Send message"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    <span>Sending...</span>
                  </div>
                ) : (
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
                  >
                    <path d="m22 2-7 20-4-9-9-4Z" />
                    <path d="M10.5 12.5 19 4" />
                  </svg>
                )}
              </button>
            </div>

            {/* Keyboard hint */}
            <div className="text-xs text-[#565f89] ml-2">
              <kbd className="px-1.5 py-0.5 bg-[#24283b] rounded border border-[#414868] font-mono text-[10px] text-[#9aa5ce]">
                Ctrl+Enter
              </kbd>{" "}
              to send
            </div>
          </div>
        </form>

        {/* Modern Slash Command Suggestions */}
        {slashSuggestions.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1b26]/98 backdrop-blur-lg border border-[#414868] rounded-xl shadow-2xl max-h-48 overflow-y-auto">
            {slashSuggestions.map((command, index) => (
              <button
                key={command.name}
                className={`
                  w-full text-left px-4 py-3
                  hover:bg-[#24283b]
                  transition-all duration-150
                  ${index !== slashSuggestions.length - 1 ? "border-b border-[#414868]/30" : ""}
                `}
                onClick={() => {
                  setValue(command.name + " ");
                  setSlashSuggestions([]);
                  inputRef.current?.focus();
                }}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-[#7aa2f7]/20 rounded-lg flex items-center justify-center border border-[#7aa2f7]/30">
                    <span className="text-[#7aa2f7] text-sm">⚡</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-[#7aa2f7] text-sm">
                      {command.name}
                    </div>
                    <div className="text-xs text-[#9aa5ce] mt-1">
                      {command.description}
                    </div>
                    {command.parameters && (
                      <div className="text-xs text-[#565f89] mt-1">
                        Parameters: {command.parameters}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <CommandSuggestionsModal />
      <VimModeIndicator active={vimMode} />
    </div>
  );
}
