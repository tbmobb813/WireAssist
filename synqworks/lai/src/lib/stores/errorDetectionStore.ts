/**
 * Error Detection Store
 * Manages detected errors and notifications
 */

import { create } from "zustand";
import { ParsedError, detectErrors } from "../../types/errors";

interface ErrorDetectionState {
  // State
  errors: ParsedError[];
  isEnabled: boolean;
  lastCheck: string | null;

  // Settings
  autoNotify: boolean;
  notifyOnWarnings: boolean;
  maxErrors: number;

  // Actions
  scanContent: (content: string) => ParsedError[];
  addError: (error: ParsedError) => void;
  removeError: (errorId: string) => void;
  clearErrors: () => void;
  toggleEnabled: () => void;
  updateSettings: (settings: Partial<ErrorDetectionSettings>) => void;
}

export interface ErrorDetectionSettings {
  autoNotify: boolean;
  notifyOnWarnings: boolean;
  maxErrors: number;
}

export const useErrorDetectionStore = create<ErrorDetectionState>(
  (set, get) => ({
    // Initial state
    errors: [],
    isEnabled: true,
    lastCheck: null,
    autoNotify: true,
    notifyOnWarnings: false,
    maxErrors: 10,

    scanContent: (content) => {
      if (!get().isEnabled) return [];

      const detected = detectErrors(content);
      const newErrors = detected.filter((error) => {
        // Filter by settings
        if (!get().notifyOnWarnings && error.severity === "warning") {
          return false;
        }

        // Check if already exists
        return !get().errors.some((e) => e.id === error.id);
      });

      if (newErrors.length > 0) {
        set((state) => ({
          errors: [...newErrors, ...state.errors].slice(0, state.maxErrors),
          lastCheck: new Date().toISOString(),
        }));
      }

      return newErrors;
    },

    addError: (error) => {
      set((state) => ({
        errors: [error, ...state.errors].slice(0, state.maxErrors),
      }));
    },

    removeError: (errorId) => {
      set((state) => ({
        errors: state.errors.filter((e) => e.id !== errorId),
      }));
    },

    clearErrors: () => {
      set({ errors: [], lastCheck: null });
    },

    toggleEnabled: () => {
      set((state) => ({ isEnabled: !state.isEnabled }));
    },

    updateSettings: (settings) => {
      set((state) => ({ ...state, ...settings }));
    },
  }),
);
