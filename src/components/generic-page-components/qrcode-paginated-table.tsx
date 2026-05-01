import React, { useState, useEffect, useCallback, useMemo } from "react";
import { logQRError, logDocumentError } from "@/utils/rollbar";
import { TilesIcon } from "../../assets/icons/TilesIcon";
import { FileOutlineIcon } from "../../assets/icons/FileOutlineIcon";
import { FolderOutlineIcon } from "../../assets/icons/FolderOutlineIcon";
import { ChevRightIcon } from "../../assets/icons/ChevRightIcon";
import { ChevLeftIcon } from "../../assets/icons/ChevLeftIcon";
import { SearchIcon } from "../../assets/icons/SearchIcon";
import { TrashCanIcon } from "../../assets/icons/TrashCanIcon";
import { DownloadIcon } from "../../assets/icons/DownloadIcon";
import { EditIcon } from "../../assets/icons/EditIcon";
import { ShowEyeIcon } from "../../assets/icons/ShowEyeIcon";
import {
  formatFileSize,
  transformDataForView,
} from "../../utils/helpers/transformData";
import { SortIcon } from "../../assets/icons/SortIcon";
import { ThreeDotIcon } from "../../assets/icons/ThreeDotIcon";
import {
  Column,
  DataItem,
  ProcoreToolItem,
  ProcoreToolData,
  QRCodeAggregate,
  SelectedCategory,
} from "../../types";
import { ChevDownIcon } from "../../assets/icons/ChevDownIcon";
import { useDispatch, useSelector } from "react-redux";
import {
  selectSelectedTool,
  setSelectedTool,
} from "../../store/slices/appSlice";
import { toolsMap } from "../../utils/toolMap";
import {
  chooseFolder,
  resetRecurse,
} from "../../store/slices/folderRecurseSlice";
import {
  updateProcoreFiles,
  updateProcoreFolders,
} from "../../store/slices/folderFileSlice";
import { RootState } from "../../store";
import { updateProcore } from "../../store/slices/procoreSlice";
import { updateProject } from "../../store/slices/projectSlice";
import { DynamicToolTable } from "../dashboard-tool-components/dynamic-tool-table";
import {
  clearFilters,
  getPaginationNumbers,
  handleFilterChange,
  handleItemSelect,
  handleSelectAll,
  handleSort,
  toggleDropdown,
  toggleGroupActions,
  useFilteredAndSortedData,
} from "../../utils/helpers/tableHelpers";
import toast from "react-hot-toast";
import EditModal, { type EditField } from "@/components/modal/taliho/EditModal";
import DeleteModal from "@/components/modal/taliho/DeleteModal";
import BulkDeleteModal from "@/components/modal/taliho/BulkDeleteModal";
import {
  updateDocument,
  deleteDocument,
  deleteDocumentsBulk,
  getS3PresignedUrl,
} from "@/api/endpoints/document";
import {
  updateFolder,
  deleteFolder,
  deleteFoldersBulk,
  getFolderCascadeCount,
} from "@/api/endpoints/folder";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateQrCaches } from "@/lib/invalidateQrCaches";
import { MAX_BULK_DELETE_COUNT } from "@/api/constants";

function normalizeResponse<T>(rawResponse: unknown): T[] {
  if (Array.isArray(rawResponse)) return rawResponse as T[];
  if (rawResponse != null && typeof rawResponse === "object") {
    const obj = rawResponse as { data?: unknown; items?: unknown };
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
  }
  return [];
}

interface QrCodeTableProps {
  qrData: QRCodeAggregate;
}

