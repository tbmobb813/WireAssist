import { useUiStore } from "../stores/uiStore";
import React from "react";

// Error types for categorization
export enum ErrorType {
  NETWORK = "network",
  DATABASE = "database",
  API = "api",
  VALIDATION = "validation",
  AUTHENTICATION = "authentication",
  PERMISSION = "permission",
  SYSTEM = "system",
  UNKNOWN = "unknown",
}

// Error severity levels
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

// Structured error interface
export interface AppError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  details?: any;
  timestamp: number;
  context?: string;
  recoverable: boolean;
  retryable: boolean;
}

// Error recovery actions
export interface ErrorRecovery {
  label: string;
  action: () => void | Promise<void>;
}

// User-friendly error messages
const ERROR_MESSAGES: Record<string, string> = {
  // Network errors
  fetch_failed:
    "Unable to connect to the service. Please check your internet connection.",
  timeout: "The request timed out. Please try again.",
  connection_refused:
    "Cannot connect to the service. It may be temporarily unavailable.",

  // Database errors
  db_connection_failed:
    "Database connection failed. Your data may not be saved.",
  db_query_failed:
    "Failed to retrieve data. Please try refreshing the application.",
  db_write_failed: "Failed to save data. Please try again.",

  // API errors
  api_key_invalid: "API key is invalid or expired. Please check your settings.",
  api_rate_limited:
    "Too many requests. Please wait a moment before trying again.",
  api_quota_exceeded: "API quota exceeded. Please check your usage limits.",

  // Validation errors
  invalid_input: "Please check your input and try again.",
  missing_required_field: "Please fill in all required fields.",

  // System errors
  permission_denied: "Permission denied. Please check your system permissions.",
  file_not_found: "File not found. It may have been moved or deleted.",
  disk_full:
    "Insufficient disk space. Please free up some space and try again.",

  // Generic fallback
  unknown_error: "An unexpected error occurred. Please try again.",
};

// Error classification function
export function classifyError(error: any): {
  type: ErrorType;
  severity: ErrorSeverity;
} {
  const errorString = String(error).toLowerCase();

  // Network errors
  if (
    errorString.includes("fetch") ||
    errorString.includes("network") ||
    errorString.includes("connection")
  ) {
    return { type: ErrorType.NETWORK, severity: ErrorSeverity.MEDIUM };
  }

  // Database errors
  if (
    errorString.includes("database") ||
    errorString.includes("sqlite") ||
    errorString.includes("query")
  ) {
    return { type: ErrorType.DATABASE, severity: ErrorSeverity.HIGH };
  }

  // API errors
  if (
    errorString.includes("api") ||
    errorString.includes("unauthorized") ||
    errorString.includes("forbidden")
  ) {
    return { type: ErrorType.API, severity: ErrorSeverity.MEDIUM };
  }

  // Permission errors
  if (
    errorString.includes("permission") ||
    errorString.includes("denied") ||
    errorString.includes("access")
  ) {
    return { type: ErrorType.PERMISSION, severity: ErrorSeverity.HIGH };
  }

  return { type: ErrorType.UNKNOWN, severity: ErrorSeverity.MEDIUM };
}

