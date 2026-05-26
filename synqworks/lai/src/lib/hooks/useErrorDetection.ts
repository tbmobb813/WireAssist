/**
 * Error Detection Hook
 * Provides utilities to scan content for errors and trigger notifications
 */

import { useCallback } from "react";
import { useErrorDetectionStore } from "../stores/errorDetectionStore";
import { useUiStore } from "../stores/uiStore";

export function useErrorDetection() {
  const scanContent = useErrorDetectionStore((s) => s.scanContent);
  const isEnabled = useErrorDetectionStore((s) => s.isEnabled);
  const autoNotify = useErrorDetectionStore((s) => s.autoNotify);
  const addToast = useUiStore((s) => s.addToast);

  const detectAndNotify = useCallback(
    (content: string, source?: string) => {
      if (!isEnabled) return [];

      const errors = scanContent(content);

      if (errors.length > 0 && autoNotify) {
        const count = errors.length;
        const errorWord = count === 1 ? "error" : "errors";
        addToast({
          message: `Detected ${count} ${errorWord}${source ? ` in ${source}` : ""}`,
          type: "error",
          ttl: 3000,
        });
      }

      return errors;
    },
    [scanContent, isEnabled, autoNotify, addToast],
  );

  return {
    detectAndNotify,
    isEnabled,
  };
}
