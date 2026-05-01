import React, { Component, type ReactNode } from "react";
import ErrorPage from "./ErrorPage";
import { logger } from "@/utils/logger";
import { getRollbarInstance, ErrorCategories } from "@/utils/rollbar";

/** Props for the root-level ErrorBoundary component. */
interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI rendered when an error is caught; when omitted, the default ErrorPage is shown */
  fallback?: ReactNode;
  /** Optional callback invoked with the error and component stack when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/** Internal state for the ErrorBoundary component. */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary component that catches JavaScript errors anywhere
 * in the child component tree, logs them, and displays a fallback UI.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 *
 * // With custom fallback:
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Gather browser context for debugging
    const userAgent = navigator?.userAgent || "unknown";
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // Get user info from localStorage if available
    const userStorage = localStorage.getItem("user");
    const user = userStorage ? JSON.parse(userStorage) : null;

    // Report to Rollbar (works in production)
    const rollbarInstance = getRollbarInstance();
    if (rollbarInstance) {
      rollbarInstance.error(error, {
        custom: {
          feature: ErrorCategories.RENDER,
          action: "component-crash",
          componentStack: errorInfo.componentStack?.slice(0, 1000), // Limit size
          url: window.location.href,
          pathname: window.location.pathname,
          userAgent,
          viewport,
          errorName: error.name,
          errorMessage: error.message,
        },
        person: user
          ? {
              id: user._id || user.userId,
              email: user.email,
            }
          : undefined,
      });
    }

    // Log error in development only
    logger.error("ErrorBoundary caught an error:", error);
    logger.error("Component stack:", errorInfo.componentStack);

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <ErrorPage
          title="Something went wrong"
          description="An unexpected error occurred. Please try again or return to the dashboard."
          reset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
