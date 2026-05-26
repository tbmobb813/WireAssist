// src/lib/stores/onboardingStore.ts
// Zustand store for onboarding tour state

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OnboardingStep =
  | "welcome"
  | "terminal"
  | "routing"
  | "artifacts"
  | "errors"
  | "settings"
  | "complete";

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  currentStep: OnboardingStep;
  showTour: boolean;
  showTooltips: boolean;

  // Actions
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  resetTour: () => void;
  setStep: (step: OnboardingStep) => void;
  toggleTooltips: (show: boolean) => void;
}

const STEP_ORDER: OnboardingStep[] = [
  "welcome",
  "terminal",
  "routing",
  "artifacts",
  "errors",
  "settings",
  "complete",
];

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      hasCompletedOnboarding: false,
      currentStep: "welcome",
      showTour: false,
      showTooltips: true,

      startTour: () => {
        set({
          showTour: true,
          currentStep: "welcome",
        });
      },

      nextStep: () => {
        const { currentStep } = get();
        const currentIndex = STEP_ORDER.indexOf(currentStep);
        const nextIndex = Math.min(currentIndex + 1, STEP_ORDER.length - 1);
        const nextStep = STEP_ORDER[nextIndex];

        if (nextStep === "complete") {
          set({
            currentStep: nextStep,
            showTour: false,
            hasCompletedOnboarding: true,
          });
        } else {
          set({ currentStep: nextStep });
        }
      },

      prevStep: () => {
        const { currentStep } = get();
        const currentIndex = STEP_ORDER.indexOf(currentStep);
        const prevIndex = Math.max(currentIndex - 1, 0);
        set({ currentStep: STEP_ORDER[prevIndex] });
      },

      skipTour: () => {
        set({
          showTour: false,
          hasCompletedOnboarding: true,
          currentStep: "complete",
        });
      },

      completeTour: () => {
        set({
          showTour: false,
          hasCompletedOnboarding: true,
          currentStep: "complete",
        });
      },

      resetTour: () => {
        set({
          hasCompletedOnboarding: false,
          currentStep: "welcome",
          showTour: true,
          showTooltips: true,
        });
      },

      setStep: (step) => {
        set({ currentStep: step });
      },

      toggleTooltips: (show) => {
        set({ showTooltips: show });
      },
    }),
    {
      name: "onboarding-store",
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        showTooltips: state.showTooltips,
      }),
    },
  ),
);
