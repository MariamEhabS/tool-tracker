import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";

const STORAGE_KEY = "settings-expanded-sections";
const LAST_VISIT_KEY = "settings-last-visit";
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

/**
 * Get the initial expanded state based on URL hash, inactivity timeout, and localStorage.
 * - If last visit was more than 12 hours ago, reset to all closed
 * - If there's a valid hash in the URL, only that section will be expanded
 * - Otherwise, falls back to localStorage (all closed if nothing stored)
 */
function getInitialExpandedState(): Record<string, boolean> {
  const now = Date.now();
  const validSectionIds = [
    "user-settings",
    "security",
    "subscription",
    "company",
    "users",
    "qr-design",
    "categories",
    "integrations",
    "storage",
    "activity",
    "notifications",
  ];

  // Check for 12-hour inactivity - if exceeded, reset to all closed
  let shouldResetDueToInactivity = false;
  try {
    const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
    if (!lastVisit || now - parseInt(lastVisit, 10) > TWELVE_HOURS_MS) {
      shouldResetDueToInactivity = true;
      // Clear stored accordion state since we're resetting
      localStorage.removeItem(STORAGE_KEY);
    }
    // Update last visit timestamp
    localStorage.setItem(LAST_VISIT_KEY, String(now));
  } catch {
    // localStorage not available
  }

  // Check if there's a hash in the URL that should override defaults
  const hash =
    typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";

  // If there's a valid hash, start with only that section expanded
  // This takes precedence even after inactivity timeout
  if (hash && validSectionIds.includes(hash)) {
    return { [hash]: true };
  }

  // If we reset due to inactivity, return all collapsed
  if (shouldResetDueToInactivity) {
    return {};
  }

  // No hash and no inactivity reset - use localStorage
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed;
    }
  } catch {
    // localStorage not available or parse error
  }

  // Default: all sections collapsed
  return {};
}

// Height of the fixed navigation header (adjust if needed)
const HEADER_OFFSET = 80;

// Animation duration for accordion expand (matches SettingsSection.tsx)
const ACCORDION_ANIMATION_MS = 250;
// Buffer after animation before scrolling (kept minimal for snappy feel)
const SCROLL_BUFFER_MS = 50;

// Maximum scroll retry attempts
const MAX_SCROLL_RETRIES = 3;
// Delay between scroll retries
const SCROLL_RETRY_DELAY_MS = 100;

interface SettingsSectionContextValue {
  /** Check if a section is expanded */
  isExpanded: (sectionId: string) => boolean;
  /** Toggle a section's expanded state */
  toggle: (sectionId: string) => void;
  /** Set a section's expanded state directly */
  setExpandedState: (sectionId: string, state: boolean) => void;
  /** Register a section's DOM element for scroll targeting */
  registerSectionRef: (
    sectionId: string,
    element: HTMLDivElement | null,
  ) => void;
  /** Expand a section and scroll to it with header offset */
  expandAndScrollTo: (sectionId: string) => void;
}

const SettingsSectionContext =
  createContext<SettingsSectionContextValue | null>(null);

