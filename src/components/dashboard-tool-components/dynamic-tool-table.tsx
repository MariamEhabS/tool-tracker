import React, { useState, useEffect } from "react";
import { logProcoreError } from "@/utils/rollbar";
import { useDispatch, useSelector } from "react-redux";
import { setSelectedTool } from "../../store/slices/appSlice";
import { chooseFolder, goBack } from "../../store/slices/folderRecurseSlice";
import { GoBackIcon } from "../../assets/icons/GoBackIcon";
import { ThreeDotIcon } from "../../assets/icons/ThreeDotIcon";
import { getToolColumns } from "./tool-table-data";
import { Document, File, QRCodeAggregate } from "../../types";
import {
  clearFilters,
  toggleGroupActions,
  useFilteredAndSortedData,
} from "../../utils/helpers/tableHelpers";
import { SearchIcon } from "../../assets/icons/SearchIcon";
import { TilesIcon } from "../../assets/icons/TilesIcon";
import { TrashCanIcon } from "../../assets/icons/TrashCanIcon";
import { SortIcon } from "../../assets/icons/SortIcon";
import { FolderOutlineIcon } from "../../assets/icons/FolderOutlineIcon";
import { FileOutlineIcon } from "../../assets/icons/FileOutlineIcon";
import { formatFileSize } from "../../utils/formatFileSize";
import { getFolders } from "../../api/endpoints/tools";
import { axiosInstance } from "../../api";
import { RootState } from "../../store";
import toast from "react-hot-toast";

export type FolderItem = {
  _id?: string;
  id?: string | number;
  procoreItemID?: string | number;
  folderName?: string;
  name?: string;
  // `files` may be Document objects (Taliho local / nested fetch) or ids (QR aggregate shape)
  files?: Array<Document | string | unknown>;
  folders?: FolderItem[];
  subfolders?: string[];
  qrcode?: string;
  project?: string;
  // `linkedFiles` may vary between endpoints; keep wide to match runtime.
  linkedFiles?: Array<Document | File | unknown>;
  linkedFolders?: FolderItem[];
  type?: string;
  updatedAt?: string;
  modified?: string;
  documentSize?: number;
  [key: string]: unknown;
};

type RowItem = FolderItem & Partial<Document>;

interface DynamicToolTableProps {
  selectedTool: string;
  singleLayerData: RootState["procore"];
  qrData: QRCodeAggregate;
  files?: Document[];
  folders?: FolderItem[];
  documents?: Document[];
  onFileClick?: (file: Document) => void;
  onFolderNavigate?: (folderId: string, folderName: string) => void;
  onCreateNew?: () => void;
}

