import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useDebounce } from "@/utils/helpers/tableHelpers";
import type { QrCodesListResponse } from "../types";

/**
 * Manages search, filter, sort, and pagination state for the My QR Codes page,
 * syncing state to and from URL query parameters.
 */
export function useQRCodeSearch() {
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/my-qrcodes" }) as
    | {
        q?: string;
        types?: string;
        groups?: string;
        projects?: string;
        sortKey?: string;
        sortDir?: "asc" | "desc";
        page?: string | number;
        perPage?: string | number;
      }
    | undefined;

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [query, setQuery] = useState("");
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [groupFilters, setGroupFilters] = useState<string[]>([]);
  const [projectFilters, setProjectFilters] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupMode, setGroupMode] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  // Server-side sort state
  const [sortKey, setSortKey] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const initFromSearchRef = useRef<boolean>(false);

  // Initialize state from query params once (on first mount)
  useEffect(() => {
    if (initFromSearchRef.current) return;
    initFromSearchRef.current = true;
    const s = searchParams || {};
    if (typeof s.q === "string") setQuery(s.q);
    if (typeof s.types === "string" && s.types.length > 0)
      setTypeFilters(s.types.split(",").filter(Boolean));
    if (typeof s.groups === "string" && s.groups.length > 0)
      setGroupFilters(s.groups.split(",").filter(Boolean));
    if (typeof s.projects === "string" && s.projects.length > 0)
      setProjectFilters(s.projects.split(",").filter(Boolean));
    if (typeof s.sortKey === "string" && s.sortKey) setSortKey(s.sortKey);
    if (s.sortDir === "asc" || s.sortDir === "desc") setSortDir(s.sortDir);
    if (s.page && !Number.isNaN(Number(s.page))) setCurrentPage(Number(s.page));
    if (s.perPage && !Number.isNaN(Number(s.perPage)))
      setItemsPerPage(Number(s.perPage));
  }, [searchParams]);

  // Persist state to query params on changes
  useEffect(() => {
    const next: Record<string, string> = {};
    if (query) next.q = query;
    if (typeFilters.length) next.types = typeFilters.join(",");
    if (groupFilters.length) next.groups = groupFilters.join(",");
    if (projectFilters.length) next.projects = projectFilters.join(",");
    if (sortKey) next.sortKey = sortKey;
    if (sortDir) next.sortDir = sortDir;
    if (currentPage && currentPage !== 1) next.page = String(currentPage);
    if (itemsPerPage && itemsPerPage !== 10)
      next.perPage = String(itemsPerPage);
    navigate({ to: "/my-qrcodes", search: next, replace: true });
  }, [
    query,
    typeFilters,
    groupFilters,
    projectFilters,
    sortKey,
    sortDir,
    currentPage,
    itemsPerPage,
    navigate,
  ]);

  // Map UI filter values to backend type values and send to backend
  // "procore-drawings" UI value maps to "procore-drawing-codes" type
  const serverGroupingTypes = useMemo(() => {
    if (groupFilters.length === 0) return undefined;
    return groupFilters.map((v) =>
      v === "procore-drawings" ? "procore-drawing-codes" : v,
    );
  }, [groupFilters]);

  // Legacy single groupingType for backwards compatibility
  // Only used when exactly one type is selected
  const serverGroupingType = useMemo(() => {
    // If multiple filters selected, use groupingTypes array instead
    if (groupFilters.length !== 1) return undefined;
    const filter = groupFilters[0];
    // Map procore-drawings to procore-drawing-codes
    if (filter === "procore-drawings") return "procore-drawing-codes";
    return filter as "equipment" | "arrangement" | "none";
  }, [groupFilters]);

  // Server query term (frozen during local search)
  const [serverQuery, setServerQuery] = useState<string | undefined>(
    debouncedQuery || undefined,
  );
  // Track the query when local mode was determined to prevent local filtering after edits (e.g., backspace)
  const localModeQueryRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    setServerQuery(debouncedQuery || undefined);
  }, [debouncedQuery]);

  // Compute project status filter: include archived when searching without explicit filter
  const computedProjectStatus = useMemo(() => {
    // If user explicitly selected project status filters, use those
    if (projectFilters.length) {
      return projectFilters;
    }
    // If searching without explicit filters, include all statuses to find QR codes from archived projects
    if (debouncedQuery && debouncedQuery.trim()) {
      return ["active", "completed", "on-hold", "archived", "unassigned"];
    }
    // No search, no filters: exclude archived but include unassigned
    return ["active", "completed", "on-hold", "unassigned"];
  }, [projectFilters, debouncedQuery]);

  return {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    query,
    setQuery,
    typeFilters,
    setTypeFilters,
    groupFilters,
    setGroupFilters,
    projectFilters,
    setProjectFilters,
    selectedIds,
    setSelectedIds,
    groupMode,
    setGroupMode,
    debouncedQuery,
    sortKey,
    setSortKey,
    sortDir,
    setSortDir,
    serverGroupingTypes,
    serverGroupingType,
    serverQuery,
    localModeQueryRef,
    computedProjectStatus,
  };
}

/**
 * Computes whether the current page of results should use local (client-side) search.
 * This is true when the entire dataset fits in one page (no next/prev pages).
 */
export function useLocalSearchMode(
  qrCodesData: QrCodesListResponse | undefined,
  currentPage: number,
  itemsPerPage: number,
) {
  return useMemo(() => {
    const meta = qrCodesData;
    const total = Number(meta?.total_items ?? 0);
    const hasNext = Boolean(meta?.has_next);
    const hasPrev = Boolean(meta?.has_prev);
    return (
      currentPage === 1 &&
      !hasPrev &&
      !hasNext &&
      total > 0 &&
      total <= itemsPerPage
    );
  }, [qrCodesData, currentPage, itemsPerPage]);
}
