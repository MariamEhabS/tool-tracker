/**
 * @fileoverview Hook for filtering table rows across tool, document, and Procore
 * views based on search queries and active filter selections.
 */

import { useMemo } from "react";
import type { ActiveFilters } from "@components/ui/SearchFiltersCard";

/**
 * Filters and returns table rows for whichever view is currently active
 * (tool view, document view, or Procore view). Applies text-search queries,
 * active filter selections (reference, type, doctype, status), and
 * hidden/removed ID exclusions.
 *
 * @param params - Configuration object containing view flags, table data,
 *   Procore bundles, search query, active filters, hidden/removed ID sets,
 *   and a document-type label getter
 * @returns An object containing:
 *   - `filteredRows` - Filtered rows for tool or document views
 *   - `filteredProcoreRows` - Filtered rows for the active Procore tool view
 *   - `effectiveFilteredRows` - The rows that should actually render (Procore or tool/doc)
 *   - `effectiveGetRowId` - The row-ID accessor matching the active view
 */
export function useFilteredRows(params: {
  isToolView: boolean;
  isDocsView: boolean;
  isProcoreView: boolean;
  procoreView: string | null;
  toolsTable: { rows: unknown[]; getRowId: (r: unknown) => string };
  docsTable: { rows: unknown[]; getRowId: (r: unknown) => string };
  procoreBundles: Record<
    string,
    { rows: unknown[]; getRowId: (r: unknown) => string }
  >;
  query: string;
  filters: ActiveFilters;
  hiddenIds: Set<string>;
  removedIds: Set<string>;
  getDocTypeLabel: (row: unknown) => string;
}) {
  const {
    isToolView,
    isDocsView,
    isProcoreView,
    procoreView,
    toolsTable,
    docsTable,
    procoreBundles,
    query,
    filters,
    hiddenIds,
    removedIds,
    getDocTypeLabel,
  } = params;

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (isToolView) {
      return (
        toolsTable.rows as Array<{
          id: string;
          name: string;
          reference: string;
          type?: string;
        }>
      ).filter((r) => {
        if (hiddenIds.has(r.id)) return false;
        const nameOk = !q || r.name.toLowerCase().includes(q);
        const refFilters = (filters.reference as string[] | undefined) ?? [];
        const typeFilters = (filters.type as string[] | undefined) ?? [];
        const refOk =
          refFilters.length === 0 || refFilters.includes(r.reference);
        const typ = r.type || r.name;
        const typeOk = typeFilters.length === 0 || typeFilters.includes(typ);
        return nameOk && refOk && typeOk;
      }) as unknown[];
    }
    if (isDocsView) {
      return (
        docsTable.rows as Array<{
          id?: string;
          documentName?: string;
          __isFolder?: boolean;
          documentFile?: string;
          addedLink?: boolean;
        }>
      ).filter((row) => {
        const rowId = (row as unknown as { __isFolder?: boolean; id?: string })
          .__isFolder
          ? (row as unknown as { id: string }).id
          : (row as { id?: string }).id;
        if (rowId && hiddenIds.has(rowId)) return false;
        const name = row.documentName ?? "";
        const nameOk = !q || name.toLowerCase().includes(q);
        const docTypeFilters = (filters.doctype as string[] | undefined) ?? [];
        const typeLabel = getDocTypeLabel(row);
        const typeOk =
          docTypeFilters.length === 0 || docTypeFilters.includes(typeLabel);
        return nameOk && typeOk;
      }) as unknown[];
    }
    return [];
  }, [
    toolsTable.rows,
    docsTable.rows,
    isToolView,
    isDocsView,
    query,
    filters,
    hiddenIds,
    getDocTypeLabel,
  ]);

  const filteredProcoreRows = useMemo(() => {
    if (!isProcoreView || !procoreView) return [];
    const bundle = (
      procoreBundles as Record<
        string,
        { rows: unknown[]; getRowId: (r: unknown) => string }
      >
    )[procoreView];
    if (!bundle) return [];
    const q = query.trim().toLowerCase();
    const statusFilters = (filters.status as string[] | undefined) ?? [];
    return bundle.rows.filter((row: unknown) => {
      const rid = bundle.getRowId(row);
      if (removedIds.has(rid)) return false;
      if (q) {
        const r = row as Record<string, unknown>;
        const searchableFields = [
          r.title,
          r.name,
          r.subject,
          r.number,
          r.documentName,
          r.location,
          r.assignee,
          r.company,
          r.email,
        ]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase());
        const matchesSearch = searchableFields.some((field) =>
          field.includes(q),
        );
        if (!matchesSearch) return false;
      }
      if (statusFilters.length > 0) {
        const r = row as { status?: { label?: string } };
        if (r.status?.label && !statusFilters.includes(r.status.label))
          return false;
      }
      return true;
    });
  }, [isProcoreView, procoreView, procoreBundles, query, filters, removedIds]);

  const currentGetRowId = useMemo(() => {
    return isToolView
      ? (toolsTable.getRowId as unknown as (r: unknown) => string)
      : isDocsView
        ? (docsTable.getRowId as unknown as (r: unknown) => string)
        : () => "";
  }, [isToolView, isDocsView, toolsTable.getRowId, docsTable.getRowId]);

  const effectiveFilteredRows = useMemo(() => {
    if (isProcoreView) return filteredProcoreRows;
    return filteredRows;
  }, [isProcoreView, filteredProcoreRows, filteredRows]);

  const effectiveGetRowId = useMemo(() => {
    if (isProcoreView && procoreView) {
      const bundle = (
        procoreBundles as Record<string, { getRowId: (r: unknown) => string }>
      )[procoreView];
      return bundle?.getRowId ?? currentGetRowId;
    }
    return currentGetRowId;
  }, [isProcoreView, procoreView, currentGetRowId, procoreBundles]);

  return {
    filteredRows,
    filteredProcoreRows,
    effectiveFilteredRows,
    effectiveGetRowId,
  };
}
