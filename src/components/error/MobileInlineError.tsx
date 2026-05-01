/** Props for the MobileInlineError component. */
interface MobileInlineErrorProps {
  /** Error heading text */
  title: string;
  /** Explanatory error message */
  message: string;
  /** When provided, renders a "Try Again" button that calls this function */
  onRetry?: () => void;
  /** Whether to show the Taliho logo above the error message. Defaults to true. */
  showLogo?: boolean;
}

/**
 * Mobile-optimized inline error component for displaying errors without blocking navigation.
 * Used for validation errors, API errors, and other recoverable error states on mobile pages.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <MobileInlineError
 *   title="QR Code Not Found"
 *   message="This QR code may have been deleted."
 * />
 *
 * // With retry button
 * <MobileInlineError
 *   title="Server Error"
 *   message="We're experiencing technical difficulties."
 *   onRetry={() => refetch()}
 * />
 * ```
 */
export function MobileInlineError({
  title,
  message,
  onRetry,
  showLogo = true,
}: MobileInlineErrorProps) {
  return (
    <div className="absolute flex flex-col items-center justify-center z-50 top-0 left-0 bg-white w-[100vw] h-[100vh] gap-y-6 p-6">
      {showLogo && (
        <img src="../../images/taliho-logo.png" width="50%" alt="Taliho" />
      )}
      <div className="text-center space-y-2">
        <p className="text-xl font-semibold text-gray-800">{title}</p>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold rounded-md shadow transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
