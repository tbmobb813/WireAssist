/**
 * Routing Store
 *
 * Manages intelligent routing state and settings
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  RoutingSettings,
  RoutingDecision,
  DEFAULT_ROUTING_SETTINGS,
} from "../../types/routing";

interface RoutingStore {
  // Settings
  settings: RoutingSettings;
  updateSettings: (updates: Partial<RoutingSettings>) => void;

  // Current routing decision
  currentDecision: RoutingDecision | null;
  setCurrentDecision: (decision: RoutingDecision | null) => void;

  // Manual override
  manualOverride: string | null;
  setManualOverride: (modelId: string | null) => void;

  // Analytics
  routingHistory: Array<{
    timestamp: number;
    decision: RoutingDecision;
    queryType: string;
    projectType?: string;
  }>;
  addRoutingDecision: (
    decision: RoutingDecision,
    queryType: string,
    projectType?: string,
  ) => void;

  // Computed stats
  getTotalCostSavings: () => number;
  getModelUsageStats: () => Record<string, number>;
}

export const useRoutingStore = create<RoutingStore>()(
  persist(
    (set, get) => ({
      // Initial state
      settings: DEFAULT_ROUTING_SETTINGS,
      currentDecision: null,
      manualOverride: null,
      routingHistory: [],

      // Actions
      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }));
      },

      setCurrentDecision: (decision) => {
        set({ currentDecision: decision });
      },

      setManualOverride: (modelId) => {
        set({ manualOverride: modelId });
      },

      addRoutingDecision: (decision, queryType, projectType) => {
        set((state) => ({
          routingHistory: [
            ...state.routingHistory,
            {
              timestamp: Date.now(),
              decision,
              queryType,
              projectType,
            },
          ].slice(-100), // Keep last 100 decisions
        }));
      },

      getTotalCostSavings: () => {
        const history = get().routingHistory;
        return history.reduce((total, entry) => {
          return total + (entry.decision.costSavings || 0);
        }, 0);
      },

      getModelUsageStats: () => {
        const history = get().routingHistory;
        const stats: Record<string, number> = {};

        history.forEach((entry) => {
          const modelId = entry.decision.modelId;
          stats[modelId] = (stats[modelId] || 0) + 1;
        });

        return stats;
      },
    }),
    {
      name: "routing-store",
      partialize: (state) => ({
        settings: state.settings,
        routingHistory: state.routingHistory,
      }),
    },
  ),
);