// Create structured error from any error
export function createAppError(
  error: any,
  context?: string,
  customMessage?: string,
): AppError {
  const { type, severity } = classifyError(error);
  const errorKey = extractErrorKey(error);

  return {
    id: `error_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    type,
    severity,
    message: String(error),
    userMessage:
      customMessage || ERROR_MESSAGES[errorKey] || ERROR_MESSAGES.unknown_error,
    details: error,
    timestamp: Date.now(),
    context,
    recoverable: severity !== ErrorSeverity.CRITICAL,
    retryable: type === ErrorType.NETWORK || type === ErrorType.API,
  };
}

// Extract error key for message lookup
function extractErrorKey(error: any): string {
  const errorString = String(error).toLowerCase();

  if (errorString.includes("fetch") && errorString.includes("failed"))
    return "fetch_failed";
  if (errorString.includes("timeout")) return "timeout";
  if (errorString.includes("connection refused")) return "connection_refused";
  if (errorString.includes("api key")) return "api_key_invalid";
  if (errorString.includes("rate limit")) return "api_rate_limited";
  if (errorString.includes("quota")) return "api_quota_exceeded";
  if (errorString.includes("permission denied")) return "permission_denied";
  if (errorString.includes("file not found")) return "file_not_found";
  if (errorString.includes("disk full") || errorString.includes("no space"))
    return "disk_full";

  return "unknown_error";
}

// Enhanced error handler with recovery options
export class ErrorHandler {
  private static errorLog: AppError[] = [];

  static handle(
    error: any,
    context?: string,
    recoveryActions?: ErrorRecovery[],
    customMessage?: string,
  ): AppError {
    const appError = createAppError(error, context, customMessage);

    // Log error
    this.log(appError);

    // Show user notification
    this.showErrorToast(appError, recoveryActions);

    // Log to console in development
    if (
      typeof window !== "undefined" &&
      window.location.hostname === "localhost"
    ) {
      console.error(
        `[${appError.type}] ${appError.context || "Unknown context"}:`,
        appError.details,
      );
    }

    // Report critical errors
    if (appError.severity === ErrorSeverity.CRITICAL) {
      this.reportCriticalError(appError);
    }

    return appError;
  }

  private static log(error: AppError): void {
    this.errorLog.push(error);

    // Keep only last 100 errors
    if (this.errorLog.length > 100) {
      this.errorLog = this.errorLog.slice(-100);
    }
  }

  private static showErrorToast(
    error: AppError,
    recoveryActions?: ErrorRecovery[],
  ): void {
    const { addToast } = useUiStore.getState();

    // Determine toast type based on severity
    const toastType =
      error.severity === ErrorSeverity.HIGH ||
      error.severity === ErrorSeverity.CRITICAL
        ? ("error" as const)
        : ("info" as const);

    // Calculate timeout based on severity
    const ttl =
      error.severity === ErrorSeverity.CRITICAL
        ? 10000
        : error.severity === ErrorSeverity.HIGH
          ? 7000
          : 5000;

    addToast({
      message: error.userMessage,
      type: toastType,
      ttl,
      action: recoveryActions?.[0]
        ? {
            label: recoveryActions[0].label,
            onClick: recoveryActions[0].action,
          }
        : undefined,
    });
  }

  private static reportCriticalError(error: AppError): void {
    // In a production app, this would send to error reporting service
    console.error("CRITICAL ERROR:", error);

    // Could integrate with services like Sentry, Bugsnag, etc.
    // For now, we'll just ensure it's logged locally
    try {
      localStorage.setItem(`critical_error_${error.id}`, JSON.stringify(error));
    } catch {
      // If localStorage fails, at least we have console log
    }
  }

  // Get error history for debugging
  static getErrorLog(): AppError[] {
    return [...this.errorLog];
  }

  // Clear error log
  static clearErrorLog(): void {
    this.errorLog = [];
  }

  // Check if error is retryable
  static isRetryable(error: AppError): boolean {
    return error.retryable && error.severity !== ErrorSeverity.CRITICAL;
  }

  // Get recovery suggestions
  static getRecoverySuggestions(error: AppError): string[] {
    const suggestions: string[] = [];

    switch (error.type) {
      case ErrorType.NETWORK:
        suggestions.push("Check your internet connection");
        suggestions.push("Try refreshing the page");
        if (error.retryable) suggestions.push("Retry the operation");
        break;

      case ErrorType.DATABASE:
        suggestions.push("Try restarting the application");
        suggestions.push("Check available disk space");
        break;

      case ErrorType.API:
        suggestions.push("Check your API settings");
        suggestions.push("Verify your API key is valid");
        if (error.message.includes("rate limit")) {
          suggestions.push("Wait a few minutes before trying again");
        }
        break;

      case ErrorType.PERMISSION:
        suggestions.push("Check file and folder permissions");
        suggestions.push("Try running as administrator if needed");
        break;

      default:
        suggestions.push("Try restarting the application");
        suggestions.push("Check the application logs for more details");
    }

    return suggestions;
  }
}

// Convenience functions for common error scenarios
export const handleNetworkError = (error: any, context?: string) =>
  ErrorHandler.handle(error, context, [
    { label: "Retry", action: () => window.location.reload() },
    {
      label: "Check Connection",
      action: () => window.open("https://google.com", "_blank"),
    },
  ]);

export const handleDatabaseError = (error: any, context?: string) =>
  ErrorHandler.handle(error, context, [
    { label: "Restart App", action: () => window.location.reload() },
  ]);

export const handleApiError = (error: any, context?: string) =>
  ErrorHandler.handle(error, context, [
    {
      label: "Check Settings",
      action: () => {
        // This would open settings - for now just log
        console.log("Opening settings to fix API error");
      },
    },
  ]);

// Async error wrapper
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  customMessage?: string,
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    ErrorHandler.handle(error, context, undefined, customMessage);
    return null;
  }
}

// React error boundary helper
export function createErrorBoundary(
  fallbackComponent: React.ComponentType<{ error: Error }>,
) {
  return class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error?: Error }
  > {
    constructor(props: { children: React.ReactNode }) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      ErrorHandler.handle(
        error,
        `React Error Boundary: ${errorInfo.componentStack}`,
      );
    }

    render() {
      if (this.state.hasError && this.state.error) {
        return React.createElement(fallbackComponent, {
          error: this.state.error,
        });
      }

      return this.props.children;
    }
  };
}