export const QrCodeTable = ({ qrData }: QrCodeTableProps) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: "asc" | "desc";
  }>({ key: null, direction: "asc" });
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(
    {},
  );
  const [showGroupActions, setShowGroupActions] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>(
    {},
  );
  const selectedTool = useSelector(selectSelectedTool);
  const [, setSelectedCategory] = useState<SelectedCategory>(null);
  const [isFetching, setIsFetching] = useState(false);
  const singleLayerData = useSelector((state: RootState) => state.procore);
  const [viewType] = useState("all");
  const data = qrData ? transformDataForView(qrData, viewType) : [];

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [activeItemForEdit, setActiveItemForEdit] = useState<DataItem | null>(
    null,
  );
  const [activeItemForDelete, setActiveItemForDelete] =
    useState<DataItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [folderCascadeInfo, setFolderCascadeInfo] = useState<{
    documentCount: number;
    subfolderCount: number;
  } | null>(null);

  // Extract IDs from qrData
  const companyId = useMemo(() => qrData?.data?.company?._id || "", [qrData]);
  const projectId = useMemo(() => qrData?.data?.project?._id || "", [qrData]);

  // const procoreTools = qrData?.procoreTools;
  const folders = useMemo(() => qrData?.folders || [], [qrData?.folders]);
  const documents = useMemo(() => qrData?.documents || [], [qrData?.documents]);

  const filteredData = useFilteredAndSortedData(
    data,
    searchTerm,
    activeFilters,
    sortConfig,
  );

  const getAndSetTool = useCallback(
    async (tool: keyof typeof toolsMap) => {
      try {
        setIsFetching(true);
        setSelectedCategory(tool as keyof typeof toolsMap);
        dispatch(setSelectedTool(tool as keyof typeof toolsMap));
        dispatch(resetRecurse());
        dispatch(
          chooseFolder({
            id: "root",
            files: documents || [],
            folders: folders || [],
            folderName: "Root",
          }),
        );
        try {
          if (tool === "document") {
            const response: ProcoreToolData = (await toolsMap[tool].fetch(
              qrData?.data?._id,
              qrData?.data?.company?._id || "",
              qrData?.data?.project?._id || "",
              "",
            )) as ProcoreToolData;
            dispatch(updateProcoreFiles({ files: response.files ?? [] }));
            dispatch(updateProcoreFolders({ folders: response.folders ?? [] }));
          } else {
            if (singleLayerData[tool]?.length > 0) {
              return;
            }
            const rawResponse = await toolsMap[tool].fetch(
              qrData?.data?._id,
              qrData?.data?.company?._id || "",
              qrData?.data?.project?._id || "",
              "",
            );
            const response = normalizeResponse<ProcoreToolItem>(rawResponse);
            dispatch(updateProcore({ tool, response }));
          }
        } catch (error) {
          logQRError(error, "fetch-tool-data", qrData?.data?._id, { tool });
        } finally {
          setIsFetching(false);
        }
        if (qrData?.data?.project) {
          dispatch(updateProject(qrData.data.project));
        }
      } catch (error) {
        if ((error as { statusCode?: number })?.statusCode === 401) {
          window.location.reload();
        }
      }
    },
    [dispatch, documents, folders, qrData, singleLayerData],
  );

  const columns: Column<DataItem>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (value, item) => (
        <div className="flex items-center">
          {item.type === "Folder" && (
            <FolderOutlineIcon className="w-4 h-4 mr-2 text-blue-500" />
          )}
          {item.type === "Document" && (
            <FileOutlineIcon className="w-4 h-4 mr-2 text-green-500" />
          )}
          {item.type === "Procore Tool" && (
            <TilesIcon className="w-4 h-4 mr-2 text-orange-500" />
          )}
          <span className="font-medium">{String(value ?? "")}</span>
        </div>
      ),
    },
    {
      key: "type",
      label: "Type",
      render: (value) => {
        const typeValue = String(value ?? "");
        return (
          <span
            className={`px-2 py-1 text-xs rounded-md ${
              typeValue === "Folder"
                ? "bg-blue-100 text-blue-800"
                : typeValue === "Document"
                  ? "bg-green-100 text-green-800"
                  : "bg-orange-100 text-orange-700"
            }`}
          >
            {typeValue}
          </span>
        );
      },
    },
    {
      key: "filesCount",
      label: "Count",
      sortable: true,
      render: (value, item) => (
        <span>
          {item.type === "Folder"
            ? `${value} files`
            : item.type === "Procore Tool"
              ? `${value} items`
              : "1 file"}
        </span>
      ),
    },
    {
      key: "size",
      label: "Size",
      sortable: true,
      render: (value) => formatFileSize(Number(value) || 0),
    },
    {
      key: "lastModified",
      label: "Last Modified",
      sortable: true,
    },
  ];

  const filters = [
    {
      key: "type",
      label: "Type",
      options: [
        { value: "Folder", label: "Folders" },
        { value: "Document", label: "Documents" },
        { value: "Procore Tool", label: "Procore Tools" },
      ],
    },
  ];

  // Helper to refresh data after mutations
  const qrcodeId = qrData?.data?._id;
  const refreshData = useCallback(() => {
    if (qrcodeId) {
      void invalidateQrCaches(queryClient, qrcodeId);
    } else {
      void queryClient.invalidateQueries({ queryKey: ["Qrs"] });
    }
  }, [queryClient, qrcodeId]);

  // Action handlers
  const handleViewItem = useCallback(
    (itemId: string | number) => {
      const item = filteredData.find((d) => d.id === itemId);
      if (!item) return;
      // Open the tool view (same as clicking the row)
      getAndSetTool(item.tool as keyof typeof toolsMap);
    },
    [filteredData, getAndSetTool],
  );

  const handleEditItem = useCallback(
    (itemId: string | number) => {
      const item = filteredData.find((d) => d.id === itemId);
      if (!item) return;
      if (item.type === "Procore Tool") {
        toast.error("Procore tools cannot be edited directly");
        return;
      }
      setActiveItemForEdit(item);
      setShowEditModal(true);
    },
    [filteredData],
  );

  const handleEditConfirm = useCallback(
    async (values: Record<string, string>) => {
      if (!activeItemForEdit || !companyId || !projectId) return;

      setIsProcessing(true);
      try {
        const newName = values.name?.trim();
        if (!newName) {
          toast.error("Name cannot be empty");
          return;
        }

        if (activeItemForEdit.type === "Document") {
          await updateDocument(String(activeItemForEdit.id), {
            companyId,
            projectId,
            documentName: newName,
          });
          toast.success("Document renamed successfully");
        } else if (activeItemForEdit.type === "Folder") {
          const result = await updateFolder(String(activeItemForEdit.id), {
            companyId,
            projectId,
            folderName: newName,
          });
          if (result.success) {
            toast.success("Folder renamed successfully");
          } else {
            toast.error(result.message || "Failed to rename folder");
            return;
          }
        }

        setShowEditModal(false);
        setActiveItemForEdit(null);
        refreshData();
      } catch (error) {
        logQRError(error, "edit-item", undefined, {
          itemId: activeItemForEdit?.id,
          itemType: activeItemForEdit?.type,
        });
        toast.error("Failed to update item");
      } finally {
        setIsProcessing(false);
      }
    },
    [activeItemForEdit, companyId, projectId, refreshData],
  );

  const handleDownloadItem = useCallback(
    async (itemId: string | number) => {
      const item = filteredData.find((d) => d.id === itemId);
      if (!item) return;

      if (item.type === "Document") {
        try {
          toast.loading("Preparing download...", { id: "download" });
          const signedUrl = await getS3PresignedUrl(String(item.id), companyId);

          if (typeof signedUrl === "string" && signedUrl) {
            const link = document.createElement("a");
            link.href = signedUrl;
            link.download = String(item.name) || "document";
            link.target = "_blank";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Download started", { id: "download" });
          } else {
            toast.error("Failed to get download URL", { id: "download" });
          }
        } catch (error) {
          logDocumentError(error, "download-document", { documentId: item.id });
          toast.error("Failed to download document", { id: "download" });
        }
      } else if (item.type === "Folder") {
        // Folder ZIP download - backend endpoint not yet available
        toast.error(
          "Folder download as ZIP is not yet supported. Please download individual files.",
        );
      } else {
        toast.error("Procore tools cannot be downloaded directly");
      }
    },
    [filteredData, companyId],
  );

  const handleDeleteItem = useCallback(
    async (itemId: string | number) => {
      const item = filteredData.find((d) => d.id === itemId);
      if (!item) return;
      if (item.type === "Procore Tool") {
        toast.error("Procore tools cannot be deleted from here");
        return;
      }
      setActiveItemForDelete(item);
      setFolderCascadeInfo(null);
      setShowDeleteModal(true);

      // Fetch cascade count for folders (non-blocking — modal shows generic message until loaded)
      if (item.type === "Folder" && companyId) {
        const count = await getFolderCascadeCount(String(itemId), companyId);
        setFolderCascadeInfo(count);
      }
    },
    [filteredData, companyId],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!activeItemForDelete || !companyId) return;

    setIsProcessing(true);
    try {
      if (activeItemForDelete.type === "Document") {
        const result = await deleteDocument(
          String(activeItemForDelete.id),
          companyId,
          projectId || undefined,
        );
        if (result.success) {
          toast.success("Document deleted successfully");
        } else {
          toast.error(result.message || "Failed to delete document");
          return;
        }
      } else if (activeItemForDelete.type === "Folder") {
        const result = await deleteFolder(
          String(activeItemForDelete.id),
          companyId,
          projectId || undefined,
        );
        if (result.success) {
          toast.success("Folder deleted successfully");
        } else {
          toast.error(result.message || "Failed to delete folder");
          return;
        }
      }

      setShowDeleteModal(false);
      setActiveItemForDelete(null);
      setFolderCascadeInfo(null);
      refreshData();
    } catch (error) {
      logQRError(error, "delete-item", undefined, {
        itemId: activeItemForDelete?.id,
        itemType: activeItemForDelete?.type,
      });
      toast.error("Failed to delete item");
    } finally {
      setIsProcessing(false);
    }
  }, [activeItemForDelete, companyId, projectId, refreshData]);

  const handleBulkDelete = useCallback(
    (selectedIds: string[]) => {
      if (selectedIds.length === 0) {
        toast.error("No items selected");
        return;
      }
      // Filter out Procore tools from selection
      const deletableItems = selectedIds.filter((id) => {
        const item = filteredData.find((d) => d.id === id);
        return item && item.type !== "Procore Tool";
      });
      if (deletableItems.length === 0) {
        toast.error(
          "No deletable items selected (Procore tools cannot be deleted here)",
        );
        return;
      }
      if (deletableItems.length > MAX_BULK_DELETE_COUNT) {
        toast.error(
          `Cannot delete more than ${MAX_BULK_DELETE_COUNT} items at once. You selected ${deletableItems.length}. Please reduce your selection.`,
        );
        return;
      }
      if (deletableItems.length < selectedIds.length) {
        toast("Procore tools will be skipped", { icon: "ℹ️" });
      }
      setShowBulkDeleteModal(true);
    },
    [filteredData],
  );

  const handleBulkDeleteConfirm = useCallback(async () => {
    if (!companyId) return;

    const selectedArray = Array.from(selectedItems);
    // Separate documents and folders
    const documentIds: string[] = [];
    const folderIds: string[] = [];

    for (const id of selectedArray) {
      const item = filteredData.find((d) => d.id === id);
      if (!item || item.type === "Procore Tool") continue;
      if (item.type === "Document") {
        documentIds.push(String(id));
      } else if (item.type === "Folder") {
        folderIds.push(String(id));
      }
    }

    // Send all selected document IDs — backend handles duplicates from
    // folder cascade gracefully (soft-delete is idempotent).

    if (documentIds.length === 0 && folderIds.length === 0) {
      toast.error("No items to delete");
      return;
    }

    setIsProcessing(true);
    try {
      let successCount = 0;
      let failCount = 0;
      const failedIds = new Set<string>();

      // Delete selected documents
      if (documentIds.length > 0) {
        const docResult = await deleteDocumentsBulk(documentIds, companyId, {
          projectId: projectId || undefined,
        });
        if (docResult.success) {
          successCount += docResult.count ?? documentIds.length;
        } else {
          failCount += documentIds.length;
          documentIds.forEach((id) => failedIds.add(id));
          toast.error(docResult.message || "Failed to delete some documents");
        }
      }

      // Delete folders (cascade handles child documents)
      if (folderIds.length > 0) {
        const folderResult = await deleteFoldersBulk(folderIds, companyId);
        if (folderResult.success) {
          successCount += folderIds.length;
          if (folderIds.length > 0) {
            toast(
              `Documents inside the deleted folder(s) were moved to trash.`,
              { icon: "ℹ️" },
            );
          }
        } else if (folderResult.partialResult) {
          // Partial failure — some folders deleted, others failed
          successCount += folderResult.partialResult.succeeded;
          failCount += folderResult.partialResult.failed;
          folderIds.forEach((id) => failedIds.add(id));
          toast.error(folderResult.message || "Some folders failed to delete");
        } else {
          failCount += folderIds.length;
          folderIds.forEach((id) => failedIds.add(id));
          toast.error(folderResult.message || "Failed to delete some folders");
        }
      }

      if (successCount > 0 && failCount === 0) {
        toast.success(`Successfully deleted ${successCount} item(s)`);
        setSelectedItems(new Set());
        setShowGroupActions(false);
      } else if (successCount > 0 && failCount > 0) {
        toast.success(
          `Deleted ${successCount} item(s). ${failCount} item(s) failed.`,
        );
        // Keep failed items selected for easy retry
        setSelectedItems(failedIds);
      }

      setShowBulkDeleteModal(false);
      refreshData();
    } catch (error) {
      logQRError(error, "bulk-delete", undefined, {
        documentCount: documentIds.length,
        folderCount: folderIds.length,
      });
      toast.error("Failed to delete items");
    } finally {
      setIsProcessing(false);
    }
  }, [companyId, selectedItems, filteredData, refreshData, projectId]);

  const handleBulkDownload = useCallback(
    async (selectedIds: string[]) => {
      if (selectedIds.length === 0) {
        toast.error("No items selected");
        return;
      }

      // Filter to only documents (folders can't be bulk downloaded yet)
      const downloadableItems = selectedIds.filter((id) => {
        const item = filteredData.find((d) => d.id === id);
        return item && item.type === "Document";
      });

      if (downloadableItems.length === 0) {
        toast.error(
          "No downloadable documents selected. Folder ZIP download is not yet supported.",
        );
        return;
      }

      if (downloadableItems.length < selectedIds.length) {
        toast("Folders will be skipped (ZIP download not yet supported)", {
          icon: "ℹ️",
        });
      }

      // Download documents one by one (batch download endpoint not available)
      toast.loading(`Downloading ${downloadableItems.length} document(s)...`, {
        id: "bulk-download",
      });

      let successCount = 0;
      for (const id of downloadableItems) {
        try {
          const signedUrl = await getS3PresignedUrl(String(id), companyId);

          if (typeof signedUrl === "string" && signedUrl) {
            const item = filteredData.find((d) => d.id === id);
            const link = document.createElement("a");
            link.href = signedUrl;
            link.download = String(item?.name) || "document";
            link.target = "_blank";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            successCount++;
            // Small delay between downloads to prevent browser throttling
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        } catch (error) {
          logDocumentError(error, "bulk-download-item", { documentId: id });
        }
      }

      if (successCount === downloadableItems.length) {
        toast.success(`Downloaded ${successCount} document(s)`, {
          id: "bulk-download",
        });
      } else if (successCount > 0) {
        toast.success(
          `Downloaded ${successCount} of ${downloadableItems.length} document(s)`,
          { id: "bulk-download" },
        );
      } else {
        toast.error("Failed to download documents", { id: "bulk-download" });
      }
    },
    [filteredData, companyId],
  );

  // Edit modal fields
  const editFields: EditField[] = useMemo(() => {
    if (!activeItemForEdit) return [];
    const itemType = String(activeItemForEdit.type || "item");
    return [
      {
        key: "name",
        label: itemType === "Folder" ? "Folder Name" : "Document Name",
        type: "text",
        placeholder: `Enter ${itemType.toLowerCase()} name`,
        required: true,
        initialValue: String(activeItemForEdit.name || ""),
      },
    ];
  }, [activeItemForEdit]);

  // Count deletable items for bulk delete modal
  const deletableItemsCount = useMemo(() => {
    return Array.from(selectedItems).filter((id) => {
      const item = filteredData.find((d) => d.id === id);
      return item && item.type !== "Procore Tool";
    }).length;
  }, [selectedItems, filteredData]);

  // Check if any selected items are folders (for cascade warning in bulk delete modal)
  const selectedHasFolders = useMemo(() => {
    return Array.from(selectedItems).some((id) => {
      const item = filteredData.find((d) => d.id === id);
      return item?.type === "Folder";
    });
  }, [selectedItems, filteredData]);

  const actions = [
    {
      label: "View",
      icon: <ShowEyeIcon />,
      onClick: handleViewItem,
      className: "text-blue-600 hover:text-blue-800",
    },
    {
      label: "Edit",
      icon: <EditIcon className="w-4 h-4" />,
      onClick: handleEditItem,
      className: "text-gray-600 hover:text-gray-800",
    },
    {
      label: "Download",
      icon: <DownloadIcon className="w-4 h-4" />,
      onClick: handleDownloadItem,
      className: "text-green-600 hover:text-green-800",
    },
    {
      label: "Delete",
      icon: <TrashCanIcon className="w-4 h-4" />,
      onClick: handleDeleteItem,
      className: "text-red-600 hover:text-red-800",
    },
  ];

  const groupActions = [
    {
      label: "Delete Selected",
      icon: <TrashCanIcon className="w-4 h-4" />,
      onClick: handleBulkDelete,
      className: "bg-red-50 text-red-700 ring-red-300 hover:bg-red-100",
    },
    {
      label: "Download Selected",
      icon: <DownloadIcon className="w-4 h-4" />,
      onClick: handleBulkDownload,
      className: "bg-green-50 text-green-700 ring-green-300 hover:bg-green-100",
    },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdowns = document.querySelectorAll("[data-dropdown-id]");
      for (const dropdown of dropdowns) {
        if (dropdown.contains(event.target as Node)) return;
      }
      setOpenDropdowns({});
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData
    .filter((item) => item.category !== "taliho-local")
    .slice(startIndex, startIndex + itemsPerPage);

  if (!qrData) {
    return (
      <main className="flex-1 overflow-y-auto p-6">
        <div
          className="flex items-center justify-center w-full py-10"
          role="status"
          aria-live="polite"
        >
          <div className="loader" aria-hidden="true"></div>
          <span className="sr-only">Loading QR data…</span>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="h-full flex flex-col">
        <div
          className={`${selectedTool ? "hidden" : ""} flex justify-between items-center mb-6`}
        >
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() =>
                toggleGroupActions({
                  showGroupActions,
                  setShowGroupActions,
                  setSelectedItems,
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
              onClick={() => {}}
              className="inline-flex items-center gap-2 rounded-md py-1.5 px-3 text-sm font-semibold text-white shadow-inner shadow-white/10 focus:outline-none transition duration-150 ease-in-out active:scale-95 bg-yellow-500 hover:opacity-90"
            >
              Create New
            </button>
          </div>
        </div>

        <div
          className={`${selectedTool ? "hidden" : ""} bg-white rounded-lg shadow-sm p-4 mb-4`}
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
                  placeholder="Search items..."
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {filters.map((filter) => (
                <div
                  key={filter.key}
                  className="relative inline-block text-left"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDropdown(`filter-${filter.key}`, setOpenDropdowns);
                    }}
                    className="inline-flex items-center justify-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  >
                    {filter.label}

                    <ChevDownIcon className="!size-3" />
                  </button>
                  {openDropdowns[`filter-${filter.key}`] && (
                    <div className="absolute left-0 z-50 mt-2 w-48 origin-top-left rounded-md bg-white shadow-lg focus:outline-none">
                      <div className="p-2 space-y-1 ">
                        {filter.options.map((option) => (
                          <label
                            key={option.value}
                            className="flex items-center px-2 py-1 text-sm rounded hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={
                                activeFilters[filter.key]?.includes(
                                  option.value,
                                ) || false
                              }
                              onChange={(e) => {
                                handleFilterChange(
                                  filter.key,
                                  option.value,
                                  e.target.checked,
                                  setActiveFilters,
                                  setCurrentPage,
                                );
                              }}
                              className="h-4 w-4 rounded border-gray-200 text-indigo-600 focus:ring-indigo-500 mr-2"
                            />
                            <span className="text-gray-500">
                              {option.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
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

        {showGroupActions && (
          <div className="bg-gray-100 border border-gray-200 rounded-lg p-3 mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              <span>{selectedItems.size}</span> items selected
            </span>
            <div className="space-x-2">
              {groupActions.map((action, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() =>
                    action.onClick(Array.from(selectedItems as Set<string>))
                  }
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-inset transition duration-150 ease-in-out active:scale-95 ${action.className || "bg-white text-gray-700 ring-gray-300 hover:bg-gray-50"}`}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          className={` ${!selectedTool ? "" : "hidden"} bg-white rounded-lg overflow-hidden flex-grow flex flex-col`}
        >
          <div className="overflow-auto flex-grow h-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {showGroupActions && (
                    <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-center w-12">
                      <input
                        type="checkbox"
                        checked={
                          selectedItems.size === filteredData.length &&
                          filteredData.length > 0
                        }
                        onChange={(e) =>
                          handleSelectAll(
                            e.target.checked,
                            filteredData,
                            setSelectedItems,
                          )
                        }
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                  )}
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className="sticky top-0 z-10 bg-gray-50 px-6 py-5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      <div className="flex items-center">
                        <span>{column.label}</span>
                        {column.sortable !== false && (
                          <button
                            onClick={() =>
                              handleSort(column.key, sortConfig, setSortConfig)
                            }
                            className="ml-1 p-0.5 rounded hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-300"
                          >
                            <SortIcon className="!size-4" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  {actions.length > 0 && (
                    <th className="sticky top-0 z-10 bg-gray-50 px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(folders?.length || documents?.length) > 0 && (
                  <tr className="hover:bg-gray-50 cursor-pointer">
                    {showGroupActions && (
                      <td className="px-4 py-4 text-center w-12">
                        <input
                          type="checkbox"
                          disabled
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 opacity-50"
                        />
                      </td>
                    )}
                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm cursor-pointer"
                      colSpan={
                        showGroupActions ? columns.length : columns.length
                      }
                      onClick={() => {
                        dispatch(setSelectedTool("taliho-local"));
                        dispatch(resetRecurse());
                      }}
                    >
                      <div className="flex flex-row items-center gap-3">
                        <img
                          className="max-w-[20px]"
                          src="../../../../logo.png"
                        />
                        <span className="text-gray-700 font-semibold">
                          Taliho Files and Folders
                        </span>
                        {/* <span className={`font-semibold bg-yellow-200 text-black shadow-md border border-yellow-400 px-2 py-[4px] text-xs rounded-full`}>
													{folders?.length + documents?.length}
												</span> */}
                      </div>
                    </td>
                    {actions.length > 0 && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"></td>
                    )}
                  </tr>
                )}

                {paginatedData.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      getAndSetTool(item.tool as keyof typeof toolsMap);
                    }}
                  >
                    {showGroupActions && (
                      <td className="px-4 py-4 text-center w-12">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={() =>
                            handleItemSelect(
                              item.id,
                              selectedItems,
                              setSelectedItems,
                            )
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className="px-6 py-4 whitespace-nowrap text-sm"
                      >
                        {column.render
                          ? column.render(
                              item[column.key as keyof typeof item],
                              item,
                            )
                          : item[column.key as keyof typeof item]}
                      </td>
                    ))}
                    {actions.length > 0 && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div
                          className="relative inline-block text-left"
                          data-dropdown-id={`actions-${item.id}`}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDropdown(
                                `actions-${item.id}`,
                                setOpenDropdowns,
                              );
                            }}
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                          >
                            <ThreeDotIcon className="!size-4" />
                          </button>
                          {openDropdowns[`actions-${item.id}`] && (
                            <div className="absolute right-0 z-10 mt-2 w-40 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                              <div className="py-1 rounded-md overflow-hidden">
                                {actions.map((action, actionIndex) => (
                                  <button
                                    key={actionIndex}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      action.onClick(item.id);
                                      setOpenDropdowns({});
                                    }}
                                    className={`group flex items-center w-full px-4 py-2 text-sm text-left hover:bg-gray-100 ${action.className || "text-gray-700 hover:text-gray-900"}`}
                                  >
                                    <span className="mr-2">{action.icon}</span>
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  {`Showing ${startIndex + 1} to ${Math.min(startIndex + itemsPerPage, filteredData.length)} of ${filteredData.length} results`}
                </p>
              </div>
              <div className="flex-1 flex justify-center">
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevLeftIcon />
                  </button>
                  {getPaginationNumbers(currentPage, totalPages).map(
                    (page, index) => (
                      <React.Fragment key={index}>
                        {page === "..." ? (
                          <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                            ...
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              typeof page === "number" && setCurrentPage(page)
                            }
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              currentPage === page
                                ? "z-10 bg-yellow-50 border-yellow-500 text-yellow-600"
                                : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            {page}
                          </button>
                        )}
                      </React.Fragment>
                    ),
                  )}
                  <button
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={totalPages === 0 || currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevRightIcon />
                  </button>
                </nav>
              </div>
              <div className="flex items-center">
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="block w-auto pl-2 pr-2 py-1.5 text-base border border-gray-300 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm rounded-md"
                >
                  {[10, 20, 50].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-gray-700 ml-2">items</span>
              </div>
            </div>
          </div>
        </div>

        {isFetching === true ? (
          <div className="flex justify-center items-center w-full h-full">
            <div className="dashboard-loader m-0 max-auto"></div>
          </div>
        ) : (
          <DynamicToolTable
            qrData={qrData}
            singleLayerData={singleLayerData}
            selectedTool={selectedTool}
            files={documents}
            folders={folders}
          />
        )}
      </div>

      {/* Edit Modal */}
      <EditModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setActiveItemForEdit(null);
        }}
        fields={editFields}
        title={`Rename ${activeItemForEdit?.type || "Item"}`}
        subtitle={
          <span>
            Enter a new name for{" "}
            <strong>{String(activeItemForEdit?.name || "this item")}</strong>
          </span>
        }
        onConfirm={handleEditConfirm}
        confirmLabel={isProcessing ? "Saving..." : "Save"}
      />

      {/* Single Delete Modal */}
      <DeleteModal
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setActiveItemForDelete(null);
          setFolderCascadeInfo(null);
        }}
        title={`Delete ${String(activeItemForDelete?.type || "Item")}`}
        subjectLabel={String(activeItemForDelete?.type || "item").toLowerCase()}
        bodyMessage={
          activeItemForDelete?.type === "Folder"
            ? folderCascadeInfo
              ? `This will permanently delete ${folderCascadeInfo.subfolderCount > 0 ? `${folderCascadeInfo.subfolderCount} subfolder(s) and ` : ""}${folderCascadeInfo.documentCount} document(s). This action cannot be undone.`
              : "This folder and all its contents (subfolders and documents) will be deleted. This action cannot be undone."
            : activeItemForDelete?.type === "Document"
              ? "This document will be moved to trash. It can be restored within 30 days."
              : "This action cannot be undone."
        }
        onConfirm={handleDeleteConfirm}
        confirmLabel={isProcessing ? "Deleting..." : "Delete"}
      />

      {/* Bulk Delete Modal */}
      <BulkDeleteModal
        open={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        selectedCount={deletableItemsCount}
        subjectLabel="item"
        title="Delete Selected Items"
        bodyMessage={
          selectedHasFolders
            ? "Selected folders will be deleted along with all their contents (subfolders and documents). This action cannot be undone."
            : "These documents will be moved to trash. They can be restored within 30 days."
        }
        onConfirm={handleBulkDeleteConfirm}
        confirmLabel={isProcessing ? "Deleting..." : "Delete"}
      />
    </main>
  );
};
