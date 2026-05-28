import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { useState, useRef, useEffect } from "react";
import { useUiStore } from "../lib/stores/uiStore";
import { isTauriEnvironment, invokeSafe } from "../lib/utils/tauri";
import "katex/dist/katex.min.css";
import "highlight.js/styles/tokyo-night-dark.css";

interface Props {
  content: string;
}

export default function MarkdownContent({ content }: Props) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          code: CodeBlock,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

function CodeBlock({ inline, className, children, ...props }: CodeProps) {
  const addToast = useUiStore((s) => s.addToast);
  const [showActions, setShowActions] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  // Extract language from className (format: language-xxx)
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";

  // Get the code content as string
  const codeString = String(children).replace(/\n$/, "");
  const lineCount = codeString.split("\n").length;

  // Auto-show line numbers for code with 3+ lines
  useEffect(() => {
    setShowLineNumbers(lineCount >= 3);
  }, [lineCount]);

  // Inline code (backticks)
  if (inline) {
    return (
      <code
        className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-sm"
        {...props}
      >
        {children}
      </code>
    );
  }

  // Block code (triple backticks)
  const handleCopy = async () => {
    try {
      if (isTauriEnvironment()) {
        const { writeText } = await import(
          "@tauri-apps/plugin-clipboard-manager"
        );
        await writeText(codeString);
      } else {
        await navigator.clipboard.writeText(codeString);
      }
      setCopied(true);
      addToast({ message: "Code copied", type: "success", ttl: 1500 });
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy code:", e);
      addToast({ message: "Failed to copy", type: "error", ttl: 2000 });
    }
  };

  const handleSave = async () => {
    const filename = prompt(
      "Enter filename:",
      language ? `code.${language}` : "code.txt",
    );
    if (!filename) return;

    try {
      // Use the browser download API for now; can enhance with Tauri file dialog later
      const blob = new Blob([codeString], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addToast({ message: `Saved as ${filename}`, type: "success", ttl: 2000 });
    } catch (e) {
      console.error("Failed to save code:", e);
      addToast({ message: "Failed to save file", type: "error", ttl: 2000 });
    }
  };

  const handleRun = async () => {
    const confirmRun = window.confirm(
      `Run this ${language || "code"} snippet?\n\nThis will execute:\n${codeString.substring(0, 100)}${codeString.length > 100 ? "..." : ""}\n\nOnly run trusted code!`,
    );
    if (!confirmRun) return;
    // Check settings
    try {
      const settings = (await import("../lib/stores/settingsStore")) as any;
      const allow = settings.useSettingsStore.getState().allowCodeExecution;
      if (!allow) {
        addToast({
          message: "Code execution is disabled in Settings",
          type: "error",
          ttl: 3000,
        });
        return;
      }
    } catch {
      // fail open
    }
    (async () => {
      addToast({ message: "Running snippet...", type: "info", ttl: 1500 });
      try {
        const res = await invokeSafe("run_code", {
          language,
          code: codeString,
          timeout_ms: 15000,
        });
        if (!res) {
          addToast({
            message: "Execution unavailable (not in Tauri)",
            type: "error",
            ttl: 3000,
          });
          return;
        }
        const { stdout, stderr, timed_out } = res as any;
        const { exit_code } = res as any;
        // Show full output in modal
        // Use uiStore directly to set modal
        useUiStore.getState().showRunResult({
          stdout: stdout || "",
          stderr: stderr || "",
          exit_code: exit_code ?? null,
          timed_out: !!timed_out,
        });
      } catch (e) {
        console.error("run snippet failed", e);
        addToast({ message: "Run failed", type: "error", ttl: 3000 });
      }
    })();
  };

  // Determine if code is runnable (common shell/script languages)
  const isRunnable = [
    "bash",
    "sh",
    "zsh",
    "python",
    "node",
    "javascript",
  ].includes(language.toLowerCase());

  return (
    <div
      className="relative group my-2 rounded-2xl overflow-hidden border border-gray-700/50 bg-gray-900"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Enhanced header with language badge and action buttons */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/80 backdrop-blur-sm border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-semibold text-blue-400 uppercase tracking-wide">
            {language || "text"}
          </span>
          <span className="text-xs text-gray-500">
            {lineCount} {lineCount === 1 ? "line" : "lines"}
          </span>
        </div>
        <div
          className={`flex items-center gap-1 transition-opacity duration-150 ${showActions ? "opacity-100" : "opacity-0"
            }`}
        >
          {/* Line numbers toggle */}
          {lineCount >= 3 && (
            <button
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              className="px-2 py-1 rounded-lg hover:bg-gray-700 transition-colors duration-150 text-xs text-gray-400 hover:text-gray-200"
              title="Toggle line numbers"
              aria-label="Toggle line numbers"
            >
              #️⃣
            </button>
          )}

          {/* Copy button with animation */}
          <button
            onClick={handleCopy}
            className={`px-2 py-1 rounded-lg hover:bg-gray-700 transition-all duration-150 text-xs ${copied
                ? "text-green-400 bg-green-900/30"
                : "text-gray-400 hover:text-gray-200"
              }`}
            title="Copy code"
            aria-label="Copy code"
          >
            {copied ? "✓ Copied!" : "📋 Copy"}
          </button>

          <button
            onClick={handleSave}
            className="px-2 py-1 rounded-lg hover:bg-gray-700 transition-colors duration-150 text-xs text-gray-400 hover:text-gray-200"
            title="Save to file"
            aria-label="Save code to file"
          >
            💾 Save
          </button>

          {isRunnable && (
            <button
              onClick={handleRun}
              className="px-2 py-1 rounded-lg hover:bg-yellow-900/30 transition-colors duration-150 text-xs text-yellow-400 hover:text-yellow-300 font-medium"
              title="Run code (with confirmation)"
              aria-label="Run code"
            >
              ▶ Run
            </button>
          )}
        </div>
      </div>

      {/* Code content with optional line numbers */}
      <div className="relative">
        {showLineNumbers && lineCount >= 3 ? (
          <div className="flex">
            {/* Line numbers column */}
            <div className="select-none flex-shrink-0 py-4 px-2 bg-gray-800/50 text-gray-500 text-xs font-mono text-right border-r border-gray-700/50">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i + 1} className="leading-6">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Code content */}
            <pre className="flex-1 !mt-0 !mb-0 !rounded-none overflow-x-auto">
              <code
                ref={codeRef}
                className={`${className} block py-4 px-4 text-sm leading-6`}
                {...props}
              >
                {children}
              </code>
            </pre>
          </div>
        ) : (
          <pre className="!mt-0 !mb-0 !rounded-none overflow-x-auto">
            <code
              ref={codeRef}
              className={`${className} block py-4 px-4 text-sm leading-6`}
              {...props}
            >
              {children}
            </code>
          </pre>
        )}
      </div>
    </div>
  );
}
