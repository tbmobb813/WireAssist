import { useUiStore } from "../lib/stores/uiStore";

// Error type icons mapping
const errorIcons: Record<string, string> = {
  NetworkError: "🌐",
  RateLimit: "⏱️",
  APIError: "⚠️",
  ValidationError: "❌",
  success: "✓",
  info: "ℹ️",
  error: "⚠️",
};

export default function Toaster() {
  const { toasts, removeToast } = useUiStore();

  return (
    <div className="fixed top-4 right-4 w-96 z-50 space-y-2 pointer-events-none">
      {toasts.map((t) => {
        // Determine icon based on type or error category
        const icon = (t.type && errorIcons[t.type]) || errorIcons.info;

        return (
          <div
            key={t.id}
            className={`
              p-4 rounded-xl shadow-lg backdrop-blur-sm
              pointer-events-auto transform transition-all duration-200 ease-out
              animate-in slide-in-from-right-5 fade-in
              border
              ${t.type === "error"
                ? "bg-red-900/90 text-red-100 border-red-700/50"
                : t.type === "success"
                  ? "bg-green-900/90 text-green-100 border-green-700/50"
                  : t.type === "info"
                    ? "bg-blue-900/90 text-blue-100 border-blue-700/50"
                    : "bg-gray-800/90 text-gray-100 border-gray-700/50"
              }
            `}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="text-xl flex-shrink-0">{icon}</div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-relaxed break-words">
                  {t.message}
                </div>
                {t.action && (
                  <button
                    className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors duration-150 font-medium"
                    onClick={() => {
                      try {
                        t.action?.onClick();
                      } catch {
                        // swallow
                      }
                      removeToast(t.id);
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
              </div>

              {/* Close button */}
              <button
                className="flex-shrink-0 text-current opacity-60 hover:opacity-100 transition-opacity duration-150 -mt-1 -mr-1 p-1 rounded hover:bg-white/10"
                onClick={() => removeToast(t.id)}
                aria-label="Dismiss"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
