import { useCallback, useEffect, useState } from "react";

/**
 * Options for the useCombobox hook -- a shared behavior hook that manages open/close state,
 * animation lifecycle, keyboard navigation index, and drop-up/drop-down placement for
 * all combobox-style components (FilterComboBox, SearchComboBox, ItemComboBox, InfoComboBox).
 */
export type UseComboboxOptions = {
  /** Identifier used to avoid closing when this same instance announces open */
  sourceId?: string;
  /** Whether to close the combobox when clicking outside. Default: true */
  closeOnOutsideClick?: boolean;
  /** Maximum menu height used to infer whether to drop up or down. Default: 280 */
  maxMenuHeightPx?: number;
  /** Optional estimator for the panel height, used for more accurate drop-up decisions */
  estimatePanelHeight?: () => number;
};

export function getScrollableAncestor(
  node: HTMLElement | null,
): HTMLElement | null {
  let current: HTMLElement | null = node?.parentElement ?? null;
  while (current) {
    try {
      const style = window.getComputedStyle(current);
      const oy = style.overflowY;
      if (oy === "auto" || oy === "scroll") return current;
    } catch {
      // ignore
    }
    current = current.parentElement;
  }
  return null;
}

export function useCombobox(options: UseComboboxOptions = {}) {
  const {
    sourceId,
    closeOnOutsideClick = true,
    maxMenuHeightPx = 280,
    estimatePanelHeight,
  } = options;

  const [open, setOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState<boolean>(false);
  const [entered, setEntered] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [dropUp, setDropUp] = useState<boolean>(false);

  const [rootNode, setRootNode] = useState<HTMLDivElement | null>(null);
  const [listNode, setListNode] = useState<HTMLElement | null>(null);

  // Close on outside click (also treat clicks inside the list panel as inside, to support portaled menus)
  useEffect(() => {
    if (!closeOnOutsideClick) return;
    function onDocClick(e: MouseEvent) {
      if (!rootNode) return;
      const target = e.target as Node;
      const clickedInsideRoot = rootNode.contains(target);
      const clickedInsideList = listNode ? listNode.contains(target) : false;
      if (!clickedInsideRoot && !clickedInsideList) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [closeOnOutsideClick, rootNode, listNode]);

  const recomputePlacement = useCallback(() => {
    try {
      const trigger = rootNode;
      if (!trigger) return;
      const scrollParent = getScrollableAncestor(trigger);
      const rect = trigger.getBoundingClientRect();
      const containerBottom = scrollParent
        ? scrollParent.getBoundingClientRect().bottom
        : window.innerHeight;
      const spaceBelow = containerBottom - rect.bottom;
      const spaceAbove = rect.top;
      const estimated =
        typeof estimatePanelHeight === "function"
          ? estimatePanelHeight()
          : maxMenuHeightPx;
      setDropUp(spaceBelow < estimated && spaceAbove > spaceBelow);
    } catch {
      setDropUp(false);
    }
  }, [rootNode, estimatePanelHeight, maxMenuHeightPx]);

  // Lifecycle animation similar to Modal.tsx
  useEffect(() => {
    let raf1: number | null = null;
    let raf2: number | null = null;
    let timeoutId: number | undefined;
    if (open) {
      // Inform other combo-like components to close
      try {
        window.dispatchEvent(
          new CustomEvent("app:combobox-open", { detail: { sourceId } }),
        );
      } catch {
        // Intentionally ignore cross-environment errors (e.g., SSR)
      }
      setShouldRender(true);
      setEntered(false);
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => setEntered(true));
      });
      recomputePlacement();
      const onResize = () => recomputePlacement();
      window.addEventListener("resize", onResize);
      window.addEventListener("scroll", onResize, true);
      return () => {
        window.removeEventListener("resize", onResize);
        window.removeEventListener("scroll", onResize, true);
      };
    } else {
      setEntered(false);
      timeoutId = window.setTimeout(() => setShouldRender(false), 200);
    }
    return () => {
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [open, sourceId, recomputePlacement]);

  // Close when another combobox opens elsewhere
  useEffect(() => {
    function onOtherOpen(ev: Event) {
      try {
        const e = ev as CustomEvent<{ sourceId?: string }>;
        const src = e.detail?.sourceId;
        if (src && src === sourceId) return;
        setOpen(false);
      } catch {
        // If event detail is missing, still close to ensure single-open policy
        setOpen(false);
      }
    }
    window.addEventListener("app:combobox-open", onOtherOpen as EventListener);
    return () =>
      window.removeEventListener(
        "app:combobox-open",
        onOtherOpen as EventListener,
      );
  }, [sourceId]);

  return {
    open,
    setOpen,
    shouldRender,
    entered,
    activeIndex,
    setActiveIndex,
    setRootNode,
    setListNode,
    rootNode,
    listNode,
    dropUp,
    recomputePlacement,
  };
}

export default null;
