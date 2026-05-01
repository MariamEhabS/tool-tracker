import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { MouseEvent, ReactNode } from "react";

// Module-level counter for stacking modals with incrementing z-index
let modalStackCount = 0;

/** Available modal width sizes. */
type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl";

/**
 * Props for the Modal component -- a portal-rendered dialog with backdrop overlay,
 * focus trapping, escape-to-close, and enter/exit animations. Supports stacking
 * multiple modals with incrementing z-index.
 */
type ModalProps = {
  /** Whether the modal is open (controls mount/unmount with exit animation) */
  open: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Optional heading rendered in the modal header */
  title?: ReactNode;
  /** Optional secondary text below the title */
  subtitle?: ReactNode;
  /** Optional footer content rendered in a gray bar at the bottom (typically action buttons) */
  footer?: ReactNode;
  /** Max-width size of the modal dialog. Defaults to "lg". */
  size?: ModalSize;
  /** Whether to show the X close button in the header. Defaults to true. */
  closeButton?: boolean;
  /** Whether clicking the backdrop overlay closes the modal. Defaults to true. */
  overlayClosable?: boolean;
  className?: string;
  /** Right-aligned content in the header */
  headerRight?: ReactNode;
  /** Optional extra classes for the header row */
  headerClassName?: string;
  /** Optional extra classes for the close button */
  closeButtonClassName?: string;
  /** Body content */
  children?: ReactNode;
  /** When true, removes default body padding (px-6 py-5). Useful for full-bleed content. */
  withoutPadding?: boolean;
  /** Enable scrollable body with max-height constraint */
  scrollable?: boolean;
  /** Allow content to overflow the modal (e.g., for dropdowns) */
  allowOverflow?: boolean;
};

export default function Modal(props: ModalProps) {
  const {
    open,
    onClose,
    title,
    subtitle,
    footer,
    size = "lg",
    closeButton = true,
    overlayClosable = true,
    className = "",
    headerRight,
    headerClassName = "",
    closeButtonClassName = "",
    withoutPadding = false,
    scrollable = false,
    allowOverflow = false,
    children,
  } = props;

  // Keep mounted while animating out for a smooth exit
  const [shouldRender, setShouldRender] = useState<boolean>(open);
  const [entered, setEntered] = useState<boolean>(false);
  // Dynamic z-index for stacking multiple modals
  const [zIndex, setZIndex] = useState(9999);
  // Focus trap refs
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  // Ref for onClose to prevent unnecessary re-renders of handleKeyDown
  const onCloseRef = useRef(onClose);

  // Keep onCloseRef in sync with onClose prop
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Handle modal stacking z-index
  useEffect(() => {
    if (open) {
      modalStackCount++;
      setZIndex(9999 + modalStackCount);
      return () => {
        modalStackCount--;
      };
    }
  }, [open]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  useEffect(() => {
    let raf1: number | null = null;
    let raf2: number | null = null;
    let timeoutId: number | undefined;
    if (open) {
      setShouldRender(true);
      setEntered(false);
      // Double rAF ensures the initial styles paint before transitioning
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => setEntered(true));
      });
    } else {
      setEntered(false);
      // Unmount after animation duration
      timeoutId = window.setTimeout(() => setShouldRender(false), 200);
    }
    return () => {
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [open]);

  // Get portal container - use document.body for SSR safety
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );

  useEffect(() => {
    setPortalContainer(document.body);
  }, []);

  // Focus trap: get all focusable elements within modal
  const getFocusableElements = useCallback(() => {
    if (!modalRef.current) return [];
    const focusableSelectors = [
      "button:not([disabled])",
      "a[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(", ");
    return Array.from(
      modalRef.current.querySelectorAll<HTMLElement>(focusableSelectors),
    );
  }, []);

  // Focus trap: handle Tab key to trap focus within modal
  // Uses onCloseRef to avoid re-creating this callback when onClose prop changes
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && overlayClosable) {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [getFocusableElements, overlayClosable],
  );

  // Track if we've already done initial focus for this modal open
  const hasInitialFocusedRef = useRef(false);

  // Reset initial focus tracking when modal closes
  useEffect(() => {
    if (!open) {
      hasInitialFocusedRef.current = false;
    }
  }, [open]);

  // Focus management: focus first element only on initial open
  useEffect(() => {
    if (open && entered && !hasInitialFocusedRef.current) {
      // Store the previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Focus the first focusable element or the modal itself
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
      } else if (modalRef.current) {
        modalRef.current.focus();
      }

      hasInitialFocusedRef.current = true;
    }
  }, [open, entered, getFocusableElements]);

  // Keydown listener for focus trap (separate from focus management)
  useEffect(() => {
    if (open && entered) {
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [open, entered, handleKeyDown]);

  // Restore focus when modal closes
  useEffect(() => {
    if (!open && previousActiveElement.current) {
      // Use setTimeout to ensure focus restoration happens after modal unmounts
      const element = previousActiveElement.current;
      setTimeout(() => {
        if (element && typeof element.focus === "function") {
          element.focus();
        }
      }, 0);
      previousActiveElement.current = null;
    }
  }, [open]);

  if (!shouldRender || !portalContainer) return null;

  const sizeClass: Record<ModalSize, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl",
    "2xl": "max-w-5xl",
  };

  function onOverlayClick(e: MouseEvent<HTMLDivElement>) {
    if (!overlayClosable) return;
    if (e.target === e.currentTarget) onClose();
  }

  return createPortal(
    <div
      ref={modalRef}
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      tabIndex={-1}
      onClick={onOverlayClick}
    >
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ease-out ${entered ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`relative z-10 w-full ${sizeClass[size]} mx-4 ${className}`}
      >
        <div
          className={`bg-white rounded-lg shadow-xl ring-1 ring-black/5 ${allowOverflow ? "" : "overflow-hidden"} transform transition-all duration-200 ease-out ${entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          {title || subtitle || closeButton || headerRight ? (
            <div
              className={`flex items-center justify-between border-b border-gray-200 px-6 py-4 ${headerClassName}`}
            >
              <div className="min-w-0">
                {title ? (
                  <h3
                    id="modal-title"
                    className="text-lg font-semibold text-gray-900 truncate"
                  >
                    {title}
                  </h3>
                ) : null}
                {subtitle ? (
                  <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {headerRight}
                {closeButton ? (
                  <button
                    aria-label="Close"
                    className={`flex items-center text-gray-400 hover:text-gray-600 ${closeButtonClassName}`}
                    onClick={onClose}
                  >
                    <i className="bx bx-x text-2xl" />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          <div
            className={`${withoutPadding ? "p-0" : "px-6 py-5"} ${scrollable ? "overflow-y-auto max-h-[calc(100vh-16rem)]" : ""}`}
          >
            {children}
          </div>
          {footer ? (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    portalContainer,
  );
}
