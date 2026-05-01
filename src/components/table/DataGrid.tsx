import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
// Footer subcomponents are composed within TableFooter
import TableFooter from "@components/table/TableFooter";
import GridSkeleton from "@components/loader/GridSkeleton";
import GridContentsSkeleton from "@components/loader/GridContentsSkeleton";
import QrGridCard, { type QrType } from "@components/qr/QrGridCard";
import type { TableLoadingState } from "@/utils/hooks/useTableLoadingState";

/**
 * Props for the DataGrid component -- a responsive card grid with pagination, selection,
 * skeleton loading, and optional QrGridCard rendering mode.
 */
type DataGridProps<T> = {
  /** Array of data items to display in the grid */
  items: T[];
  /** Function that returns a unique string identifier for each item (used for React keys) */
  getItemId: (item: T) => string;
  /** Render function for each grid card; ignored when mapItemToQrCard is provided */
  renderItem: (item: T) => ReactNode;
  className?: string;
  /** Tailwind grid layout classes. Defaults to a responsive 1-6 column grid with gap-6 and p-8. */
  gridClassName?: string;
  /** @deprecated Use loadingState prop instead for proper cache-aware loading */
  loading?: boolean;
  /**
   * Enhanced loading state from useTableLoadingState hook.
   * When provided, this takes precedence over the legacy `loading` prop.
   * Properly respects TanStack Query cache to avoid skeleton flash on cached data.
   */
  loadingState?: TableLoadingState;
  /** Enable selection UX and header select-all for current page */
  showSelection?: boolean;
  /** Returns whether an item is selected */
  isItemSelected?: (item: T) => boolean;
  /** Toggle selection for a specific item */
  onToggleItem?: (item: T) => void;
  /** Optional mapper: render items as QrGridCard when provided */
  mapItemToQrCard?: (item: T) => {
    qrImageSrc?: string;
    qrCodeId?: string;
    hasS3Image?: boolean;
    title: string;
    type: QrType;
    created: string;
    scans: number;
    actions?: ReactNode;
    className?: string;
  };
  /** Optional item click handler (QrGridCard mode) */
  onItemClick?: (item: T) => void;
  /** Optional function to provide URL for right-click to open in new tab */
  getItemUrl?: (item: T) => string | undefined;
  // Optional footer controls configuration
  resultsStart?: number;
  resultsEnd?: number;
  resultsTotal?: number;
  currentPage?: number;
  pageCount?: number;
  onPageChange?: (page: number) => void;
  itemsPerPage?: number;
  onItemsPerPageChange?: (value: number) => void;
  itemsPerPageSelectId?: string;
  /** When this signal changes, briefly render GridContentsSkeleton instead of full GridSkeleton */
  bodySkeletonSignal?: number;
};

