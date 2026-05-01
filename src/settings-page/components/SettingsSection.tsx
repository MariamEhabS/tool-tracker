import { ReactNode, useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettingsSections } from "../context/SettingsSectionContext";
import Button from "@/components/ui/Button";

/** Accent color variants for section icons */
export type AccentColor =
  | "indigo"
  | "amber"
  | "emerald"
  | "rose"
  | "cyan"
  | "violet"
  | "orange"
  | "teal"
  | "blue";

/** Mapping of accent colors to Tailwind classes */
const accentColorClasses: Record<
  AccentColor,
  { bg: string; bgHover: string; text: string }
> = {
  indigo: {
    bg: "bg-indigo-100",
    bgHover: "bg-indigo-200",
    text: "text-indigo-600",
  },
  amber: {
    bg: "bg-amber-100",
    bgHover: "bg-amber-200",
    text: "text-amber-600",
  },
  emerald: {
    bg: "bg-emerald-100",
    bgHover: "bg-emerald-200",
    text: "text-emerald-600",
  },
  rose: {
    bg: "bg-rose-100",
    bgHover: "bg-rose-200",
    text: "text-rose-600",
  },
  cyan: {
    bg: "bg-cyan-100",
    bgHover: "bg-cyan-200",
    text: "text-cyan-600",
  },
  violet: {
    bg: "bg-violet-100",
    bgHover: "bg-violet-200",
    text: "text-violet-600",
  },
  orange: {
    bg: "bg-orange-100",
    bgHover: "bg-orange-200",
    text: "text-orange-600",
  },
  teal: {
    bg: "bg-teal-100",
    bgHover: "bg-teal-200",
    text: "text-teal-600",
  },
  blue: {
    bg: "bg-blue-100",
    bgHover: "bg-blue-200",
    text: "text-blue-600",
  },
};

export interface SettingsSectionProps {
  /** Unique identifier for localStorage persistence */
  id: string;
  /** Section title displayed in the header */
  title: string;
  /** Subtitle/description displayed below the title */
  subtitle: string;
  /** Icon displayed in the header (ReactNode, typically an <i> element) */
  icon: ReactNode;
  /** Whether the section is expanded by default (only applies on first render) */
  defaultExpanded?: boolean;
  /** Content to render when the section is expanded */
  children: ReactNode;
  /** Whether this section is locked (requires upgrade) */
  isLocked?: boolean;
  /** Message to display when locked */
  lockedMessage?: string;
  /** Required tier name for the locked feature */
  requiredTier?: string;
  /** Callback when upgrade button is clicked */
  onUpgrade?: () => void;
  /** Accent color for the icon container */
  accentColor?: AccentColor;
}

// Check if user prefers reduced motion
const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function SettingsSection({
  id,
  title,
  subtitle,
  icon,
  defaultExpanded = false,
  children,
  isLocked = false,
  lockedMessage,
  requiredTier,
  onUpgrade,
  accentColor = "blue",
}: SettingsSectionProps) {
  const { isExpanded, toggle, setExpandedState, registerSectionRef } =
    useSettingsSections();
  const expanded = isExpanded(id);
  const sectionRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  const [isHovered, setIsHovered] = useState(false);

  // Get accent color classes
  const colorClasses = accentColorClasses[accentColor];

  // Register this section's ref for scroll targeting
  useEffect(() => {
    registerSectionRef(id, sectionRef.current);
    return () => registerSectionRef(id, null);
  }, [id, registerSectionRef]);

  // Set default expanded state on mount if not already set
  // Skip if there's a URL hash (hash navigation takes precedence)
  useEffect(() => {
    const hasUrlHash = window.location.hash && window.location.hash.length > 1;
    if (
      !hasInitialized.current &&
      defaultExpanded &&
      !isExpanded(id) &&
      !hasUrlHash
    ) {
      setExpandedState(id, true);
      hasInitialized.current = true;
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = () => {
    if (!isLocked) {
      toggle(id);
    }
  };

  const animationDuration = prefersReducedMotion ? 0 : 0.25;

  return (
    <div
      className={`bg-white rounded-xl border border-gray-100 overflow-hidden scroll-mt-20 transition-all duration-200 ${
        isHovered && !isLocked
          ? "shadow-lg shadow-gray-200/50 -translate-y-0.5"
          : "shadow-sm"
      }`}
      ref={sectionRef}
      id={`settings-section-${id}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <button
        type="button"
        className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50/50 hover:cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls={`settings-section-content-${id}`}
        disabled={isLocked}
      >
        <div className="flex items-center gap-4">
          {/* Icon container with accent color */}
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${
              isHovered && !isLocked
                ? `${colorClasses.bgHover} ${colorClasses.text}`
                : `${colorClasses.bg} ${colorClasses.text}`
            }`}
          >
            {icon}
          </div>
          {/* Title and subtitle */}
          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              {title}
              {isLocked && (
                <i
                  className="bx bx-lock-alt text-gray-400 text-lg"
                  aria-hidden="true"
                />
              )}
            </h3>
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          </div>
        </div>
        {/* Chevron with smooth rotation */}
        {!isLocked && (
          <motion.div
            initial={false}
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: animationDuration, ease: "easeInOut" }}
            className="flex-shrink-0 ml-4"
          >
            <i
              className={`bx bxs-chevron-down text-xl transition-colors duration-150 ${
                isHovered ? "text-gray-600" : "text-gray-400"
              }`}
              aria-hidden="true"
            />
          </motion.div>
        )}
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {expanded && !isLocked && (
          <motion.div
            id={`settings-section-content-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: animationDuration, ease: "easeInOut" },
              opacity: { duration: animationDuration * 0.8, ease: "easeInOut" },
            }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100">
              <div className="px-6 py-5">{children}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Locked overlay */}
      {isLocked && (
        <div className="border-t border-gray-200">
          <div className="px-6 py-4 relative">
            {/* Blur overlay */}
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6">
              <div className="text-center max-w-sm">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <i
                    className="bx bx-lock-alt text-gray-400 text-2xl"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {lockedMessage ||
                    `This feature requires a ${requiredTier || "higher"} plan.`}
                </p>
                {onUpgrade && (
                  <Button
                    variant="primary"
                    onClick={onUpgrade}
                    leftIconClass="bx bx-rocket"
                  >
                    Upgrade to {requiredTier || "Unlock"}
                  </Button>
                )}
              </div>
            </div>
            {/* Blurred placeholder content */}
            <div
              className="blur-sm pointer-events-none select-none"
              aria-hidden="true"
            >
              <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsSection;
