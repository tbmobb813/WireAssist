/**
 * Multi-Model Intelligent Routing Service
 *
 * Core routing logic that selects the optimal AI model based on:
 * - Query classification (type and complexity)
 * - Project context (language, type)
 * - Cost preferences
 * - Model capabilities
 */

import {
  QueryType,
  QueryClassification,
  RoutingContext,
  RoutingDecision,
  RoutingSettings,
  ModelCapability,
  MODEL_CAPABILITIES,
  QUERY_TYPE_PATTERNS,
  COMPLEXITY_INDICATORS,
  DEFAULT_ROUTING_SETTINGS,
} from "../../types/routing";

/**
 * Classify a user query to determine intent and complexity
 */
export function classifyQuery(
  query: string,
  context: RoutingContext,
): QueryClassification {
  const lowerQuery = query.toLowerCase();

  // Detect query type based on keyword patterns
  let queryType: QueryType = "general_question";
  let maxScore = 0;

  for (const [type, patterns] of Object.entries(QUERY_TYPE_PATTERNS)) {
    const score = patterns.filter((pattern) =>
      lowerQuery.includes(pattern),
    ).length;
    if (score > maxScore) {
      maxScore = score;
      queryType = type as QueryType;
    }
  }

  // Detect complexity
  let complexity: "simple" | "medium" | "complex" = "medium";

  if (
    COMPLEXITY_INDICATORS.complex.some((indicator) =>
      lowerQuery.includes(indicator),
    )
  ) {
    complexity = "complex";
  } else if (
    COMPLEXITY_INDICATORS.simple.some((indicator) =>
      lowerQuery.includes(indicator),
    )
  ) {
    complexity = "simple";
  }

  // Adjust complexity based on query length and code presence
  if (query.length > 500 || query.includes("```")) {
    complexity = complexity === "simple" ? "medium" : "complex";
  }

  // Check if query requires context
  const requiresContext =
    context.hasCodeContext ||
    context.hasErrorContext ||
    lowerQuery.includes("this code") ||
    lowerQuery.includes("my project") ||
    lowerQuery.includes("above") ||
    lowerQuery.includes("previous");

  // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
  const tokensEstimate = Math.ceil(
    (query.length + (requiresContext ? 2000 : 0)) / 4,
  );

  return {
    type: queryType,
    complexity,
    requiresContext,
    tokensEstimate,
  };
}

/**
 * Calculate a score for how well a model matches the requirements
 */
function scoreModel(
  model: ModelCapability,
  classification: QueryClassification,
  context: RoutingContext,
  settings: RoutingSettings,
): number {
  let score = 0;

  // Base score: does model support this query type?
  if (model.bestFor.includes(classification.type)) {
    score += 30;
  }

  // Complexity match
  if (model.maxComplexity === classification.complexity) {
    score += 25;
  } else if (
    model.maxComplexity === "complex" &&
    classification.complexity === "medium"
  ) {
    score += 20; // Can handle it, but might be overkill
  } else if (
    model.maxComplexity === "simple" &&
    classification.complexity !== "simple"
  ) {
    score -= 20; // Not sufficient
  }

  // Project type / language match
  if (context.projectType) {
    const projectLang = context.projectType.toLowerCase();
    if (model.languages.some((lang) => projectLang.includes(lang))) {
      score += 20;
    }
    if (model.strengths.includes(projectLang)) {
      score += 15;
    }
  }

  // Context window requirements
  if (classification.tokensEstimate > model.contextWindow) {
    score -= 50; // Cannot handle
  } else if (classification.tokensEstimate < model.contextWindow / 2) {
    score += 5; // Comfortable fit
  }

  // Cost preference adjustment
  if (settings.costPreference === "economy") {
    if (model.costTier === "free") score += 20;
    if (model.costTier === "low") score += 15;
    if (model.costTier === "high") score -= 10;
  } else if (settings.costPreference === "quality") {
    if (model.costTier === "high") score += 15;
    if (model.costTier === "medium") score += 5;
  } else {
    // balanced
    if (model.costTier === "medium") score += 10;
    if (model.costTier === "free" || model.costTier === "low") score += 5;
  }

  // Downgrade penalty if not allowed
  if (!settings.allowDowngrade && model.costTier !== "high") {
    score -= 15;
  }

  // Continuity bonus: prefer same model as previous if it was good
  if (context.previousModel === model.modelId && score > 40) {
    score += 10;
  }

  return Math.max(0, score);
}

