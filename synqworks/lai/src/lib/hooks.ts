import { useEffect, useState, startTransition } from "react";

interface UseKeyboardShortcutsProps {
  onCommandPalette?: () => void;
  onNewConversation?: () => void;
  onSettings?: () => void;
}

export const useKeyboardShortcuts = ({
  onCommandPalette,
  onNewConversation,
  onSettings,
}: UseKeyboardShortcutsProps = {}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Command Palette — prefer browser-safe combos first
      // - Alt+K (safe in most browsers)
      // - Ctrl/Cmd+K (may be intercepted by browser search shortcut)
      // - Ctrl/Cmd+/ (rarely reserved)
      if (
        (e.altKey && key === "k") ||
        ((e.ctrlKey || e.metaKey) && (key === "k" || key === "/"))
      ) {
        e.preventDefault();
        console.log("🚀 Command Palette shortcut triggered!");
        onCommandPalette?.();
        return;
      }

      // New Conversation — Ctrl/Cmd+N (may be reserved for new window)
      // Keep it, but add Alt+N as a safer fallback
      if (
        ((e.ctrlKey || e.metaKey) && key === "n") ||
        (e.altKey && key === "n")
      ) {
        e.preventDefault();
        console.log("✨ New Conversation shortcut triggered!");
        onNewConversation?.();
        return;
      }

      // Settings — try multiple fallbacks to avoid browser conflicts
      // - Ctrl/Cmd+, (often reserved)
      // - Ctrl/Cmd+. (alternate)
      // - Alt+, or Alt+S (safe fallbacks)
      if ((e.ctrlKey || e.metaKey) && (key === "," || key === ".")) {
        e.preventDefault();
        console.log("⚙️ Settings shortcut triggered!");
        onSettings?.();
        return;
      }
      if (e.altKey && (key === "," || key === "s")) {
        e.preventDefault();
        console.log("⚙️ Settings shortcut (Alt) triggered!");
        onSettings?.();
        return;
      }
    };

    // Use capture to try to handle before browser defaults when possible
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", handleKeyDown, {
        capture: true,
      } as any);
  }, [onCommandPalette, onNewConversation, onSettings]);
};

// Hook for managing command palette state
export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => {
    console.log("📂 useCommandPalette.open() called");
    startTransition(() => {
      console.log("📂 Setting isOpen to true");
      setIsOpen(true);
    });
  };
  const close = () => startTransition(() => setIsOpen(false));
  const toggle = () => startTransition(() => setIsOpen((prev) => !prev));

  // Listen for custom events
  useEffect(() => {
    const handleOpenCommandPalette = () => {
      console.log("📂 Custom event 'open-command-palette' received");
      open();
    };

    document.addEventListener("open-command-palette", handleOpenCommandPalette);
    return () =>
      document.removeEventListener(
        "open-command-palette",
        handleOpenCommandPalette,
      );
  }, []);

  return { isOpen, open, close, toggle };
};

// Hook for smooth animations and transitions
export const useAnimations = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Small delay to trigger entrance animations
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return { isVisible };
};

// Hook for managing loading states with micro-interactions
export const useLoadingState = (initialState = false) => {
  const [isLoading, setIsLoading] = useState(initialState);
  const [progress, setProgress] = useState(0);

  const startLoading = () => {
    setIsLoading(true);
    setProgress(0);
  };

  const updateProgress = (value: number) => {
    setProgress(Math.max(0, Math.min(100, value)));
  };

  const finishLoading = () => {
    setProgress(100);
    setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
    }, 300);
  };

  return {
    isLoading,
    progress,
    startLoading,
    updateProgress,
    finishLoading,
  };
};

export default {
  useKeyboardShortcuts,
  useCommandPalette,
  useAnimations,
  useLoadingState,
};
