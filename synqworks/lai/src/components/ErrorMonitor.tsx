import { useEffect, useState } from "react";
import { useErrorDetectionStore } from "../lib/stores/errorDetectionStore";
import ErrorNotification from "./ErrorNotification";
import { FadeIn } from "./Animations";

export default function ErrorMonitor() {
  const errors = useErrorDetectionStore((s) => s.errors);
  const removeError = useErrorDetectionStore((s) => s.removeError);
  const isEnabled = useErrorDetectionStore((s) => s.isEnabled);
  const [visibleErrors, setVisibleErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!isEnabled) return;

    // Show new errors
    const newErrors = errors
      .filter((e) => !visibleErrors.includes(e.id))
      .slice(0, 3); // Max 3 notifications at once

    if (newErrors.length > 0) {
      setVisibleErrors((prev) =>
        [...newErrors.map((e) => e.id), ...prev].slice(0, 3),
      );
    }
  }, [errors, isEnabled]);

  const handleDismiss = (errorId: string) => {
    setVisibleErrors((prev) => prev.filter((id) => id !== errorId));
    // Keep error in history, just remove from visible list
    setTimeout(() => {
      removeError(errorId);
    }, 300); // Allow fade out animation
  };

  if (!isEnabled || visibleErrors.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3 pointer-events-none">
      {visibleErrors.map((errorId) => {
        const error = errors.find((e) => e.id === errorId);
        if (!error) return null;

        return (
          <FadeIn key={error.id} className="pointer-events-auto">
            <ErrorNotification
              error={error}
              onDismiss={() => handleDismiss(error.id)}
            />
          </FadeIn>
        );
      })}
    </div>
  );
}
