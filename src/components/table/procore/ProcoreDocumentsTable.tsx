import type { ReactNode } from "react";
import { type Column } from "@components/table/DataTable";
import { col, secondaryCell, statusBadgeCell, dateCell } from "@lib/columns";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@components/combobox/detail/ItemComboBox";
import { formatDate, formatBytes } from "@lib/format";
import {
  asString,
  asRecord,
  asDateLike,
  asNumber,
  getArray,
} from "@lib/coerce";
import { ProcoreToolData } from "@/types";
// import { ProcoreDocumentsMockData } from '@/api/mockdata/procoreData'
// import { ProcoreItemsMockData, QRCodesMockData } from '@/api/mockdata/talihoData'

export type DocumentRow = {
  id: string;
  kind: "folder" | "file";
  name: string;
  revision: string;
  typeLabel: string;
  typeClass: string;
  size: string;
  modified: string;
  icon: ReactNode;
  /** Optional direct download URL or version URL from Procore (for preview/open) */
  procoreUrl?: string;
  /** Underlying Procore file id (numeric) */
  procoreId?: number | string;
  /** Marker used by parent views to detect folder rows */
  __isFolder?: boolean;
  /** Underlying numeric Procore folder id when this row represents a folder */
  folderId?: number;
};

interface FolderNode {
  id: number;
  folders?: FolderNode[];
  name?: string;
}

