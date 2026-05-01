import type { ReactNode } from "react";
import { type Column } from "@components/table/DataTable";
import { col, statusBadgeCell, numberCell, dateCell } from "@lib/columns";
import { formatBytes } from "@lib/format";
import { getDocTypeLabel } from "@/lib/files";
import ItemComboBox, {
  type ItemComboBoxOption,
} from "@components/combobox/detail/ItemComboBox";
import type { QRCodeAggregate, Document as TalihoDoc } from "@/types";

export type TalihoDocumentsTableOptions = {
  aggregate: QRCodeAggregate;
  qrType?: string;
  activeFolderId?: string | null;
  onEdit?: (id: string) => void;
  onUpload?: (id: string) => void;
  onMove?: (id: string) => void;
  onDelete?: (id: string) => void;
  onPreview?: (row: TalihoFolderContentsRow) => void;
};

export type TalihoFolderContentsRow = {
  id: string;
  documentName: string;
  documentFile: string;
  documentSize: number;
  originalFileName: string;
  source: "Taliho" | "URL";
  createdAt?: string;
  updatedAt?: string;
  qrcode?: string;
  arrangement?: string;
  project?: string;
  addedLink?: boolean;
  __isFolder?: true;
};

export function getTalihoDocumentsTable(opts: TalihoDocumentsTableOptions): {
  columns: Column<TalihoFolderContentsRow>[];
  rows: unknown[];
  getRowId: (row: unknown) => string;
  renderActions?: (row: unknown) => ReactNode;
} {
  const { aggregate, activeFolderId } = opts;
  // formatters moved to @lib/format

  // date formatting handled by shared dateCell

  const columns: Column<TalihoFolderContentsRow>[] = [
    col<TalihoFolderContentsRow>({
      key: "documentName",
      header: "Name",
      sortable: true,
      columnType: "primary",
      className: "",
      getSortValue: (row: TalihoFolderContentsRow) => {
        const isFolder =
          Boolean((row as unknown as { __isFolder?: boolean }).__isFolder) ||
          row.documentFile === "Folder";
        const name = String(row.documentName || "");
        return `${isFolder ? "0" : "1"}_${name.toLowerCase()}`;
      },
      render: (row: TalihoFolderContentsRow) => {
        const isFolder =
          Boolean((row as unknown as { __isFolder?: boolean }).__isFolder) ||
          row.documentFile === "Folder";
        const isLink = Boolean(row.addedLink);
        const f = row.documentFile || "";
        const ext = isLink
          ? "URL"
          : f.startsWith("http") && !/\.[a-zA-Z0-9]+$/.test(f)
            ? "URL"
            : (f.split(".").pop() || "").toUpperCase();
        const icon = isFolder
          ? "bxs-folder text-yellow-600"
          : ext === "URL"
            ? "bx-link text-indigo-600"
            : ext === "PDF"
              ? "bxs-file-pdf text-red-600"
              : ext === "DOCX"
                ? "bxs-file-doc text-blue-600"
                : ext === "XLSX" || ext === "CSV"
                  ? "bxs-file text-green-600"
                  : ext === "PNG" || ext === "JPG"
                    ? "bxs-file-image text-green-600"
                    : ext === "MP4" || ext === "MOV"
                      ? "bxs-videos text-purple-600"
                      : ext === "TXT"
                        ? "bxs-file-txt text-gray-600"
                        : ext === "ZIP"
                          ? "bxs-file-archive text-amber-600"
                          : "bx-file text-gray-600";
        const bgClass = isFolder ? "bg-yellow-100" : "bg-gray-100";
        return (
          <div className="flex items-center">
            <div
              className={`flex-shrink-0 h-10 w-10 rounded-md flex items-center justify-center mr-3 ${bgClass}`}
            >
              <i className={`bx ${icon} text-xl`}></i>
            </div>
            <span className="font-medium text-gray-900">
              {row.documentName}
            </span>
          </div>
        );
      },
    }),
    // col<TalihoFolderContentsRow>({ key: 'originalFileName', header: 'Reference', sortable: true, ...statusBadgeCell<TalihoFolderContentsRow>((row) => {
    //   const isFolder = Boolean((row as unknown as { __isFolder?: boolean }).__isFolder) || ((row as TalihoFolderContentsRow).documentFile === 'Folder')
    //   return isFolder ? 'Taliho' : ((row as TalihoFolderContentsRow).originalFileName ?? '')
    // }) }),
    col<TalihoFolderContentsRow>({
      key: "documentFile",
      header: "Type",
      sortable: true,
      // maxPercent: 18.5,
      getSortValue: (row) => {
        const isFolder =
          Boolean((row as unknown as { __isFolder?: boolean }).__isFolder) ||
          (row as TalihoFolderContentsRow).documentFile === "Folder";
        if (isFolder)
          return `0_${String((row as TalihoFolderContentsRow).documentName || "").toLowerCase()}`;
        const label = getDocTypeLabel(
          row as unknown as {
            __isFolder?: boolean;
            documentFile?: string;
            addedLink?: boolean;
          },
        );
        return `1_${String(label).toLowerCase()}`;
      },
      ...statusBadgeCell<TalihoFolderContentsRow>((row) => {
        const isFolder =
          Boolean((row as unknown as { __isFolder?: boolean }).__isFolder) ||
          (row as TalihoFolderContentsRow).documentFile === "Folder";
        if (isFolder) return "Folder";
        const isLink = Boolean(row.addedLink);
        if (isLink) {
          return { label: "URL", className: "bg-indigo-100 text-indigo-700" };
        }
        const t = String((row as TalihoFolderContentsRow).documentFile ?? "");
        const ext =
          t.startsWith("http") && !/\.[a-zA-Z0-9]+$/.test(t)
            ? "URL"
            : (t.split(".").pop() || "").toUpperCase();
        const label = [
          "PDF",
          "DOCX",
          "XLSX",
          "PNG",
          "JPG",
          "TXT",
          "ZIP",
          "CSV",
        ].includes(ext)
          ? ext
          : ext === "JPEG"
            ? "JPG"
            : t.startsWith("http")
              ? "URL"
              : "FILE";
        const colorClass =
          label === "PDF"
            ? "bg-red-100 text-red-700"
            : label === "DOCX"
              ? "bg-blue-100 text-blue-700"
              : label === "XLSX" || label === "CSV"
                ? "bg-green-100 text-green-700"
                : label === "JPG" || label === "PNG"
                  ? "bg-teal-100 text-teal-700"
                  : label === "ZIP"
                    ? "bg-amber-100 text-amber-700"
                    : label === "URL"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-gray-100 text-gray-700";
        return { label, className: colorClass };
      }),
    }),
    col<TalihoFolderContentsRow>({
      key: "documentSize",
      header: "Size",
      sortable: true,
      ...numberCell<TalihoFolderContentsRow>((row) => {
        const isFolder =
          Boolean((row as unknown as { __isFolder?: boolean }).__isFolder) ||
          (row as TalihoFolderContentsRow).documentFile === "Folder";
        if (isFolder) return "-";
        return formatBytes((row as TalihoFolderContentsRow).documentSize);
      }),
    }),
    col<TalihoFolderContentsRow>({
      key: "updatedAt",
      header: "Date Modified",
      sortable: true,
      ...dateCell<TalihoFolderContentsRow>((row) => {
        const isFolder =
          Boolean((row as unknown as { __isFolder?: boolean }).__isFolder) ||
          (row as TalihoFolderContentsRow).documentFile === "Folder";
        const value = isFolder
          ? (row as unknown as { updatedAt?: string }).updatedAt
          : (row as TalihoFolderContentsRow).updatedAt;
        return value;
      }),
    }),
  ];

  function toFolderRow(f: {
    _id: string;
    folderName: string;
    createdAt?: string;
    updatedAt?: string;
    qrcode?: string;
    arrangement?: string;
    project?: string;
  }): TalihoFolderContentsRow & { __isFolder: true } {
    return {
      id: f._id,
      documentName: f.folderName,
      documentFile: "Folder",
      documentSize: 0,
      originalFileName: f.folderName,
      source: "Taliho",
      createdAt: f?.createdAt,
      updatedAt: f?.updatedAt,
      qrcode: f?.qrcode,
      arrangement: (f as unknown as { arrangement?: string }).arrangement,
      project: (f as unknown as { project?: string }).project,
      __isFolder: true,
    };
  }

  let rows: unknown[] = [];
  if (activeFolderId) {
    const folders = aggregate?.folders ?? [];
    const active = folders.find((f) => f._id === activeFolderId);
    const subIds = new Set<string>(active?.subfolders ?? []);
    const childFolders = folders.filter((f) => subIds.has(f._id));
    const fileRows = ((active?.linkedFiles ?? []) as TalihoDoc[]).map((d) => ({
      id: d._id,
      documentName: d.documentName,
      documentFile: d.documentFile,
      documentSize: d.documentSize,
      originalFileName: d.documentName,
      source: "Taliho" as const,
      createdAt: d.createdAt,
      updatedAt:
        (d as unknown as { updatedAt?: string }).updatedAt ?? d.createdAt,
      qrcode: d.qrcode,
      arrangement: (d as unknown as { arrangement?: string }).arrangement,
      project: d.project,
      addedLink: (d as unknown as { addedLink?: boolean }).addedLink,
    }));
    rows = [...childFolders.map(toFolderRow), ...fileRows] as unknown[];
  } else {
    const folders = aggregate?.folders ?? [];
    const documents = (aggregate?.documents ?? []) as TalihoDoc[];
    const subIds = new Set<string>();
    folders.forEach((f) => f.subfolders?.forEach((id) => subIds.add(id)));
    const roots = folders.filter((f) => !subIds.has(f._id));

    const inFolderDocIds = new Set<string>();
    folders.forEach((f) =>
      f.linkedFiles?.forEach((d: TalihoDoc) => inFolderDocIds.add(d._id)),
    );
    const looseDocs = documents
      .filter((d) => !inFolderDocIds.has(d._id))
      .map((d) => ({
        id: d._id,
        documentName: d.documentName,
        documentFile: d.documentFile,
        documentSize: d.documentSize,
        originalFileName: d.documentName,
        source: "Taliho" as const,
        createdAt: d.createdAt,
        updatedAt:
          (d as unknown as { updatedAt?: string }).updatedAt ?? d.createdAt,
        qrcode: d.qrcode,
        arrangement: (d as unknown as { arrangement?: string }).arrangement,
        project: d.project,
        addedLink: (d as unknown as { addedLink?: boolean }).addedLink,
      }));

    rows = [...roots.map(toFolderRow), ...looseDocs] as unknown[];
  }

  const renderActions = (row: unknown) => {
    const rowId = (row as unknown as { __isFolder?: boolean; id?: string })
      .__isFolder
      ? (row as unknown as { id: string }).id
      : (row as TalihoFolderContentsRow).id;
    const isFolder = Boolean(
      (row as unknown as { __isFolder?: boolean }).__isFolder,
    );

    const options: ItemComboBoxOption[] = [];

    if (opts.onEdit) {
      options.push({
        label: "Edit",
        value: "edit",
        iconClass: "bx bx-edit",
        onSelect: () => opts.onEdit!(rowId),
      });
    }

    if (opts.onUpload && isFolder) {
      options.push({
        label: "Upload",
        value: "upload",
        iconClass: "bx bx-upload",
        onSelect: () => opts.onUpload!(rowId),
      });
    }

    if (opts.onMove && !isFolder) {
      const hasFolders = (aggregate?.folders?.length ?? 0) > 0;
      options.push({
        label: "Move to Folder",
        value: "move",
        iconClass: "bx bx-folder",
        onSelect: () => opts.onMove!(rowId),
        disabled: !hasFolders,
      });
    }

    if (opts.onDelete) {
      options.push({
        label: "Delete",
        value: "delete",
        iconClass: "bx bx-trash",
        onSelect: () => opts.onDelete!(rowId),
      });
    }

    if (options.length === 0) return null;

    return (
      <div
        className="relative inline-block text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <ItemComboBox options={options} id={`docs-actions-${rowId}`} />
      </div>
    );
  };

  return {
    columns,
    rows,
    getRowId: (row: unknown) =>
      (row as unknown as { __isFolder?: boolean; id?: string }).__isFolder
        ? (row as unknown as { id: string }).id
        : (row as TalihoFolderContentsRow).id,
    renderActions,
  };
}
