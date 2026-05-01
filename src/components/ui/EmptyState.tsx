import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

/** Props for the EmptyState component -- a centered placeholder shown when a list or section has no content. */
interface EmptyStateProps {
  /** Icon element displayed in the circular background */
  icon: ReactNode;
  /** Primary heading text */
  title: string;
  /** Optional supporting description below the title */
  description?: string;
  /** Label for the optional call-to-action button */
  actionLabel?: string;
  /** Route path for the CTA when using link-based navigation (uses TanStack Router Link) */
  actionTo?: string;
  /** Click handler for the CTA when using button-based interaction (takes precedence over actionTo) */
  onActionClick?: () => void;
  /** Tailwind background class for the icon container. Defaults to "bg-gray-100". */
  iconBgClass?: string;
  /** When true, reduces vertical padding and icon/text sizing for tighter layouts. Defaults to false. */
  compact?: boolean;
  className?: string;
}

const EmptyState = ({
  icon,
  title,
  description,
  actionLabel,
  actionTo,
  onActionClick,
  iconBgClass = "bg-gray-100",
  compact = false,
  className,
}: EmptyStateProps) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? "py-6" : "py-12"} ${className ?? ""}`}
    >
      <div
        className={`${iconBgClass} ${compact ? "w-12 h-12" : "w-16 h-16"} rounded-full flex items-center justify-center mb-4`}
      >
        {icon}
      </div>
      <h4
        className={`${compact ? "text-sm" : "text-base"} font-medium text-gray-900 mb-1`}
      >
        {title}
      </h4>
      {description && (
        <p
          className={`${compact ? "text-xs" : "text-sm"} text-gray-500 max-w-xs`}
        >
          {description}
        </p>
      )}
      {actionLabel &&
        (onActionClick ? (
          <button
            onClick={onActionClick}
            className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors"
          >
            {actionLabel}
          </button>
        ) : actionTo ? (
          <Link
            to={actionTo}
            className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors"
          >
            {actionLabel}
          </Link>
        ) : null)}
    </div>
  );
};

export default EmptyState;
