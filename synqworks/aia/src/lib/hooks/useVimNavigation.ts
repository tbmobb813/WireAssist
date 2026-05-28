// useVimNavigation.ts
// Vim-style keyboard navigation for power users

import { useEffect, useRef, useState } from "react";

interface VimNavigationOptions {
  enabled?: boolean;
  scrollRef?: React.RefObject<HTMLElement>;
  onSearch?: () => void;
  onExplain?: () => void;
  onDebug?: () => void;
  onPrevConversation?: () => void;
  onNextConversation?: () => void;
}

export function useVimNavigation({
  enabled = true,
  scrollRef,
  onSearch,
  onExplain,
  onDebug,
  onPrevConversation,
  onNextConversation,
}: VimNavigationOptions) {
  const [vimMode, setVimMode] = useState(false);
  const lastKeyRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      // Don't intercept if user is typing in input/textarea
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const now = Date.now();
      const timeSinceLastKey = now - (lastKeyTimeRef.current ?? 0);
      const isDoubleKey =
        timeSinceLastKey < 500 && lastKeyRef.current === e.key;

      // Vim-style navigation
      switch (e.key) {
        case "j":
          // Scroll down
          e.preventDefault();
          if (scrollRef?.current) {
            scrollRef.current.scrollBy({ top: 100, behavior: "smooth" });
          } else {
            window.scrollBy({ top: 100, behavior: "smooth" });
          }
          setVimMode(true);
          break;

        case "k":
          // Scroll up
          e.preventDefault();
          if (scrollRef?.current) {
            scrollRef.current.scrollBy({ top: -100, behavior: "smooth" });
          } else {
            window.scrollBy({ top: -100, behavior: "smooth" });
          }
          setVimMode(true);
          break;

        case "g":
          // gg = top (double-tap g)
          if (isDoubleKey) {
            e.preventDefault();
            if (scrollRef?.current) {
              scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
            setVimMode(true);
            lastKeyRef.current = "";
          } else {
            lastKeyRef.current = "g";
            lastKeyTimeRef.current = now;
          }
          break;

        case "G":
          // G = bottom (shift+g)
          e.preventDefault();
          if (scrollRef?.current) {
            scrollRef.current.scrollTo({
              top: scrollRef.current.scrollHeight,
              behavior: "smooth",
            });
          } else {
            window.scrollTo({
              top: document.documentElement.scrollHeight,
              behavior: "smooth",
            });
          }
          setVimMode(true);
          break;

        case "/":
          // Open search
          e.preventDefault();
          if (onSearch) {
            onSearch();
          }
          setVimMode(true);
          break;

        case "E":
          // Ctrl+Shift+E = Explain
          if (e.ctrlKey && e.shiftKey) {
            e.preventDefault();
            if (onExplain) {
              onExplain();
            }
          }
          break;

        case "D":
          // Ctrl+Shift+D = Debug
          if (e.ctrlKey && e.shiftKey) {
            e.preventDefault();
            if (onDebug) {
              onDebug();
            }
          }
          break;

        case "ArrowUp":
          // Ctrl+ArrowUp = Previous conversation
          if (e.ctrlKey) {
            e.preventDefault();
            if (onPrevConversation) {
              onPrevConversation();
            }
          }
          break;

        case "ArrowDown":
          // Ctrl+ArrowDown = Next conversation
          if (e.ctrlKey) {
            e.preventDefault();
            if (onNextConversation) {
              onNextConversation();
            }
          }
          break;

        case "Escape":
          // Exit vim mode indicator
          setVimMode(false);
          break;

        default:
          // Reset double-key tracking for non-g keys
          if (e.key !== "g" && lastKeyRef.current === "g") {
            lastKeyRef.current = "";
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    scrollRef,
    onSearch,
    onExplain,
    onDebug,
    onPrevConversation,
    onNextConversation,
  ]);

  return { vimMode };
}
