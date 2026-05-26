/**
 * Multi-Model Intelligent Routing System
 *
 * Automatically selects the optimal AI model based on:
 * - Query intent and complexity
 * - Project type and programming language
 * - Cost optimization preferences
 * - Model capabilities and strengths
 */

export type QueryType =
  | "code_generation"
  | "debugging"
  | "code_explanation"
  | "refactoring"
  | "creative_writing"
  | "data_analysis"
  | "general_question"
  | "documentation"
  | "architecture";

export type CostPreference = "economy" | "balanced" | "quality";

export interface QueryClassification {
  type: QueryType;
  complexity: "simple" | "medium" | "complex";
  requiresContext: boolean;
  tokensEstimate: number;
}

export interface RoutingContext {
  query: string;
  projectType?: string; // From project detection (Node, Rust, Python, etc.)
  conversationLength: number;
  hasCodeContext: boolean;
  hasErrorContext: boolean;
  previousModel?: string;
  userPreference?: string; // Manual override
}

export interface ModelCapability {
  modelId: string;
  displayName: string;
  strengths: string[]; // e.g., ["rust", "systems", "reasoning"]
  costTier: "free" | "low" | "medium" | "high";
  contextWindow: number;
  bestFor: QueryType[];
  languages: string[]; // Programming languages it excels at
  maxComplexity: "simple" | "medium" | "complex";
}

export interface RoutingDecision {
  modelId: string;
  reasoning: string;
  confidence: number; // 0-1 score
  alternatives: Array<{ modelId: string; score: number }>;
  costSavings?: number; // Estimated savings vs always using premium model
}

export interface RoutingSettings {
  enabled: boolean;
  costPreference: CostPreference;
  alwaysUseForLanguages?: Record<string, string>; // e.g., { rust: "claude-sonnet" }
  minConfidence: number; // Minimum confidence to auto-route (default 0.7)
  fallbackModel: string; // Default when routing uncertain
  allowDowngrade: boolean; // Allow cheaper models for simple queries
  trackPerformance: boolean;
}

/**
 * Model capability definitions
 * Defines strengths and characteristics of each available model
 */
export const MODEL_CAPABILITIES: ModelCapability[] = [
  {
    modelId: "claude-3-5-sonnet-20241022",
    displayName: "Claude 3.5 Sonnet",
    strengths: [
      "reasoning",
      "systems",
      "rust",
      "complex_logic",
      "architecture",
    ],
    costTier: "high",
    contextWindow: 200000,
    bestFor: ["code_generation", "debugging", "refactoring", "architecture"],
    languages: ["rust", "cpp", "go", "typescript", "python"],
    maxComplexity: "complex",
  },
  {
    modelId: "gpt-4o",
    displayName: "GPT-4o",
    strengths: ["general", "python", "data_science", "creative", "multimodal"],
    costTier: "high",
    contextWindow: 128000,
    bestFor: [
      "code_generation",
      "data_analysis",
      "creative_writing",
      "documentation",
    ],
    languages: ["python", "javascript", "typescript", "java", "php"],
    maxComplexity: "complex",
  },
  {
    modelId: "gpt-4o-mini",
    displayName: "GPT-4o Mini",
    strengths: ["fast", "efficient", "general", "cost_effective"],
    costTier: "medium",
    contextWindow: 128000,
    bestFor: ["code_explanation", "general_question", "documentation"],
    languages: ["python", "javascript", "typescript", "java", "go"],
    maxComplexity: "medium",
  },
  {
    modelId: "gpt-3.5-turbo",
    displayName: "GPT-3.5 Turbo",
    strengths: ["fast", "economical", "simple_queries"],
    costTier: "low",
    contextWindow: 16385,
    bestFor: ["general_question", "code_explanation"],
    languages: ["python", "javascript", "typescript"],
    maxComplexity: "simple",
  },
  {
    modelId: "gemini-1.5-flash",
    displayName: "Gemini 1.5 Flash",
    strengths: ["fast", "free", "multimodal", "cost_effective"],
    costTier: "free",
    contextWindow: 1000000,
    bestFor: ["general_question", "code_explanation", "documentation"],
    languages: ["python", "javascript", "java", "go"],
    maxComplexity: "medium",
  },
  {
    modelId: "gemini-1.5-pro",
    displayName: "Gemini 1.5 Pro",
    strengths: ["large_context", "multimodal", "reasoning"],
    costTier: "medium",
    contextWindow: 2000000,
    bestFor: ["code_generation", "debugging", "data_analysis"],
    languages: ["python", "javascript", "java", "go", "cpp"],
    maxComplexity: "complex",
  },
];

/**
 * Query type keywords for classification
 * Used to detect query intent from user message
 */
export const QUERY_TYPE_PATTERNS: Record<QueryType, string[]> = {
  code_generation: [
    "create",
    "build",
    "write",
    "implement",
    "generate",
    "make a",
    "develop",
    "code for",
    "function that",
    "class that",
  ],
  debugging: [
    "fix",
    "debug",
    "error",
    "bug",
    "not working",
    "doesn't work",
    "issue",
    "problem",
    "wrong",
    "broken",
  ],
  code_explanation: [
    "explain",
    "what does",
    "how does",
    "understand",
    "what is",
    "clarify",
    "describe",
    "tell me about",
    "walk me through",
  ],
  refactoring: [
    "refactor",
    "improve",
    "optimize",
    "clean up",
    "restructure",
    "better way",
    "rewrite",
    "simplify",
  ],
  creative_writing: [
    "write a story",
    "creative",
    "narrative",
    "poem",
    "essay",
    "article",
    "blog post",
  ],
  data_analysis: [
    "analyze",
    "data",
    "statistics",
    "trends",
    "insights",
    "visualize",
    "chart",
    "graph",
  ],
  general_question: [
    "what",
    "how",
    "why",
    "when",
    "where",
    "who",
    "can you",
    "?",
  ],
  documentation: [
    "document",
    "readme",
    "comments",
    "docstring",
    "documentation",
    "api docs",
    "guide",
  ],
  architecture: [
    "architecture",
    "design",
    "structure",
    "system",
    "diagram",
    "pattern",
    "best practices",
  ],
};

/**
 * Complexity indicators
 * Keywords that suggest query complexity level
 */
export const COMPLEXITY_INDICATORS = {
  simple: ["what is", "explain", "how to", "simple", "basic", "quick"],
  medium: ["implement", "create", "build", "fix", "refactor"],
  complex: [
    "architecture",
    "system design",
    "optimize",
    "performance",
    "scale",
    "distributed",
    "algorithm",
  ],
};

/**
 * Default routing settings
 */
export const DEFAULT_ROUTING_SETTINGS: RoutingSettings = {
  enabled: true,
  costPreference: "balanced",
  minConfidence: 0.7,
  fallbackModel: "gpt-4o",
  allowDowngrade: true,
  trackPerformance: true,
};