export const DynamicToolTable: React.FC<DynamicToolTableProps> = ({
  selectedTool,
  singleLayerData,
  qrData,
  files = [],
  folders = [],
  documents = [],
  onFileClick,
  onFolderNavigate,
  onCreateNew,
}) => {
  const dispatch = useDispatch();
  const { breadcrumbs, childrenOf, currentLocation } = useSelector(
    (state: RootState) => state.folderRecurse,
  );
  const companyId = useSelector((state: RootState) => state.company._id);
  const projectId = useSelector((state: RootState) => state.project._id);
  const data = useSelector(
    (state: RootState) =>
      state.folderFile[selectedTool as "taliho-local" | "document"],
  );

  const [showGroupActions, setShowGroupActions] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(
    {},
  );
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: "asc" | "desc";
  }>({
    key: null,
    direction: "asc",
  });
  const [, setCurrentPage] = useState(1);
  const [, setSelectedItems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [folderLoadError, setFolderLoadError] = useState<string | null>(null);

  const isTalihoLocal = selectedTool === "taliho-local";
  const isRecursiveMode = isTalihoLocal || selectedTool === "document";

  const isKeyOf = <T extends object>(
    obj: T,
    key: PropertyKey,
  ): key is keyof T => key in obj;

  const getCurrentData = () => {
    if (!isRecursiveMode) {
      if (!selectedTool) return qrData?.documents || [];
      if (!isKeyOf(singleLayerData, selectedTool)) return [];
      const value = singleLayerData[selectedTool];
      return Array.isArray(value) ? value : [];
    }

    const currentParentId = breadcrumbs[currentLocation] || "root";
    if (currentParentId === "root") {
      const allFiles = [...(files || []), ...(documents || [])];
      const allFolders = folders || [];

      if (data && (data.folders?.length > 0 || data.files?.length > 0)) {
        return [...(data.folders || []), ...(data.files || [])];
      }
      return [...allFolders, ...allFiles];
    } else {
      const currentFolder = childrenOf[currentParentId];
      return currentFolder
        ? [...(currentFolder.folders || []), ...(currentFolder.files || [])]
        : [];
    }
  };
  const combinedData = getCurrentData().map((it) => {
    const folder = it as unknown as FolderItem;
    const isFolder = !!folder.folderName;
    const nextType = isFolder ? "folder" : "file";
    return { ...(it as Record<string, unknown>), type: nextType };
  });

  useEffect(() => {
    if (isRecursiveMode && selectedTool) {
      const allFiles = [...(files || []), ...(documents || [])];
      if (
        breadcrumbs.length === 0 ||
        (breadcrumbs.length === 1 &&
          breadcrumbs[0] === "root" &&
          (!data || (data.files?.length === 0 && data.folders?.length === 0)))
      ) {
        dispatch(
          chooseFolder({
            id: "root",
            files: allFiles,
            folders: folders || [],
            folderName: "Root",
          }),
        );
      }
    }
  }, [
    selectedTool,
    isRecursiveMode,
    breadcrumbs,
    files,
    documents,
    folders,
    dispatch,
    data,
  ]);

  const filteredData = useFilteredAndSortedData<RowItem>(
    combinedData as RowItem[],
    searchTerm,
    activeFilters,
    sortConfig,
  );

  const columns = isTalihoLocal
    ? [
        { key: "name", label: "Name", sortable: true },
        { key: "type", label: "Type", sortable: true },
        { key: "size", label: "Size", sortable: true },
        { key: "modified", label: "Modified", sortable: true },
      ]
    : getToolColumns(selectedTool);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Handle tool-specific creation flow
  const handleCreateNew = () => {
    // If parent provided a custom handler, use it
    if (onCreateNew) {
      onCreateNew();
      return;
    }

    // Default tool-specific behavior
    if (selectedTool === "document" || selectedTool === "taliho-local") {
      // For Taliho documents, show upload guidance
      toast("Use the upload button to add new files", { icon: "📁" });
    } else {
      // For Procore tools, items are created in Procore
      toast("New items for this tool are created in Procore", { icon: "🔗" });
    }
  };

  const handleFolderClick = async (folder: FolderItem) => {
    const folderId = isTalihoLocal ? folder._id : folder.id;
    if (!folderId) return; // ensure defined
    const id = String(folderId);
    const folderName =
      (isTalihoLocal ? folder.folderName : folder.name) || "Folder";

    setFolderLoadError(null);
    setIsLoading(true);
    try {
      if (!(id in childrenOf)) {
        if (selectedTool === "document") {
          const qrCodeId = "";
          const data = (await getFolders(
            qrCodeId,
            companyId,
            projectId,
            id,
          )) as { files: []; folders: [] };
          dispatch(
            chooseFolder({
              id,
              files: data.files,
              folders: data.folders,
              folderName,
            }),
          );
        } else {
          const { data } = await axiosInstance.get(
            `/folder/nested-for-mobile/${id}`,
          );
          const [{ linkedFiles, linkedFolders }] = data as {
            linkedFiles: [];
            linkedFolders: [];
          }[];
          dispatch(
            chooseFolder({
              id,
              files: linkedFiles,
              folders: linkedFolders,
              folderName,
            }),
          );
        }
      } else {
        dispatch(chooseFolder({ id, folderName }));
      }
      onFolderNavigate?.(id, folderName);
    } catch (err) {
      logProcoreError(err, "load-folder-contents", {
        folderId: id,
        folderName,
        selectedTool,
      });
      setFolderLoadError("Failed to load folder contents. Please try again.");
      toast.error("Failed to load folder contents.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileClick = (file: RowItem) => {
    if (onFileClick) {
      // RowItem is compatible with Document via intersection - pass safely
      onFileClick(file as Document);
    }
  };

  const handleBackNavigation = () => {
    dispatch(goBack());
  };

  const getCurrentBreadcrumb = () => {
    const currentParentId = breadcrumbs[currentLocation];
    if (currentParentId && currentParentId !== "root") {
      return childrenOf[currentParentId]?.folderName || "";
    }
    return "";
  };

  const canGoBack = () => {
    return isRecursiveMode && currentLocation > 0;
  };

  const renderCellContent = (column: { key: string }, item: RowItem) => {
    if (isTalihoLocal || selectedTool === "document") {
      switch (column.key) {
        case "name":
          return (
            <div className="flex items-center">
              {item.type === "folder" ? (
                <FolderOutlineIcon className="w-5 h-5 text-yellow-500 mr-2" />
              ) : (
                <FileOutlineIcon className="w-5 h-5 text-blue-500 mr-2" />
              )}
              <span>{item.folderName || item.documentName || item.name}</span>
            </div>
          );
        case "type":
          return item.type === "folder" ? "Folder" : "File";
        case "size":
          if (item.type === "folder") {
            const folderSize =
              item?.linkedFiles?.reduce<number>((acc, file) => {
                const size =
                  typeof file === "object" &&
                  file !== null &&
                  "documentSize" in file
                    ? (file as { documentSize?: unknown }).documentSize
                    : undefined;

                return acc + (typeof size === "number" ? size : 0);
              }, 0) || 0;
            return formatFileSize(folderSize);
          }
          return formatFileSize(item?.documentSize || 0);
        case "modified":
          return item.modified || item.updatedAt || "-";
        default: {
          const cell = (item as Record<string, unknown>)[column.key];
          return React.isValidElement(cell)
            ? cell
            : typeof cell === "string" || typeof cell === "number"
              ? cell
              : "-";
        }
      }
    } else {
      const cell = (item as Record<string, unknown>)[column.key];
      return React.isValidElement(cell)
        ? cell
        : typeof cell === "string" || typeof cell === "number"
          ? cell
          : "-";
    }
  };

  const handleRowClick = (item: RowItem) => {
    if (item.type === "folder") {
      handleFolderClick(item);
    } else {
      handleFileClick(item);
    }
  };

  return (
    <div>
      <div
        className={` ${!selectedTool ? "hidden" : ""} flex justify-between items-center mb-6`}
      >
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() =>
              toggleGroupActions({
                showGroupActions,
                setShowGroupActions,
                setSelectedItems: (items: Set<string>) =>
                  setSelectedItems(Array.from(items)),
              })
            }
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-inset transition duration-150 ease-in-out active:scale-95 ${
              showGroupActions
                ? "bg-yellow-50 text-yellow-700 ring-yellow-300"
                : "bg-white text-gray-700 ring-gray-300 hover:bg-gray-50"
            }`}
          >
            <TilesIcon className="w-4 h-4" />
            Group Actions
          </button>
          <button
            type="button"
            onClick={handleCreateNew}
            className="inline-flex items-center gap-2 rounded-md py-1.5 px-3 text-sm font-semibold text-white shadow-inner shadow-white/10 focus:outline-none transition duration-150 ease-in-out active:scale-95 bg-yellow-500 hover:opacity-90"
          >
            Create New
          </button>
        </div>
      </div>

      {folderLoadError && (
        <div
          role="alert"
          className={` ${!selectedTool ? "hidden" : ""} mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200`}
        >
          {folderLoadError}
        </div>
      )}

      {isRecursiveMode && canGoBack() && (
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <button
            onClick={handleBackNavigation}
            className="flex items-center gap-2 text-yellow-600 hover:underline text-sm"
            disabled={isLoading}
          >
            <GoBackIcon />
            <span>
              Back to{" "}
              {breadcrumbs[currentLocation - 1] === "root"
                ? "Root"
                : "Previous Folder"}
            </span>
          </button>
          {getCurrentBreadcrumb() && (
            <div className="mt-2 text-lg font-semibold text-gray-800">
              Current Folder: {getCurrentBreadcrumb()}
            </div>
          )}
        </div>
      )}

      <div
        className={` ${!selectedTool ? "hidden" : ""} bg-white rounded-lg shadow-sm p-4 mb-4`}
      >
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative rounded-md shadow-sm border border-gray-300">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="text-gray-600 w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-4 py-2 sm:text-sm border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                placeholder={
                  isTalihoLocal
                    ? "Search files and folders..."
                    : "Search items..."
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={() => clearFilters(setActiveFilters, setCurrentPage)}
              className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-500 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 hover:text-gray-700 gap-1"
            >
              <TrashCanIcon className="w-4 h-4" />
              <span>Clear Filters</span>
            </button>
          </div>
        </div>
      </div>

      <main className={`${selectedTool ? "" : "hidden"}`}>
        {selectedTool && (
          <button
            onClick={() => dispatch(setSelectedTool(""))}
            className="flex items-center gap-2 mb-4 text-yellow-600 hover:underline text-sm"
          >
            <GoBackIcon />
            <span>Back to all tools</span>
          </button>
        )}

        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin h-8 w-8 border-4 border-yellow-500 border-t-transparent rounded-full" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="group-actions-col hidden px-4 py-3 text-center w-12">
                  <input
                    type="checkbox"
                    className="select-all-checkbox h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key as string}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    <div className="flex items-center">
                      <span>{column.label}</span>
                      {column.sortable !== false && (
                        <button
                          onClick={() => handleSort(column.key as string)}
                          className="ml-1 p-0.5 rounded hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-300"
                        >
                          {sortConfig.key === column.key ? (
                            sortConfig.direction === "asc" ? (
                              "↑"
                            ) : (
                              "↓"
                            )
                          ) : (
                            <SortIcon className="!size-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody className="items-container bg-white divide-y divide-gray-200">
              {filteredData.length > 0 ? (
                filteredData.map((item, index) => (
                  <tr
                    key={item?.id || item?._id || index}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleRowClick(item)}
                  >
                    <td className="group-actions-col hidden px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        className="row-checkbox h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    {columns.map((column) => (
                      <td
                        key={column.key as string}
                        className="px-6 py-4 whitespace-nowrap text-sm"
                      >
                        {renderCellContent(column, item)}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div
                        className="relative inline-block text-left"
                        data-popover
                      >
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                          data-popover-trigger
                          aria-expanded="false"
                          aria-haspopup="true"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ThreeDotIcon className="!size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length + 2}
                    className="px-6 py-4 text-center text-sm text-gray-500"
                  >
                    {isRecursiveMode
                      ? "No files or folders found"
                      : "No items found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};
