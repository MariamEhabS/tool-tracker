import { type ReactNode } from "react";

type InfoTooltipProps = {
  /** The tooltip content to display */
  content: ReactNode;
  /** Position of the tooltip relative to the icon */
  position?: "top" | "bottom" | "left" | "right";
  /** Additional CSS classes for the wrapper */
  className?: string;
  /** Icon class (defaults to bx-info-circle) */
  iconClass?: string;
};

/**
 * InfoTooltip - Displays an info icon with a styled tooltip on hover.
 * Uses CSS-only hover for immediate tooltip visibility without render delays.
 * Features a semi-transparent dark background for better UX.
 */
export default function InfoTooltip({
  content,
  position = "top",
  className = "",
  iconClass = "bx bx-info-circle",
}: InfoTooltipProps) {
  // Position classes for the tooltip
  const positionClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  // Arrow position classes (using semi-transparent dark color)
  const arrowClasses: Record<string, string> = {
    top: "top-full left-1/2 -translate-x-1/2 -mt-1 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900/90",
    bottom:
      "bottom-full left-1/2 -translate-x-1/2 -mb-1 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900/90",
    left: "left-full top-1/2 -translate-y-1/2 -ml-1 border-t-transparent border-b-transparent border-r-transparent border-l-gray-900/90",
    right:
      "right-full top-1/2 -translate-y-1/2 -mr-1 border-t-transparent border-b-transparent border-l-transparent border-r-gray-900/90",
  };

  return (
    <span
      className={`group relative inline-flex items-center cursor-help ${className}`}
      role="button"
      aria-label="More information"
      tabIndex={0}
      onClick={(e) => e.stopPropagation()}
    >
      <i
        className={`${iconClass} text-gray-400 group-hover:text-gray-600 text-base transition-colors`}
      />
      {/* Tooltip - hidden by default, shown on hover via group-hover */}
      <div
        role="tooltip"
        className={`
          absolute z-[100] w-max max-w-xs px-3 py-2
          text-sm text-white bg-gray-900/90 rounded-lg
          shadow-lg backdrop-blur-sm
          whitespace-normal pointer-events-none
          hidden group-hover:block group-focus:block
          ${positionClasses[position]}
        `}
      >
        {content}
        {/* Arrow */}
        <span
          className={`absolute w-0 h-0 border-[6px] ${arrowClasses[position]}`}
        />
      </div>
    </span>
  );
}
