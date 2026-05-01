import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

type PortalTooltipProps = {
  /** The content to display inside the tooltip */
  content: ReactNode;
  /** The children that trigger the tooltip on hover */
  children: ReactNode;
  /** Position preference (tooltip will flip if needed) */
  position?: "top" | "bottom";
  /** Additional class names for the wrapper */
  className?: string;
  /** Max width of the tooltip */
  maxWidth?: number;
};

/**
 * PortalTooltip - Renders a tooltip in a portal to avoid overflow clipping issues.
 * Use this when tooltips need to appear outside of containers with overflow:hidden/auto.
 */
export default function PortalTooltip({
  content,
  children,
  position = "top",
  className = "",
  maxWidth = 200,
}: PortalTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [actualPosition, setActualPosition] = useState(position);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Calculate tooltip position when it becomes visible
  useEffect(() => {
    if (!isVisible || !triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipHeight = tooltipRef.current?.offsetHeight ?? 32;
      const tooltipWidth = tooltipRef.current?.offsetWidth ?? maxWidth;
      const padding = 8;

      // Calculate horizontal center
      let left = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;

      // Clamp to viewport
      if (left < padding) left = padding;
      if (left + tooltipWidth > window.innerWidth - padding) {
        left = window.innerWidth - tooltipWidth - padding;
      }

      // Determine vertical position
      let top: number;
      let finalPosition = position;

      if (position === "top") {
        top = triggerRect.top - tooltipHeight - padding;
        // Flip to bottom if not enough space above
        if (top < padding) {
          top = triggerRect.bottom + padding;
          finalPosition = "bottom";
        }
      } else {
        top = triggerRect.bottom + padding;
        // Flip to top if not enough space below
        if (top + tooltipHeight > window.innerHeight - padding) {
          top = triggerRect.top - tooltipHeight - padding;
          finalPosition = "top";
        }
      }

      setCoords({ top, left });
      setActualPosition(finalPosition);
    };

    updatePosition();

    // Update position on scroll/resize
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isVisible, position, maxWidth]);

  return (
    <>
      <div
        ref={triggerRef}
        className={className}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            className={`fixed z-[10000] px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg pointer-events-none transition-opacity duration-150 ${
              isVisible ? "opacity-100" : "opacity-0"
            }`}
            style={{
              top: coords.top,
              left: coords.left,
              maxWidth,
            }}
          >
            <span className="block truncate">{content}</span>
            {/* Arrow indicator */}
            <span
              className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-4 border-transparent ${
                actualPosition === "top"
                  ? "top-full border-t-gray-900"
                  : "bottom-full border-b-gray-900"
              }`}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
