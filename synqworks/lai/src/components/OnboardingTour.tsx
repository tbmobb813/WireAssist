// OnboardingTour.tsx
// Interactive onboarding tour for new users

import { useEffect } from "react";
import {
  useOnboardingStore,
  type OnboardingStep,
} from "../lib/stores/onboardingStore";
import {
  Terminal,
  Sparkles,
  FileCode,
  AlertCircle,
  Settings,
  Rocket,
  X,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

interface StepContent {
  title: string;
  description: string;
  icon: React.ReactNode;
  highlightElement?: string; // CSS selector
  benefits: string[];
  tip?: string;
}

const STEP_CONTENT: Record<OnboardingStep, StepContent | null> = {
  welcome: {
    title: "Welcome to Linux AI Assistant! 👋",
    description:
      "Let's take a quick tour of the key features that make this the most powerful AI assistant for Linux developers.",
    icon: <Rocket className="text-[#7aa2f7]" size={32} />,
    benefits: [
      "Terminal integration for seamless workflows",
      "Multi-model routing for cost optimization",
      "Live code artifacts and previews",
      "Intelligent error detection",
      "Full keyboard navigation",
    ],
  },
  terminal: {
    title: "🚀 Terminal Integration",
    description:
      "Pipe errors, logs, and command output directly to the AI using the `lai` CLI tool.",
    icon: <Terminal className="text-[#9ece6a]" size={32} />,
    benefits: [
      "Analyze errors: cargo build 2>&1 | lai analyze",
      "Get suggestions: lai capture 'npm test'",
      "Open GUI: lai --gui",
    ],
    tip: "Use Ctrl+Shift+V to paste from clipboard",
  },
  routing: {
    title: "💡 Smart Model Routing",
    description:
      "Automatically routes queries to the best model for the task. Simple questions use cheaper models, complex tasks use premium ones.",
    icon: <Sparkles className="text-[#bb9af7]" size={32} />,
    benefits: [
      "Saves money on simple queries",
      "Uses GPT-4 only when needed",
      "Track savings in Cost Dashboard",
      "6 models: GPT-4, Claude, Gemini, local",
    ],
    tip: "Check the routing indicator in the input area",
  },
  artifacts: {
    title: "🎨 Live Code Artifacts",
    description:
      "AI-generated HTML, CSS, JS, React, and Vue code runs live in a sandboxed preview. Perfect for rapid prototyping.",
    icon: <FileCode className="text-[#e0af68]" size={32} />,
    benefits: [
      "Instant previews of web components",
      "Sandboxed execution for safety",
      "Edit and re-generate easily",
      "Export code to files",
    ],
    tip: "Try: 'Create a countdown timer in React'",
  },
  errors: {
    title: "🔍 Error Auto-Detection",
    description:
      "Automatically detects errors in your messages and offers one-click AI fixes. Supports 9 error types.",
    icon: <AlertCircle className="text-[#f7768e]" size={32} />,
    benefits: [
      "Recognizes stack traces, build errors, Git conflicts",
      "One-click 'Fix This Error' button",
      "Context-aware solutions",
      "Learns from your codebase",
    ],
    tip: "Paste any error message and get instant help",
  },
  settings: {
    title: "⚙️ Powerful Settings",
    description:
      "Customize everything: API keys, models, shortcuts, routing behavior, and more.",
    icon: <Settings className="text-[#7aa2f7]" size={32} />,
    benefits: [
      "Tab-based organization (5 categories)",
      "Global keyboard shortcuts",
      "Model preferences and API keys",
      "Monthly budget tracking",
    ],
    tip: "Press Ctrl+Comma to open settings anytime",
  },
  complete: null,
};

export default function OnboardingTour() {
  const {
    showTour,
    currentStep,
    nextStep,
    prevStep,
    skipTour,
    hasCompletedOnboarding,
  } = useOnboardingStore();

  const stepContent = STEP_CONTENT[currentStep];
  const isFirstStep = currentStep === "welcome";
  const isLastStep = currentStep === "settings";

  // Auto-show tour for new users
  useEffect(() => {
    if (!hasCompletedOnboarding) {
      // Delay to let the app render first
      const timer = setTimeout(() => {
        useOnboardingStore.getState().startTour();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedOnboarding]);

  if (!showTour || !stepContent) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200" />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#1a1b26] border border-[#414868] rounded-2xl shadow-2xl max-w-2xl w-full animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="relative bg-gradient-to-r from-[#24283b] to-[#1a1b26] px-8 py-6 border-b border-[#414868]/50">
            <button
              onClick={skipTour}
              className="absolute top-6 right-6 p-2 text-[#9aa5ce] hover:text-[#c0caf5] hover:bg-[#24283b] rounded-lg transition-colors"
              aria-label="Skip tour"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">{stepContent.icon}</div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-[#c0caf5] mb-1">
                  {stepContent.title}
                </h2>
                <p className="text-[#9aa5ce]">{stepContent.description}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-6 space-y-6">
            {/* Benefits */}
            <div>
              <h3 className="text-sm font-semibold text-[#c0caf5] uppercase tracking-wide mb-3">
                {currentStep === "welcome"
                  ? "What you'll learn:"
                  : "Key Features:"}
              </h3>
              <ul className="space-y-2">
                {stepContent.benefits.map((benefit, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#7aa2f7]/20 border border-[#7aa2f7]/30 flex items-center justify-center text-[#7aa2f7] text-xs mt-0.5">
                      ✓
                    </span>
                    <span className="text-[#9aa5ce] text-sm">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tip */}
            {stepContent.tip && (
              <div className="bg-[#7aa2f7]/10 border border-[#7aa2f7]/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-[#7aa2f7] text-lg">💡</span>
                  <div>
                    <p className="text-sm font-medium text-[#7aa2f7] mb-1">
                      Pro Tip
                    </p>
                    <p className="text-sm text-[#c0caf5]">{stepContent.tip}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-6 bg-[#24283b]/50 border-t border-[#414868]/50 flex items-center justify-between rounded-b-2xl">
            {/* Progress */}
            <div className="flex items-center gap-2">
              {Object.keys(STEP_CONTENT)
                .filter((key) => key !== "complete")
                .map((key, idx) => (
                  <div
                    key={key}
                    className={`h-1.5 rounded-full transition-all duration-200 ${
                      key === currentStep
                        ? "w-8 bg-[#7aa2f7]"
                        : idx < Object.keys(STEP_CONTENT).indexOf(currentStep)
                          ? "w-1.5 bg-[#9ece6a]"
                          : "w-1.5 bg-[#414868]"
                    }`}
                  />
                ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-3">
              {!isFirstStep && (
                <button
                  onClick={prevStep}
                  className="px-4 py-2 bg-[#414868] hover:bg-[#565f89] text-[#c0caf5] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              )}

              <button
                onClick={isLastStep ? skipTour : nextStep}
                className="px-6 py-2 bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                {isLastStep ? (
                  <>
                    Get Started
                    <Rocket size={16} />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