export default function DataGrid<T>(props: DataGridProps<T>) {
  const {
    items,
    getItemId,
    renderItem,
    className = "",
    gridClassName = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6 p-8",
    loading,
    loadingState,
    showSelection,
    isItemSelected,
    onToggleItem,
    mapItemToQrCard,
    onItemClick,
    getItemUrl,
    resultsStart = 1,
    resultsEnd = 20,
    resultsTotal = 60,
    currentPage = 1,
    pageCount = 8,
    onPageChange,
    itemsPerPage = 20,
    onItemsPerPageChange,
    itemsPerPageSelectId = "grid-items-per-page",
    bodySkeletonSignal,
  } = props;

  // Ref to the scrollable container for scroll reset on page change
  const containerRef = useRef<HTMLDivElement>(null);

  // Skeleton loading controller
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true);
  const [showBodyOnlySkeleton, setShowBodyOnlySkeleton] =
    useState<boolean>(false);
  const prevItemsLenRef = useRef<number>(items.length);
  const prevItemsSigRef = useRef<string>("");

  // External signal: force body-only skeleton on demand (e.g., sort, pagination, items-per-page)
  useEffect(() => {
    // If using new loadingState prop and data is already cached, skip initial skeleton
    if (loadingState?.hasData) {
      setShowSkeleton(false);
      return;
    }
    if (bodySkeletonSignal === undefined || bodySkeletonSignal < 3) {
      triggerFullSkeleton();
    } else {
      triggerBodySkeletonShort();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodySkeletonSignal, loadingState?.hasData]);

  function triggerFullSkeleton() {
    setShowBodyOnlySkeleton(false);
    setShowSkeleton(true);
    window.setTimeout(() => setShowSkeleton(false), 1000);
  }

  const triggerBodySkeletonShort = useCallback(() => {
    // Do not show body-only skeleton while full skeleton/loading is active
    setShowSkeleton(false);
    setShowBodyOnlySkeleton(true);
    window.setTimeout(() => setShowBodyOnlySkeleton(false), 1000);
  }, []);

  // Treat items length change as filter/search: show full skeleton (unless recently suppressed or explicitly skipped once)
  useEffect(() => {
    const prevLen = prevItemsLenRef.current;
    const nextLen = items?.length ?? 0;
    if (prevLen !== nextLen) {
      if (bodySkeletonSignal === undefined) {
        triggerFullSkeleton();
      }
    }
    prevItemsLenRef.current = nextLen;
  }, [items, bodySkeletonSignal]);

  // Treat identity change with same length as sort: show body-only skeleton
  useEffect(() => {
    try {
      const sig = `${items.length}::${items
        .slice(0, 200)
        .map((it) => getItemId(it))
        .join("|")}`;
      if (
        prevItemsSigRef.current &&
        prevItemsSigRef.current !== sig &&
        items.length === prevItemsLenRef.current
      ) {
        triggerFullSkeleton();
      }
      prevItemsSigRef.current = sig;
    } catch {
      // if getItemId fails, ignore
    }
  }, [items, getItemId, triggerBodySkeletonShort]);

  // Selection helpers for current page (items are expected to be paged upstream)
  const headerSelectRef = useRef<HTMLInputElement>(null);
  const allPageSelected = Boolean(
    items.length > 0 &&
      isItemSelected &&
      items.every((it) => Boolean(isItemSelected(it))),
  );
  const somePageSelected = Boolean(
    items.length > 0 &&
      isItemSelected &&
      items.some((it) => Boolean(isItemSelected(it))),
  );

  useEffect(() => {
    if (headerSelectRef.current) {
      headerSelectRef.current.indeterminate =
        somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  // Reset scroll position to top when page changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [currentPage]);

  function handleSelectAllOnPage(checked: boolean) {
    if (!onToggleItem || !isItemSelected) return;
    items.forEach((item) => {
      const selected = Boolean(isItemSelected(item));
      if (selected !== checked) onToggleItem(item);
    });
  }

  // ─── Reactive path: loadingState controls everything ───
  if (loadingState?.showSkeleton) {
    return (
      <div className={`relative flex flex-col h-full min-h-0 ${className}`}>
        <GridSkeleton className="flex-grow" gridClassName={gridClassName} />
      </div>
    );
  }

  // ─── Legacy path: timer-based (unchanged) ───
  const shouldShowSkeleton =
    !loadingState && (Boolean(loading) || showSkeleton);
  if (shouldShowSkeleton) {
    return (
      <div className={`relative flex flex-col h-full min-h-0 ${className}`}>
        {showBodyOnlySkeleton ? (
          <GridContentsSkeleton
            className="flex-grow"
            gridClassName={gridClassName}
          />
        ) : (
          <GridSkeleton className="flex-grow" gridClassName={gridClassName} />
        )}
      </div>
    );
  }

  // Empty state when there are no items
  if (!items || items.length === 0) {
    return (
      <div className={`relative flex flex-col h-full min-h-0 ${className}`}>
        <div
          className="flex-grow flex items-center justify-center p-12 text-center"
          aria-live="polite"
        >
          <div>
            <i className="bx bx-grid-alt text-4xl text-gray-300 mb-2" />
            <p className="text-sm text-gray-600">No items found</p>
            <p className="text-xs text-gray-400">
              Try adjusting your search or filters.
            </p>
          </div>
        </div>
        <TableFooter
          resultsStart={resultsStart ?? 1}
          resultsEnd={resultsEnd ?? 0}
          resultsTotal={resultsTotal ?? 0}
          currentPage={currentPage ?? 1}
          pageCount={pageCount ?? 1}
          onPrev={
            onPageChange
              ? () => {
                  if ((currentPage ?? 1) > 1)
                    onPageChange((currentPage ?? 1) - 1);
                }
              : undefined
          }
          onNext={
            onPageChange
              ? () => {
                  if ((currentPage ?? 1) < (pageCount ?? 1))
                    onPageChange((currentPage ?? 1) + 1);
                }
              : undefined
          }
          onPageChange={onPageChange}
          itemsPerPage={itemsPerPage ?? 20}
          onItemsPerPageChange={onItemsPerPageChange ?? (() => {})}
          itemsPerPageSelectId={itemsPerPageSelectId}
          itemsPerPageOptions={[12, 24, 48]}
        />
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col h-full min-h-0 ${className}`}>
      {/* Header select-all (optional) */}
      {showSelection && isItemSelected && onToggleItem ? (
        <div className="flex-none bg-gray-50 border-b border-gray-200 px-4 py-2">
          <label className="flex items-center text-sm text-gray-700">
            <input
              ref={headerSelectRef}
              type="checkbox"
              aria-label="Select all on this page"
              checked={Boolean(allPageSelected)}
              onChange={(e) => handleSelectAllOnPage(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
            />
            <span className="block font-medium ml-2">
              Select all on this page
            </span>
          </label>
        </div>
      ) : null}

      {/* Body */}
      <div className={`flex-grow flex flex-col overflow-hidden`}>
        <div
          ref={containerRef}
          className={`${loadingState?.showContentsSkeleton || showSkeleton || showBodyOnlySkeleton ? "overflow-hidden" : "overflow-auto"} flex-grow`}
        >
          {/* Body-only skeleton: reactive path (showContentsSkeleton) or legacy timer path */}
          {loadingState?.showContentsSkeleton ||
          (!loadingState && showBodyOnlySkeleton) ? (
            <GridContentsSkeleton
              className="flex-grow"
              gridClassName={gridClassName}
            />
          ) : (
            <div className={gridClassName}>
              {items.map((item) => {
                const url = getItemUrl ? getItemUrl(item) : undefined;
                const cardContent = mapItemToQrCard
                  ? (() => {
                      const p = mapItemToQrCard(item);
                      return (
                        <QrGridCard
                          {...p}
                          onClick={
                            onItemClick ? () => onItemClick(item) : undefined
                          }
                          showCheckbox={Boolean(
                            showSelection && isItemSelected && onToggleItem,
                          )}
                          selected={Boolean(
                            isItemSelected ? isItemSelected(item) : false,
                          )}
                          onToggleSelect={
                            onToggleItem ? () => onToggleItem(item) : undefined
                          }
                        />
                      );
                    })()
                  : renderItem(item);

                if (url) {
                  return (
                    <a
                      key={getItemId(item)}
                      href={url}
                      onClick={(e) => {
                        e.preventDefault();
                        if (onItemClick) onItemClick(item);
                      }}
                      className="block relative"
                    >
                      {cardContent}
                    </a>
                  );
                }

                return (
                  <div key={getItemId(item)} className="relative">
                    {cardContent}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <TableFooter
          resultsStart={resultsStart ?? 1}
          resultsEnd={resultsEnd ?? items.length}
          resultsTotal={resultsTotal ?? items.length}
          currentPage={currentPage ?? 1}
          pageCount={pageCount ?? 1}
          onPrev={
            onPageChange
              ? () => {
                  if ((currentPage ?? 1) > 1)
                    onPageChange((currentPage ?? 1) - 1);
                }
              : undefined
          }
          onNext={
            onPageChange
              ? () => {
                  if ((currentPage ?? 1) < (pageCount ?? 1))
                    onPageChange((currentPage ?? 1) + 1);
                }
              : undefined
          }
          onPageChange={onPageChange}
          itemsPerPage={itemsPerPage ?? 20}
          onItemsPerPageChange={onItemsPerPageChange ?? (() => {})}
          itemsPerPageSelectId={itemsPerPageSelectId}
          itemsPerPageOptions={[12, 24, 48]}
        />
      </div>
    </div>
  );
}
