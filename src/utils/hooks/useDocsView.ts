/**
 * @fileoverview Hook for building the Taliho documents table view, including
 * document-type filter options and the folder breadcrumb trail.
 */

import { useMemo } from "react";
import { getTalihoDocumentsTable } from "@components/table/taliho/TalihoDocumentsTable";
import { getDocTypeLabel } from "@lib/files";
import type { QRCodeAggregate } from "@/types";

type Handlers = {
  onEdit: (id: string) => void;
  onUpload: (id: string) => void;
  onMove: (id: string) => void;
  onDelete: (id: string) => void;
  onPreview: (row: unknown) => void;
};

/**
 * Constructs the Taliho documents table configuration, derives the unique
 * document-type filter options, and builds the folder breadcrumb trail for
 * the active folder.
 *
 * @param params - Configuration object
 * @param params.id - The QR code ID
 * @param params.aggregate - The full QR code aggregate data (documents, folders, etc.)
 * @param params.activeFolderId - The currently-selected folder ID, or `null` for the root
 * @param params.handlers - Callback handlers for edit, upload, move, delete, and preview actions
 * @returns An object containing:
 *   - `docsTable` - The table configuration (columns, rows, getRowId)
 *   - `docsTypeOptions` - Sorted unique document-type labels for filter dropdowns
 *   - `folderTrail` - Breadcrumb array of `{ id, label }` from root to the active folder
 */
export function useDocsView(params: {
  id: string;
  aggregate: QRCodeAggregate | undefined;
  activeFolderId: string | null;
  handlers: Handlers;
}) {
  const {
    // id,
    aggregate,
    activeFolderId,
    handlers,
  } = params;

  const docsTable = useMemo(
    () =>
      getTalihoDocumentsTable({
        aggregate: aggregate as QRCodeAggregate,
        qrType: aggregate?.data?.type,
        activeFolderId,
        onEdit: handlers.onEdit,
        onUpload: handlers.onUpload,
        onMove: handlers.onMove,
        onDelete: handlers.onDelete,
        onPreview: handlers.onPreview,
      }),
    [aggregate, activeFolderId, handlers],
  );

  const docsTypeOptions = useMemo<string[]>(() => {
    const labels = (docsTable.rows as unknown[]).map((row: unknown) =>
      getDocTypeLabel(
        row as {
          __isFolder?: boolean;
          documentFile?: string;
          addedLink?: boolean;
        },
      ),
    );
    const unique = Array.from(new Set(labels));
    return unique.sort((a, b) => {
      if (a === "Folder" && b !== "Folder") return -1;
      if (b === "Folder" && a !== "Folder") return 1;
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
  }, [docsTable.rows]);

  const folderTrail = useMemo(() => {
    if (!activeFolderId) return [] as Array<{ id: string; label: string }>;
    const folders = aggregate?.folders ?? [];
    const byId = new Map<
      string,
      { _id: string; folderName: string; parentFolder?: string | null }
    >();
    folders.forEach((f) =>
      byId.set(f._id, {
        _id: f._id,
        folderName: f.folderName,
        parentFolder: (f as unknown as { parentFolder?: string | null })
          .parentFolder,
      }),
    );
    const trail: Array<{ id: string; label: string }> = [];
    let cur = byId.get(activeFolderId);
    const guard = new Set<string>();
    while (cur && !guard.has(cur._id)) {
      trail.unshift({ id: cur._id, label: cur.folderName || "Folder" });
      guard.add(cur._id);
      const parentId = cur.parentFolder;
      if (!parentId) break;
      cur = byId.get(parentId);
    }
    return trail;
  }, [activeFolderId, aggregate]);

  return { docsTable, docsTypeOptions, folderTrail };
}
