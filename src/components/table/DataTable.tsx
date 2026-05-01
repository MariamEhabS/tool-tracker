import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Button from "@components/ui/Button";
import TableSkeleton from "@components/loader/TableSkeleton";
import TableContentsSkeleton from "@components/loader/TableContentsSkeleton";
// Footer subcomponents are composed within TableFooter
import TableFooter from "@components/table/TableFooter";
import type { TableLoadingState } from "@/utils/hooks/useTableLoadingState";

export type { TableLoadingState };

/** Semantic column type that determines width weighting, minimum widths, and sort behavior. */
export type ColumnType =
  | "primary"
  | "secondary"
  | "date"
  | "group"
  | "project"
  | "number"
  | "status"
  | "text"
  | "id"
  | "short";

/** Column definition for DataTable, describing header, rendering, sorting, and sizing for a single column. */
export type Column<T> = {
  /** Unique key identifying this column (also used as default data accessor) */
  key: string;
  /** Display text for the column header */
  header: string;
  /** When true, the column header includes a sort toggle button */
  sortable?: boolean;
  className?: string;
  /** Custom render function for cell content; when omitted, the column key is used to access row data directly */
  render?: (row: T) => ReactNode;
  /** Semantic type that controls width weighting and sort behavior (e.g., "date" columns parse dates). Defaults to "text". */
  columnType?: ColumnType;
  /** Minimum percentage width for this column (currently unused; width is calculated by columnType weights) */
  minPercent?: number;
  /** Maximum percentage width for this column (currently unused) */
  maxPercent?: number;
  /** Custom value extractor for sorting; when omitted, the column key is used as the data accessor */
  getSortValue?: (row: T) => string | number | Date | undefined | null;
  /** Custom comparator for sorting two rows; takes precedence over getSortValue */
  sortComparator?: (a: T, b: T) => number;
};

/**
 * Props for the DataTable component -- a full-featured data table with sorting, pagination,
 * row selection, exit animations, skeleton loading, and both client-side and server-side modes.
 */
type DataTableProps<T> = {
  /** Column definitions controlling headers, rendering, sorting, and sizing */
  columns: Column<T>[];
  /** Array of data rows to display */
  rows: T[];
  /** Function that returns a unique string identifier for each row (used for React keys and selection tracking) */
  getRowId: (row: T) => string;
  /** Callback fired when a row is clicked */
  onRowClick?: (row: T) => void;
  /** When true, shows selection checkboxes in the first column */
  showSelection?: boolean;
  /** Returns whether a given row is currently selected */
  isRowSelected?: (row: T) => boolean;
  /** Callback to toggle selection state for a single row */
  onToggleRow?: (row: T) => void;
  /** Optional: disable selection and gray-out styling for specific rows */
  isRowDisabled?: (row: T) => boolean;
  /** Whether all rows are selected (legacy; current implementation uses per-page select-all) */
  allSelected?: boolean;
  /** Callback to toggle all rows (legacy; current implementation uses per-page select-all) */
  onToggleAll?: () => void;
  /** Render function for the actions column on the right side of each row */
  renderActions?: (row: T) => ReactNode;
  /** @deprecated Use loadingState prop instead for proper cache-aware loading */
  loading?: boolean;
  /**
   * Enhanced loading state from useTableLoadingState hook.
   * When provided, this takes precedence over the legacy `loading` prop.
   * Properly respects TanStack Query cache to avoid skeleton flash on cached data.
   */
  loadingState?: TableLoadingState;
  /** Current search text driving the table's rows; used to trigger skeleton on first two typed chars */
  searchText?: string;
  /** Optional function to provide per-row className for animations or styling */
  getRowClassName?: (row: T) => string;
  /** Optional function to provide URL for right-click to open in new tab */
  getRowUrl?: (row: T) => string | undefined;
  /** Enable server-side pagination mode (optional) */
  serverSide?: boolean;
  /** Controlled current page when serverSide is true */
  currentPage?: number;
  /** Controlled items per page when serverSide is true */
  itemsPerPage?: number;
  /** Total items (for footer and page count) when serverSide is true */
  totalItems?: number;
  /** Page change handler when serverSide is true */
  onPageChange?: (page: number) => void;
  /** Items-per-page change handler when serverSide is true */
  onItemsPerPageChange?: (value: number) => void;
  /** Explicit list of row ids that should play the exit animation on removal */
  exitingRowIds?: string[];
  /** Enable server-side sort mode (disables client-side sorting) */
  serverSideSort?: boolean;
  /** Controlled sort state when serverSideSort is true (or to control locally) */
  sortState?: { key: string; dir: "asc" | "desc" } | null;
  /** Sort change handler for server-side sort mode */
  onSortChange?: (key: string, dir: "asc" | "desc") => void;
  /** Allow table to overflow horizontally and use native x/y scrolling. */
  allowHorizontalScroll?: boolean;
  /** Show pagination footer controls. */
  showFooter?: boolean;
  /** Show "Showing X of Y results" in footer. */
  showFooterResultsSummary?: boolean;
  /** Show "Show Z items" selector in footer. */
  showFooterItemsPerPage?: boolean;
};

