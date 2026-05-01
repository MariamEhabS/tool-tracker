import React, { Component, type ReactNode } from "react";
import { getRollbarInstance, ErrorCategories } from "@/utils/rollbar";

/** Props for the FeatureErrorBoundary component. */
interface FeatureErrorBoundaryProps {
  children: ReactNode;
  /** Identifier for the feature section being wrapped (e.g., "dashboard", "settings"); used in Rollbar error reports */
  featureName: string;
  /** Custom fallback UI rendered when an error is caught; when omitted, a simple retry UI is shown */
  fallback?: ReactNode;
}

/** Internal state for the FeatureErrorBoundary component. */
interface FeatureErrorBoundaryState {
  hasError: boolean;
}

/**
 * Feature-level Error Boundary component that catches JavaScript errors
 * within a specific feature section, logs them to Rollbar, and displays
 * a fallback UI without crashing the entire application.
 *
 * Unlike the root ErrorBoundary, this component is designed for wrapping
 * individual feature sections (Dashboard, Settings, etc.) to isolate failures.
 *
 * Usage:
 * ```tsx
 * <FeatureErrorBoundary featureName="dashboard">
 *   <DashboardContent />
 * </FeatureErrorBoundary>
 *
 * // With custom fallback:
 * <FeatureErrorBoundary featureName="settings" fallback={<SettingsErrorUI />}>
 *   <SettingsContent />
 * </FeatureErrorBoundary>
 * ```
 */
class FeatureErrorBoundary extends Component<
  FeatureErrorBoundaryProps,
  FeatureErrorBoundaryState
> {
  constructor(props: FeatureErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): FeatureErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Gather context for debugging
    const userAgent = navigator?.userAgent || "unknown";
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // Get user info from localStorage if available
    const userStorage = localStorage.getItem("user");
    const user = userStorage ? JSON.parse(userStorage) : null;

    const rollbarInstance = getRollbarInstance();
    if (rollbarInstance) {
      rollbarInstance.error(error, {
        custom: {
          feature: ErrorCategories.RENDER,
          action: `${this.props.featureName}-crash`,
          featureName: this.props.featureName,
          componentStack: errorInfo.componentStack?.slice(0, 1000),
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
  }

  handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-6 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-600 mb-4">
            This section encountered an error. Please try again.
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default FeatureErrorBoundary;
