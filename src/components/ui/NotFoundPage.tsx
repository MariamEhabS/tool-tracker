import { Link, NotFoundRouteProps } from "@tanstack/react-router";

/** Props for the NotFoundPage component -- a full-screen 404 page with a link back to the dashboard. */
interface NotFoundPageProps extends Partial<NotFoundRouteProps> {
  /** Heading text. Defaults to "Page Not Found". */
  title?: string;
  /** Explanatory message shown below the title. */
  description?: string;
}

const NotFoundPage = ({
  title = "Page Not Found",
  description = "The page you're looking for doesn't exist or has been moved.",
}: NotFoundPageProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="bx bx-error-circle text-4xl text-gray-500" />
        </div>
        <h1 className="text-6xl font-bold text-gray-800 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-3">{title}</h2>
        <p className="text-gray-500 mb-8">{description}</p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors"
        >
          <i className="bx bx-home text-lg" />
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
