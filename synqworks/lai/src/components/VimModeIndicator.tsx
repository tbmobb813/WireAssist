// VimModeIndicator.tsx
// Visual indicator for Vim navigation mode

import { Keyboard } from "lucide-react";

interface VimModeIndicatorProps {
  active: boolean;
}

export default function VimModeIndicator({ active }: VimModeIndicatorProps) {
  if (!active) return null;

  return (
    <div
      className="
        fixed bottom-4 left-4 z-50
        flex items-center gap-2 px-3 py-2
        bg-[#7aa2f7] text-white rounded-lg shadow-lg
        animate-in fade-in slide-in-from-bottom-2 duration-200
      "
    >
      <Keyboard size={16} />
      <span className="text-sm font-medium">Vim Mode</span>
      <div className="ml-2 pl-2 border-l border-white/30 text-xs">
        <kbd className="px-1.5 py-0.5 bg-white/20 rounded">j/k</kbd> scroll •{" "}
        <kbd className="px-1.5 py-0.5 bg-white/20 rounded">gg/G</kbd> top/bottom
        • <kbd className="px-1.5 py-0.5 bg-white/20 rounded">/</kbd> search •{" "}
        <kbd className="px-1.5 py-0.5 bg-white/20 rounded">ESC</kbd> exit
      </div>
    </div>
  );
}
