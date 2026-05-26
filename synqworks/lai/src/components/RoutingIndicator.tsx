/**
 * Routing Indicator Component
 *
 * Shows the current model routing decision and allows manual override
 */

import { useState } from "react";
import { useRoutingStore } from "../lib/stores/routingStore";
import { MODEL_CAPABILITIES } from "../types/routing";
import {
  getModelIcon,
  getModelDisplayName,
} from "../lib/services/routingService";

export default function RoutingIndicator() {
  const { currentDecision, manualOverride, setManualOverride, settings } =
    useRoutingStore();
  const [showDropdown, setShowDropdown] = useState(false);

  if (!settings.enabled && !manualOverride) {
    return null;
  }

  const activeModelId =
    manualOverride || currentDecision?.modelId || settings.fallbackModel;
  const activeIcon = getModelIcon(activeModelId);
  const activeName = getModelDisplayName(activeModelId);

  const handleModelSelect = (modelId: string) => {
    setManualOverride(modelId === manualOverride ? null : modelId);
    setShowDropdown(false);
  };

  const handleClearOverride = (e: React.MouseEvent) => {
    e.stopPropagation();
    setManualOverride(null);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
        title={currentDecision?.reasoning || "Model selection"}
      >
        <span>{activeIcon}</span>
        <span className="text-gray-700 dark:text-gray-300">
          {activeName.split(" ")[0]} {/* Show just first part of name */}
        </span>
        {manualOverride && (
          <span
            className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            onClick={handleClearOverride}
            title="Clear manual override"
          >
            ✕
          </span>
        )}
        <svg
          className={`w-3 h-3 transition-transform ${showDropdown ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute bottom-full mb-2 left-0 min-w-[280px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 py-1">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              Select Model
            </div>

            {MODEL_CAPABILITIES.map((model) => {
              const isActive = model.modelId === activeModelId;
              const isOverride = model.modelId === manualOverride;
              const isRecommended = model.modelId === currentDecision?.modelId;

              return (
                <button
                  key={model.modelId}
                  onClick={() => handleModelSelect(model.modelId)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors flex items-start gap-2 ${
                    isActive ? "bg-blue-50 dark:bg-blue-900/20" : ""
                  }`}
                >
                  <span className="text-lg leading-none mt-0.5">
                    {getModelIcon(model.modelId)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium ${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-gray-100"}`}
                      >
                        {model.displayName}
                      </span>
                      {isRecommended && !isOverride && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          Recommended
                        </span>
                      )}
                      {isOverride && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                          Override
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {model.strengths.slice(0, 3).join(", ")}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          model.costTier === "free"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            : model.costTier === "low"
                              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                              : model.costTier === "medium"
                                ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                                : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                        }`}
                      >
                        {model.costTier}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {(model.contextWindow / 1000).toFixed(0)}K context
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}

            {currentDecision && settings.enabled && (
              <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 mt-1">
                <div className="font-medium mb-1">Routing Info</div>
                <div>{currentDecision.reasoning}</div>
                <div className="mt-1">
                  Confidence: {(currentDecision.confidence * 100).toFixed(0)}%
                </div>
                {currentDecision.costSavings && (
                  <div className="text-green-600 dark:text-green-400 mt-1">
                    Est. savings: ${currentDecision.costSavings.toFixed(4)}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
