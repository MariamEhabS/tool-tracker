import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import {
  useCombobox,
  getScrollableAncestor,
} from "@/components/combobox/Combobox";

type InfoComboBoxProps = {
  title?: string;
  items?: string[];
  /** Optional rich content shown under items (e.g., CTA button, extra note) */
  content?: React.ReactNode;
  /** Override the trigger icon class (defaults to info icon) */
  iconClassName?: string;
  /** Align dropdown relative to trigger */
  align?: "left" | "right";
  /** Optional id for a11y/testing */
  id?: string;
  /** Optional container className */
  className?: string;
  /** Optional menu width class (e.g., w-80) */
  menuWidthClassName?: string;
  /** Optional z-index utility class for panel */
  menuZIndexClassName?: string;
  /** Trigger mode: "hover" opens on mouse enter, "click" requires click. Default: "hover" */
  triggerMode?: "hover" | "click";
  /** Delay in ms before closing on mouse leave (only for hover mode). Default: 150 */
  hoverCloseDelay?: number;
  /** Visual variant for different use cases */
  variant?: "default" | "status";
  /** Status type when variant is "status" */
  statusType?: "success" | "warning" | "error";
  /** Custom trigger content (replaces default icon button) */
  trigger?: React.ReactNode;
};

type StatusStyleConfig = {
  headerBg: string;
  headerBorder: string;
  iconColor: string;
  titleColor: string;
  dotColor: string;
};

export default function InfoComboBox(props: InfoComboBoxProps) {
  const {
    title = "Info",
    items = [],
    content,
    iconClassName = "bx bx-info-circle",
    align = "left",
    id,
    className = "",
    menuWidthClassName = "w-80",
    menuZIndexClassName = "z-40",
    triggerMode = "hover",
    hoverCloseDelay = 150,
    variant = "default",
    statusType,
    trigger,
  } = props;

  // Status variant styling
  const getStatusStyles = (): StatusStyleConfig => {
    if (variant !== "status" || !statusType) {
      return {
        headerBg: "",
        headerBorder: "",
        iconColor: "",
        titleColor: "",
        dotColor: "",
      };
    }
    const styles: Record<"success" | "warning" | "error", StatusStyleConfig> = {
      success: {
        headerBg: "bg-gradient-to-r from-green-50 to-emerald-50",
        headerBorder: "border-green-100",
        iconColor: "text-green-600",
        titleColor: "text-green-800",
        dotColor: "bg-green-500",
      },
      warning: {
        headerBg: "bg-gradient-to-r from-amber-50 to-yellow-50",
        headerBorder: "border-amber-100",
        iconColor: "text-amber-600",
        titleColor: "text-amber-800",
        dotColor: "bg-amber-500",
      },
      error: {
        headerBg: "bg-gradient-to-r from-red-50 to-rose-50",
        headerBorder: "border-red-100",
        iconColor: "text-red-600",
        titleColor: "text-red-800",
        dotColor: "bg-red-500",
      },
    };
    return styles[statusType];
  };

  const statusStyles = getStatusStyles();

  const {
    open,
    setOpen,
    shouldRender,
    entered,
    setRootNode,
    setListNode,
    rootNode,
  } = useCombobox({
    sourceId: "info-combobox",
    closeOnOutsideClick: triggerMode === "click",
  });
  const [dropUp, setDropUp] = useState<boolean>(false);
  const closeTimeoutRef = useRef<number | null>(null);

  const hasList = useMemo(
    () => (items && items.length > 0) || !!content,
    [items, content],
  );

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (triggerMode !== "hover") return;
    clearCloseTimeout();
    setOpen(true);
  }, [triggerMode, clearCloseTimeout, setOpen]);

  const handleMouseLeave = useCallback(() => {
    if (triggerMode !== "hover") return;
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
    }, hoverCloseDelay);
  }, [triggerMode, clearCloseTimeout, setOpen, hoverCloseDelay]);

  useEffect(() => {
    return () => clearCloseTimeout();
  }, [clearCloseTimeout]);

  useEffect(() => {
    if (!open) return;
    const trigger = rootNode;
    if (!trigger) return;
    const scrollParent = getScrollableAncestor(trigger);
    const triggerRect = trigger.getBoundingClientRect();
    const containerBottom = scrollParent
      ? scrollParent.getBoundingClientRect().bottom
      : window.innerHeight;
    // Estimate panel height: header + list items (~28px each) + padding, capped
    const estimated = Math.min(items.length * 28 + 100, 320);
    const spaceBelow = containerBottom - triggerRect.bottom;
    setDropUp(spaceBelow < estimated);
  }, [open, rootNode, items.length]);

  return (
    <div
      ref={setRootNode}
      className={`relative inline-block text-left shrink-0 ${className}`}
      id={id}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {trigger ? (
        <div
          onClick={() => triggerMode === "click" && setOpen((o) => !o)}
          className="cursor-pointer"
        >
          {trigger}
        </div>
      ) : (
        <Button
          type="button"
          aria-label={title}
          variant="iconGhost"
          onClick={() => triggerMode === "click" && setOpen((o) => !o)}
          leftIconClass={iconClassName}
          className="!p-0"
        />
      )}
      {shouldRender && hasList ? (
        <div
          className={`absolute ${align === "right" ? "right-0" : "left-0"} ${menuZIndexClassName} ${menuWidthClassName} rounded-xl bg-white shadow-xl ring-1 ring-black/5 focus:outline-none transition-all duration-200 ease-out transform overflow-hidden ${dropUp ? (entered ? "opacity-100 -translate-y-0" : "opacity-0 translate-y-1") : entered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"} ${dropUp ? "origin-bottom-right mb-2" : "origin-top-left mt-2"}`}
          style={dropUp ? { bottom: "100%" } : undefined}
        >
          <div ref={setListNode}>
            {variant === "status" && statusType ? (
              <>
                {/* Status header with gradient background */}
                <div
                  className={`px-4 py-3 ${statusStyles.headerBg} border-b ${statusStyles.headerBorder}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${statusStyles.dotColor} ring-4 ring-opacity-20 ${statusType === "success" ? "ring-green-500" : statusType === "warning" ? "ring-amber-500" : "ring-red-500"}`}
                    />
                    <h4
                      className={`text-sm font-semibold ${statusStyles.titleColor}`}
                    >
                      {title}
                    </h4>
                  </div>
                </div>
                {/* Content area */}
                <div className="p-4">
                  {items && items.length > 0 ? (
                    <ul className="space-y-2">
                      {items.map((it, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-sm text-gray-600"
                        >
                          <i
                            className={`bx ${statusType === "success" ? "bx-check" : statusType === "warning" ? "bx-info-circle" : "bx-x"} ${statusStyles.iconColor} mt-1 flex-shrink-0`}
                          />
                          <span>{it}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {content ? (
                    <div
                      className={`${items.length ? "mt-4 pt-3 border-t border-gray-100" : ""}`}
                    >
                      {content}
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="p-3">
                {title ? (
                  <div className="flex items-center gap-2 mb-2">
                    <i className={`${iconClassName} text-gray-600`}></i>
                    <h4 className="text-sm font-medium text-gray-900">
                      {title}
                    </h4>
                  </div>
                ) : null}

                {items && items.length > 0 ? (
                  <ul className="list-disc pl-5 text-[11px] text-gray-700 space-y-1">
                    {items.map((it, idx) => (
                      <li key={idx}>{it}</li>
                    ))}
                  </ul>
                ) : null}

                {content ? (
                  <div
                    className={`${items.length ? "mt-3" : ""} text-sm text-gray-700`}
                  >
                    {content}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