export function getProcoreDocumentsTable(opts?: {
  qrId?: string;
  data?: ProcoreToolData;
  activeFolderId?: number | null;
  onAction?: (id: string, action: "hide" | "remove" | "show") => void;
  onRemove?: (id: string) => void;
  onShow?: (id: string) => void;
  onPreview?: (row: DocumentRow) => void;
  hiddenIds?: Set<string>;
  shownIds?: Set<string>;
  actionMode?: "hide-show" | "remove";
}): {
  columns: Column<DocumentRow>[];
  rows: DocumentRow[];
  getRowId: (r: DocumentRow) => string;
  folderTrail: Array<{ id: number; label: string }>;
  renderActions?: (row: DocumentRow) => ReactNode;
} {
  const activeFolderId = opts?.activeFolderId ?? null;

  function findFolderById(
    node: FolderNode | null,
    id: number,
  ): FolderNode | null {
    if (!node) return null;
    if (node.id === id) return node;
    const children = Array.isArray(node.folders) ? node.folders : [];
    for (const f of children) {
      const hit = findFolderById(f, id);
      if (hit) return hit;
    }
    return null;
  }

  // Build folder trail for breadcrumbs from a single root
  function buildFolderTrail(
    root: unknown,
    folderId: number | null,
  ): Array<{ id: number; label: string }> {
    if (folderId === null || !root) return [];
    const trail: Array<{ id: number; label: string }> = [];

    // const folder = findFolderById(ProcoreDocumentsMockData, folderId)
    // if (!folder) return []

    // let current: typeof ProcoreDocumentsMockData | null = folder
    // const visited = new Set<number>()

    // while (current && current.id !== ProcoreDocumentsMockData.id && !visited.has(current.id)) {
    //   trail.unshift({ id: current.id, label: current.name })
    //   visited.add(current.id)
    //   if (current.parent_id === null) break
    //   current = findFolderById(ProcoreDocumentsMockData, current.parent_id)
    // }

    //TODO will need this when working on breadcrumbs
    // const path: FolderNode[] = [];
    function dfs(
      node: FolderNode | null,
      target: number,
      stack: FolderNode[],
    ): boolean {
      if (!node) return false;
      if (node.id === target) {
        stack.push(node);
        return true;
      }
      const kids: FolderNode[] = Array.isArray(node.folders)
        ? node.folders
        : [];
      for (const k of kids) {
        stack.push(node);
        if (dfs(k, target, stack)) return true;
        stack.pop();
      }
      return false;
    }
    const acc: FolderNode[] = [];
    dfs(root as FolderNode, folderId, acc);
    const chain = acc.filter((x) => typeof x?.id === "number");
    for (const n of chain) trail.push({ id: n.id, label: n.name ?? "" });
    return trail;
  }

  // const folderTrail = buildFolderTrail(activeFolderId)
  // // Prefer real data tree from opts.data if present; else use mock root
  // const root = (opts?.data && typeof opts.data === 'object') ? (opts.data as typeof ProcoreDocumentsMockData) : ProcoreDocumentsMockData
  // const current = (typeof activeFolderId === 'number' ? findFolderById(root as any, activeFolderId) : root) || root
  // let folders = (current as any).folders.map((f: any) => ({

  const folderTrail = buildFolderTrail(opts?.data, activeFolderId);

  // Prefer real data tree from opts.data; default to empty structure
  type DocumentsRoot = FolderNode & { files?: Record<string, unknown>[] };
  const root: DocumentsRoot =
    opts?.data && typeof opts.data === "object"
      ? (opts.data as unknown as DocumentsRoot)
      : { id: 0, folders: [], files: [] };
  const current: DocumentsRoot =
    (typeof activeFolderId === "number"
      ? (findFolderById(root, activeFolderId) as DocumentsRoot)
      : root) || root;

  const folders = (current.folders || []).map((f) => {
    const fRec = f as unknown as Record<string, unknown>;
    const updatedIso = asDateLike(fRec.updated_at);
    return {
      id: String(f.id),
      kind: "folder" as const,
      name: asString(f.name, ""),
      revision: "-",
      typeLabel: "Folder",
      typeClass: "bg-yellow-100 text-yellow-800",
      size: "-",
      modified: updatedIso ? formatDate(updatedIso) : "—",
      icon: <i className="bx bxs-folder text-yellow-600 text-xl"></i>,
      __isFolder: true as const,
      folderId: f.id,
    };
  });
  // let files = (current).files.map((file) => ({
  const files = (current.files || []).map((file) => {
    // Extract file extension from name as fallback
    const fileName = asString(file.name, "");
    const extensionMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
    const extensionFromName = extensionMatch
      ? extensionMatch[1].toUpperCase()
      : "";

    // Normalize common extensions (JPEG -> JPG)
    const normalizeExtension = (ext: string) => {
      if (ext === "JPEG") return "JPG";
      return ext;
    };

    // Use file extension for icon/color determination (not file_type which may be human-readable like "Adobe Acrobat PDF")
    const extensionForMatching = normalizeExtension(extensionFromName);

    // Use file_type for display label if available, fallback to extension
    const displayType =
      asString(file.file_type, "") || extensionFromName || "FILE";

    // Determine icon and type class based on file EXTENSION
    let icon: ReactNode;
    let typeClass: string;

    switch (extensionForMatching) {
      case "PDF":
        icon = <i className="bx bxs-file-pdf text-red-600 text-xl" />;
        typeClass = "bg-red-100 text-red-700";
        break;
      case "DOC":
      case "DOCX":
        icon = <i className="bx bxs-file-doc text-blue-600 text-xl" />;
        typeClass = "bg-blue-100 text-blue-700";
        break;
      case "PPT":
      case "PPTX":
        icon = <i className="bx bxs-file text-orange-600 text-xl" />;
        typeClass = "bg-orange-100 text-orange-700";
        break;
      case "JPG":
      case "JPEG":
      case "PNG":
      case "GIF":
      case "WEBP":
        icon = <i className="bx bxs-file-image text-green-600 text-xl" />;
        typeClass = "bg-green-100 text-green-700";
        break;
      case "XLS":
      case "XLSX":
      case "CSV":
        icon = <i className="bx bxs-file text-green-600 text-xl" />;
        typeClass = "bg-green-100 text-green-700";
        break;
      case "MP4":
      case "MOV":
        icon = <i className="bx bx-movie-play text-purple-600 text-xl" />;
        typeClass = "bg-purple-100 text-purple-700";
        break;
      case "ZIP":
      case "RAR":
      case "7Z":
        icon = <i className="bx bxs-archive text-yellow-600 text-xl" />;
        typeClass = "bg-yellow-100 text-yellow-700";
        break;
      case "TXT":
        icon = <i className="bx bxs-file-txt text-gray-600 text-xl" />;
        typeClass = "bg-gray-100 text-gray-700";
        break;
      case "URL":
        icon = <i className="bx bx-link-external text-indigo-600 text-xl" />;
        typeClass = "bg-indigo-100 text-indigo-700";
        break;
      default:
        icon = <i className="bx bx-file text-gray-600 text-xl" />;
        typeClass = "bg-gray-100 text-gray-700";
    }

    const fileVersions = getArray(file, "file_versions");
    const firstVersion = asRecord(fileVersions[0]);
    const modifiedIso = asDateLike(file.updated_at);
    return {
      id: asString(file.id, ""),
      kind: "file" as const,
      name: fileName,
      revision: asString(firstVersion?.number, "-"),
      typeLabel: displayType,
      typeClass,
      size: formatBytes(asNumber(file.size, 0)),
      modified: modifiedIso ? formatDate(modifiedIso) : "—",
      icon,
      procoreUrl: asString(firstVersion?.url, ""),
      procoreId: file.id != null ? (file.id as string | number) : undefined,
    };
  });

  // If used from QRCode page: show full list for procore-tool/Documents;
  // for folder QR, filter to only items explicitly linked in ProcoreItemsMockData (Documents)

  // if (opts?.qrId) {
  //   const qr = QRCodesMockData.find(q => q.id === opts.qrId)
  //   const isDocumentsProcoreTool = qr?.type === 'procore-tool' && qr?.procoreCategory === 'Documents'
  //   if (!isDocumentsProcoreTool && (qr?.type === 'folder' || qr?.type === 'procore-location')) {
  //     const allowed = new Set(
  //       ProcoreItemsMockData
  //         .filter(i => i.qrcode === opts.qrId && i.procoreToolName === 'Documents')
  //         .map(i => String(i.procoreItemID))
  //     )
  //     files = files.filter((r: { id: string }) => allowed.has(String(r.id).replace(/^file-/, '')))
  //     // Only keep folders that have a matching ProcoreItem
  //     folders = folders.filter((fol) => allowed.has(String(fol.folderId)))
  //   }
  // }
  // Backend returns the appropriate set; no extra filtering needed here.

  const rows: DocumentRow[] = [...folders, ...files];

  const columns: Column<DocumentRow>[] = [
    col<DocumentRow>({
      key: "name",
      header: "Name",
      sortable: true,
      getSortValue: (row) => {
        const isFolder =
          Boolean((row as DocumentRow).__isFolder) ||
          (row as DocumentRow).kind === "folder";
        const name = String((row as DocumentRow).name || "");
        return `${isFolder ? "0" : "1"}_${name.toLowerCase()}`;
      },
      ...secondaryCell<DocumentRow>((row) => {
        // Compute hidden from either local hiddenIds or ProcoreItemsMockData (for procore-tool QRs),
        // but allow explicit user override via shownIds
        // const normalizedId = row.id.startsWith('folder-') ? row.id.slice(7) : (row.id.startsWith('file-') ? row.id.slice(5) : row.id)
        // const proItem = ProcoreItemsMockData.find(i => i.qrcode === opts?.qrId && i.procoreToolName === 'Documents' && (String(i.procoreItemID) === normalizedId || String(i.procoreItemID) === row.id)) as (undefined | { hidden?: boolean })
        // const shownOverride = opts?.shownIds?.has(row.id) ?? false
        // const proHidden = (proItem?.hidden === true) && !shownOverride
        // const isHidden = proHidden || (opts?.hiddenIds?.has(row.id) ?? false)
        const isHidden =
          opts?.actionMode !== "remove" &&
          (opts?.hiddenIds?.has(row.id) ?? false);
        const isFolder = row.__isFolder || row.kind === "folder";
        // Use yellow background for folders to match Taliho Documents styling
        const containerBg = isHidden
          ? "bg-red-100"
          : isFolder
            ? "bg-yellow-100"
            : "bg-gray-100";
        return (
          <div className="flex items-center">
            <div
              className={`flex-shrink-0 h-10 w-10 ${containerBg} rounded-md flex items-center justify-center mr-3`}
            >
              {isHidden ? (
                <i className="bx bx-hide text-red-600 text-xl"></i>
              ) : (
                row.icon
              )}
            </div>
            <span className="font-medium text-gray-900">{row.name}</span>
          </div>
        );
      }),
    }),
    col<DocumentRow>({
      key: "typeLabel",
      header: "Type",
      sortable: true,
      columnType: "status",
      getSortValue: (row) => {
        const isFolder =
          Boolean((row as DocumentRow).__isFolder) ||
          (row as DocumentRow).kind === "folder" ||
          (row as DocumentRow).typeLabel === "Folder";
        if (isFolder)
          return `0_${String((row as DocumentRow).name || "").toLowerCase()}`;
        const type = String((row as DocumentRow).typeLabel || "Unknown");
        return `1_${type.toLowerCase()}`;
      },
      ...statusBadgeCell<DocumentRow>((row) => ({
        label: row.typeLabel ?? "Unknown",
        className: row.typeClass ?? "bg-gray-50 text-gray-700",
      })),
    }),
    col<DocumentRow>({
      key: "modified",
      header: "Date Modified",
      sortable: true,
      columnType: "date",
      ...dateCell<DocumentRow>((row) => row.modified),
    }),
  ];

  const renderActions =
    opts?.onRemove || opts?.onShow || opts?.onAction
      ? (row: DocumentRow) => {
          const isHidden = opts?.hiddenIds?.has(row.id) ?? false;
          const options: ItemComboBoxOption[] = [];

          // const qrType = (QRCodesMockData.find(q => q.id === opts?.qrId)?.type || '').toLowerCase()
          // const normalizedId = row.id.startsWith('folder-') ? row.id.slice(7) : (row.id.startsWith('file-') ? row.id.slice(5) : row.id)
          // const proItem = ProcoreItemsMockData.find(i => i.qrcode === opts?.qrId && i.procoreToolName === 'Documents' && (String(i.procoreItemID) === normalizedId || String(i.procoreItemID) === row.id)) as (undefined | { hidden?: boolean })
          // const shownOverride = opts?.shownIds?.has(row.id) ?? false
          // const proHidden = (proItem?.hidden === true) && !shownOverride

          // if ((qrType === 'folder' || qrType === 'procore-location') && proItem) {
          //   if (proHidden) {
          //     options.push({ label: 'Show', value: 'show', iconClass: 'bx bx-show', onSelect: () => {
          //       if (opts?.onAction) return opts.onAction(row.id, 'show')
          //       if (opts?.onShow) return opts.onShow(row.id)
          //     } })
          //   } else {
          //     options.push({ label: 'Remove', value: 'remove', iconClass: 'bx bx-x', onSelect: () => {
          //       if (opts?.onAction) return opts.onAction(row.id, 'remove')
          //       if (opts?.onRemove) return opts.onRemove(row.id)
          //     } })
          //   }
          // } else if (qrType === 'procore-tool' && proItem) {
          //   if (proHidden) {
          //     options.push({ label: 'Show', value: 'show', iconClass: 'bx bx-show', onSelect: () => {
          //       if (opts?.onAction) return opts.onAction(row.id, 'show')
          //       if (opts?.onShow) return opts.onShow(row.id)
          //     } })
          //   } else {
          //     options.push({ label: 'Hide', value: 'hide', iconClass: 'bx bx-hide', onSelect: () => {
          //       if (opts?.onAction) return opts.onAction(row.id, 'hide')
          //       if (opts?.onRemove) return opts.onRemove(row.id)
          //     } })
          //   }
          // } else {
          //   if (isHidden && opts?.onShow) {
          //     options.push({ label: 'Show', value: 'show', iconClass: 'bx bx-show', onSelect: () => {
          //       if (opts?.onAction) return opts.onAction(row.id, 'show')
          //       return opts.onShow!(row.id)
          //     } })
          //   } else if (!isHidden && opts?.onRemove) {
          //     options.push({ label: 'Hide', value: 'hide', iconClass: 'bx bx-hide', onSelect: () => {
          //       if (opts?.onAction) return opts.onAction(row.id, 'hide')
          //       return opts.onRemove!(row.id)
          //     } })
          //   }
          // }

          if (opts?.actionMode === "remove") {
            // Always show "Remove" in remove mode regardless of hidden state
            options.push({
              label: "Remove",
              value: "remove",
              iconClass: "bx bx-x",
              onSelect: () => {
                if (opts?.onAction) return opts.onAction(row.id, "remove");
                return opts?.onRemove?.(row.id);
              },
            });
          } else if (isHidden && (opts?.onShow || opts?.onAction)) {
            options.push({
              label: "Show",
              value: "show",
              iconClass: "bx bx-show",
              onSelect: () => {
                if (opts?.onAction) return opts.onAction(row.id, "show");
                return opts?.onShow?.(row.id);
              },
            });
          } else if (!isHidden && (opts?.onRemove || opts?.onAction)) {
            // In this branch, actionMode is "hide-show" or undefined (not "remove")
            // so we always show "Hide" action
            options.push({
              label: "Hide",
              value: "hide",
              iconClass: "bx bx-hide",
              onSelect: () => {
                if (opts?.onAction) return opts.onAction(row.id, "hide");
                return opts?.onRemove?.(row.id);
              },
            });
          }
          if (options.length === 0) return null;
          return (
            <div
              className="relative inline-block text-left"
              onClick={(e) => e.stopPropagation()}
            >
              {/* <ItemComboBox options={options} sourceId={`procore-docs-actions-${row.id}`} /> */}
              <ItemComboBox options={options} />
            </div>
          );
        }
      : undefined;

  return {
    columns,
    rows,
    getRowId: (r: DocumentRow) => r.id,
    folderTrail,
    renderActions,
  };
}
