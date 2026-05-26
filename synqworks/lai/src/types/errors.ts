/**
 * Error Detection Types
 * For automatic error detection and contextual assistance
 */

export type ErrorSeverity = "error" | "warning" | "info";

export type ErrorSource =
  | "typescript"
  | "rust"
  | "python"
  | "javascript"
  | "go"
  | "java"
  | "generic"
  | "npm"
  | "cargo"
  | "git"
  | "shell";

export interface ParsedError {
  id: string;
  severity: ErrorSeverity;
  source: ErrorSource;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  code?: string; // Error code like TS2307, E0308
  stackTrace?: string[];
  context?: string; // Surrounding code or context
  suggestion?: string; // Compiler suggestion if available
  raw: string; // Original error text
  timestamp: string;
}

export interface ErrorPattern {
  name: string;
  source: ErrorSource;
  regex: RegExp;
  parser: (match: RegExpMatchArray) => Partial<ParsedError>;
}

/**
 * Common error patterns for various languages and tools
 */
export const ERROR_PATTERNS: ErrorPattern[] = [
  // TypeScript errors
  {
    name: "TypeScript Compiler Error",
    source: "typescript",
    regex: /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(\w+):\s*(.+)$/m,
    parser: (match) => ({
      file: match[1],
      line: parseInt(match[2]),
      column: parseInt(match[3]),
      severity: match[4] as ErrorSeverity,
      code: match[5],
      message: match[6],
    }),
  },

  // Rust compiler errors (rustc/cargo)
  {
    name: "Rust Compiler Error",
    source: "rust",
    regex: /^error(?:\[(\w+)\])?: (.+?)\n\s+-->\s+(.+?):(\d+):(\d+)/m,
    parser: (match) => ({
      code: match[1],
      message: match[2],
      file: match[3],
      line: parseInt(match[4]),
      column: parseInt(match[5]),
      severity: "error",
    }),
  },

  // Python errors
  {
    name: "Python Traceback",
    source: "python",
    regex:
      /File "(.+?)", line (\d+)(?:, in (.+?))?\n\s+(.+?)\n(\w+Error): (.+)/m,
    parser: (match) => ({
      file: match[1],
      line: parseInt(match[2]),
      context: match[4],
      code: match[5],
      message: match[6],
      severity: "error",
    }),
  },

  // JavaScript/Node errors
  {
    name: "JavaScript Error",
    source: "javascript",
    regex: /^(\w+Error): (.+?)\n\s+at .+? \((.+?):(\d+):(\d+)\)/m,
    parser: (match) => ({
      code: match[1],
      message: match[2],
      file: match[3],
      line: parseInt(match[4]),
      column: parseInt(match[5]),
      severity: "error",
    }),
  },

  // Go compiler errors
  {
    name: "Go Compiler Error",
    source: "go",
    regex: /^(.+?):(\d+):(\d+): (.+)$/m,
    parser: (match) => ({
      file: match[1],
      line: parseInt(match[2]),
      column: parseInt(match[3]),
      message: match[4],
      severity: "error",
    }),
  },

  // NPM errors
  {
    name: "NPM Error",
    source: "npm",
    regex: /^npm ERR! (.+)$/m,
    parser: (match) => ({
      message: match[1],
      severity: "error",
    }),
  },

  // Cargo errors
  {
    name: "Cargo Build Error",
    source: "cargo",
    regex: /^\s*error: (.+)$/m,
    parser: (match) => ({
      message: match[1],
      severity: "error",
    }),
  },

  // Git errors
  {
    name: "Git Error",
    source: "git",
    regex: /^(?:fatal|error): (.+)$/m,
    parser: (match) => ({
      message: match[1],
      severity: "error",
    }),
  },

  // Generic error pattern (fallback)
  {
    name: "Generic Error",
    source: "generic",
    regex: /\b(error|fail(?:ed|ure)|exception|fatal)\b:?\s*(.+)/i,
    parser: (match) => ({
      message: match[2] || match[0],
      severity: "error",
    }),
  },
];

