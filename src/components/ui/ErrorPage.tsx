import { Link, ErrorComponentProps } from "@tanstack/react-router";

/** Props for the ErrorPage component -- a full-screen error display with retry and dashboard navigation. */
interface ErrorPageProps extends Partial<ErrorComponentProps> {
  /** Error heading text. Defaults to "Something went wrong". */
  title?: string;
  /** Explanatory message shown below the title. */
  description?: string;
}

const ErrorPage = ({
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again or return to the dashboard.",
  reset,
}: ErrorPageProps) => {
  const handleRetry = () => {
    if (reset) {
      reset();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="bx bx-error text-4xl text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-3">{title}</h1>
        <p className="text-gray-500 mb-8">{description}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors"
          >
            <i className="bx bx-refresh text-lg" />
            Try Again
          </button>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <i className="bx bx-home text-lg" />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;