// Check if user prefers reduced motion
const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function SettingsSectionProvider({ children }: { children: ReactNode }) {
  const localStorageAvailable = useRef(true);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Track section waiting for ref registration (initial page load scenario)
  const pendingRegistrationRef = useRef<string | null>(null);
  // Track section waiting for accordion animation to complete
  const pendingAnimationRef = useRef<string | null>(null);
  // Track timeout ID for animation scroll to allow cancellation
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Track the current scroll target to prevent stale retries from interfering
  const currentScrollTargetRef = useRef<string | null>(null);
  // Track retry timeout IDs to allow cancellation
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >(getInitialExpandedState);

  // Persist to localStorage whenever state changes
  useEffect(() => {
    if (!localStorageAvailable.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedSections));
    } catch {
      localStorageAvailable.current = false;
    }
  }, [expandedSections]);

  const isExpanded = useCallback(
    (sectionId: string): boolean => {
      return expandedSections[sectionId] ?? false;
    },
    [expandedSections],
  );

  const setExpandedState = useCallback(
    (sectionId: string, state: boolean): void => {
      setExpandedSections((prev) => ({
        ...prev,
        [sectionId]: state,
      }));
    },
    [],
  );

  const registerSectionRef = useCallback(
    (sectionId: string, element: HTMLDivElement | null) => {
      if (element) {
        sectionRefs.current.set(sectionId, element);
      } else {
        sectionRefs.current.delete(sectionId);
      }
    },
    [],
  );

  /**
   * Check if an element is reasonably visible in the viewport (within header offset tolerance).
   */
  const isElementInView = useCallback((element: HTMLElement): boolean => {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    // Consider element "in view" if its top is within a reasonable range of the header offset
    // Allow some tolerance (within 150px of ideal position)
    return (
      rect.top >= HEADER_OFFSET - 50 &&
      rect.top <= HEADER_OFFSET + 150 &&
      rect.top < viewportHeight
    );
  }, []);

  /**
   * Cancels all pending scroll operations.
   * Call this before starting a new scroll to prevent conflicts.
   */
  const cancelPendingScrolls = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  }, []);

  /**
   * Scrolls to a section with proper header offset.
   * Uses scrollIntoView for reliability, with retry logic to handle animation timing.
   */
  const scrollToSection = useCallback(
    (sectionId: string, retryCount = 0) => {
      const element = sectionRefs.current.get(sectionId);
      if (!element) return;

      // On first call (not a retry), set this as the current target and cancel old operations
      if (retryCount === 0) {
        cancelPendingScrolls();
        currentScrollTargetRef.current = sectionId;
      }

      // Check if this scroll operation is still valid (not superseded by a newer scroll)
      if (currentScrollTargetRef.current !== sectionId) {
        return; // Another scroll was initiated, abort this one
      }

      // Use requestAnimationFrame to ensure layout is complete
      requestAnimationFrame(() => {
        // Double-check target is still valid after RAF
        if (currentScrollTargetRef.current !== sectionId) {
          return;
        }

        requestAnimationFrame(() => {
          // Triple-check target is still valid
          if (currentScrollTargetRef.current !== sectionId) {
            return;
          }

          // Use scrollIntoView which respects scroll-margin-top CSS property
          element.scrollIntoView({
            behavior: prefersReducedMotion ? "auto" : "smooth",
            block: "start",
          });

          // For smooth scroll, verify position after animation completes
          // Smooth scroll typically takes ~300-500ms
          if (!prefersReducedMotion && retryCount < MAX_SCROLL_RETRIES) {
            retryTimeoutRef.current = setTimeout(
              () => {
                // Verify target hasn't changed before retrying
                if (currentScrollTargetRef.current !== sectionId) {
                  return;
                }
                // Check if element is in the expected position
                if (!isElementInView(element)) {
                  // Retry scroll if element is not properly positioned
                  scrollToSection(sectionId, retryCount + 1);
                } else {
                  // Scroll successful, clear the target
                  currentScrollTargetRef.current = null;
                }
              },
              SCROLL_RETRY_DELAY_MS + retryCount * 50,
            ); // Increasing delay for each retry
          } else {
            // No more retries or reduced motion, clear target after a short delay
            retryTimeoutRef.current = setTimeout(() => {
              if (currentScrollTargetRef.current === sectionId) {
                currentScrollTargetRef.current = null;
              }
            }, 100);
          }
        });
      });
    },
    [isElementInView, cancelPendingScrolls],
  );

  /**
   * Toggle section expanded state with scroll on expand.
   */
  const toggle = useCallback(
    (sectionId: string): void => {
      setExpandedSections((prev) => {
        const isCurrentlyExpanded = prev[sectionId] ?? false;
        const willExpand = !isCurrentlyExpanded;

        // When expanding, scroll to the section after animation completes
        if (willExpand) {
          // Cancel ALL pending scroll operations to prevent conflicts
          cancelPendingScrolls();
          currentScrollTargetRef.current = sectionId;
          pendingAnimationRef.current = sectionId;

          animationTimeoutRef.current = setTimeout(() => {
            // Verify this is still the intended target
            if (
              pendingAnimationRef.current === sectionId &&
              currentScrollTargetRef.current === sectionId
            ) {
              requestAnimationFrame(() => {
                scrollToSection(sectionId);
                pendingAnimationRef.current = null;
              });
            }
            animationTimeoutRef.current = null;
          }, ACCORDION_ANIMATION_MS + SCROLL_BUFFER_MS);
        } else {
          // When collapsing, cancel any pending scroll to this section
          if (currentScrollTargetRef.current === sectionId) {
            cancelPendingScrolls();
            currentScrollTargetRef.current = null;
          }
        }

        return {
          ...prev,
          [sectionId]: willExpand,
        };
      });
    },
    [scrollToSection, cancelPendingScrolls],
  );

  /**
   * Expands a section (if collapsed) and scrolls to it.
   * Handles timing to ensure accordion is fully expanded before scrolling.
   */
  const expandAndScrollTo = useCallback(
    (sectionId: string) => {
      // Cancel ALL pending scroll operations to prevent conflicts
      cancelPendingScrolls();
      currentScrollTargetRef.current = sectionId;
      pendingAnimationRef.current = null;

      const element = sectionRefs.current.get(sectionId);
      if (!element) {
        // Section not registered yet, store for later
        pendingRegistrationRef.current = sectionId;
        return;
      }

      // Clear registration pending since element exists
      pendingRegistrationRef.current = null;

      // Check current state directly from the state setter to avoid stale closure
      setExpandedSections((currentState) => {
        const isCurrentlyExpanded = currentState[sectionId] ?? false;

        if (isCurrentlyExpanded) {
          // Already expanded, scroll immediately
          scrollToSection(sectionId);
          return currentState; // No state change needed
        }

        // Need to expand first, then scroll after animation completes
        pendingAnimationRef.current = sectionId;

        // Schedule scroll after accordion animation completes
        // Minimal buffer to keep interaction snappy while ensuring DOM stability
        animationTimeoutRef.current = setTimeout(() => {
          // Verify this is still the intended target
          if (
            pendingAnimationRef.current === sectionId &&
            currentScrollTargetRef.current === sectionId
          ) {
            // Use RAF to ensure we're in a stable rendering state
            requestAnimationFrame(() => {
              scrollToSection(sectionId);
              pendingAnimationRef.current = null;
            });
          }
          animationTimeoutRef.current = null;
        }, ACCORDION_ANIMATION_MS + SCROLL_BUFFER_MS);

        // Return updated state with section expanded
        return {
          ...currentState,
          [sectionId]: true,
        };
      });
    },
    [scrollToSection, cancelPendingScrolls],
  );

  // Handle pending scroll when sections register (for initial page load with hash)
  const registerSectionRefWithPendingCheck = useCallback(
    (sectionId: string, element: HTMLDivElement | null) => {
      registerSectionRef(sectionId, element);

      // If this is the section we're waiting to scroll to, trigger scroll
      if (element && pendingRegistrationRef.current === sectionId) {
        // Clear the pending registration before triggering scroll
        pendingRegistrationRef.current = null;
        // Small delay to ensure component is fully mounted
        setTimeout(() => {
          expandAndScrollTo(sectionId);
        }, 50);
      }
    },
    [registerSectionRef, expandAndScrollTo],
  );

  const value: SettingsSectionContextValue = {
    isExpanded,
    toggle,
    setExpandedState,
    registerSectionRef: registerSectionRefWithPendingCheck,
    expandAndScrollTo,
  };

  return (
    <SettingsSectionContext.Provider value={value}>
      {children}
    </SettingsSectionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettingsSections(): SettingsSectionContextValue {
  const context = useContext(SettingsSectionContext);
  if (!context) {
    throw new Error(
      "useSettingsSections must be used within a SettingsSectionProvider",
    );
  }
  return context;
}

export default SettingsSectionContext;
