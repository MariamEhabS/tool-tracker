import { Link } from "@tanstack/react-router";

/** Predefined error icon types, each with a distinct color and icon. */
type IconType = "not-found" | "access-denied" | "server-error" | "validation";

/** Props for the InlineError component. */
interface InlineErrorProps {
  /** Error heading text */
  title: string;
  /** Explanatory error message */
  message: string;
  /** Error category that determines the icon and color. Defaults to "not-found". */
  icon?: IconType;
  /** When provided, renders a "Try Again" button that calls this function */
  onRetry?: () => void;
  /** When provided, renders a go-back button that calls this function */
  onGoBack?: () => void;
  /** Label for the go-back button. Defaults to "Go Back". */
  goBackLabel?: string;
  /** Route path for link-based go-back navigation (uses TanStack Router Link; used when onGoBack is not provided) */
  goBackTo?: string;
  /** Whether to show a "Go to Dashboard" link. Defaults to true. */
  showDashboardLink?: boolean;
}

const iconConfig: Record<IconType, { bgColor: string; iconClass: string }> = {
  "not-found": {
    bgColor: "bg-purple-100",
    iconClass: "bx bx-error-circle text-4xl text-purple-500",
  },
  "access-denied": {
    bgColor: "bg-red-100",
    iconClass: "bx bx-lock text-4xl text-red-500",
  },
  "server-error": {
    bgColor: "bg-orange-100",
    iconClass: "bx bx-server text-4xl text-orange-500",
  },
  validation: {
    bgColor: "bg-yellow-100",
    iconClass: "bx bx-error text-4xl text-yellow-600",
  },
};

/**
 * Desktop-optimized inline error component for displaying errors without blocking navigation.
 * Used for API errors, not-found states, and other recoverable error states on desktop pages.
 *
 * @example
 * ```tsx
 * // Not Found error
 * <InlineError
 *   title="Group Not Found"
 *   message="The group you're looking for doesn't exist."
 *   icon="not-found"
 *   onGoBack={() => navigate({ to: "/groups" })}
 *   goBackLabel="Back to Groups"
 * />
 *
 * // Server error with retry
 * <InlineError
 *   title="Server Error"
 *   message="We're experiencing technical difficulties."
 *   icon="server-error"
 *   onRetry={() => refetch()}
 * />
 * ```
 */
export function InlineError({
  title,
  message,
  icon = "not-found",
  onRetry,
  onGoBack,
  goBackLabel = "Go Back",
  goBackTo,
  showDashboardLink = true,
}: InlineErrorProps) {
  const { bgColor, iconClass } = iconConfig[icon];

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div
          className={`w-20 h-20 ${bgColor} rounded-full flex items-center justify-center mx-auto mb-6`}
        >
          <i className={iconClass} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-3">{title}</h1>
        <p className="text-gray-600 mb-8">{message}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors"
            >
              <i className="bx bx-refresh text-lg" />
              Try Again
            </button>
          )}
          {onGoBack && (
            <button
              onClick={onGoBack}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors"
            >
              <i className="bx bx-arrow-back text-lg" />
              {goBackLabel}
            </button>
          )}
          {goBackTo && !onGoBack && (
            <Link
              to={goBackTo}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors"
            >
              <i className="bx bx-arrow-back text-lg" />
              {goBackLabel}
            </Link>
          )}
          {showDashboardLink && (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <i className="bx bx-home text-lg" />
              Go to Dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
