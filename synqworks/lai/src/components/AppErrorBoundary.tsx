import React from "react";
import { ErrorHandler } from "../lib/utils/errorHandler";

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    ErrorHandler.handle(
      error,
      `React Error Boundary: ${errorInfo.componentStack}`,
      [
        {
          label: "Reload App",
          action: () => window.location.reload(),
        },
        {
          label: "Reset Component",
          action: () => this.setState({ hasError: false, error: undefined }),
        },
      ],
      "A component error occurred. You can try reloading or resetting the component.",
    );
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const Fallback = this.props.fallback;
        return (
          <Fallback
            error={this.state.error}
            reset={() => this.setState({ hasError: false, error: undefined })}
          />
        );
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          reset={() => this.setState({ hasError: false, error: undefined })}
        />
      );
    }

    return this.props.children;
  }
}

// Default error fallback component
function DefaultErrorFallback({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="min-h-[200px] flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center">
            <svg
              className="w-4 h-4 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
            Something went wrong
          </h3>
        </div>

        <p className="text-red-700 dark:text-red-300 mb-4">
          A component error occurred. You can try resetting the component or
          reloading the application.
        </p>

        <details className="mb-4">
          <summary className="text-sm text-red-600 dark:text-red-400 cursor-pointer hover:underline">
            Technical details
          </summary>
          <pre className="mt-2 text-xs text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/40 p-2 rounded overflow-auto max-h-32">
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        </details>

        <div className="flex gap-2">
          <button
            onClick={reset}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Reset Component
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Reload App
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for easier error boundary usage
export function useErrorHandler() {
  return (error: Error, context?: string) => {
    ErrorHandler.handle(error, context);
  };
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>,
) {
  const WrappedComponent = (props: P) => (
    <AppErrorBoundary fallback={fallback}>
      <Component {...props} />
    </AppErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}
