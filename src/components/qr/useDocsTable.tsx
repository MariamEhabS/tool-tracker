import { useMemo } from "react";
import { type Column } from "@/components/table/DataTable";
import type { QRCodeAggregate } from "@/types";

type DocRow = {
  id: string;
  name: string;
  type: string;
  dateModified: string;
  isFolder: boolean;
  isProcoreTool?: boolean;
  [key: string]: unknown;
};

type Folder = {
  _id: string;
  files: string[];
  subfolders: string[];
  folderName: string;
  qrcode: string;
  project: string;
  linkedFiles: LinkedDoc[];
};

type LinkedDoc = {
  _id?: string;
  id?: string;
  documentName?: string;
  documentFile?: string;
  updatedAt?: string;
  createdAt?: string;
};

type ProcoreToolRef = { tool?: string };

export function useDocsTable(
  qrData: QRCodeAggregate | undefined,
  activeFolderId: string | null = null,
) {
  const columns = useMemo<Column<DocRow>[]>(
    () => [
      {
        key: "name",
        header: "Name",
        sortable: true,
        columnType: "primary",
        className: "",
        headerClassName: "", // align with body cell icon (40px) + gap (12px) + default pl-6 (24px)
        getSortValue: (row) => {
          // Folders sort before files
          return `${row.isFolder ? "0" : "1"}_${row.name.toLowerCase()}`;
        },
        render: (row) => (
          <div className="flex items-center">
            {row.isFolder ? (
              <div className="flex-shrink-0 h-10 w-10 rounded-md flex items-center justify-center mr-3 bg-yellow-100">
                <i className="bx bxs-folder text-yellow-600 text-xl"></i>
              </div>
            ) : row.isProcoreTool ? (
              <div className="flex-shrink-0 h-10 w-10 rounded-md flex items-center justify-center mr-3 bg-orange-100">
                <i className="bx bx-package text-orange-600 text-xl"></i>
              </div>
            ) : (
              <div className="flex-shrink-0 h-10 w-10 rounded-md flex items-center justify-center mr-3 bg-gray-100">
                <i className={`bx ${getFileIcon(row.type)} text-xl`}></i>
              </div>
            )}
            <span className="font-medium text-gray-900">{row.name}</span>
          </div>
        ),
      },
      {
        key: "reference",
        header: "Reference",
        sortable: true,
        columnType: "status",
        className: "text-gray-500 ",
        render: (row) => {
          if (row.isFolder) {
            return (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                Taliho
              </span>
            );
          }
          if (row.isProcoreTool) {
            return (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-orange-100 text-orange-700">
                Procore
              </span>
            );
          }
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
              Taliho
            </span>
          );
        },
      },
      {
        key: "type",
        header: "Type",
        sortable: true,
        columnType: "status",
        className: "text-gray-500",

        getSortValue: (row) => {
          // Folders first, then by type
          return `${row.isFolder ? "0" : "1"}_${row.type.toLowerCase()}`;
        },
        render: (row) => {
          if (row.isFolder) {
            return (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800">
                Folder
              </span>
            );
          }
          if (row.isProcoreTool) {
            return (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-orange-100 text-orange-700">
                Procore Tool
              </span>
            );
          }
          const colorClass = getTypeColorClass(row.type);
          return (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${colorClass}`}
            >
              {row.type}
            </span>
          );
        },
      },
      {
        key: "dateModified",
        header: "Date Modified",
        sortable: true,
        columnType: "date",
        className: "text-gray-500",
        render: (row) => (
          <span className="text-sm text-gray-900">
            {row.dateModified && !row.isProcoreTool
              ? new Date(row.dateModified).toLocaleDateString()
              : "-"}
          </span>
        ),
      },
    ],
    [],
  );

  const rows = useMemo<DocRow[]>(() => {
    if (!qrData) return [];

    const allFolders = qrData.folders || [];
    const allDocuments = (qrData.documents || []) as LinkedDoc[];

    let displayFolders: Folder[] = [];
    let displayDocuments: LinkedDoc[] = [];

    if (activeFolderId) {
      // Show subfolders and files of the active folder
      const activeFolder = allFolders.find(
        (f: Folder) => f._id === activeFolderId,
      );
      if (activeFolder) {
        // Get subfolders
        displayFolders = allFolders.filter((f: Folder) =>
          activeFolder.subfolders?.includes(f._id),
        );

        // Get documents linked to this folder
        displayDocuments = activeFolder.linkedFiles || [];
      }
    } else {
      // Root level: show root folders and documents not in any folder
      const filesInFolders = new Set<string>();

      // Collect all file IDs that are in folders
      allFolders.forEach((folder: Folder) => {
        folder.linkedFiles?.forEach((file: LinkedDoc) => {
          filesInFolders.add(file._id ?? file.id ?? "");
        });
      });

      // Find root folders (those not referenced as subfolders)
      const subfolderIds = new Set<string>();
      allFolders.forEach((folder: Folder) => {
        folder.subfolders?.forEach((subfolderId: string) => {
          subfolderIds.add(subfolderId);
        });
      });

      displayFolders = allFolders.filter(
        (f: Folder) => !subfolderIds.has(f._id),
      );

      // Documents not in any folder
      displayDocuments = allDocuments.filter(
        (doc: LinkedDoc) => !filesInFolders.has(doc._id ?? doc.id ?? ""),
      );
    }

    const folders = displayFolders.map((folder: Folder) => ({
      id: folder._id,
      name: folder.folderName || "Untitled Folder",
      type: "Folder",
      dateModified: "",
      isFolder: true,
    }));

    const documents = displayDocuments.map((doc: LinkedDoc) => ({
      id: String(doc._id ?? doc.id ?? ""), // ensure string
      name: doc.documentName || "Untitled Document",
      type: getFileType(doc.documentFile || ""),
      dateModified: doc.updatedAt || doc.createdAt || "", // ensure string
      isFolder: false,
    }));

    // Only show Procore tools at root level
    const procoreTools = !activeFolderId
      ? ((qrData.procoreTools || []) as ProcoreToolRef[]).map(
          (tool, index: number) => {
            const toolName = tool.tool || "unknown";
            const formattedName = toolName
              .split("-")
              .map(
                (word: string) => word.charAt(0).toUpperCase() + word.slice(1),
              )
              .join(" ");

            return {
              id: `procore-tool-${index}`,
              name: `${formattedName}`,
              type: "Procore Tool",
              dateModified: "",
              isFolder: false,
              isProcoreTool: true,
            };
          },
        )
      : [];

    return [...folders, ...documents, ...procoreTools];
  }, [qrData, activeFolderId]);

  const getRowId = (row: DocRow) => row.id;

  // Build folder trail for breadcrumbs
  const folderTrail = useMemo(() => {
    if (!activeFolderId || !qrData)
      return [] as Array<{ id: string; label: string }>;

    const allFolders = qrData.folders || [];
    const trail: Array<{ id: string; label: string }> = [];
    const visited = new Set<string>();

    // Build trail from current folder back to root
    const buildTrail = (folderId: string) => {
      if (visited.has(folderId)) return; // Prevent infinite loops
      visited.add(folderId);

      const folder = allFolders.find((f: Folder) => f._id === folderId);
      if (!folder) return;

      trail.unshift({ id: folder._id, label: folder.folderName || "Folder" });

      // Find parent folder (folder that has this folder in its subfolders)
      const parentFolder = allFolders.find((f: Folder) =>
        f.subfolders?.includes(folderId),
      );

      if (parentFolder) {
        buildTrail(parentFolder._id);
      }
    };

    buildTrail(activeFolderId);
    return trail;
  }, [activeFolderId, qrData]);

  return {
    columns,
    rows,
    getRowId,
    folderTrail,
  };
}

function getFileType(fileName: string): string {
  if (!fileName) return "FILE";
  const ext = fileName.split(".").pop()?.toUpperCase();
  if (!ext) return fileName.startsWith("http") ? "URL" : "FILE";
  return [
    "PDF",
    "DOCX",
    "XLSX",
    "PNG",
    "JPG",
    "JPEG",
    "TXT",
    "ZIP",
    "MP4",
    "MOV",
    "CSV",
  ].includes(ext)
    ? ext === "JPEG"
      ? "JPG"
      : ext
    : "FILE";
}

function getFileIcon(type: string): string {
  const icons: Record<string, string> = {
    PDF: "bxs-file-pdf text-red-600",
    DOCX: "bxs-file-doc text-blue-600",
    XLSX: "bxs-file text-green-600",
    CSV: "bxs-file text-green-600",
    PNG: "bxs-file-image text-green-600",
    JPG: "bxs-file-image text-green-600",
    MP4: "bxs-videos text-purple-600",
    MOV: "bxs-videos text-purple-600",
    TXT: "bxs-file-txt text-gray-600",
    ZIP: "bxs-file-archive text-amber-600",
    URL: "bx-link text-indigo-600",
  };
  return icons[type] || "bx-file text-gray-600";
}

function getTypeColorClass(type: string): string {
  const colors: Record<string, string> = {
    PDF: "bg-red-100 text-red-700",
    DOCX: "bg-blue-100 text-blue-700",
    XLSX: "bg-green-100 text-green-700",
    CSV: "bg-green-100 text-green-700",
    PNG: "bg-teal-100 text-teal-700",
    JPG: "bg-teal-100 text-teal-700",
    ZIP: "bg-amber-100 text-amber-700",
    URL: "bg-indigo-100 text-indigo-700",
    TXT: "bg-gray-100 text-gray-700",
  };
  return colors[type] || "bg-gray-100 text-gray-700";
}