/**
 * Select the optimal model for a given query and context
 */
export function selectOptimalModel(
  context: RoutingContext,
  settings: RoutingSettings = DEFAULT_ROUTING_SETTINGS,
): RoutingDecision {
  // If routing disabled or user has preference, use that
  if (!settings.enabled || context.userPreference) {
    const modelId = context.userPreference || settings.fallbackModel;
    return {
      modelId,
      reasoning: context.userPreference
        ? "User preference"
        : "Routing disabled",
      confidence: 1.0,
      alternatives: [],
    };
  }

  // Check for language-specific overrides
  if (
    context.projectType &&
    settings.alwaysUseForLanguages?.[context.projectType]
  ) {
    const modelId = settings.alwaysUseForLanguages[context.projectType];
    return {
      modelId,
      reasoning: `Always use ${modelId} for ${context.projectType} projects (user setting)`,
      confidence: 1.0,
      alternatives: [],
    };
  }

  // Classify the query
  const classification = classifyQuery(context.query, context);

  // Score all available models
  const scoredModels = MODEL_CAPABILITIES.map((model) => ({
    model,
    score: scoreModel(model, classification, context, settings),
  })).sort((a, b) => b.score - a.score);

  const topModel = scoredModels[0];
  const maxScore = topModel.score;

  // Calculate confidence (normalize score to 0-1)
  const confidence = Math.min(maxScore / 100, 1.0);

  // If confidence too low, use fallback
  if (confidence < settings.minConfidence) {
    return {
      modelId: settings.fallbackModel,
      reasoning: `Low routing confidence (${(confidence * 100).toFixed(0)}%), using fallback`,
      confidence: 0.5,
      alternatives: scoredModels.slice(0, 3).map((m) => ({
        modelId: m.model.modelId,
        score: m.score,
      })),
    };
  }

  // Build reasoning string
  const reasons: string[] = [];

  if (classification.complexity === "complex") {
    reasons.push("complex query");
  }
  if (context.projectType) {
    reasons.push(`${context.projectType} project`);
  }
  if (classification.type !== "general_question") {
    reasons.push(classification.type.replace(/_/g, " "));
  }
  if (settings.costPreference === "economy") {
    reasons.push("cost optimized");
  }

  const reasoning =
    reasons.length > 0
      ? `Best for: ${reasons.join(", ")}`
      : "General purpose model";

  // Calculate cost savings (rough estimate)
  const premiumModel = MODEL_CAPABILITIES.find((m) => m.costTier === "high");
  let costSavings = 0;
  if (premiumModel && topModel.model.costTier !== "high") {
    // Estimate: premium costs $0.003/1K tokens, free is $0, low is $0.0005, medium is $0.001
    const costMap = { free: 0, low: 0.0005, medium: 0.001, high: 0.003 };
    const tokenCost = classification.tokensEstimate / 1000;
    costSavings = (costMap.high - costMap[topModel.model.costTier]) * tokenCost;
  }

  return {
    modelId: topModel.model.modelId,
    reasoning,
    confidence,
    alternatives: scoredModels.slice(1, 4).map((m) => ({
      modelId: m.model.modelId,
      score: m.score,
    })),
    costSavings: costSavings > 0 ? costSavings : undefined,
  };
}

/**
 * Get model display name from ID
 */
export function getModelDisplayName(modelId: string): string {
  const model = MODEL_CAPABILITIES.find((m) => m.modelId === modelId);
  return model?.displayName || modelId;
}

/**
 * Get model emoji icon for UI
 */
export function getModelIcon(modelId: string): string {
  if (modelId.includes("claude")) return "🤖";
  if (modelId.includes("gpt")) return "💬";
  if (modelId.includes("gemini")) return "✨";
  return "🧠";
}

/**
 * Format routing decision for UI display
 */
export function formatRoutingDecision(decision: RoutingDecision): string {
  const icon = getModelIcon(decision.modelId);
  const name = getModelDisplayName(decision.modelId);
  return `${icon} ${name}${decision.reasoning ? ` • ${decision.reasoning}` : ""}`;
}