const COLUMN_TYPE_WEIGHTS: Record<
  | "primary"
  | "secondary"
  | "date"
  | "group"
  | "project"
  | "number"
  | "status"
  | "text"
  | "id"
  | "short",
  number
> = {
  primary: 2.7,
  secondary: 2.0,
  text: 2.0,
  group: 1.1,
  project: 1.3,
  date: 1.0,
  number: 0.9,
  status: 0.9,
  id: 0.6,
  short: 1.0,
};

// Minimum pixel widths to prevent content overflow
const COLUMN_MIN_WIDTHS: Partial<Record<ColumnType, number>> = {
  primary: 220,
  secondary: 180,
  text: 150,
  date: 120,
  status: 100,
};

export default function DataTable<T>(props: DataTableProps<T>) {
  const {
    columns,
    rows,
    getRowId,
    onRowClick,
    showSelection,
    isRowSelected,
    onToggleRow,
    isRowDisabled,
    renderActions,
    loading,
    loadingState,
    searchText,
    getRowClassName,
    getRowUrl,
    allowHorizontalScroll = false,
    showFooter = true,
    showFooterResultsSummary = true,
    showFooterItemsPerPage = true,
  } = props;

  const headerTableRef = useRef<HTMLTableElement>(null);
  const bodyTableRef = useRef<HTMLTableElement>(null);
  const bodyWrapRef = useRef<HTMLDivElement>(null);
  const [scrollbarWidth, setScrollbarWidth] = useState<number>(0);
  const [scrollLeft, setScrollLeft] = useState<number>(0);
  const [contentWidth, setContentWidth] = useState<number>(0);
  const [sortState, setSortState] = useState<null | {
    key: string;
    dir: "asc" | "desc";
  }>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);
  // Skeleton loading controller: show for 1s on first mount/search; use body-only skeleton for sort/pagination
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true);
  const [showBodyOnlySkeleton, setShowBodyOnlySkeleton] =
    useState<boolean>(false);
  const skeletonTimerRef = useRef<number | null>(null);
  const prevSearchRef = useRef<string>("");
  const didInitPaginateRef = useRef<boolean>(false);
  const prevRowsLengthRef = useRef<number>(rows.length);
  const prevRowsSigRef = useRef<string>("");
  const skeletonKindRef = useRef<"none" | "full" | "body">("none");
  const suppressBodyOnlyUntilRef = useRef<number>(0);
  const pendingSkipBodySkeletonRef = useRef<boolean>(false);
  // Track sort initialization to avoid triggering skeleton on first mount
  const didInitSortRef = useRef<boolean>(false);
  // Track previous sort state to detect actual sort changes vs just renderRows updates
  const prevSortKeyRef = useRef<string | undefined>(undefined);
  const prevSortDirRef = useRef<"asc" | "desc" | undefined>(undefined);
  // Built-in exit animation support: keep removed rows briefly and mark as exiting
  const [renderRows, setRenderRows] = useState<T[]>(rows);
  const prevRowsRef = useRef<T[]>(rows);
  const prevGetRowIdRef = useRef<typeof getRowId>(getRowId);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());

  // Server-side feature flags and effective pagination state
  const serverSide = props.serverSide === true;
  const serverSideSort = props.serverSideSort === true;
  const effectiveCurrentPage =
    serverSide && typeof props.currentPage === "number"
      ? props.currentPage
      : currentPage;
  const effectiveItemsPerPage =
    serverSide && typeof props.itemsPerPage === "number"
      ? props.itemsPerPage
      : itemsPerPage;
  // Track total for server-side to avoid footer flicker
  const lastKnownTotalRef = useRef<number>(
    typeof props.totalItems === "number" ? props.totalItems : 0,
  );
  useEffect(() => {
    if (!serverSide) return;
    if (
      typeof props.totalItems === "number" &&
      props.totalItems >= 0 &&
      !loading
    ) {
      lastKnownTotalRef.current = props.totalItems;
    }
  }, [props.totalItems, serverSide, loading]);

  useEffect(() => {
    // Explicit exit animation support if exitingRowIds are provided
    if (props.exitingRowIds && props.exitingRowIds.length > 0) {
      const exitingSet = new Set(props.exitingRowIds);
      const prev = prevRowsRef.current;
      const removedRows = prev.filter((r) => exitingSet.has(getRowId(r)));
      const keptRows = rows.filter((r) => !exitingSet.has(getRowId(r)));
      if (removedRows.length > 0) {
        setRenderRows([...keptRows, ...removedRows]);
        setExitingIds(new Set(Array.from(exitingSet)));
        const t = window.setTimeout(() => {
          setRenderRows((curr) =>
            curr.filter((r) => !exitingSet.has(getRowId(r))),
          );
          setExitingIds(new Set());
        }, 200);
        prevRowsRef.current = rows;
        return () => window.clearTimeout(t);
      }
    }

    // In server-side mode, avoid exit animations to prevent pagination bleed-through across pages
    if (serverSide) {
      setRenderRows(rows);
      prevRowsRef.current = rows;
      setExitingIds(new Set());
      return;
    }

    // If the identity function changes (switching table types/configs), reset cache to avoid key reuse issues
    if (prevGetRowIdRef.current !== getRowId) {
      setRenderRows(rows);
      setExitingIds(new Set());
      prevRowsRef.current = rows;
      prevGetRowIdRef.current = getRowId;
      return;
    }
    const prev = prevRowsRef.current;
    const prevIds = new Set(prev.map((r) => getRowId(r)));
    const nextIds = new Set(rows.map((r) => getRowId(r)));
    const removedIds = Array.from(prevIds).filter((id) => !nextIds.has(id));
    if (removedIds.length > 0) {
      const removedRows = prev.filter((r) => removedIds.includes(getRowId(r)));
      setRenderRows([...rows, ...removedRows]);
      setExitingIds((prevSet) => {
        const next = new Set(prevSet);
        removedIds.forEach((id) => next.add(id));
        return next;
      });
      const t = window.setTimeout(() => {
        setRenderRows((curr) =>
          curr.filter((r) => !removedIds.includes(getRowId(r))),
        );
        setExitingIds((prevSet) => {
          const next = new Set(prevSet);
          removedIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 200);
      prevRowsRef.current = rows;
      return () => window.clearTimeout(t);
    }
    setRenderRows(rows);
    prevRowsRef.current = rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, getRowId, serverSide]);

  function triggerSkeleton({ bodyOnly = false }: { bodyOnly?: boolean } = {}) {
    // Do not downgrade an active full skeleton to body-only
    if (bodyOnly && skeletonKindRef.current === "full") return;
    setShowBodyOnlySkeleton(Boolean(bodyOnly));
    skeletonKindRef.current = bodyOnly ? "body" : "full";
    // When full skeleton is requested, suppress body-only for a short window to avoid flicker
    if (!bodyOnly) suppressBodyOnlyUntilRef.current = Date.now() + 1200;
    setShowSkeleton(true);
    if (skeletonTimerRef.current) window.clearTimeout(skeletonTimerRef.current);
    skeletonTimerRef.current = window.setTimeout(() => {
      setShowSkeleton(false);
      setShowBodyOnlySkeleton(false);
      skeletonKindRef.current = "none";
    }, 1000);
  }

  // Initial mount: show skeleton for 1s ONLY if no cached data exists
  useEffect(() => {
    // If using new loadingState prop and data is already cached, skip initial skeleton
    if (loadingState?.hasData) {
      setShowSkeleton(false);
      return;
    }
    // Legacy behavior: show skeleton if loading prop is true or no loadingState provided
    triggerSkeleton();
    return () => {
      if (skeletonTimerRef.current)
        window.clearTimeout(skeletonTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search-triggered handling: reset to first page when search text CHANGES
  useEffect(() => {
    if (typeof searchText !== "string") return;
    // Skip initial mount; only act when search text changes
    if (prevSearchRef.current === undefined) {
      prevSearchRef.current = searchText;
      return;
    }
    if (prevSearchRef.current === searchText) return;
    prevSearchRef.current = searchText;
    // Reset to first page on search; avoid body-only skeleton for this programmatic change
    if (serverSide) {
      pendingSkipBodySkeletonRef.current = true;
      if (props.onPageChange) props.onPageChange(1);
    } else {
      if (currentPage !== 1) {
        pendingSkipBodySkeletonRef.current = true;
        setCurrentPage(1);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, serverSide, props.onPageChange, currentPage]);

  // Filter/search-triggered skeleton: if the number of rows changes from parent, show full table skeleton
  // Skip this when loadingState is provided as the external hook manages loading state
  useEffect(() => {
    const prevLen = prevRowsLengthRef.current;
    const nextLen = rows?.length ?? 0;
    if (prevLen !== nextLen) {
      // Reset to first page for new result sets
      if (!serverSide && currentPage !== 1) {
        pendingSkipBodySkeletonRef.current = true;
        setCurrentPage(1);
      }
      // Only trigger skeleton if NOT using external loadingState
      if (nextLen > itemsPerPage && !loadingState) {
        triggerSkeleton({ bodyOnly: false });
      }
    }
    prevRowsLengthRef.current = nextLen;
  }, [rows, itemsPerPage, currentPage, serverSide, loadingState]);

  // Also detect row identity changes (filters can change content without changing count)
  // Skip skeleton trigger when loadingState is provided as the external hook manages loading state
  useEffect(() => {
    try {
      const nextLen = rows.length;
      const sig = `${nextLen}::${rows
        .slice(0, 200)
        .map((r) => getRowId(r))
        .join("|")}`;
      if (prevRowsSigRef.current && prevRowsSigRef.current !== sig) {
        // Reset to first page for changed results
        if (!serverSide && currentPage !== 1) {
          pendingSkipBodySkeletonRef.current = true;
          setCurrentPage(1);
        }
        // Only trigger skeleton if NOT using external loadingState
        if (nextLen > itemsPerPage && !loadingState) {
          triggerSkeleton({ bodyOnly: false });
        }
      }
      prevRowsSigRef.current = sig;
    } catch {
      // Fallback: if signature fails, still show full skeleton once when multi-page
      // Only trigger skeleton if NOT using external loadingState
      if ((rows?.length ?? 0) > itemsPerPage && !loadingState)
        triggerSkeleton({ bodyOnly: false });
    }
  }, [rows, getRowId, itemsPerPage, currentPage, serverSide, loadingState]);

  // Trigger body-only skeleton when sorting or paginating
  // Only trigger when sort actually changes, not when renderRows updates
  useEffect(() => {
    const effectiveKey = serverSideSort ? props.sortState?.key : sortState?.key;
    const effectiveDir = serverSideSort ? props.sortState?.dir : sortState?.dir;
    if (!effectiveKey || !effectiveDir) return;

    // Skip first mount to avoid skeleton on initial sort state
    if (!didInitSortRef.current) {
      didInitSortRef.current = true;
      prevSortKeyRef.current = effectiveKey;
      prevSortDirRef.current = effectiveDir;
      return;
    }

    // Only trigger skeleton if sort actually changed (not just renderRows update)
    const sortChanged =
      prevSortKeyRef.current !== effectiveKey ||
      prevSortDirRef.current !== effectiveDir;
    prevSortKeyRef.current = effectiveKey;
    prevSortDirRef.current = effectiveDir;

    if (!sortChanged) return;

    // Avoid overriding full skeleton and avoid within suppression window
    if (skeletonKindRef.current === "full") return;
    if (Date.now() < suppressBodyOnlyUntilRef.current) return;
    // If only one page, skip body-only skeleton and just resort
    const totalRows = renderRows.length;
    if (totalRows <= itemsPerPage) return;
    triggerSkeleton({ bodyOnly: true });
  }, [sortState, props.sortState, renderRows, itemsPerPage, serverSideSort]);

  useEffect(() => {
    // currentPage or itemsPerPage change implies pagination interaction
    if (!didInitPaginateRef.current) {
      didInitPaginateRef.current = true;
      return;
    }
    // Avoid overriding full skeleton and avoid within suppression window
    if (skeletonKindRef.current === "full") return;
    if (Date.now() < suppressBodyOnlyUntilRef.current) return;
    // Skip body-only skeleton if the page change was caused by a search reset
    if (pendingSkipBodySkeletonRef.current) {
      pendingSkipBodySkeletonRef.current = false;
      return;
    }
    triggerSkeleton({ bodyOnly: true });
  }, [currentPage, itemsPerPage]);

  // Reset scroll position to top when page changes
  useEffect(() => {
    if (bodyWrapRef.current) {
      bodyWrapRef.current.scrollTop = 0;
    }
  }, [effectiveCurrentPage]);

  function defaultCompare(a: unknown, b: unknown): number {
    const va =
      a instanceof Date
        ? a.getTime()
        : typeof a === "number"
          ? a
          : String(a ?? "");
    const vb =
      b instanceof Date
        ? b.getTime()
        : typeof b === "number"
          ? b
          : String(b ?? "");
    if (typeof va === "number" && typeof vb === "number") return va - vb;
    const collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base",
    });
    return collator.compare(String(va), String(vb));
  }

  function parseDateValue(value: unknown): number | null {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return new Date(value).getTime();
    if (typeof value === "string") {
      const ts = Date.parse(value);
      if (!Number.isNaN(ts)) return ts;
    }
    return null;
  }

  const compareByColumnType = useCallback(
    (a: unknown, b: unknown, t: ColumnType | undefined): number => {
      if (t === "date") {
        const ta = parseDateValue(a);
        const tb = parseDateValue(b);
        if (ta !== null && tb !== null) return ta - tb;
        const collator = new Intl.Collator(undefined, {
          numeric: true,
          sensitivity: "base",
        });
        return collator.compare(String(a ?? ""), String(b ?? ""));
      }
      return defaultCompare(a, b);
    },
    [],
  );

  const displayRows = useMemo(() => {
    const source = renderRows;
    const effectiveSort = serverSideSort
      ? (props.sortState ?? null)
      : sortState;
    if (!effectiveSort) return source;
    const col = columns.find((c) => c.key === effectiveSort.key);
    if (!col) return source;
    const sorted = [...source];
    if (col.sortComparator) {
      sorted.sort(col.sortComparator);
    } else {
      const getVal = col.getSortValue
        ? (r: T) => col.getSortValue!(r)
        : (r: T) => (r as unknown as Record<string, unknown>)[col.key];
      const comparator = (a: T, b: T) =>
        compareByColumnType(getVal(a), getVal(b), col.columnType);
      sorted.sort(comparator);
    }
    if (effectiveSort.dir === "desc") sorted.reverse();
    return sorted;
  }, [
    renderRows,
    columns,
    sortState,
    props.sortState,
    compareByColumnType,
    serverSideSort,
  ]);

  const totalForPaging = serverSide
    ? loading
      ? lastKnownTotalRef.current
      : typeof props.totalItems === "number" && props.totalItems >= 0
        ? props.totalItems
        : lastKnownTotalRef.current
    : displayRows.length;
  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(totalForPaging / effectiveItemsPerPage)),
    [totalForPaging, effectiveItemsPerPage],
  );

  useEffect(() => {
    if (serverSide) return;
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [pageCount, currentPage, serverSide]);

  const pagedRows = useMemo(() => {
    if (serverSide) return displayRows;
    const start = (currentPage - 1) * itemsPerPage;
    return displayRows.slice(start, start + itemsPerPage);
  }, [displayRows, currentPage, itemsPerPage, serverSide]);

  // Selection state for the CURRENT PAGE only
  const selectablePagedRows = useMemo(() => {
    if (!isRowDisabled) return pagedRows;
    return pagedRows.filter((r) => !isRowDisabled(r));
  }, [pagedRows, isRowDisabled]);
  const allPageSelected = useMemo(() => {
    if (!isRowSelected || selectablePagedRows.length === 0) return false;
    return selectablePagedRows.every((r) => Boolean(isRowSelected(r)));
  }, [selectablePagedRows, isRowSelected]);

  const somePageSelected = useMemo(() => {
    if (!isRowSelected || selectablePagedRows.length === 0) return false;
    return selectablePagedRows.some((r) => Boolean(isRowSelected(r)));
  }, [selectablePagedRows, isRowSelected]);

  const headerSelectRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerSelectRef.current) {
      headerSelectRef.current.indeterminate =
        somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  function handleSelectAllOnPage(checked: boolean) {
    if (onToggleRow && isRowSelected) {
      selectablePagedRows.forEach((row) => {
        const selected = Boolean(isRowSelected(row));
        if (selected !== checked) onToggleRow(row);
      });
    }
    // Intentionally avoid using legacy onToggleAll to prevent selecting across all pages
  }

  // Sync header horizontal scroll with body
  useEffect(() => {
    const wrap = bodyWrapRef.current;
    if (!wrap) return;
    const onScroll = () => setScrollLeft(wrap.scrollLeft);
    wrap.addEventListener("scroll", onScroll, { passive: true });
    // initialize
    onScroll();
    return () => wrap.removeEventListener("scroll", onScroll);
  }, [loading, showSkeleton]);

  // Track scrollbar width of the scrolling wrapper to keep header aligned
  useEffect(() => {
    const wrap = bodyWrapRef.current;
    if (!wrap) return;
    const update = () => {
      const w = wrap.offsetWidth - wrap.clientWidth;
      setScrollbarWidth(w > 0 ? w : 0);
      setContentWidth(wrap.clientWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [
    columns,
    renderRows,
    showSelection,
    renderActions,
    loading,
    showSkeleton,
  ]);

  // Column width calculation
  const SELECT_COL_PX = 48;
  const LAST_COL_PCT = 0.0725;

  const getColWeight = useCallback((col: Column<T>): number => {
    const t = (col.columnType ?? "text") as ColumnType;
    return COLUMN_TYPE_WEIGHTS[t] ?? 1;
  }, []);

  const computedWidths = useMemo(() => {
    const avail = contentWidth;
    const hasActions = Boolean(renderActions);
    const selectionPx = showSelection ? SELECT_COL_PX : 0;
    if (avail <= 0 || columns.length === 0) {
      return {
        selection: selectionPx,
        data: columns.map(() => 0),
        actions: hasActions ? Math.round(LAST_COL_PCT * Math.max(avail, 0)) : 0,
      };
    }

    const lastColPx = Math.round(LAST_COL_PCT * avail);
    let remainingForData = avail - selectionPx - (hasActions ? lastColPx : 0);
    if (remainingForData < 0) remainingForData = 0;

    const n = columns.length;
    const widths: number[] = new Array(n).fill(0);

    if (n === 1) {
      // Single data column: give it all remaining space
      widths[0] = remainingForData;
      return {
        selection: selectionPx,
        data: widths,
        actions: hasActions ? lastColPx : 0,
      };
    }

    // Calculate minimum widths required
    const minWidths = columns.map((col) => {
      const colType = col.columnType ?? "text";
      return COLUMN_MIN_WIDTHS[colType] ?? 100;
    });
    const totalMinWidth = minWidths.reduce((sum, w) => sum + w, 0);

    // If minimum widths exceed available space, use proportional scaling
    if (totalMinWidth > remainingForData) {
      if (allowHorizontalScroll) {
        columns.forEach((_, idx) => {
          widths[idx] = minWidths[idx];
        });
        return {
          selection: selectionPx,
          data: widths,
          actions: hasActions ? lastColPx : 0,
        };
      }

      const scale = remainingForData / totalMinWidth;
      columns.forEach((_, idx) => {
        widths[idx] = Math.round(minWidths[idx] * scale);
      });
      // Adjust last column for any rounding error
      const sumData = widths.reduce((s, v) => s + v, 0);
      const diff = remainingForData - sumData;
      if (diff !== 0) {
        widths[widths.length - 1] = Math.max(
          0,
          widths[widths.length - 1] + diff,
        );
      }
      return {
        selection: selectionPx,
        data: widths,
        actions: hasActions ? lastColPx : 0,
      };
    }

    // Weighted distribution for ALL columns based on columnType
    let weightSum = 0;
    const weights: number[] = columns.map((col) => {
      const w = getColWeight(col);
      weightSum += w;
      return w;
    });

    if (weightSum > 0) {
      let assigned = 0;
      columns.forEach((_col, idx) => {
        const raw = (weights[idx] / weightSum) * remainingForData;
        const px =
          idx === columns.length - 1
            ? Math.max(0, Math.round(remainingForData - assigned))
            : Math.max(minWidths[idx], Math.round(raw));
        widths[idx] = px;
        assigned += px;
      });
    } else {
      // Fallback: distribute evenly if no weights, respecting minimums
      const evenWidth = Math.floor(remainingForData / n);
      columns.forEach((_, idx) => {
        widths[idx] = Math.max(minWidths[idx], evenWidth);
      });
      const remainder = remainingForData - widths.reduce((s, v) => s + v, 0);
      if (remainder > 0) widths[0] += remainder;
    }

    // Final sanity adjustment to ensure totals align
    const sumData = widths.reduce((s, v) => s + v, 0);
    const target = remainingForData;
    const diff = target - sumData;
    if (diff !== 0) {
      // Adjust the last column to account for any rounding differences
      const targetIdx = columns.length - 1;
      widths[targetIdx] = Math.max(
        minWidths[targetIdx] ?? 100,
        widths[targetIdx] + diff,
      );
    }

    return {
      selection: selectionPx,
      data: widths,
      actions: hasActions ? lastColPx : 0,
    };
  }, [
    contentWidth,
    columns,
    showSelection,
    renderActions,
    getColWeight,
    allowHorizontalScroll,
  ]);

  const widthsReady = contentWidth > 0;

  const headerColgroup = useMemo(
    () => (
      <colgroup>
        {showSelection ? (
          <col
            style={
              widthsReady
                ? { width: `${computedWidths.selection}px` }
                : undefined
            }
          />
        ) : null}
        {columns.map((_, i) => (
          <col
            key={i}
            style={
              widthsReady
                ? { width: `${computedWidths.data[i] ?? 0}px` }
                : undefined
            }
          />
        ))}
        {renderActions ? (
          <col
            style={
              widthsReady ? { width: `${computedWidths.actions}px` } : undefined
            }
          />
        ) : null}
      </colgroup>
    ),
    [columns, showSelection, renderActions, computedWidths, widthsReady],
  );

  // ─── Reactive path: loadingState controls everything ───
  if (loadingState?.showSkeleton) {
    return (
      <TableSkeleton
        columnCount={columns.length}
        rowCount={10}
        showSelection={showSelection}
        showActions={Boolean(renderActions)}
      />
    );
  }

  // ─── Legacy path: timer-based (unchanged) ───
  const shouldPreferBodySkeleton =
    !loadingState && serverSide && Boolean(loading);
  const isLegacyLoading =
    !loadingState && (Boolean(loading) || (!serverSide && showSkeleton));

  if (isLegacyLoading && !showBodyOnlySkeleton && !shouldPreferBodySkeleton) {
    return (
      <TableSkeleton
        columnCount={columns.length}
        rowCount={10}
        showSelection={showSelection}
        showActions={Boolean(renderActions)}
      />
    );
  }

  return (
    <div className="relative flex flex-col h-full min-h-0">
      <div
        className="flex-none bg-gray-50 border-b border-gray-200 overflow-x-hidden"
        style={{ paddingRight: scrollbarWidth }}
      >
        <table
          ref={headerTableRef}
          className="table-fixed"
          style={{
            transform: scrollLeft ? `translateX(-${scrollLeft}px)` : undefined,
            minWidth: "100%",
            width: widthsReady
              ? `${computedWidths.selection + computedWidths.data.reduce((s, w) => s + w, 0) + computedWidths.actions}px`
              : "100%",
          }}
        >
          {headerColgroup}
          <thead className="bg-gray-50">
            <tr>
              {showSelection ? (
                <th
                  scope="col"
                  className={`sticky top-0 bg-gray-50 px-4 py-3 text-center w-12`}
                >
                  <input
                    ref={headerSelectRef}
                    aria-label="Select all on this page"
                    checked={Boolean(allPageSelected)}
                    disabled={selectablePagedRows.length === 0}
                    onChange={(e) => handleSelectAllOnPage(e.target.checked)}
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                  />
                </th>
              ) : null}
              {columns.map((col, i) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`sticky top-0 bg-gray-50 ${i === 0 ? "pl-6" : "pl-5"} py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.className ?? ""}`}
                  aria-sort={
                    col.sortable
                      ? (serverSideSort
                          ? props.sortState?.key
                          : sortState?.key) === col.key
                        ? (serverSideSort
                            ? props.sortState?.dir
                            : sortState?.dir) === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                >
                  <div className="flex items-center gap-1">
                    <span>{col.header}</span>
                    {col.sortable ? (
                      <Button
                        type="button"
                        variant="icon"
                        onClick={() => {
                          if (serverSideSort) {
                            const prev = props.sortState ?? null;
                            const next =
                              !prev || prev.key !== col.key
                                ? { key: col.key, dir: "asc" as const }
                                : {
                                    key: col.key,
                                    dir:
                                      prev.dir === "asc"
                                        ? ("desc" as const)
                                        : ("asc" as const),
                                  };
                            if (props.onSortChange)
                              props.onSortChange(next.key, next.dir);
                          } else {
                            setSortState((prev) => {
                              if (!prev || prev.key !== col.key)
                                return { key: col.key, dir: "asc" };
                              return {
                                key: col.key,
                                dir: prev.dir === "asc" ? "desc" : "asc",
                              };
                            });
                          }
                        }}
                        leftIconClass={`bx ${(serverSideSort ? props.sortState?.key : sortState?.key) === col.key ? ((serverSideSort ? props.sortState?.dir : sortState?.dir) === "asc" ? "bx-sort-up" : "bx-sort-down") : "bx-sort"} text-sm`}
                      >
                        <span className="sr-only">Sort</span>
                      </Button>
                    ) : null}
                  </div>
                </th>
              ))}
              {renderActions ? (
                <th
                  scope="col"
                  className="pl-5 pr-6 top-0 bg-gray-50 relative py-3"
                >
                  <div className="h-full">
                    <span className="sr-only">Actions</span>
                  </div>
                </th>
              ) : null}
            </tr>
          </thead>
        </table>
      </div>

      {/* Body */}
      <div
        ref={bodyWrapRef}
        className={`flex-grow flex flex-col ${loadingState?.showContentsSkeleton || ((Boolean(loading) || showSkeleton) && (showBodyOnlySkeleton || (shouldPreferBodySkeleton && isLegacyLoading))) ? "overflow-hidden" : allowHorizontalScroll ? "overflow-auto" : "overflow-y-auto overflow-x-hidden"} min-h-0`}
      >
        <table
          ref={bodyTableRef}
          className="table-fixed"
          style={{
            minWidth: "100%",
            width: widthsReady
              ? `${computedWidths.selection + computedWidths.data.reduce((s, w) => s + w, 0) + computedWidths.actions}px`
              : "100%",
          }}
        >
          {headerColgroup}
          {/* Body-only skeleton: reactive path (showContentsSkeleton) or legacy timer path */}
          {loadingState?.showContentsSkeleton ||
          (!loadingState &&
            (showBodyOnlySkeleton ||
              (shouldPreferBodySkeleton && isLegacyLoading))) ? (
            <TableContentsSkeleton
              columnCount={columns.length}
              rowCount={10}
              showSelection={showSelection}
              showActions={Boolean(renderActions)}
            />
          ) : (
            <tbody className="bg-white divide-y divide-gray-200">
              {pagedRows.map((row, rowIdx) => {
                const key = getRowId(row) || `row-${rowIdx}`;
                const disabled = Boolean(
                  isRowDisabled ? isRowDisabled(row) : false,
                );
                const rowUrl = getRowUrl ? getRowUrl(row) : undefined;

                const handleContextMenu = (e: React.MouseEvent) => {
                  if (rowUrl) {
                    e.preventDefault();
                    window.open(rowUrl, "_blank", "noopener,noreferrer");
                  }
                };

                return (
                  <tr
                    key={key}
                    className={`hover:bg-gray-50 cursor-pointer relative ${getRowClassName ? getRowClassName(row) : ""} ${disabled ? "opacity-60 grayscale" : ""} ${exitingIds.has(key) ? "transition-all duration-200 ease-in-out opacity-0 -translate-y-2" : ""}`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onContextMenu={handleContextMenu}
                  >
                    {showSelection ? (
                      <td
                        className={`px-4 py-4 text-center w-12 relative z-10`}
                      >
                        <input
                          aria-label={`Select row`}
                          type="checkbox"
                          checked={Boolean(
                            isRowSelected ? isRowSelected(row) : false,
                          )}
                          onClick={(e) => e.stopPropagation()}
                          onChange={
                            onToggleRow && !disabled
                              ? () => onToggleRow(row)
                              : undefined
                          }
                          disabled={disabled}
                          className={`h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                        />
                      </td>
                    ) : null}
                    {columns.map((col, i) => (
                      <td
                        key={col.key}
                        className={`py-4 ${i === 0 ? "pl-6" : "pl-5"} text-sm ${col.className ?? ""} relative`}
                      >
                        <div className="relative z-10">
                          {col.render
                            ? col.render(row)
                            : ((
                                row as Record<
                                  string,
                                  ReactNode | string | number
                                >
                              )[col.key] as ReactNode)}
                        </div>
                      </td>
                    ))}
                    {renderActions ? (
                      <td className="pl-5 pr-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
                        {renderActions(row)}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>

      {/* Empty state when there are no rows to display */}
      {renderRows.length === 0 && !(serverSide && Boolean(loading)) && (
        <div className="relative flex flex-col h-full min-h-0">
          <div
            className="flex-grow flex items-center justify-center p-12 text-center"
            aria-live="polite"
          >
            <div>
              <i className="bx bx-folder-open text-4xl text-gray-300 mb-2" />
              <p className="text-sm text-gray-600">No items found</p>
              <p className="text-xs text-gray-400">
                Try adjusting your search or filters.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer remains visible during body-only skeleton */}
      {showFooter ? (
        <TableFooter
          resultsStart={
            (effectiveCurrentPage - 1) * effectiveItemsPerPage +
            (pagedRows.length ? 1 : 0)
          }
          resultsEnd={
            (effectiveCurrentPage - 1) * effectiveItemsPerPage +
            pagedRows.length
          }
          resultsTotal={totalForPaging}
          currentPage={effectiveCurrentPage}
          pageCount={pageCount}
          onPrev={
            effectiveCurrentPage > 1
              ? serverSide
                ? props.onPageChange
                  ? () => props.onPageChange!(effectiveCurrentPage - 1)
                  : undefined
                : () => setCurrentPage(effectiveCurrentPage - 1)
              : undefined
          }
          onNext={
            effectiveCurrentPage < pageCount
              ? serverSide
                ? props.onPageChange
                  ? () => props.onPageChange!(effectiveCurrentPage + 1)
                  : undefined
                : () => setCurrentPage(effectiveCurrentPage + 1)
              : undefined
          }
          onPageChange={
            serverSide
              ? props.onPageChange
                ? (p) => props.onPageChange!(p)
                : undefined
              : (p) => setCurrentPage(p)
          }
          itemsPerPage={effectiveItemsPerPage}
          onItemsPerPageChange={
            serverSide
              ? props.onItemsPerPageChange
                ? (v) => {
                    props.onItemsPerPageChange!(v);
                    if (props.onPageChange) props.onPageChange(1);
                  }
                : () => {}
              : (v) => {
                  setItemsPerPage(v);
                  setCurrentPage(1);
                }
          }
          itemsPerPageSelectId="data-table-items-per-page"
          showResultsSummary={showFooterResultsSummary}
          showItemsPerPage={showFooterItemsPerPage}
        />
      ) : null}
    </div>
  );
}
