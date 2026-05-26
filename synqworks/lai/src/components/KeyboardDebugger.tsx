import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Debug component to show what keyboard events are being captured
 * Press F12 to toggle visibility
 */
export const KeyboardDebugger: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [lastKey, setLastKey] = useState<string>("");
  const [events, setEvents] = useState<string[]>([]);

  console.log("🧪 KeyboardDebugger RENDER, visible:", visible);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mods = [];
      if (e.ctrlKey) mods.push("Ctrl");
      if (e.metaKey) mods.push("Meta");
      if (e.altKey) mods.push("Alt");
      if (e.shiftKey) mods.push("Shift");

      const keyInfo = `${mods.join("+") + (mods.length ? "+" : "")}${e.key}`;
      setLastKey(keyInfo);
      setEvents((prev) => [keyInfo, ...prev.slice(0, 9)]);

      // Toggle debugger with F12 or Ctrl/Cmd+Alt+D (safer on Linux)
      if (
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "d")
      ) {
        e.preventDefault();
        e.stopPropagation();
        console.log("🧪 Toggling keyboard debugger, current visible:", visible);
        setVisible((v) => {
          console.log("🧪 Setting visible to:", !v);
          return !v;
        });
      }
    };

    console.log("🧪 KeyboardDebugger mounted, visible:", visible);
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    const toggleListener = () => {
      console.log("🧪 Toggle event received");
      setVisible((v) => !v);
    };
    document.addEventListener(
      "toggle-keyboard-debugger",
      toggleListener as EventListener,
    );
    return () => {
      document.removeEventListener("keydown", handleKeyDown, {
        capture: true,
      } as any);
      document.removeEventListener(
        "toggle-keyboard-debugger",
        toggleListener as EventListener,
      );
    };
  }, []); // Remove 'visible' from dependencies to prevent infinite loop

  const debuggerContent = !visible ? (
    <div
      className="fixed z-[99999] pointer-events-auto"
      style={{
        bottom: "20px",
        right: "20px",
        left: "auto",
        top: "auto",
        position: "fixed",
      }}
    >
      <button
        title="Click to show keyboard debugger (or press Ctrl+Alt+D)"
        onClick={() => {
          console.log("🧪 Button clicked, showing debugger");
          setVisible(true);
        }}
        className="block text-base text-white bg-red-600 hover:bg-red-700 px-6 py-4 rounded-xl border-4 border-yellow-400 shadow-2xl font-bold animate-bounce cursor-pointer whitespace-nowrap"
        style={{ boxShadow: "0 0 30px rgba(239, 68, 68, 0.8)" }}
      >
        🎹 KB DEBUG
      </button>
    </div>
  ) : (
    <div
      className="fixed bg-white dark:bg-gray-900 border-4 border-blue-500 rounded-lg shadow-2xl p-4 w-96 z-[99999]"
      style={{
        bottom: "20px",
        right: "20px",
        left: "auto",
        top: "auto",
        position: "fixed",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-base">⌨️ Keyboard Debug</h3>
        <button
          onClick={() => setVisible(false)}
          className="text-xs bg-red-500 text-white px-3 py-1.5 rounded hover:bg-red-600 font-bold"
        >
          Close
        </button>
      </div>

      <div className="mb-2">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          Last Key:
        </div>
        <div className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
          {lastKey || "(none)"}
        </div>
      </div>

      <div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          Recent (last 10):
        </div>
        <div className="text-xs font-mono space-y-0.5 max-h-32 overflow-y-auto">
          {events.length === 0 ? (
            <div className="text-gray-400 italic">No keys pressed yet</div>
          ) : (
            events.map((key, i) => (
              <div
                key={i}
                className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded"
              >
                {key}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 border-t pt-2">
        💡 Try: Ctrl+K, Alt+K, Ctrl+Space, Ctrl+,. Toggle with F12 or Ctrl+Alt+D
      </div>
    </div>
  );

  // Use portal to render directly to document.body
  return createPortal(debuggerContent, document.body);
};

export default KeyboardDebugger;