/**
 * Parse text content for errors
 */
export function detectErrors(content: string): ParsedError[] {
  const errors: ParsedError[] = [];

  // Try each pattern
  for (const pattern of ERROR_PATTERNS) {
    const matches = content.matchAll(new RegExp(pattern.regex, "gm"));

    for (const match of matches) {
      try {
        const parsed = pattern.parser(match);
        const error: ParsedError = {
          id: generateErrorId(),
          severity: parsed.severity || "error",
          source: pattern.source,
          message: parsed.message || "Unknown error",
          file: parsed.file,
          line: parsed.line,
          column: parsed.column,
          code: parsed.code,
          stackTrace: parsed.stackTrace,
          context: parsed.context,
          suggestion: parsed.suggestion,
          raw: match[0],
          timestamp: new Date().toISOString(),
        };

        errors.push(error);
      } catch (e) {
        console.warn("Failed to parse error:", e);
      }
    }
  }

  return deduplicateErrors(errors);
} /**
 * Extract stack trace from error text
 */
export function extractStackTrace(
  content: string,
  startLine: number,
): string[] {
  const lines = content.split("\n").slice(startLine);
  const stackTrace: string[] = [];

  for (const line of lines) {
    // Common stack trace patterns
    if (
      line.trim().startsWith("at ") ||
      line.trim().startsWith("-->") ||
      line.trim().match(/^\s+\d+\s+\|/) ||
      line.trim().match(/^File "/)
    ) {
      stackTrace.push(line.trim());
    } else if (stackTrace.length > 0) {
      // Stop when stack trace pattern breaks
      break;
    }
  }

  return stackTrace;
}

/**
 * Generate unique error ID
 */
function generateErrorId(): string {
  return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Remove duplicate errors
 */
function deduplicateErrors(errors: ParsedError[]): ParsedError[] {
  const seen = new Set<string>();
  return errors.filter((error) => {
    const key = `${error.file}:${error.line}:${error.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Check if text contains errors
 */
export function hasErrors(content: string): boolean {
  return ERROR_PATTERNS.some((pattern) => pattern.regex.test(content));
}

/**
 * Get error severity icon
 */
export function getErrorIcon(severity: ErrorSeverity): string {
  switch (severity) {
    case "error":
      return "🔴";
    case "warning":
      return "⚠️";
    case "info":
      return "ℹ️";
  }
}

/**
 * Format error for AI context
 */
export function formatErrorForAI(error: ParsedError): string {
  let formatted = `## ${getErrorIcon(error.severity)} ${error.source.toUpperCase()} Error\n\n`;

  if (error.code) {
    formatted += `**Error Code:** ${error.code}\n`;
  }

  formatted += `**Message:** ${error.message}\n\n`;

  if (error.file) {
    formatted += `**File:** \`${error.file}\``;
    if (error.line) {
      formatted += `:${error.line}`;
      if (error.column) {
        formatted += `:${error.column}`;
      }
    }
    formatted += "\n\n";
  }

  if (error.context) {
    formatted += `**Context:**\n\`\`\`\n${error.context}\n\`\`\`\n\n`;
  }

  if (error.stackTrace && error.stackTrace.length > 0) {
    formatted += `**Stack Trace:**\n\`\`\`\n${error.stackTrace.join("\n")}\n\`\`\`\n\n`;
  }

  if (error.suggestion) {
    formatted += `**Compiler Suggestion:** ${error.suggestion}\n\n`;
  }

  formatted += `**Raw Error:**\n\`\`\`\n${error.raw}\n\`\`\`\n`;

  return formatted;
}

/**
 * Create fix request message
 */
export function createFixRequest(error: ParsedError): string {
  return `Fix this ${error.source} error:\n\n${formatErrorForAI(error)}`;
}
