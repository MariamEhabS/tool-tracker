import {
  useQRImageSignedUrl,
  useSingleQRCode,
  fetchSignedUrl,
  updateQRCodeDetails,
  deleteSingleQRCode,
  bulkAssignQRCodesToGroup,
  bulkAssignQRCodesToProject,
} from "@/api/endpoints/qr-codes";
import { logQRError, logDocumentError, logProcoreError } from "@/utils/rollbar";
import { getStoredUser } from "@/utils/getStoredUser";
import { useQRCodeModals } from "@/components/qrcode/hooks/useQRCodeModals";
import { useQRCodePreviews } from "@/components/qrcode/hooks/useQRCodePreviews";
import { useQRCodeDocuments } from "@/components/qrcode/hooks/useQRCodeDocuments";
import { useQRCodeSelection } from "@/components/qrcode/hooks/useQRCodeSelection";
import { getToolTitle } from "@/components/qrcode/utils";
import { useScannedQR } from "@/api/endpoints/scanned-qr";
import { invalidateQrCaches } from "@/lib/invalidateQrCaches";
import { useQrProcoreTools } from "@/api/endpoints/qr-procore-tools";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import TableSkeleton from "@/components/loader/TableSkeleton";
import Modal from "@/components/modal/Modal";
import DeleteModal from "@/components/modal/taliho/DeleteModal";
import DownloadModal from "@/components/modal/taliho/DownloadModal";
import EditModal from "@/components/modal/taliho/EditModal";
import SetPasswordModal from "@/components/modal/taliho/SetPasswordModal";
import TalihoItemModalMap from "@/components/modal/taliho/TalihoItemModalMap";
import { type FolderOption } from "@/components/modal/taliho/MoveModal";
import QrBreadcrumbs from "@/components/qr/QrBreadcrumbs";
import QrBicView from "@/components/qr/QrBicView";
import QrDocsTable from "@/components/qr/QrDocsTable";
import QrToolsTable from "@/components/qr/QrToolsTable";
import QrFilters from "@/components/qr/QrFilters";
import QrHeaderActions from "@/components/qr/QrHeaderActions";
import QrInfoCard from "@/components/qr/QrInfoCard";
import BulkActionsBar from "@/components/table/BulkActionsBar";
import { getToolTypeTable } from "@/components/table/taliho/ToolTypeTable";
import Button from "@/components/ui/Button";
import {
  computeTypeBadge,
  computeGroupingBadge,
  computeProjectBadge,
} from "@/lib/badges";
import { mapFileTypeToPreviewAsset } from "@/lib/filePreviews";
import { getDocTypeLabel, normalizeExtensionLabel } from "@/lib/files";
import { useDocsView } from "@/utils/hooks/useDocsView";
import { useFilePreview } from "@/utils/hooks/useFilePreview";
import { useFilteredRows } from "@/utils/hooks/useFilteredRows";
import { useQrTypes } from "@/utils/hooks/useQrTypes";
import { useSearchAndFilters } from "@/utils/hooks/useSearchAndFilters";
import { useSelectionState } from "@/utils/hooks/useSelectionState";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import BallInCourtModal from "@/components/modal/taliho/BallInCourtModal";
import BicTradeDetailModal from "@/components/modal/taliho/BicTradeDetailModal";
import { useWorkflowsByQrCode } from "@/api/endpoints/ball-in-court";
import {
  useSingleGroup,
  useListGroups,
  createGroup,
} from "@/api/endpoints/groups";
import { useSingleProject, useListProjects } from "@/api/endpoints/projects";
import { useCompany } from "@/api/endpoints/company";
import AssignToModal from "@/components/modal/taliho/AssignToModal";
import CreateProjectModal from "@/components/modal/taliho/CreateProjectModal";
import PrintItemsModal from "@/components/modal/taliho/PrintItemsModal";
import QrProcoreTable from "@/components/qr/QrProcoreTable";
import type { Bundle } from "@/components/qr/QrProcoreTable";
// Use per-tool table column builders to keep column headers consistent with legacy tables
import { getProcoreCoordinationIssuesTable } from "@/components/table/procore/ProcoreCoordinationIssuesTable";
import { getProcoreRFIsTable } from "@/components/table/procore/ProcoreRFIsTable";
import { getProcoreInspectionsTable } from "@/components/table/procore/ProcoreInspectionsTable";
import { getProcorePunchListTable } from "@/components/table/procore/ProcorePunchListTable";
import { getProcoreDrawingsTable } from "@/components/table/procore/ProcoreDrawingsTable";
import { getProcoreDocumentsTable } from "@/components/table/procore/ProcoreDocumentsTable";
import { getProcoreIncidentsTable } from "@/components/table/procore/ProcoreIncidentsTable";
import { getProcoreDirectoryTable } from "@/components/table/procore/ProcoreDirectoryTable";
import { getProcoreFormsTable } from "@/components/table/procore/ProcoreFormsTable";
import { getProcoreInstructionsTable } from "@/components/table/procore/ProcoreInstructionsTable";
import { getProcoreObservationsTable } from "@/components/table/procore/ProcoreObservationsTable";
import { getProcorePhotosTable } from "@/components/table/procore/ProcorePhotosTable";
import { getProcoreSpecificationsTable } from "@/components/table/procore/ProcoreSpecificationsTable";
import { getProcoreSubmittalsTable } from "@/components/table/procore/ProcoreSubmittalsTable";
import { getProcoreTasksTable } from "@/components/table/procore/ProcoreTasksTable";
import { toolsMapTitles, backendEnumToToolKey } from "@/utils/toolMap";
import { useProcoreToolData } from "@/utils/hooks/useProcoreToolData";
import { createTableLoadingState } from "@/utils/hooks/useTableLoadingState";
import { Project, QRCodeAggregate, ProcoreToolData } from "@/types";
import { resolveQRCodeTypeFromFields } from "@/utils/icon-color-map";
// Used inside useMemo callback
import {
  toggleVisibilitySingleProcoreItem,
  deleteSingleProcoreItem,
  toggleVisibilityBulkProcoreItems,
} from "@/api/endpoints/procore-item";
import { getFolders } from "@/api/endpoints/tools";
import {
  getS3PresignedUrl,
  updateDocument,
  moveDocument,
  moveDocumentsBulk,
  deleteDocument,
  deleteDocumentsBulk,
} from "@/api/endpoints/document";
import { MAX_BULK_DELETE_COUNT } from "@/api/constants";
import {
  createFolder,
  updateFolder,
  deleteFolder,
  deleteFoldersBulk,
} from "@/api/endpoints/folder";
import { buildFolderTree, findDocumentFolder } from "@/utils/buildFolderTree";
import UploadModal, {
  type UploadItem as ModalUploadItem,
} from "@/components/modal/taliho/UploadModal";
import QrFilePreviewModal from "@/components/modal/taliho/QrFilePreviewModal";
import ProcoreItemDetailModal from "@/components/modal/procore/ProcoreItemDetailModal";
import { PdfOpener } from "@/components/pdf-opener";
import { useNavigate } from "@tanstack/react-router";
import { useUploadQueue } from "@/components/upload/UploadQueueProvider";
import { canDelete } from "@/utils/permissions";
import RecentlyDeletedDocuments from "@/components/secondary-page-components/recently-deleted-documents";

export const Route = createFileRoute("/qrcode/$qrcodeId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { qrcodeId: id } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { enqueueUrlAdds, enqueueFileGroupUploadSmart } = useUploadQueue();
  const user = getStoredUser();
  const userCanDelete = canDelete(user);

  const {
    data: qrRow,
    isLoading: qrLoading,
    isError: qrIsError,
  } = useSingleQRCode(id);
  const { data: qrData, isFetching: qrDataFetching } = useScannedQR(id);
  const { data: qrProcoreToolsData, isFetching: qrProcoreToolsFetching } =
    useQrProcoreTools(id);

  // Debug: log when dedicated procore tools data loads
  useEffect(() => {
    if (qrProcoreToolsData) {
      console.log("[QR Procore Tools] Loaded:", {
        qrCodeId: id,
        toolCount: qrProcoreToolsData.procoreTools?.length ?? 0,
        qrType: qrProcoreToolsData.qrType,
        procoreCategory: qrProcoreToolsData.procoreCategory,
        tools: qrProcoreToolsData.procoreTools?.map((t) => t.tool),
      });
    }
  }, [qrProcoreToolsData, id]);

  // Fetch group details (legacy types + unified groups) via Groups API
  const groupingIdForQr = useMemo(
    () =>
      String(
        (qrRow?.data?.groupingId as unknown as string | undefined) ||
          (qrRow?.data?.arrangement as unknown as string | undefined) ||
          (qrRow?.data?.equipment as unknown as string | undefined) ||
          "",
      ),
    [qrRow?.data?.groupingId, qrRow?.data?.arrangement, qrRow?.data?.equipment],
  );
  const groupRes = useSingleGroup(groupingIdForQr || "");

  // Extract raw ObjectId strings from potentially populated company/project objects
  const companyIdFromQr = useMemo(() => {
    const rawCompany = qrRow?.data?.company;
    const fromQrRow =
      (rawCompany as unknown as { _id?: string })?._id ??
      (rawCompany as unknown as string | undefined) ??
      "";

    // Fallback to qrData (scanned QR aggregate) if qrRow doesn't have it
    const fromQrDataTop = qrData?.company?._id ?? "";
    const fromQrDataNested = qrData?.data?.company?._id ?? "";

    const extracted = fromQrRow || fromQrDataTop || fromQrDataNested || "";
    return String(extracted);
  }, [qrRow?.data, qrData?.company?._id, qrData?.data?.company?._id]);

  const projectIdFromQr = useMemo(() => {
    const rawProject = qrRow?.data?.project;
    const fromQrRow =
      (rawProject as unknown as { _id?: string })?._id ??
      (rawProject as unknown as string | undefined) ??
      "";

    // Fallback to qrData (scanned QR aggregate) if qrRow doesn't have it
    const fromQrDataTop = qrData?.project?._id ?? "";
    const fromQrDataNested = qrData?.data?.project?._id ?? "";

    const extracted = fromQrRow || fromQrDataTop || fromQrDataNested || "";
    return String(extracted);
  }, [qrRow?.data, qrData?.project?._id, qrData?.data?.project?._id]);

  const { data: projectData } = useSingleProject(
    companyIdFromQr,
    projectIdFromQr,
  );
  const companyRes = useCompany(companyIdFromQr);

  // Data for assign modals - only fetch when needed (QR is unassigned)
  const { data: groupsData } = useListGroups({
    companyId: companyIdFromQr,
    projectId: projectIdFromQr,
  });
  const { data: projectsData } = useListProjects({
    companyId: companyIdFromQr,
    perPage: 100,
  });

  // Use dedicated procore-tools endpoint as PRIMARY source, scanned QR as fallback.
  // Prefer the dedicated endpoint only when it has actual content; an empty array
  // from stale React Query cache must NOT block fresh data arriving from qrData.
  const procoreItems =
    Array.isArray(qrProcoreToolsData?.procoreTools) &&
    qrProcoreToolsData.procoreTools.length > 0
      ? qrProcoreToolsData.procoreTools
      : qrData?.procoreTools;
  const roots = qrData?.folders || [];
  const docs = qrData?.documents || [];
  const folderNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const folder of qrData?.folders || []) {
      map.set(folder._id, folder.folderName || "Untitled Folder");
    }
    return map;
  }, [qrData?.folders]);
  const documentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of qrData?.documents || []) {
      map.set(doc._id, doc.documentName || "Untitled Document");
    }
    for (const folder of qrData?.folders || []) {
      for (const linked of folder.linkedFiles || []) {
        if (!map.has(linked._id)) {
          map.set(linked._id, linked.documentName || "Untitled Document");
        }
      }
    }
    return map;
  }, [qrData?.documents, qrData?.folders]);

  // Build hierarchical folder options for MoveModal (depth-first ordered tree)
  const folderOptions: FolderOption[] = useMemo(
    () => buildFolderTree(qrData?.folders || []),
    [qrData?.folders],
  );

  const hasS3Image = Boolean(
    qrRow?.data?.qrImageUrl || qrData?.data?.qrImageUrl,
  );
  const { data: signedImageUrl } = useQRImageSignedUrl(id, hasS3Image);
  const project = projectData?.data as Partial<Project>;

  // Check if the project is archived - used to show special state for Procore tables
  const isProjectArchived = useMemo(() => {
    if (!project) return false;
    return (
      project.archived === true ||
      project.projectStatus?.toLowerCase() === "archived"
    );
  }, [project]);

  // Decide which main table to show:
  // - If the QR has more than one associated tool (Procore tools + Taliho docs), show ToolType table
  // - If only one associated tool type, and it's not procore-tool/location/drawing, show TalihoDocuments table
  // - If it's procore-tool/location/drawing types, we may show something else later (placeholder for now)
  // const procoreItems = useMemo(() => ProcoreItemsMockData.filter(i => i.qrcode === id), [id])
  const hasTalihoDocs = useMemo(() => {
    // Check if there are actual Taliho documents or folders (not just empty arrays).
    // Previously `docs || roots` was always truthy because empty arrays [] are truthy in JS.
    return (
      (Array.isArray(docs) && docs.length > 0) ||
      (Array.isArray(roots) && roots.length > 0)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, docs, roots]);
  const procoreToolNames = useMemo(
    () =>
      Array.from(
        new Set(
          (procoreItems || [])
            .map((i: { tool?: string }) => i?.tool)
            .filter((t): t is string => Boolean(t)),
        ),
      ),
    [procoreItems],
  );

  // Resolve the QR code type from raw fields, handling legacy QR codes
  // that have procoreConnect/procoreCategory but no explicit type set.
  // Mirrors the backend aggregation pipeline's $switch logic.
  const effectiveQrType = resolveQRCodeTypeFromFields({
    type:
      qrRow?.data?.type ||
      qrProcoreToolsData?.qrType ||
      qrData?.data?.type ||
      undefined,
    procoreConnect: qrRow?.data?.procoreConnect,
    procoreCategory:
      (qrRow?.data?.procoreCategory as string | undefined) ||
      qrProcoreToolsData?.procoreCategory ||
      undefined,
    qrcodeType: qrRow?.data?.qrcodeType,
  });
  const {
    isProcoreLocationType,
    isProcoreToolType,
    isProcoreDrawingCodeType,
    isProcoreSpecialType,
  } = useQrTypes(effectiveQrType);

  // --- Custom hooks for organized state management ---
  const modalsState = useQRCodeModals();
  const {
    showEditModal,
    setShowEditModal,
    showPasswordModal,
    setShowPasswordModal,
    showDownloadModal,
    setShowDownloadModal,
    showPrintModal,
    setShowPrintModal,
    showShareModal,
    setShowShareModal,
    showDeleteModal,
    setShowDeleteModal,
    isDeleting,
    setIsDeleting,
    showUploadModal,
    setShowUploadModal,
    showDocEditModal,
    setShowDocEditModal,
    showDocUploadModal,
    setShowDocUploadModal,
    showDocMoveModal,
    setShowDocMoveModal,
    showDocDeleteModal,
    setShowDocDeleteModal,
    showBulkUploadModal,
    setShowBulkUploadModal,
    showBulkMoveModal,
    setShowBulkMoveModal,
    showBulkDeleteModal,
    setShowBulkDeleteModal,
    showBulkDocDeleteModal,
    setShowBulkDocDeleteModal,
    showHideRemoveModal,
    setShowHideRemoveModal,
    showBulkHideRemoveModal,
    setShowBulkHideRemoveModal,
    showConvertNoticeModal,
    setShowConvertNoticeModal,
    showRecentlyDeletedModal,
    setShowRecentlyDeletedModal,
    showAssignToProjectModal,
    setShowAssignToProjectModal,
    showAssignToGroupModal,
    setShowAssignToGroupModal,
    showCreateProjectModal,
    setShowCreateProjectModal,
    pendingProjectName,
    setPendingProjectName,
    isAssigning,
    setIsAssigning,
    pendingAddAction,
    setPendingAddAction,
    pendingRemoveItemId,
    setPendingRemoveItemId,
  } = modalsState;

  const [bicModalOpen, setBicModalOpen] = useState(false);
  const [bicView, setBicView] = useState(false);
  const [selectedBicWorkflowId, setSelectedBicWorkflowId] = useState<string | null>(null);
  const [bicModalWorkflowId, setBicModalWorkflowId] = useState<string | null>(null);
  const [bicModalTradeIndex, setBicModalTradeIndex] = useState<number | null>(null);
  const { data: bicWorkflows } = useWorkflowsByQrCode(
    companyRes.data?.procoreIntegration === true && !!project?.procoreProjectID ? id : undefined,
  );


  const selectionState = useQRCodeSelection();
  const {
    bulkActions,
    setbulkActions,
    hiddenIds,
    setHiddenIds,
    removingIds,
    setRemovingIds,
    removedIds,
    setRemovedIds,
    localHiddenIds,
    setLocalHiddenIds,
    fadingIds,
    setFadingIds,
    localShownIds,
    setLocalShownIds,
  } = selectionState;

  const documentsState = useQRCodeDocuments();
  const {
    activeDocId,
    setActiveDocId,
    activeFolderId,
    setActiveFolderId,
    forceDocsView,
    setForceDocsView,
    activeProcoreFolderId,
    setActiveProcoreFolderId,
    currentFolderData,
    setCurrentFolderData,
    currentFolderHiddenIds,
    setCurrentFolderHiddenIds,
    loadingFolderId,
    setLoadingFolderId,
    procoreFolderTrailState,
    setProcoreFolderTrailState,
    procoreView,
    setProcoreView,
  } = documentsState;

  // selected will be managed by useSelectionState once rows are computed
  // selection managed by useSelectionState

  const { query, setQuery, filters, setFilters, clearAll } =
    useSearchAndFilters();
  // Determine the parent folder of the actively-selected document (for single-move validation)
  const activeDocParentFolderId = useMemo(() => {
    if (!activeDocId || !qrData?.folders) return null;
    return findDocumentFolder(qrData.folders, activeDocId);
  }, [activeDocId, qrData?.folders]);
  const activeItemIsFolder = useMemo(
    () => Boolean(activeDocId && folderNameById.has(activeDocId)),
    [activeDocId, folderNameById],
  );
  const activeItemName = useMemo(() => {
    if (!activeDocId) return "";
    if (folderNameById.has(activeDocId)) {
      return folderNameById.get(activeDocId) || "";
    }
    return documentNameById.get(activeDocId) || "";
  }, [activeDocId, folderNameById, documentNameById]);
  // On first render, async data is not yet available.
  // The useEffect auto-set handles setting procoreView once data loads.
  const {
    showFilePreview,
    setShowFilePreview,
    filePreview,
    setFilePreview,
    textPreview,
    closePreview,
  } = useFilePreview();

  // Procore preview states (from custom hook)
  const {
    procorePreview,
    setProcorePreview,
    procoreDocToOpen,
    setProcoreDocToOpen,
    procorePdfFormId,
  } = useQRCodePreviews();

  // View override and skeleton for switching from ToolType -> Docs

  const qrImageSrc = useMemo(() => {
    if (signedImageUrl) return signedImageUrl;
    if (qrRow?.data?.qrimage)
      return `data:image/svg+xml;base64,${btoa(qrRow.data.qrimage)}`;
    if (qrData?.data?.qrImageUrl) return qrData.data.qrImageUrl;
    if (qrRow?.data?.qrImageUrl) return qrRow.data.qrImageUrl;
    return "";
  }, [
    signedImageUrl,
    qrRow?.data?.qrimage,
    qrData?.data?.qrImageUrl,
    qrRow?.data?.qrImageUrl,
  ]);

  const qrSvgFallbackSrc = useMemo(() => {
    if (!qrRow?.data?.qrimage) return undefined;
    return `data:image/svg+xml;base64,${btoa(qrRow.data.qrimage)}`;
  }, [qrRow?.data?.qrimage]);

  const qrPrintItem = useMemo(() => {
    const primarySrc =
      signedImageUrl ||
      qrRow?.data?.qrImageUrl ||
      qrData?.data?.qrImageUrl ||
      qrImageSrc ||
      "";
    return {
      name: qrRow?.data?.qrcodeName || "QR Code",
      imgSrc: primarySrc,
      fallbackSrc: qrSvgFallbackSrc,
      qrCodeId: id,
    };
  }, [
    signedImageUrl,
    qrRow?.data?.qrImageUrl,
    qrRow?.data?.qrcodeName,
    qrData?.data?.qrImageUrl,
    qrImageSrc,
    qrSvgFallbackSrc,
    id,
  ]);

  // Actual removal logic after confirmation - with animation
  const confirmHideItem = (itemId: string) => {
    // First, mark as removing to trigger animation
    setRemovingIds((prev) => new Set(prev).add(itemId));

    // After animation completes (200ms), actually hide the item
    window.setTimeout(() => {
      setHiddenIds((prev) => new Set(prev).add(itemId));
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      // Also remove from selection if selected
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }, 200);
  };

  // Document action handlers
  const handleEditDoc = (docId: string) => {
    setActiveDocId(docId);
    setShowDocEditModal(true);
  };

  const handleUploadToDoc = (docId: string) => {
    setActiveDocId(docId);
    setShowDocUploadModal(true);
  };

  const handleMoveDoc = (docId: string) => {
    setActiveDocId(docId);
    setShowDocMoveModal(true);
  };

  const handleDeleteDoc = (docId: string) => {
    setActiveDocId(docId);
    setShowDocDeleteModal(true);
  };

  // Delete QR code handler
  const handleDeleteQRCode = async () => {
    if (!id) return;
    // Use companyIdFromQr (derived from QR data) or fall back to the
    // logged-in user's company so QR codes without a project can still
    // be deleted by their owning company.
    const effectiveCompanyId =
      companyIdFromQr || user?.companyId || user?.company || "";
    if (!effectiveCompanyId) {
      toast.error("Unable to determine company for this QR code.");
      return;
    }
    setIsDeleting(true);
    try {
      await deleteSingleQRCode(String(effectiveCompanyId), id);
      toast.success("QR code deleted successfully");
      navigate({ to: "/my-qrcodes" });
    } catch (error) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to delete QR code",
      );
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // File preview handler (PDF, DOC, DOCX, PNG, JPEG/JPG, URL, XLSX, ZIP, MP4, MOV, TXT)
  const handlePreviewDoc = async (row: unknown) => {
    const r = row as {
      id?: string;
      documentName?: string;
      documentFile?: string;
      addedLink?: boolean;
    };
    const name = r.documentName || "Document";
    const f = r.documentFile || "";
    const previewableTypes = new Set([
      "PDF",
      "PNG",
      "JPG",
      "TXT",
      "MP4",
      "MOV",
    ]);
    const isUrlLike =
      Boolean((r as { addedLink?: boolean }).addedLink) ||
      (f.startsWith("http") && !/\.[a-zA-Z0-9]+$/.test(f));
    const extRaw = isUrlLike ? "URL" : (f.split(".").pop() || "").toUpperCase();
    const ext = extRaw === "JPEG" ? "JPG" : extRaw;
    const normalizedExt = normalizeExtensionLabel(ext);

    let src: string | undefined;
    let downloadHref: string | undefined;
    if (isUrlLike) {
      src = f;
      downloadHref = f;
    } else if (r.id) {
      try {
        const signed = await getS3PresignedUrl(r.id, companyIdFromQr);
        if (typeof signed === "string" && signed) {
          downloadHref = signed;
          if (previewableTypes.has(ext)) {
            src = signed;
          }
        }
      } catch {
        // ignore and show fallback preview state
      }
    }

    // URL previews can still use src fallback from the row value.
    src = src ?? mapFileTypeToPreviewAsset(normalizedExt, f);
    setFilePreview({ name, type: ext, src, downloadHref });
    setShowFilePreview(true);
  };

  // Procore Documents file preview handler (mirror of Taliho preview behavior)
  const handlePreviewProcoreDoc = (row: unknown) => {
    const r = row as {
      name?: string;
      typeLabel?: string;
      procoreUrl?: string;
      procoreId?: string | number;
      __isFolder?: boolean;
    };
    if (r.__isFolder) return;
    if (r.procoreUrl) {
      // Use backend proxy via PdfOpener to open the Procore file in a new tab
      setProcoreDocToOpen({ procoreUrl: r.procoreUrl, procoreId: r.procoreId });
      // Defer submit to ensure form is mounted
      setTimeout(() => {
        const form = document.getElementById(
          procorePdfFormId,
        ) as HTMLFormElement | null;
        if (form) {
          try {
            form.submit();
            return;
          } catch {
            // fall through to generic preview if submit fails
          }
        }
        const extRaw = (r.typeLabel || "").toUpperCase();
        const ext = normalizeExtensionLabel(extRaw);
        const src = mapFileTypeToPreviewAsset(ext);
        setFilePreview({
          name: r.name || "Document",
          type: ext,
          src,
        });
        setShowFilePreview(true);
      }, 0);
      return;
    }
    // Fallback: show generic preview based on type
    const extRaw = (r.typeLabel || "").toUpperCase();
    const ext = normalizeExtensionLabel(extRaw);
    const src = mapFileTypeToPreviewAsset(ext);
    setFilePreview({ name: r.name || "Document", type: ext, src });
    setShowFilePreview(true);
  };

  // Bulk document handlers
  const handleBulkMove = () => {
    setShowBulkMoveModal(true);
  };

  const handleBulkDelete = () => {
    setShowBulkDeleteModal(true);
  };

  // Bulk hide without animation (Procore tables – Hide should only add eyeball icon)
  const handleBulkHide = () => {
    if (!companyIdForProcore || !projectIdForProcore) {
      toast.error("This QR code is not linked to a Procore project.");
      return;
    }

    const selectedItems = Array.from(selected);

    // Optimistic update: mark all selected items as hidden
    selectedItems.forEach((itemId) => {
      setHiddenIds((prev) => new Set(prev).add(itemId));
    });

    const procoreItemIDs = selectedItems.map((itemId) => String(itemId));

    setSelected(new Set());
    setbulkActions(false);

    toggleVisibilityBulkProcoreItems({
      companyId: companyIdForProcore,
      projectId: projectIdForProcore,
      procoreItemIDs,
      qrcodeId: id,
      hidden: true,
    })
      .then(() => {
        toast.success(
          `${selectedItems.length} item${selectedItems.length !== 1 ? "s" : ""} hidden successfully`,
        );
        queryClient.invalidateQueries({ queryKey: ["ProcoreTool"] });
        queryClient.invalidateQueries({
          queryKey: ["QrProcoreTools", id],
        });
        void invalidateQrCaches(queryClient, id);
      })
      .catch((error) => {
        // Revert optimistic update
        selectedItems.forEach((itemId) => {
          setHiddenIds((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
        });
        toast.error(
          error?.response?.data?.message ||
            `Failed to hide ${selectedItems.length} item${selectedItems.length !== 1 ? "s" : ""}`,
        );
      });
  };

  // For procore-location: Hide/Remove mixed action based on each row's action eligibility
  const handleBulkHideRemove = () => {
    // Migration fallback: use existing bulk remove behavior
    return handleBulkRemove();
  };

  // Build table data
  const { docsTable, docsTypeOptions, folderTrail } = useDocsView({
    id,
    aggregate: qrData as QRCodeAggregate,
    activeFolderId,
    handlers: {
      onEdit: handleEditDoc,
      onUpload: handleUploadToDoc,
      onMove: handleMoveDoc,
      onDelete: handleDeleteDoc,
      onPreview: handlePreviewDoc,
    },
  });

  // Build enhanced aggregate that merges procore tools from the dedicated endpoint
  const enhancedAggregate = useMemo(() => {
    if (!qrData && !qrProcoreToolsData) return undefined;
    // Prefer the dedicated endpoint only when it has actual content; an empty
    // array from stale React Query cache must NOT block fresh data from qrData.
    const effectiveProcoreTools =
      Array.isArray(qrProcoreToolsData?.procoreTools) &&
      qrProcoreToolsData.procoreTools.length > 0
        ? qrProcoreToolsData.procoreTools
        : qrData?.procoreTools;
    const effectiveBicWorkflows =
      Array.isArray(bicWorkflows) && bicWorkflows.length > 0
        ? bicWorkflows
        : qrData?.ballInCourtWorkflows;
    return {
      ...(qrData || {}),
      procoreTools: effectiveProcoreTools,
      ballInCourtWorkflows: effectiveBicWorkflows,
    } as QRCodeAggregate;
  }, [bicWorkflows, qrData, qrProcoreToolsData]);

  const toolsTable = useMemo(
    () =>
      getToolTypeTable({
        qrId: id,
        aggregate: enhancedAggregate,
        qrType: effectiveQrType,
        procoreCategory:
          (qrRow?.data?.procoreCategory as string | null | undefined) ??
          qrProcoreToolsData?.procoreCategory ??
          null,
      }),
    [
      id,
      enhancedAggregate,
      effectiveQrType,
      qrRow?.data?.procoreCategory,
      qrProcoreToolsData?.procoreCategory,
    ],
  );

  // Legacy Procore view state and mock-data tables (commented out during migration to real data)
  // const { procoreDocumentsTable, procoreBundles } = useProcoreViewState({
  //   id,
  //   activeProcoreFolderId,
  //   hiddenIds,
  //   shownIds: procoreShownIds,
  //   onAction: handleProcoreAction,
  //   onRemove: handleRemoveItem,
  //   onShow: handleShowItem,
  //   onPreview: () => undefined,
  // })

  // Real Procore data hook wiring
  const selectedToolKey = useMemo(() => {
    if (isProcoreDrawingCodeType)
      return "drawing" as keyof typeof toolsMapTitles;
    const title = procoreView || "";
    // Try to look up by friendly name first (e.g., "RFI's" -> "rfi")
    let key = (toolsMapTitles as Record<string, string>)[title];
    // If not found, try to look up by backend enum value (e.g., "rfis" -> "rfi")
    if (!key) {
      key = (backendEnumToToolKey as Record<string, string>)[title];
    }
    // If still not found, the title might already be a tool key (e.g., "rfi")
    if (!key && title) {
      key = title;
    }
    return key as string;
  }, [procoreView, isProcoreDrawingCodeType]);

  // Use the memoized IDs extracted earlier from qrRow
  const companyIdForProcore = companyIdFromQr;
  const projectIdForProcore = projectIdFromQr;

  const {
    data: procoreData,
    hiddenIds: procoreHiddenIds,
    loading: _procoreLoading,
    isFetching: procoreIsFetching,
    isFetched: procoreIsFetched,
    error: procoreError,
    // refetch: refetchProcoreData
  } = useProcoreToolData(
    selectedToolKey as keyof typeof toolsMapTitles,
    id,
    companyIdForProcore || "",
    projectIdForProcore || "",
    true,
    false, // fetchPage - must be false; only the Procore Fetch modal (/procore/fetch) uses true
  );

  // Create cache-aware loading state for Procore tool data
  // Use isFetching instead of isPending to ensure skeleton shows during fetch
  const procoreLoadingState = createTableLoadingState({
    data: procoreData,
    loading: procoreIsFetching,
    error: procoreError,
  });

  function formatToBundle<T>(tmp: {
    columns?: Array<{ key: string; header: string }>;
    rows?: T[];
    getRowId?: (x: T) => string;
    renderActions?: (row: T) => React.ReactNode;
  }): Bundle {
    return {
      columns: tmp.columns as Array<{ key: string; header: string }>,
      rows: (tmp.rows ?? []) as unknown[],
      getRowId: tmp.getRowId as unknown as (r: unknown) => string,
      renderActions: tmp.renderActions as unknown as
        | undefined
        | ((row: unknown) => React.ReactNode),
    };
  }

  // Determine the row-level action mode based on QR code type and flags.
  // "remove" for procoreFetch mode: items were explicitly fetched/linked, so the
  // user should be able to remove (unlink) them rather than hide/show.
  // "hide-show" for procoreConnect mode: items are shown by default and can be
  // toggled hidden/visible.
  const procoreActionMode: "hide-show" | "remove" = (() => {
    if (effectiveQrType === "folder") return "remove";
    // Mirror backend logic (qr-code.service.ts getScannedQRCode):
    // procoreFetch=true AND procoreConnect=false means items were explicitly
    // fetched/linked via the Procore Fetch flow and should be removable.
    const procoreFetch = Boolean(
      qrRow?.data?.procoreFetch ??
        qrData?.data?.procoreFetch ??
        qrData?.procoreFetch,
    );
    const procoreConnect = Boolean(
      qrRow?.data?.procoreConnect ??
        qrData?.data?.procoreConnect ??
        qrData?.procoreConnect,
    );
    if (procoreFetch && !procoreConnect) return "remove";
    return "hide-show";
  })();

  const procoreDataBundle: Bundle | null = useMemo(() => {
    // For Documents view, use currentFolderData if navigating inside folders, otherwise use procoreData
    const dataToUse =
      procoreView === "Documents" && currentFolderData
        ? currentFolderData
        : procoreData;

    if (!dataToUse) return null;
    const key = isProcoreDrawingCodeType ? "Drawings" : procoreView || "";
    // Documents endpoint returns an object with files/folders; others return arrays
    type DocumentData = {
      folders?: Record<string, unknown>[];
      files?: Record<string, unknown>[];
    };
    const docData = dataToUse as DocumentData;
    const rows: Record<string, unknown>[] =
      key === "Documents"
        ? ([] as Record<string, unknown>[]).concat(
            Array.isArray(docData?.folders) ? docData.folders : [],
            Array.isArray(docData?.files) ? docData.files : [],
          )
        : Array.isArray(dataToUse)
          ? (dataToUse as Record<string, unknown>[])
          : [];

    // Map frontend view names to backend tool names
    const getProcoreToolName = (view: string | null): string => {
      const toolNameMap: Record<string, string> = {
        "Coordination Issues": "coordination-issue",
        Directory: "directory",
        Documents: "document",
        Drawings: "drawing",
        Forms: "form",
        Incidents: "incident",
        Inspections: "inspection",
        Instructions: "instruction",
        Observations: "observation",
        Photos: "photo",
        "Punch List": "punch-list",
        RFIs: "rfi",
        Specifications: "specification",
        Submittals: "submittal",
        Tasks: "task",
      };
      return toolNameMap[view || ""] || "unknown";
    };

    // Handler for hide/show/remove actions
    // NOTE: The backend will automatically handle the correct logic based on QR code mode:
    // - procoreFetch mode: hide = DELETE record, show = CREATE/UPDATE record
    // - procoreConnect mode: hide = CREATE/UPDATE with hidden:true, show = DELETE record
    // The frontend just toggles the optimistic UI and lets the backend handle the database logic
    const handleProcoreAction = async (
      itemId: string,
      action: "hide" | "remove" | "show",
    ) => {
      console.log(`Procore action: ${action} on item ${itemId}`);

      if (!companyIdForProcore || !projectIdForProcore) {
        toast.error("This QR code is not linked to a Procore project.");
        return;
      }

      try {
        // For hide/show actions, update UI optimistically
        if (action === "hide" || action === "show") {
          // Start fade animation
          setFadingIds((prev) => {
            const next = new Set(prev);
            next.add(itemId);
            return next;
          });

          // Update local hidden state immediately for optimistic UI
          if (action === "hide") {
            setLocalHiddenIds((prev) => {
              const next = new Set(prev);
              next.add(itemId);
              return next;
            });
          } else {
            setLocalHiddenIds((prev) => {
              const next = new Set(prev);
              next.delete(itemId);
              return next;
            });
          }

          // Track local shown overrides so UI can reflect immediately without refetch
          if (action === "hide") {
            setLocalShownIds((prev) => {
              const next = new Set(prev);
              next.delete(itemId);
              return next;
            });
          } else {
            setLocalShownIds((prev) => {
              const next = new Set(prev);
              next.add(itemId);
              return next;
            });
          }

          // Call API in the background (don't refetch to avoid table reload)
          toggleVisibilitySingleProcoreItem({
            companyId: companyIdForProcore,
            projectId: projectIdForProcore,
            procoreItemID: String(itemId || ""),
            qrcodeId: id, // The QR code ID
            hidden: action === "hide",
            procoreToolName: getProcoreToolName(procoreView),
          })
            .then(() => {
              // Show success toast to user
              toast.success(
                `Item ${action === "hide" ? "hidden" : "shown"} successfully`,
              );

              // Clear fading state after animation completes
              setTimeout(() => {
                setFadingIds((prev) => {
                  const next = new Set(prev);
                  next.delete(itemId);
                  return next;
                });
              }, 300);

              // Invalidate cached data for eventual consistency
              queryClient.invalidateQueries({ queryKey: ["ProcoreTool"] });
              queryClient.invalidateQueries({
                queryKey: ["QrProcoreTools", id],
              });
              void invalidateQrCaches(queryClient, id);
            })
            .catch((error) => {
              // Revert optimistic update on error
              setFadingIds((prev) => {
                const next = new Set(prev);
                next.delete(itemId);
                return next;
              });
              if (action === "hide") {
                setLocalHiddenIds((prev) => {
                  const next = new Set(prev);
                  next.delete(itemId);
                  return next;
                });
              } else {
                setLocalHiddenIds((prev) => {
                  const next = new Set(prev);
                  next.add(itemId);
                  return next;
                });
              }
              // Revert shown override on failure
              setLocalShownIds((prev) => {
                const next = new Set(prev);
                if (action === "hide") {
                  next.add(itemId);
                } else {
                  next.delete(itemId);
                }
                return next;
              });
              // Show error toast to user
              let message = `Failed to ${action} item.`;
              if (typeof error === "object" && error !== null) {
                const maybeResponse = (
                  error as { response?: { data?: { message?: string } } }
                ).response;
                message =
                  maybeResponse?.data?.message ??
                  (error instanceof Error ? error.message : message);
              }
              toast.error(message);
            });
        } else if (action === "remove") {
          // Remove action permanently unlinks the item from the QR code
          if (!companyIdForProcore || !projectIdForProcore) {
            toast.error("This QR code is not linked to a Procore project.");
            return;
          }

          // Show confirmation dialog before deleting
          setPendingRemoveItemId(itemId);
        }
      } catch (error) {
        // Show error toast to user
        let message = `Failed to ${action} item.`;
        if (typeof error === "object" && error !== null) {
          const maybeResponse = (
            error as { response?: { data?: { message?: string } } }
          ).response;
          message =
            maybeResponse?.data?.message ??
            (error instanceof Error ? error.message : message);
        }
        toast.error(message);
      }
    };

    // Merge server hiddenIds with local optimistic updates
    const mergeHiddenIds = (serverHidden: unknown[] | undefined) => {
      const serverSet = new Set<string>(
        (serverHidden || []).map((v: unknown) => String(v)),
      );
      // Apply local "show" overrides first
      for (const shownId of localShownIds) {
        serverSet.delete(shownId);
      }
      // Combine server hidden IDs with local optimistic "hide" updates
      const merged = new Set<string>([...serverSet, ...localHiddenIds]);
      // Ensure any explicit "show" overrides win
      for (const shownId of localShownIds) {
        merged.delete(shownId);
      }
      return merged;
    };

    // Use the per-tool table factory with real API data to extract consistent columns and ids
    if (key === `RFI's`) {
      const hiddenSet = mergeHiddenIds(procoreHiddenIds);
      const tmp = getProcoreRFIsTable({
        data: rows,
        hiddenIds: hiddenSet,
        onAction: handleProcoreAction,
        actionMode: procoreActionMode,
      });
      return formatToBundle(tmp);
    }
    if (key === "Directory") {
      const hiddenSet = mergeHiddenIds(procoreHiddenIds);
      const tmp = getProcoreDirectoryTable({
        data: rows,
        hiddenIds: hiddenSet,
        onAction: handleProcoreAction,
        actionMode: procoreActionMode,
      });
      return formatToBundle(tmp);
    }
    if (key === "Inspections") {
      const hiddenSet = mergeHiddenIds(procoreHiddenIds);
      const tmp = getProcoreInspectionsTable({
        data: rows,
        hiddenIds: hiddenSet,
        onAction: handleProcoreAction,
        actionMode: procoreActionMode,
      });
      return formatToBundle(tmp);
    }
    if (key === "Punch List") {
      const hiddenSet = mergeHiddenIds(procoreHiddenIds);
      const tmp = getProcorePunchListTable({
        data: rows,
        hiddenIds: hiddenSet,
        onAction: handleProcoreAction,
        actionMode: procoreActionMode,
      });
      return formatToBundle(tmp);
    }
    if (key === "Photos") {
      const hiddenSet = mergeHiddenIds(procoreHiddenIds);
      const tmp = getProcorePhotosTable({
        data: rows,
        hiddenIds: hiddenSet,
        onAction: handleProcoreAction,
        actionMode: procoreActionMode,
      });
      return formatToBundle(tmp);
    }
    if (key === "Observations") {
      const hiddenSet = mergeHiddenIds(procoreHiddenIds);
      const tmp = getProcoreObservationsTable({
        data: rows,
        hiddenIds: hiddenSet,
        onAction: handleProcoreAction,
        actionMode: procoreActionMode,
      });
      return formatToBundle(tmp);
    }
    if (key === "Drawings") {
      const hiddenSet = mergeHiddenIds(procoreHiddenIds);
      const tmp = getProcoreDrawingsTable({
        data: rows,
        hiddenIds: hiddenSet,
        onAction: handleProcoreAction,
        actionMode: procoreActionMode,
      });
      return formatToBundle(tmp);
    }
    if (key === "Documents") {
      // Use folder-level hiddenIds when browsing inside a folder; otherwise use root-level hiddenIds
      const serverHidden = (
        currentFolderData ? currentFolderHiddenIds : procoreHiddenIds
      ) as unknown[] | undefined;
      // Normalize server hidden ids (numeric) to match document row ids ('file-<id>' / 'folder-<id>')
      const serverIds = Array.isArray(serverHidden)
        ? (serverHidden as unknown[]).map((v) => String(v))
        : [];
      const serverPrefixed = new Set<string>();
      for (const sid of serverIds) {
        {
          serverPrefixed.add(`file-${sid}`);
          serverPrefixed.add(`folder-${sid}`);
        }
      }
      // Merge with any locally hidden ids already tracked as full row ids
      const hiddenSet = new Set<string>([
        ...Array.from(serverPrefixed),
        ...Array.from(localHiddenIds ?? new Set<string>()),
      ]);
      // Apply local "show" overrides to prefixed ids
      for (const shownId of localShownIds) {
        hiddenSet.delete(shownId);
      }
      const tmp = getProcoreDocumentsTable({
        data: dataToUse as unknown as ProcoreToolData | undefined,
        activeFolderId: activeProcoreFolderId ?? null,
        hiddenIds: hiddenSet,
        onAction: handleProcoreAction,
        actionMode: procoreActionMode,
      });
      return formatToBundle(tmp);
    }
    if (key === "Specifications") {
      const hiddenSet = mergeHiddenIds(procoreHiddenIds);
      const tmp = getProcoreSpecificationsTable({
        data: rows,
        hiddenIds: hiddenSet,
        onAction: handleProcoreAction,
        actionMode: procoreActionMode,
      });
      return formatToBundle(tmp);
    }
    if (key === "Submittals") {
      const hiddenSet = mergeHiddenIds(procoreHiddenIds);
      const tmp = getProcoreSubmittalsTable({
        data: rows,
        hiddenIds: hiddenSet,
        onAction: handleProcoreAction,
        actionMode: procoreActionMode,
      });
      return formatToBundle(tmp);
    }
    if (key === "Tasks") {
      const hiddenSet = mergeHiddenIds(procoreHiddenIds);
      const tmp = getProcoreTasksTable({
        data: rows,
        hiddenIds: hiddenSet,
        onAction: handleProcoreAction,
        actionMode: procoreActionMode,
      });
      return formatToBundle(tmp);
    }
    if (key === "Forms") {
      const hiddenSet = mergeHiddenIds(procoreHiddenIds);
      const tmp = getProcoreFormsTable({
        data: rows,
        hiddenIds: hiddenSet,
        onAction: handleProcoreAction,
        actionMode: procoreActionMode,
      });
      return formatToBundle(tmp);
    }
    if (key === "Instructions") {
      const hiddenSet = mergeHiddenIds(procoreHiddenIds);
      const tmp = getProcoreInstructionsTable({
        data: rows,
        hiddenIds: hiddenSet,
        onAction: handleProcoreAction,
        actionMode: procoreActionMode,
      });
      return formatToBundle(tmp);
    }
    if (key === "Incidents") {
      const hiddenSet = mergeHiddenIds(procoreHiddenIds);
      const tmp = getProcoreIncidentsTable({
        data: rows,
        hiddenIds: hiddenSet,
        onAction: handleProcoreAction,
        actionMode: procoreActionMode,
      });
      return formatToBundle(tmp);
    }
    if (key === "Coordination Issues") {
      const hiddenSet = mergeHiddenIds(procoreHiddenIds);
      const tmp = getProcoreCoordinationIssuesTable({
        data: rows,
        hiddenIds: hiddenSet,
        onAction: handleProcoreAction,
        actionMode: procoreActionMode,
      });
      return formatToBundle(tmp);
    }
    // Default fallback uses simple key inference
    const fallbackGetRowId = (r: unknown) => {
      const o = r as Record<string, unknown>;
      return String(
        (o?.id as string) ??
          o?.procoreId ??
          o?.rfi ??
          o?.number ??
          o?.uid ??
          o?.uuid ??
          Math.random().toString(36).slice(2),
      );
    };
    const fallbackColumns = [
      { key: "title", header: "Title" },
      { key: "status", header: "Status" },
      { key: "modified", header: "Date Modified" },
    ];
    return {
      columns: fallbackColumns as Array<{ key: string; header: string }>,
      rows,
      getRowId: fallbackGetRowId,
    } as unknown as Bundle;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    procoreData,
    currentFolderData,
    procoreView,
    isProcoreDrawingCodeType,
    activeProcoreFolderId,
    procoreHiddenIds,
    currentFolderHiddenIds,
    localHiddenIds,
    localShownIds,
    procoreActionMode,
  ]);

  // Map from procoreView display name to internal tool key (used for rawItemMap lookup)
  const viewToToolKey: Record<string, string> = {
    "Coordination Issues": "coordination-issue",
    Directory: "directory",
    Documents: "document",
    Drawings: "drawing",
    Forms: "form",
    Incidents: "incident",
    Inspections: "inspection",
    Instructions: "instruction",
    Observations: "observation",
    Photos: "photo",
    "Punch List": "punch-list",
    [`RFI's`]: "rfi",
    Specifications: "specification",
    Submittals: "submittal",
    Tasks: "task",
  };

  // Build a lookup map from raw item ID → raw Procore item for the current tool view
  const rawItemMap = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    const dataToUse =
      procoreView === "Documents" && currentFolderData
        ? currentFolderData
        : procoreData;
    if (!dataToUse) return map;

    const items: Record<string, unknown>[] = Array.isArray(dataToUse)
      ? (dataToUse as Record<string, unknown>[])
      : [];

    for (const item of items) {
      const id = String((item as Record<string, unknown>)?.id ?? "");
      if (id) map.set(id, item as Record<string, unknown>);
    }
    return map;
  }, [procoreData, currentFolderData, procoreView]);

  // Handler for navigating into a Procore Documents folder
  const handleNavigateToFolder = async (
    folderId: number,
    folderName?: string,
    skipTrailPush?: boolean,
  ) => {
    try {
      setLoadingFolderId(folderId);

      // Fetch folder contents using getFolders with desktop=true
      const desktop = true;
      const response = await getFolders(
        id,
        companyIdForProcore || "",
        projectIdForProcore || "",
        String(folderId),
        desktop,
      );
      // When desktop=true, expect { data, hiddenIds } structure
      // When desktop=false, expect direct structure
      if (
        desktop &&
        response &&
        typeof response === "object" &&
        !Array.isArray(response) &&
        "data" in response
      ) {
        type FolderResponse = {
          data?: Record<string, unknown>;
          hiddenIds?: string[];
        };
        setCurrentFolderData((response as FolderResponse).data || response);
        const extractedHiddenIds =
          (response as FolderResponse).hiddenIds || undefined;
        setCurrentFolderHiddenIds(extractedHiddenIds);
      } else {
        // Mobile mode or legacy structure
        setCurrentFolderData(response as Record<string, unknown> | null);
        setCurrentFolderHiddenIds(undefined);
      }

      setActiveProcoreFolderId(folderId);
      setSelected(new Set());
      if (!skipTrailPush) {
        setProcoreFolderTrailState((prev) => [
          ...prev,
          { id: folderId, label: folderName || `Folder ${folderId}` },
        ]);
      }
    } catch (error) {
      logProcoreError(error, "load-procore-folder", { folderId, qrcodeId: id });
    } finally {
      setLoadingFolderId(null);
    }
  };

  // Handler for navigating to a specific folder in the breadcrumb trail
  const handleNavigateToBreadcrumbFolder = async (folderId: number | null) => {
    if (folderId === null) {
      // Navigate back to root -- clear the entire trail
      setActiveProcoreFolderId(null);
      setCurrentFolderData(null);
      setCurrentFolderHiddenIds(undefined);
      setSelected(new Set());
      setProcoreFolderTrailState([]);
    } else {
      // Truncate the trail to the clicked breadcrumb segment (inclusive)
      setProcoreFolderTrailState((prev) => {
        const idx = prev.findIndex((seg) => seg.id === folderId);
        return idx >= 0 ? prev.slice(0, idx + 1) : prev;
      });
      // Re-fetch folder contents without pushing onto the trail again
      await handleNavigateToFolder(folderId, undefined, true);
    }
  };

  // Compute filter options for Tools view
  // ^%^%^
  // const toolTypeFilterOptions = useMemo<{ references: string[]; types: string[] }>(() => {
  //     if (!(Array?.isArray(toolsTable?.rows) && toolsTable?.rows?.length > 0)) return { references: [] as string[], types: [] as string[] }
  //     const references = Array.from(new Set((toolsTable?.rows as Array<{ reference: string }>)?.map(r => r.reference)))
  //     const types = Array.from(new Set((toolsTable?.rows as Array<{ type?: string; name?: string }>)
  //         .map(r => (r?.type || r?.name || '').toString())
  //         .filter(Boolean)
  //     )).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  //     return { references, types }
  // }, [toolsTable?.rows])

  const toolTypeFilterOptions: { references: string[]; types: string[] } =
    (() => {
      type ToolsTableType = {
        rows?: Array<{ reference: string; type?: string; name?: string }>;
      };
      if (!toolsTable || !Array.isArray((toolsTable as ToolsTableType).rows))
        return { references: [], types: [] };
      const rows = (toolsTable as ToolsTableType).rows!;
      if (rows.length === 0) return { references: [], types: [] };
      const references = Array.from(new Set(rows.map((r) => r.reference)));
      const types = Array.from(
        new Set(rows.map((r) => r.type || r.name || "").filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      return { references, types };
    })();

  const qrType = effectiveQrType;
  const shouldShowAddNotice =
    qrType === "file" || qrType === "url" || qrType === "procore-drawing-code";
  const hasProcoreConfigured =
    isProcoreToolType ||
    isProcoreLocationType ||
    isProcoreDrawingCodeType ||
    procoreToolNames?.length > 0;
  const hasBicWorkflows = (bicWorkflows?.length ?? 0) > 0;
  const showToolType =
    !isProcoreDrawingCodeType &&
    (isProcoreLocationType ||
      (hasTalihoDocs && hasProcoreConfigured) ||
      (!hasTalihoDocs && procoreToolNames?.length > 1) ||
      hasBicWorkflows);
  const showDocs =
    !showToolType && !isProcoreSpecialType && !isProcoreDrawingCodeType;

  // Auto-set procoreView once data loads for procore-tool/procore-location QR codes
  // that have no Taliho documents. Uses a ref so it only fires once and does not
  // override the user's manual navigation.
  const procoreViewAutoSetRef = useRef(false);
  useEffect(() => {
    if (procoreViewAutoSetRef.current) return;
    // Wait for QR code data AND the dedicated procore-tools data
    if (qrLoading || !qrRow?.data) return;
    // Also wait for procore tools data to be available from at least one source
    if (!qrProcoreToolsData && !qrData?.procoreTools) return;
    if (!qrData) return;

    const t = effectiveQrType;

    if (!hasTalihoDocs) {
      if (t === "procore-tool" || t === "procore-location") {
        const category =
          (qrRow?.data?.procoreCategory as string | undefined) ||
          qrProcoreToolsData?.procoreCategory ||
          undefined;
        const toolName = procoreToolNames[0];
        const title = getToolTitle(category) ?? getToolTitle(toolName);
        if (title) {
          setProcoreView(title);
          procoreViewAutoSetRef.current = true;
        }
      } else if (procoreToolNames.length > 0 && !showToolType) {
        // Non-procore QR type with only procore items and no tool-type table
        const title = getToolTitle(procoreToolNames[0]);
        if (title) {
          setProcoreView(title);
          procoreViewAutoSetRef.current = true;
        }
      }
    } else {
      // Has Taliho docs — the ToolType table handles navigation.
      // Only lock the ref once showToolType is confirmed true, so that the
      // ToolType table will actually render. This prevents locking before
      // Procore data arrives (hasProcoreConfigured still false from stale cache),
      // which would leave the user stuck in the Taliho Documents view.
      if (showToolType) {
        procoreViewAutoSetRef.current = true;
      }
    }
  }, [
    qrLoading,
    qrRow?.data,
    qrRow?.data?.type,
    qrRow?.data?.procoreCategory,
    qrProcoreToolsData,
    qrData,
    qrData?.data?.type,
    qrData?.procoreTools,
    effectiveQrType,
    hasTalihoDocs,
    procoreToolNames,
    setProcoreView,
    showToolType,
  ]);

  // Reset procoreView when the active tool is no longer present in refetched data.
  // Handles the case where removing the last item from a procoreFetch tool
  // leaves the user stuck on "No data for [tool]" because procoreViewAutoSetRef
  // prevents the auto-set effect from re-running.
  useEffect(() => {
    if (!procoreView) return;
    if (!procoreViewAutoSetRef.current) return;
    if (qrProcoreToolsFetching || qrDataFetching) return;
    if (isProcoreDrawingCodeType) return;

    const currentToolStillExists = procoreToolNames.some((toolName: string) => {
      const title = getToolTitle(toolName);
      return title === procoreView;
    });

    if (currentToolStillExists) return;

    // Current tool no longer has items -- navigate to appropriate fallback
    if (procoreToolNames.length > 0) {
      if (showToolType) {
        // Multiple tools remain -- go back to tool type table
        setProcoreView(null);
        setForceDocsView(false);
      } else {
        // Single remaining tool -- switch directly to it
        const nextTitle = getToolTitle(procoreToolNames[0]);
        setProcoreView(nextTitle);
      }
    } else if (hasTalihoDocs) {
      // No Procore tools remain but Taliho docs exist
      setProcoreView(null);
      setForceDocsView(true);
    } else {
      // Nothing remains
      setProcoreView(null);
      setForceDocsView(false);
    }

    setLocalHiddenIds(new Set());
    setFadingIds(new Set());
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    procoreView,
    procoreToolNames,
    qrProcoreToolsFetching,
    qrDataFetching,
    isProcoreDrawingCodeType,
    showToolType,
    hasTalihoDocs,
  ]);

  // Effective view for display (allows forcing docs after click)
  const isToolView =
    !isProcoreDrawingCodeType && !forceDocsView && !procoreView && !bicView && showToolType;
  const isDocsView =
    !isProcoreDrawingCodeType && !procoreView && (forceDocsView || showDocs);
  const isProcoreView = !isProcoreDrawingCodeType && Boolean(procoreView);
  const isBicView = bicView && !isProcoreDrawingCodeType;

  // Check if Procore view is waiting for required dependencies (company/project IDs)
  // This prevents a flash of "No data" when the query is disabled while waiting for IDs
  const isProcoreWaitingForDeps =
    (isProcoreView || isProcoreDrawingCodeType) &&
    (!companyIdForProcore || !projectIdForProcore);

  // Extract filter options for Procore tables based on their status columns
  const procoreFilterOptions = useMemo<{ statuses: string[] }>(
    () => ({ statuses: [] }),
    [],
  );

  // Breadcrumb trail for Procore Documents is now tracked incrementally
  // via procoreFolderTrailState rather than computed from tree data
  // (the Procore API only returns immediate children, not a full nested tree).
  const procoreFolderTrail = procoreFolderTrailState;

  // Use extracted hook for filtered rows and getters
  // const { procoreBundles } = useProcoreBundles({ qrId: id, aggregate: qrData as any }); // commented during migration
  const {
    filteredRows,
    // filteredProcoreRows,
    effectiveFilteredRows,
    effectiveGetRowId,
  } = useFilteredRows({
    isToolView,
    isDocsView,
    isProcoreView,
    procoreView,
    toolsTable: {
      rows: toolsTable.rows as unknown[],
      getRowId: toolsTable.getRowId as unknown as (r: unknown) => string,
    },
    docsTable: {
      rows: docsTable.rows as unknown[],
      getRowId: docsTable.getRowId as unknown as (r: unknown) => string,
    },
    procoreBundles: {} as unknown as Record<
      string,
      { rows: unknown[]; getRowId: (r: unknown) => string }
    >,
    query,
    filters,
    hiddenIds,
    removedIds,
    getDocTypeLabel: (row: unknown) =>
      getDocTypeLabel(
        row as {
          __isFolder?: boolean;
          documentFile?: string;
          addedLink?: boolean;
        },
      ),
  });

  // Initialize selection state from current rows and id getter
  const { selected, setSelected, allSelected, toggleRow, toggleSelectAll } =
    useSelectionState(
      effectiveFilteredRows as unknown[],
      effectiveGetRowId as (r: unknown) => string,
    );

  // Function to apply animation class to rows being removed (uses local removing/removed ids)
  const getRowClassName = (row: unknown) => {
    const rowId = effectiveGetRowId(row);
    return removingIds.has(rowId) || removedIds.has(rowId)
      ? "transition-all duration-200 ease-in-out opacity-0 -translate-y-2"
      : "";
  };

  const handleBulkDocumentAndFolderDelete = async (itemIds: string[]) => {
    if (itemIds.length > MAX_BULK_DELETE_COUNT) {
      toast.error(
        `Cannot delete more than ${MAX_BULK_DELETE_COUNT} items at once. You selected ${itemIds.length}.`,
      );
      return;
    }
    if (itemIds.length === 0) return;

    const folderIds = itemIds.filter((itemId) => folderNameById.has(itemId));
    const documentIds = itemIds.filter(
      (itemId) => !folderNameById.has(itemId),
    );

    let deletedCount = 0;
    let partialFailure = false;
    const errorMessages: string[] = [];

    if (documentIds.length > 0) {
      const result = await deleteDocumentsBulk(documentIds, companyIdFromQr);
      if (result.success) {
        deletedCount += result.count ?? documentIds.length;
      } else {
        partialFailure = true;
        errorMessages.push(result.message || "Failed to delete documents");
      }
    }

    if (folderIds.length > 0) {
      const result = await deleteFoldersBulk(folderIds, companyIdFromQr, {
        projectId: projectIdFromQr || undefined,
      });
      if (result.success) {
        deletedCount += result.count ?? folderIds.length;
      } else {
        partialFailure = true;
        if (result.partialResult?.succeeded) {
          deletedCount += result.partialResult.succeeded;
        }
        errorMessages.push(result.message || "Failed to delete folders");
      }
    }

    if (deletedCount > 0) {
      if (!partialFailure) {
        itemIds.forEach((itemId) => confirmHideItem(itemId));
      }
      void invalidateQrCaches(queryClient, id);
    }

    if (deletedCount > 0 && !partialFailure) {
      toast.success(
        `Deleted ${deletedCount} item${deletedCount !== 1 ? "s" : ""} successfully`,
      );
    } else if (deletedCount > 0) {
      toast.success(
        `Deleted ${deletedCount} item${deletedCount !== 1 ? "s" : ""}. Some items could not be deleted.`,
      );
    }

    if (errorMessages.length > 0) {
      toast.error(errorMessages[0]);
    }
  };

  // Bulk hide/remove selected items - now shows confirmation modal
  function handleBulkRemove() {
    setShowBulkHideRemoveModal(true);
  }

  // Actual bulk removal logic after confirmation
  function confirmBulkRemove() {
    if (isProcoreView) {
      // Procore view: delete items via backend API
      if (!companyIdForProcore || !projectIdForProcore) {
        toast.error("This QR code is not linked to a Procore project.");
        return;
      }

      const selectedItems = Array.from(selected);

      // Optimistic animation: mark all selected items as removing
      selectedItems.forEach((itemId) => {
        setRemovingIds((prev) => new Set(prev).add(itemId));
      });

      // Delete items in batches to avoid overwhelming the server
      const BATCH_SIZE = 10;
      (async () => {
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < selectedItems.length; i += BATCH_SIZE) {
          const batch = selectedItems.slice(i, i + BATCH_SIZE);
          const batchPromises = batch.map((itemId) =>
            deleteSingleProcoreItem({
              companyId: companyIdForProcore,
              projectId: projectIdForProcore,
              procoreItemID: String(itemId || ""),
              qrcodeId: id,
            }),
          );
          const batchResults = await Promise.allSettled(batchPromises);

          batchResults.forEach((result, index) => {
            const itemId = batch[index];
            if (result.status === "fulfilled") {
              successCount++;
              setRemovedIds((prev) => new Set(prev).add(itemId));
            } else {
              failCount++;
            }
            // Clear removing state regardless of outcome
            setRemovingIds((prev) => {
              const next = new Set(prev);
              next.delete(itemId);
              return next;
            });
          });
        }

        if (successCount > 0) {
          toast.success(
            `${successCount} item${successCount !== 1 ? "s" : ""} removed successfully`,
          );
          queryClient.invalidateQueries({ queryKey: ["ProcoreTool"] });
          queryClient.invalidateQueries({
            queryKey: ["QrProcoreTools", id],
          });
          void invalidateQrCaches(queryClient, id);
        }
        if (failCount > 0) {
          toast.error(
            `Failed to remove ${failCount} item${failCount !== 1 ? "s" : ""}`,
          );
        }
      })();
    } else if (qrType === "folder") {
      // Folder view: animate then remove from table entirely
      selected.forEach((itemId) => {
        setRemovingIds((prev) => new Set(prev).add(itemId));
        window.setTimeout(() => {
          setRemovedIds((prev) => new Set(prev).add(itemId));
          setRemovingIds((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
        }, 200);
      });
    } else {
      // Fallback: treat as hide
      selected.forEach((itemId) => confirmHideItem(itemId));
    }
    setSelected(new Set());
    setbulkActions(false);
  }

  // Bulk show handler
  const handleBulkShow = () => {
    if (!companyIdForProcore || !projectIdForProcore) {
      toast.error("This QR code is not linked to a Procore project.");
      return;
    }

    const selectedItems = Array.from(selected);

    // Optimistic update: remove all selected items from hiddenIds
    selectedItems.forEach((itemId) => {
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    });

    const procoreItemIDs = selectedItems.map((itemId) => String(itemId));

    setSelected(new Set());
    setbulkActions(false);

    toggleVisibilityBulkProcoreItems({
      companyId: companyIdForProcore,
      projectId: projectIdForProcore,
      procoreItemIDs,
      qrcodeId: id,
      hidden: false,
    })
      .then(() => {
        toast.success(
          `${selectedItems.length} item${selectedItems.length !== 1 ? "s" : ""} shown successfully`,
        );
        queryClient.invalidateQueries({ queryKey: ["ProcoreTool"] });
        queryClient.invalidateQueries({
          queryKey: ["QrProcoreTools", id],
        });
        void invalidateQrCaches(queryClient, id);
      })
      .catch((error) => {
        // Revert optimistic update: re-add items to hiddenIds
        selectedItems.forEach((itemId) => {
          setHiddenIds((prev) => new Set(prev).add(itemId));
        });
        toast.error(
          error?.response?.data?.message ||
            `Failed to show ${selectedItems.length} item${selectedItems.length !== 1 ? "s" : ""}`,
        );
      });
  };

  function goToProcoreFetch() {
    navigate({
      to: "/procore/fetch",
      search: {
        selectedIds: [id],
        groupId: undefined,
        returnTo: "/qrcode/$qrcodeId",
        returnParams: { qrcodeId: id },
      },
    });
  }

  const handleFetchFromProcore = () => {
    if (shouldShowAddNotice) {
      setPendingAddAction("fetch");
      setShowConvertNoticeModal(true);
      return;
    }
    goToProcoreFetch();
  };

  const handleAddItems = () => {
    if (shouldShowAddNotice) {
      setPendingAddAction("add");
      setShowConvertNoticeModal(true);
      return;
    }
    setShowUploadModal(true);
  };

  async function enqueueUploadModalItems(
    allItems: ModalUploadItem[] | undefined,
    options?: {
      defaultParentFolderId?: string;
      onSuccess?: () => void;
    },
  ) {
    try {
      // Use the memoized IDs extracted from qrRow (handles both string and populated object formats)
      const companyId = companyIdFromQr;
      const projectId = projectIdFromQr;
      const defaultParentFolderId = options?.defaultParentFolderId;
      const normalizedItems = (allItems || []).map((it) =>
        !it.parentFolderId && defaultParentFolderId
          ? { ...it, parentFolderId: defaultParentFolderId }
          : it,
      );
      // 1) Create folders in hierarchical order
      const syntheticToReal = new Map<string, string>();
      const folderItems = normalizedItems.filter((i) => i.kind === "folder");
      const unresolved = new Set(folderItems.map((f) => f.id));
      let guard = 0;
      while (unresolved.size > 0 && guard++ < 1000) {
        let progressed = false;
        for (const it of folderItems) {
          if (!unresolved.has(it.id)) continue;
          const parentSynthetic = it.parentFolderId;
          if (parentSynthetic && !syntheticToReal.has(parentSynthetic))
            continue;
          // Default new root-level folders to the currently active Taliho folder (when in Docs view)
          const parentFolderId = parentSynthetic
            ? syntheticToReal.get(parentSynthetic)
            : defaultParentFolderId;
          const created = await createFolder({
            companyId,
            projectId,
            qrcodeId: id,
            folderName: it.displayName || "New Folder",
            parentFolderId,
          });
          syntheticToReal.set(
            it.id,
            (created as unknown as { _id?: string; id?: string })._id ||
              (created as unknown as { _id?: string; id?: string }).id ||
              "",
          );
          unresolved.delete(it.id);
          progressed = true;
        }
        if (!progressed) break;
      }

      // Force-refetch QR data so newly created folders appear immediately.
      // AWAIT ensures fresh data is cached before the modal closes.
      if (syntheticToReal.size > 0) {
        await invalidateQrCaches(queryClient, id);
      }

      // 2) Enqueue URL items (background)
      const urlItems = normalizedItems.filter((i) => i.kind === "url");
      const urlTaskId =
        urlItems.length > 0
          ? enqueueUrlAdds({
              companyId,
              projectId,
              qrcodeId: id,
              items: urlItems.map((it) => ({
                displayName: it.displayName || it.url || "Link",
                url: it.url || "",
                folderId: it.parentFolderId
                  ? syntheticToReal.get(it.parentFolderId)
                  : defaultParentFolderId,
              })),
            })
          : null;

      // 3) Upload files grouped by destination folder
      type UploadItem = {
        kind: string;
        file?: File;
        displayName?: string;
        parentFolderId?: string;
      };
      const fileItems = normalizedItems.filter((i) => i.kind === "file");
      const groupMap = new Map<string, Array<{ it: UploadItem }>>();
      for (const it of fileItems) {
        // Default to the active Taliho folder when no parent is specified in UploadModal
        const realFolderId = it.parentFolderId
          ? syntheticToReal.get(it.parentFolderId) || ""
          : defaultParentFolderId || "";
        const key = realFolderId || "__root__";
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key)!.push({ it });
      }

      const taskIds: string[] = [];
      for (const [key, list] of groupMap.entries()) {
        const groupFiles: File[] = [];
        const names: string[] = [];
        for (const { it } of list) {
          if (it.file) groupFiles.push(it.file);
          names.push(it.displayName || (it.file?.name ?? "File"));
        }
        const ids = enqueueFileGroupUploadSmart({
          companyId,
          projectId,
          qrcodeId: id,
          folderId: key === "__root__" ? undefined : key,
          documentPurpose: key === "__root__" ? "file-qrcode" : "folder-qrcode",
          files: groupFiles,
          documentNames: names,
        });
        taskIds.push(...ids);
      }
      if (urlTaskId) taskIds.push(urlTaskId);

      // Close modal immediately and let background upload tray show progress
      options?.onSuccess?.();
      if (taskIds.length > 0) {
        toast.success("Uploading in background…");
      } else {
        toast.success("Items added successfully.");
      }
    } catch (error) {
      logDocumentError(error, "upload-failed", { qrcodeId: id });
      toast.error("Failed to add items.");
    }
  }

  async function handleUploadModalConfirm(
    _files: File[],
    allItems?: ModalUploadItem[],
  ) {
    await enqueueUploadModalItems(allItems, {
      defaultParentFolderId: (isDocsView && activeFolderId) || undefined,
      onSuccess: () => setShowUploadModal(false),
    });
  }

  async function handleDocUploadModalConfirm(
    _files: File[],
    allItems?: ModalUploadItem[],
  ) {
    const targetFolderId =
      activeDocId && folderNameById.has(activeDocId)
        ? activeDocId
        : (isDocsView && activeFolderId) || undefined;
    await enqueueUploadModalItems(allItems, {
      defaultParentFolderId: targetFolderId,
      onSuccess: () => {
        setShowDocUploadModal(false);
        setActiveDocId(null);
      },
    });
  }

  async function handleBulkUploadModalConfirm(
    _files: File[],
    allItems?: ModalUploadItem[],
  ) {
    await enqueueUploadModalItems(allItems, {
      defaultParentFolderId: (isDocsView && activeFolderId) || undefined,
      onSuccess: () => {
        setShowBulkUploadModal(false);
        setSelected(new Set());
        setbulkActions(false);
      },
    });
  }
  const createdAt = qrRow?.data?.createdAt;
  const totalScans =
    typeof qrRow?.data?.mobileScanCount === "number"
      ? qrRow?.data?.mobileScanCount
      : undefined;
  const lastScanned = "N/A";
  const typeBadge = computeTypeBadge(effectiveQrType);
  const groupingData = groupRes.data?.data as
    | {
        type?: string;
        arrangementName?: string;
        equipmentName?: string;
        groupName?: string;
      }
    | undefined;
  // Resolve the actual group type: prefer the Group record's own type (from API),
  // since it indicates what the group actually IS (arrangement or equipment).
  // The QR's groupingType indicates HOW the link works ('group' = unified groupingId,
  // 'arrangement'/'equipment' = legacy refs), not necessarily the group's actual type.
  const effectiveGroupType = (
    groupingData?.type ||
    (qrRow?.data?.groupingType as string | undefined) ||
    ""
  ).toLowerCase();
  const arrangementName =
    effectiveGroupType === "arrangement"
      ? groupingData?.arrangementName || groupingData?.groupName || ""
      : "";
  const equipmentName =
    effectiveGroupType === "equipment"
      ? groupingData?.equipmentName || groupingData?.groupName || ""
      : "";
  const groupName =
    effectiveGroupType === "group" ? groupingData?.groupName || "" : "";
  const groupingBadge = computeGroupingBadge({
    groupingType: effectiveGroupType || undefined,
    arrangement: qrRow?.data?.arrangement,
    equipment: qrRow?.data?.equipment,
    groupingId: qrRow?.data?.groupingId,
    arrangementName,
    equipmentName,
    groupName,
  });

  const projectBadge = computeProjectBadge({
    project: project?._id,
    projectName: project?.projectName,
    projectStatus: project?.projectStatus,
    archived: project?.archived,
  });

  const link = useMemo(() => {
    const url = qrRow?.data?.mobileUrl || qrRow?.data?.url;
    return url ? { url, buttonText: "Copy Link" } : undefined;
  }, [qrRow?.data?.url, qrRow?.data?.mobileUrl]);

  // Determine if QR code is unassigned to project/group
  const isUnassignedToProject = !projectIdFromQr;
  const isUnassignedToGroup = !groupingBadge?.href;

  // Options for assign modals
  const projectOptions = useMemo(() => {
    const projects = projectsData?.data ?? [];
    return projects.map((p) => ({
      id: p._id,
      name: p.projectName || "Unnamed Project",
    }));
  }, [projectsData?.data]);

  const groupOptions = useMemo(() => {
    const groups = groupsData?.data ?? [];
    return groups.map((g) => ({
      id: g._id,
      name:
        g.groupName || g.arrangementName || g.equipmentName || "Unnamed Group",
    }));
  }, [groupsData?.data]);

  // Handlers for assigning to project/group
  const handleAssignToProject = async (projectId: string) => {
    if (!id || !companyIdFromQr) return;
    setIsAssigning(true);
    try {
      const result = await bulkAssignQRCodesToProject(
        [id],
        projectId,
        companyIdFromQr,
      );
      if (result.success) {
        toast.success("QR code assigned to project");
        setShowAssignToProjectModal(false);
        void invalidateQrCaches(queryClient, id);
      } else {
        toast.error(result.message || "Failed to assign to project");
      }
    } catch (error) {
      logQRError(error, "assign-to-project-failed", id);
      toast.error("Failed to assign to project");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAssignToGroup = async (groupId: string) => {
    if (!id || !companyIdFromQr || !projectIdFromQr) return;
    setIsAssigning(true);
    try {
      const result = await bulkAssignQRCodesToGroup(
        [id],
        groupId,
        "group",
        companyIdFromQr,
        projectIdFromQr,
      );
      if (result.success) {
        toast.success("QR code assigned to group");
        setShowAssignToGroupModal(false);
        void invalidateQrCaches(queryClient, id);
      } else {
        toast.error(result.message || "Failed to assign to group");
      }
    } catch (error) {
      logQRError(error, "assign-to-group-failed", id);
      toast.error("Failed to assign to group");
    } finally {
      setIsAssigning(false);
    }
  };

  if (qrLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading QR code...</p>
        </div>
      </div>
    );
  }

  // Show 404 error if QR code not found
  if (qrIsError || !qrRow || !qrRow.data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="bx bx-error-circle text-4xl text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-3">
            QR Code Not Found
          </h1>
          <p className="text-gray-600 mb-8">
            The QR code you're looking for doesn't exist or has been deleted.
          </p>
          <button
            onClick={() => navigate({ to: "/my-qrcodes" })}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors"
          >
            <i className="bx bx-arrow-back text-lg" />
            Back to My QR Codes
          </button>
        </div>
      </div>
    );
  }

  const left = (
    <div className="h-full min-h-0 flex flex-col">
      <QrInfoCard
        //need to add backwards compatability for the qrimage svgs
        qrImageSrc={`${qrImageSrc}`}
        title={qrRow?.data?.qrcodeName || "QR Code"}
        type={effectiveQrType}
        description={
          qrRow?.data?.description || `This QR Code doesn't have a description`
        }
        createdAt={createdAt}
        totalScans={totalScans}
        lastScanned={lastScanned}
        typeBadge={typeBadge}
        groupingBadge={groupingBadge}
        projectBadge={projectBadge}
        link={link}
        onEdit={() => setShowEditModal(true)}
        onSetPassword={() => setShowPasswordModal(true)}
        onDownload={() => setShowDownloadModal(true)}
        onShare={() => setShowShareModal(true)}
        onPrint={() => setShowPrintModal(true)}
        onDelete={userCanDelete ? () => setShowDeleteModal(true) : undefined}
        onSettings={() => setShowEditModal(true)}
        onAssignToProject={
          isUnassignedToProject
            ? () => setShowAssignToProjectModal(true)
            : undefined
        }
        onAssignToGroup={
          isUnassignedToGroup && !isUnassignedToProject
            ? () => setShowAssignToGroupModal(true)
            : undefined
        }
        className="h-full flex flex-col"
      />
    </div>
  );

  const right = (
    <div className="h-full min-h-0 flex flex-col">
      {/* Header Actions */}
      <QrHeaderActions
        isToolView={isToolView}
        isProcoreDrawingCodeQR={isProcoreDrawingCodeType}
        isTalihoFileTypeQR={qrType === "file"}
        isTalihoURLTypeQR={qrType === "url"}
        isProjectArchived={isProjectArchived}
        bulkActions={bulkActions}
        onToggleBulk={() => {
          if (!isToolView) {
            setbulkActions((g) => !g);
            setSelected(new Set());
          }
        }}
        onFetchProcore={handleFetchFromProcore}
        onAddItems={handleAddItems}
        onBallInCourt={
          companyRes.data?.procoreIntegration === true && !!project?.procoreProjectID
            ? () => setBicModalOpen(true)
            : undefined
        }
      />

      {/* Breadcrumbs */}
      <QrBreadcrumbs
        items={(function () {
          const items: Array<{ label: string }> = [];
          if (isToolView || showToolType || (isProcoreView && hasTalihoDocs) || isBicView)
            items.push({ label: "Tools" });
          if (isProcoreDrawingCodeType) {
            items.push({ label: "Procore Drawings" });
          }
          if (isDocsView) {
            items.push({ label: "Taliho Documents" });
            for (const seg of folderTrail) items.push({ label: seg.label });
          }
          if (isProcoreView) {
            items.push({ label: "Procore " + (procoreView ?? "") });
            if (procoreView === "Documents")
              for (const seg of procoreFolderTrail)
                items.push({ label: seg.label });
          }
          if (isBicView) {
            items.push({ label: "Task Signoff" });
            if (selectedBicWorkflowId) {
              const wf = (bicWorkflows ?? []).find((w) => w._id === selectedBicWorkflowId);
              if (wf) items.push({ label: wf.name });
            }
          }
          return items;
        })()}
        onCrumbClick={(index) => {
          // For procore-drawing-code, breadcrumb is informational only
          if (isProcoreDrawingCodeType) {
            setSelected(new Set());
            return;
          }
          // Always clear any existing bulk selections when navigating via breadcrumbs
          setSelected(new Set());
          // Determine if a Tools crumb exists (affects indices of following crumbs)
          const hasToolsCrumb =
            isToolView || showToolType || (isProcoreView && hasTalihoDocs) || isBicView;

          // Compute the index of the 'Taliho Documents' crumb when present
          let docsCrumbIndex = -1;
          {
            let idx = 0;
            if (hasToolsCrumb) idx += 1;
            if (isProcoreDrawingCodeType) idx += 1;
            if (isDocsView) docsCrumbIndex = idx;
          }

          // Tools root (only when Tools crumb is rendered)
          if (hasToolsCrumb && index === 0) {
            setForceDocsView(false);
            setProcoreView(null);
            setBicView(false);
            setSelectedBicWorkflowId(null);
            
            setActiveFolderId(null);
            setActiveProcoreFolderId(null);
            setCurrentFolderData(null);
            setCurrentFolderHiddenIds(undefined);
            setProcoreFolderTrailState([]);
            setbulkActions(false);
            setSelected(new Set());
            return;
          }
          // Ball In Court crumb — navigate back to workflow list
          if (isBicView && index === 1) {
            setSelectedBicWorkflowId(null);
            
            return;
          }
          // Documents root when visible (clicking 'Taliho Documents')
          if (isDocsView && docsCrumbIndex >= 0 && index === docsCrumbIndex) {
            setActiveFolderId(null);
            setSelected(new Set());
            return;
          }
          // Procore root crumb (its index depends on whether Tools crumb exists)
          if (isProcoreView && index === (hasToolsCrumb ? 1 : 0)) {
            if (procoreView === "Documents") {
              // Navigate back to root of Documents
              handleNavigateToBreadcrumbFolder(null);
            } else {
              setProcoreView(null);
              setForceDocsView(false);
              setSelected(new Set());
            }
            return;
          }
          // Folder crumbs when in docs view (after 'Taliho Documents')
          if (
            isDocsView &&
            docsCrumbIndex >= 0 &&
            index >= docsCrumbIndex + 1
          ) {
            const segIndex = index - (docsCrumbIndex + 1);
            if (segIndex < 0 || segIndex >= folderTrail?.length) return;
            const target = folderTrail[segIndex];
            setActiveFolderId(target.id);
            setSelected(new Set());
            return;
          }
          // Folder crumbs when in Procore Documents view (after 'Procore Documents')
          if (
            isProcoreView &&
            procoreView === "Documents" &&
            index >= (hasToolsCrumb ? 2 : 1)
          ) {
            const segIndex = index - (hasToolsCrumb ? 2 : 1);
            if (segIndex < 0 || segIndex >= procoreFolderTrail?.length) return;
            const target = procoreFolderTrail[segIndex];
            handleNavigateToBreadcrumbFolder(target.id);
            return;
          }
          // Current Procore tool crumb is a no-op
        }}
      />

      {/* TODO: REIMPLEMENT RECENTLY DELETED TALIHO DOCUMENTS AFTER V3 PUSH */}
      {/* Recently Deleted button — shown only in Taliho documents view */}
      {/* {isDocsView && (
        <div className="flex justify-end pb-2">
          <Button
            type="button"
            variant="secondary"
            leftIconClass="bx bx-trash text-gray-500"
            onClick={() => setShowRecentlyDeletedModal(true)}
          >
            Recently Deleted
          </Button>
        </div>
      )} */}

      {/* Search & Filters */}
      <QrFilters
        query={query}
        onQueryChange={(v) => {
          setQuery(v);
          setSelected(new Set());
        }}
        mode={isProcoreView ? "procore" : isDocsView ? "docs" : "tools"}
        toolRefs={toolTypeFilterOptions.references}
        toolTypes={toolTypeFilterOptions.types}
        docTypes={docsTypeOptions}
        procoreStatuses={procoreFilterOptions.statuses}
        filters={filters}
        onFiltersChange={(next) => setFilters(next)}
        onClear={() => {
          clearAll();
          setSelected(new Set());
        }}
      />

      {/* Bulk Actions Bar */}
      {bulkActions ? (
        <BulkActionsBar
          selectedCount={selected.size}
          showSelectAll
          selectAllChecked={allSelected}
          onSelectAllChange={(checked) => {
            if (checked !== allSelected) toggleSelectAll();
          }}
          onClearSelection={() => setSelected(new Set())}
          actions={
            <>
              {isDocsView ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    leftIconClass="bx bx-folder"
                    onClick={handleBulkMove}
                    disabled={isProjectArchived}
                    title={
                      isProjectArchived
                        ? "This project has been archived"
                        : undefined
                    }
                  >
                    Move
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    leftIconClass="bx bx-trash"
                    onClick={handleBulkDelete}
                    disabled={isProjectArchived}
                    title={
                      isProjectArchived
                        ? "This project has been archived"
                        : undefined
                    }
                  >
                    Delete
                  </Button>
                </>
              ) : isProcoreView ? (
                <>
                  {qrType === "procore-location" ? (
                    // procore-location: tool-specific buttons
                    (() => {
                      const tool = (procoreView || "").toLowerCase();
                      const showHideRemoveTools = new Set([
                        "coordination issues",
                        "incidents",
                        "inspections",
                        "observations",
                        "photos",
                        "punch list",
                        "rfis",
                        "submittals",
                      ]);
                      const removeOnlyTools = new Set([
                        "directory",
                        "documents",
                        "drawings",
                        "forms",
                        "instructions",
                        "specifications",
                        "tasks",
                      ]);
                      if (showHideRemoveTools.has(tool)) {
                        return (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              leftIconClass="bx bx-show"
                              onClick={handleBulkShow}
                              disabled={isProjectArchived}
                              title={
                                isProjectArchived
                                  ? "This project has been archived"
                                  : undefined
                              }
                            >
                              Show
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              leftIconClass="bx bx-x"
                              onClick={handleBulkHideRemove}
                              disabled={isProjectArchived}
                              title={
                                isProjectArchived
                                  ? "This project has been archived"
                                  : undefined
                              }
                            >
                              Hide/Remove
                            </Button>
                          </>
                        );
                      }
                      if (removeOnlyTools.has(tool)) {
                        return (
                          <Button
                            type="button"
                            variant="danger"
                            leftIconClass="bx bx-x"
                            onClick={handleBulkRemove}
                            disabled={isProjectArchived}
                            title={
                              isProjectArchived
                                ? "This project has been archived"
                                : undefined
                            }
                          >
                            Remove
                          </Button>
                        );
                      }
                      // Fallback
                      return (
                        <Button
                          type="button"
                          variant="danger"
                          leftIconClass="bx bx-x"
                          onClick={handleBulkRemove}
                          disabled={isProjectArchived}
                          title={
                            isProjectArchived
                              ? "This project has been archived"
                              : undefined
                          }
                        >
                          Hide/Remove
                        </Button>
                      );
                    })()
                  ) : qrType === "procore-tool" ? (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        leftIconClass="bx bx-show"
                        onClick={handleBulkShow}
                        disabled={isProjectArchived}
                        title={
                          isProjectArchived
                            ? "This project has been archived"
                            : undefined
                        }
                      >
                        Show
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        leftIconClass="bx bx-hide"
                        onClick={handleBulkHide}
                        disabled={isProjectArchived}
                        title={
                          isProjectArchived
                            ? "This project has been archived"
                            : undefined
                        }
                      >
                        Hide
                      </Button>
                    </>
                  ) : qrType === "folder" ? (
                    <Button
                      type="button"
                      variant="danger"
                      leftIconClass="bx bx-x"
                      onClick={handleBulkRemove}
                      disabled={isProjectArchived}
                      title={
                        isProjectArchived
                          ? "This project has been archived"
                          : undefined
                      }
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="danger"
                      leftIconClass="bx bx-x"
                      onClick={handleBulkRemove}
                      disabled={isProjectArchived}
                      title={
                        isProjectArchived
                          ? "This project has been archived"
                          : undefined
                      }
                    >
                      Hide/Remove
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  type="button"
                  variant="danger"
                  leftIconClass="bx bx-x"
                  onClick={handleBulkRemove}
                  disabled={isProjectArchived}
                  title={
                    isProjectArchived
                      ? "This project has been archived"
                      : undefined
                  }
                >
                  Hide/Remove
                </Button>
              )}
            </>
          }
        />
      ) : null}

      {/* Content */}
      <div className="grow min-h-0 overflow-hidden bg-white rounded-lg shadow-sm">
        {procoreLoadingState.showSkeleton ||
        loadingFolderId !== null ||
        isProcoreWaitingForDeps ? (
          <TableSkeleton
            columnCount={
              isToolView
                ? (toolsTable?.columns?.length ?? 5)
                : isDocsView
                  ? (docsTable?.columns?.length ?? 5)
                  : (procoreDataBundle?.columns?.length ?? 5)
            }
            rowCount={10}
            showSelection={bulkActions}
            showActions={isDocsView}
          />
        ) : isToolView ? (
          <div className="h-full flex-1 min-h-0 flex flex-col">
            <QrToolsTable
              columns={
                toolsTable.columns as unknown as {
                  key: string;
                  header: string;
                }[]
              }
              rows={filteredRows as unknown as unknown[]}
              getRowId={
                toolsTable.getRowId as unknown as (r: unknown) => string
              }
              getRowClassName={getRowClassName}
              showSelection={bulkActions}
              isRowSelected={(r) =>
                selected.has(
                  (toolsTable.getRowId as unknown as (r: unknown) => string)(r),
                )
              }
              onToggleRow={(r) =>
                toggleRow(
                  (toolsTable.getRowId as unknown as (r: unknown) => string)(r),
                )
              }
              allSelected={allSelected}
              onToggleAll={toggleSelectAll}
              onRowClick={(row) => {
                if (row?.id === "t-bic") {
                  setBicView(true);
                  setSelectedBicWorkflowId(null);
                  
                  setForceDocsView(false);
                  setProcoreView(null);
                  setSelected(new Set());
                  return;
                }
                if (row?.id === "t-docs") {
                  setForceDocsView(true);
                  setProcoreView(null);
                  setActiveFolderId(null);
                  setSelected(new Set());
                  return;
                }
                if (row?.name) {
                  setForceDocsView(false);
                  setProcoreView(row.name);
                  setActiveProcoreFolderId(null);
                  setCurrentFolderData(null);
                  setCurrentFolderHiddenIds(undefined);
                  setProcoreFolderTrailState([]);
                  setSelected(new Set());
                  // Skeleton automatically shown by procoreLoadingState when switching tools
                }
              }}
            />
          </div>
        ) : isBicView ? (
          <div className="h-full flex-1 min-h-0 flex flex-col px-1">
            <QrBicView
              workflows={bicWorkflows ?? []}
              selectedWorkflowId={selectedBicWorkflowId}
              onSelectWorkflow={(id) => setSelectedBicWorkflowId(id)}
              onSelectTrade={(workflowId, tradeIndex) => {
                setBicModalWorkflowId(workflowId);
                setBicModalTradeIndex(tradeIndex);
              }}
            />
          </div>
        ) : isDocsView ? (
          <div className="h-full flex-1 min-h-0 flex flex-col">
            <QrDocsTable
              columns={
                docsTable.columns as unknown as {
                  key: string;
                  header: string;
                }[]
              }
              rows={filteredRows as unknown as unknown[]}
              getRowId={docsTable.getRowId as unknown as (r: unknown) => string}
              getRowClassName={getRowClassName}
              renderActions={
                docsTable.renderActions as unknown as
                  | ((row: unknown) => React.ReactNode)
                  | undefined
              }
              onRowClick={(row) => {
                const r = row as unknown as {
                  __isFolder?: boolean;
                  id?: string;
                };
                if (r.__isFolder) {
                  // Clear any bulk selections when navigating into a folder
                  setSelected(new Set());
                  if (r.id) setActiveFolderId(r.id);
                  return;
                }
                handlePreviewDoc(row);
              }}
              showSelection={bulkActions}
              isRowSelected={(r) =>
                selected.has(
                  (docsTable.getRowId as unknown as (r: unknown) => string)(r),
                )
              }
              onToggleRow={(r) =>
                toggleRow(
                  (docsTable.getRowId as unknown as (r: unknown) => string)(r),
                )
              }
              allSelected={allSelected}
              onToggleAll={toggleSelectAll}
            />
          </div>
        ) : isProcoreView || isProcoreDrawingCodeType ? (
          <div className="h-full flex-1 min-h-0 flex flex-col">
            {(() => {
              const key = isProcoreDrawingCodeType
                ? "Drawings"
                : (procoreView ?? "");
              // Archived project state - show informative message instead of generic error
              if (isProjectArchived) {
                return (
                  <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <i className="bx bx-archive text-3xl text-gray-400" />
                    </div>
                    <p className="text-gray-600 font-medium mb-2">
                      Project Archived
                    </p>
                    <p className="text-sm text-gray-500 max-w-md">
                      This project has been archived. Procore data is no longer
                      accessible.
                    </p>
                  </div>
                );
              }
              // Error states - show generic error for actual API failures
              if (procoreError)
                return (
                  <div className="flex-1 min-h-0 flex items-center justify-center text-sm text-red-600 p-8 text-center">
                    Failed to load {key}.
                  </div>
                );
              const bundle = procoreDataBundle;
              // Only show "No data" when:
              // 1. NOT waiting for dependencies (company/project IDs loaded)
              // 2. NOT currently fetching (query is idle)
              // 3. Query has actually completed at least once (isFetched)
              // 4. Bundle is genuinely empty after successful fetch
              if (
                !isProcoreWaitingForDeps &&
                !procoreIsFetching &&
                procoreIsFetched &&
                (!bundle ||
                  !Array.isArray(bundle.rows) ||
                  bundle.rows.length === 0)
              ) {
                return (
                  <div className="flex-1 min-h-0 flex items-center justify-center text-sm text-gray-600 p-8 text-center">
                    No data for {procoreView || key}.
                  </div>
                );
              }
              // If we're still waiting for deps or loading, don't render the table yet
              // (the outer skeleton will handle this, but we guard here for type safety)
              if (!bundle || !Array.isArray(bundle.rows)) {
                return null;
              }
              // In "remove" mode, filter out locally-removed items for
              // immediate optimistic UI feedback (cache invalidation
              // handles eventual consistency after the API responds).
              const displayRows =
                procoreActionMode === "remove"
                  ? bundle.rows.filter(
                      (row) =>
                        !localHiddenIds.has(
                          (
                            bundle.getRowId as unknown as (r: unknown) => string
                          )(row),
                        ),
                    )
                  : bundle.rows;
              return (
                <QrProcoreTable
                  keyName={`${key}-${activeProcoreFolderId ?? "root"}`}
                  bundle={bundle}
                  rows={displayRows}
                  getRowClassName={(row) => {
                    const baseClass = getRowClassName(row);
                    const rowId = (
                      bundle.getRowId as unknown as (r: unknown) => string
                    )(row);
                    // Add fade animation for hiding/showing items
                    const fadingClass = fadingIds.has(rowId)
                      ? "transition-all duration-300 ease-in-out opacity-50"
                      : "";
                    return `${baseClass} ${fadingClass}`.trim();
                  }}
                  onRowClick={(row) => {
                    const r = row as unknown as {
                      __isFolder?: boolean;
                      folderId?: number;
                      name?: string;
                      pdfUrl?: string;
                      number?: string;
                      title?: string;
                    };
                    // Navigate into folder for Documents view
                    if (
                      r.__isFolder &&
                      typeof r.folderId === "number" &&
                      procoreView === "Documents"
                    ) {
                      handleNavigateToFolder(r.folderId, r.name);
                      return;
                    }
                    // Documents: open via PdfOpener
                    if (procoreView === "Documents" && !r.__isFolder) {
                      handlePreviewProcoreDoc(row);
                      return;
                    }
                    // Drawings with PDF URL: open via PdfOpener
                    if (procoreView === "Drawings" && r.pdfUrl) {
                      handlePreviewProcoreDoc({
                        name: `${r.number} — ${r.title}`,
                        procoreUrl: r.pdfUrl,
                        typeLabel: "PDF",
                      });
                      return;
                    }
                    // All other tools: look up raw item and open detail modal
                    const toolType = viewToToolKey[procoreView || ""];
                    if (!toolType || !bundle) return;
                    const rowId = (
                      bundle.getRowId as unknown as (r: unknown) => string
                    )(row);
                    const rawItem = rawItemMap.get(rowId);
                    if (rawItem) {
                      setProcorePreview({ toolType, rawItem });
                    }
                  }}
                  showSelection={bulkActions}
                  isRowSelected={(r) =>
                    selected.has(
                      (bundle.getRowId as unknown as (r: unknown) => string)(r),
                    )
                  }
                  onToggleRow={(r) =>
                    toggleRow(
                      (bundle.getRowId as unknown as (r: unknown) => string)(r),
                    )
                  }
                  allSelected={allSelected}
                  onToggleAll={toggleSelectAll}
                />
              );
            })()}
          </div>
        ) : (
          <div className="h-full flex-1 min-h-0 flex items-center justify-center text-sm text-gray-600 p-8 text-center">
            Content for this QR type will appear here.
          </div>
        )}
      </div>
    </div>
  );

  // Modals mounted at page level
  const modals = (
    <>
      {/* Hidden form to open Procore documents (new tab) via backend proxy */}
      <PdfOpener
        procoreUrl={procoreDocToOpen?.procoreUrl}
        formId={procorePdfFormId}
        qrCodeId={id}
      />
      <EditModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        fields={[
          {
            key: "name",
            label: "Name",
            type: "text",
            initialValue: qrRow?.data?.qrcodeName || "",
          },
          {
            key: "description",
            label: "Description",
            type: "textarea",
            initialValue: qrRow?.data?.description || "",
          },
        ]}
        title="Edit QR Code"
        onConfirm={async (values) => {
          try {
            if (!companyIdForProcore) {
              toast.error("Company information is missing. Please try again.");
              return;
            }
            // Map form values to API parameters
            await updateQRCodeDetails(id, {
              qrcodeName: values.name,
              description: values.description,
              companyId: companyIdForProcore,
              projectId: projectIdForProcore || undefined,
            });

            // Show success toast
            toast.success("QR code updated successfully!");

            // Invalidate and refetch the QR code data
            await invalidateQrCaches(queryClient, id);

            // Close the modal
            setShowEditModal(false);
          } catch (error) {
            logQRError(error, "update-qrcode-details", id);
            toast.error("Failed to update QR code. Please try again.");
          }
        }}
      />
      <SetPasswordModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        subjectLabel="QR code"
        initialPasswordActivated={qrRow?.data?.passwordActivated}
        initialPassword={qrRow?.data?.password}
        initialTimezone={qrRow?.data?.timezone}
        initialWeekdayPassword={qrRow?.data?.weekdayPassword}
        initialWeekdayPasswordTimeStart={qrRow?.data?.weekdayPasswordTimeStart}
        initialWeekdayPasswordTimeEnd={qrRow?.data?.weekdayPasswordTimeEnd}
        initialWeekendPassword={qrRow?.data?.weekendPassword}
        initialWeekendPasswordTimeStart={qrRow?.data?.weekendPasswordTimeStart}
        initialWeekendPasswordTimeEnd={qrRow?.data?.weekendPasswordTimeEnd}
        onConfirmValues={async (vals) => {
          try {
            if (!companyIdFromQr) {
              toast.error("Company information is missing. Please try again.");
              return;
            }
            await updateQRCodeDetails(String(id), {
              companyId: companyIdFromQr,
              projectId: projectIdFromQr || undefined,
              passwordActivated: Boolean(vals.passwordActivated),
              password: vals.password,
              timezone: vals.timezone,
              weekdayPassword: Boolean(vals.weekdayPassword),
              weekdayPasswordTimeStart: vals.weekdayPasswordTimeStart,
              weekdayPasswordTimeEnd: vals.weekdayPasswordTimeEnd,
              weekendPassword: Boolean(vals.weekendPassword),
              weekendPasswordTimeStart: vals.weekendPasswordTimeStart,
              weekendPasswordTimeEnd: vals.weekendPasswordTimeEnd,
            });
            toast.success("Password settings saved.");
            await invalidateQrCaches(queryClient, id);
          } catch (e) {
            logQRError(e, "save-password-settings", id);
            toast.error("Failed to save password settings.");
          } finally {
            setShowPasswordModal(false);
          }
        }}
      />
      <DownloadModal
        open={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        subjectLabel="QR code"
        onConfirm={() => {
          setShowDownloadModal(false);
        }}
      />
      <PrintItemsModal
        open={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        selectedCount={1}
        title="Print QR Code"
        companyName={companyRes.data?.companyName ?? "Taliho"}
        companyWebsite={companyRes.data?.companyWebsite}
        brandLogoSrc={companyRes.data?.printBrandingLogo}
        clientName={project?.clientName || ""}
        projectLine={project?.projectName || ""}
        addressLine={
          project
            ? `${project.projectAddress}, ${project?.projectCity}, ${project?.projectState} ${project?.projectZIP}`
            : ""
        }
        groupLine={(arrangementName || equipmentName) ?? ""}
        items={[qrPrintItem]}
        onRefetchUrl={fetchSignedUrl}
        allowMultiple={false}
        maxItemsPerPage={1}
        onConfirm={() => {
          setShowPrintModal(false);
        }}
      />
      <DeleteModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteQRCode}
        title="Delete QR Code"
        subtitle={
          <span>
            Are you sure you want to delete{" "}
            <strong>{qrRow?.data?.qrcodeName || "this QR code"}</strong>?
          </span>
        }
        bodyMessage="This action cannot be undone. All associated documents and data will be permanently removed."
        isLoading={isDeleting}
        size="md"
      />
      <UploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        subjectLabel="QR code"
        subtitle={`Upload files to ${qrRow?.qrcodeName ? "QR code: " + qrRow?.qrcodeName : "this QR code"}`}
        onConfirm={handleUploadModalConfirm}
      />
      <QrFilePreviewModal
        open={showFilePreview}
        title={filePreview?.name || "Preview"}
        type={filePreview?.type}
        downloadHref={filePreview?.downloadHref}
        downloadName={filePreview?.name}
        onClose={closePreview}
        content={(() => {
          if (!filePreview) return null;
          if (filePreview.type === "PDF" && filePreview.src)
            return (
              <iframe
                title="PDF Preview"
                src={filePreview.src}
                className="w-full h-[70vh]"
              />
            );
          if (
            (filePreview.type === "PNG" || filePreview.type === "JPG") &&
            filePreview.src
          )
            return (
              <img
                alt="Image Preview"
                src={filePreview.src}
                className="max-h-[70vh] w-auto mx-auto"
              />
            );
          if (filePreview.type === "TXT")
            return (
              <div className="w-full h-[70vh] overflow-auto p-4 bg-gray-50 text-gray-800">
                {textPreview?.loading ? (
                  <div className="text-sm text-gray-500">Loading text…</div>
                ) : textPreview?.error ? (
                  <div className="text-sm text-red-600">
                    {textPreview.error}
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap break-words font-mono text-sm">
                    {textPreview?.content ?? "No content."}
                  </pre>
                )}
              </div>
            );
          if (filePreview.type === "URL" && filePreview.src) {
            const canEmbed = (() => {
              try {
                const u = new URL(filePreview.src as string);
                const host = u.hostname.toLowerCase();
                return (
                  host === "app.taliho.com" ||
                  host === "files.taliho.com" ||
                  host === "www.taliho.com" ||
                  host === "taliho.com"
                );
              } catch {
                return false;
              }
            })();
            if (canEmbed)
              return (
                <iframe
                  title="URL Preview"
                  src={filePreview.src}
                  className="w-full h-[70vh] zoom-out"
                />
              );
            return (
              <div className="grow flex flex-col items-center justify-center text-gray-600 gap-4 py-12">
                <i className="bx bx-link text-4xl text-indigo-600"></i>
                <div className="text-sm break-all max-w-full px-6 text-center">
                  {filePreview.src}
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={filePreview.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500"
                  >
                    Open in new tab
                  </a>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(filePreview.src as string)
                        .catch(() => undefined);
                    }}
                  >
                    Copy URL
                  </Button>
                </div>
              </div>
            );
          }
          if (
            (filePreview.type === "MP4" || filePreview.type === "MOV") &&
            filePreview.src
          )
            return (
              <video controls className="w-full max-h-[70vh]">
                <source
                  src={filePreview.src}
                  type={
                    filePreview.type === "MP4" ? "video/mp4" : "video/quicktime"
                  }
                />
                Your browser does not support the video tag.
              </video>
            );
          return (
            <div className="grow flex flex-col items-center justify-center text-gray-600 gap-3 py-12">
              <i className="bx bxs-file text-4xl"></i>
              <p className="text-sm">Preview unavailable for this file type.</p>
              <p className="text-sm"> Use Download to open it.</p>
            </div>
          );
        })()}
      />
      <Modal
        open={showConvertNoticeModal}
        onClose={() => {
          setShowConvertNoticeModal(false);
          setPendingAddAction(null);
        }}
        title="Convert to Taliho QR Code?"
        subtitle={
          <span>Are you sure you want to add items to this QR code?</span>
        }
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowConvertNoticeModal(false);
                setPendingAddAction(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setShowConvertNoticeModal(false);
                const action = pendingAddAction;
                setPendingAddAction(null);
                if (action === "fetch") {
                  goToProcoreFetch();
                } else if (action === "add") {
                  setShowUploadModal(true);
                }
              }}
            >
              Continue
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Adding more documents to this QR code will convert it to a Taliho QR
            code.
          </p>
        </div>
      </Modal>
      <Modal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share QR Code"
        subtitle={<span>Copy the link to share this QR code.</span>}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowShareModal(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="primary"
              leftIconClass="bx bx-link"
              onClick={() => {
                if (link?.url) {
                  void navigator.clipboard
                    .writeText(link.url)
                    .catch(() => undefined);
                }
                setShowShareModal(false);
              }}
            >
              Copy Link
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Link
          </label>
          <input
            readOnly
            value={link?.url || ""}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
          />
        </div>
      </Modal>

      <ProcoreItemDetailModal
        preview={procorePreview}
        onClose={() => setProcorePreview(null)}
        qrCodeId={id}
      />

      <TalihoItemModalMap
        docEdit={{
          open: showDocEditModal,
          fields: [
            {
              key: "name",
              label: activeItemIsFolder ? "Folder Name" : "Document Name",
              type: "text",
              initialValue: activeItemName,
            },
            {
              key: "description",
              label: "Description",
              type: "textarea",
              initialValue: "",
            },
          ],
          title: activeItemIsFolder ? "Edit Folder" : "Edit Document",
          subtitle: activeItemIsFolder
            ? "Update folder details"
            : "Update document details",
          onConfirm: async (values) => {
            const nextName = (values.name || "").trim();
            if (!activeDocId) {
              toast.error("No item selected");
              return;
            }
            if (!nextName) {
              toast.error(
                activeItemIsFolder
                  ? "Folder name is required"
                  : "Document name is required",
              );
              return;
            }

            try {
              if (activeItemIsFolder) {
                const result = await updateFolder(activeDocId, {
                  companyId: companyIdFromQr,
                  projectId: projectIdFromQr || undefined,
                  qrcodeId: id,
                  folderName: nextName,
                });
                if (!result.success) {
                  toast.error(result.message || "Failed to rename folder");
                  return;
                }
                toast.success("Folder renamed successfully");
              } else {
                await updateDocument(activeDocId, {
                  companyId: companyIdFromQr,
                  projectId: projectIdFromQr || undefined,
                  documentName: nextName,
                });
                toast.success("Document renamed successfully");
              }

              setShowDocEditModal(false);
              setActiveDocId(null);
              void invalidateQrCaches(queryClient, id);
            } catch (error) {
              logDocumentError(error, "rename-doc-or-folder", {
                qrcodeId: id,
                itemId: activeDocId,
                itemType: activeItemIsFolder ? "folder" : "document",
              });
              toast.error(
                activeItemIsFolder
                  ? "Failed to rename folder"
                  : "Failed to rename document",
              );
            }
          },
          onClose: () => {
            setShowDocEditModal(false);
            setActiveDocId(null);
          },
        }}
        docUpload={{
          open: showDocUploadModal,
          title: "Upload to Folder",
          subtitle: `Upload files to current folder`,
          onConfirm: handleDocUploadModalConfirm,
          onClose: () => {
            setShowDocUploadModal(false);
            setActiveDocId(null);
          },
        }}
        docMove={{
          open: showDocMoveModal,
          subjectLabel: "document",
          onConfirm: async (folderId) => {
            if (!activeDocId) {
              toast.error("No document selected");
              return;
            }

            try {
              const result = await moveDocument(
                activeDocId,
                folderId,
                companyIdFromQr,
                projectIdFromQr || undefined,
              );

              if (result.success) {
                toast.success("Document moved successfully");
                setShowDocMoveModal(false);
                setActiveDocId(null);
                // Refresh QR code data to show updated document location
                void invalidateQrCaches(queryClient, id);
              } else {
                toast.error(result.message || "Failed to move document");
              }
            } catch (error) {
              logDocumentError(error, "move-document", {
                qrcodeId: id,
                documentId: activeDocId,
              });
              toast.error("An error occurred while moving the document");
            }
          },
          onClose: () => {
            setShowDocMoveModal(false);
            setActiveDocId(null);
          },
          // Folder validation props
          folderOptions: folderOptions,
          currentFolderId:
            activeDocParentFolderId ?? activeFolderId ?? undefined,
        }}
        docDelete={{
          open: showDocDeleteModal,
          title: activeItemIsFolder ? "Delete Folder" : "Delete Document",
          subtitle: activeItemIsFolder
            ? "Are you sure you want to delete this folder?"
            : "Are you sure you want to delete this document?",
          bodyMessage:
            activeItemIsFolder
              ? "This folder and its contents will be moved to trash. They can be restored within 30 days."
              : "This document will be moved to trash. It can be restored within 30 days.",
          onConfirm: async () => {
            if (activeDocId) {
              if (activeItemIsFolder) {
                const result = await deleteFolder(
                  activeDocId,
                  companyIdFromQr,
                  projectIdFromQr || undefined,
                );
                if (result.success) {
                  toast.success("Folder deleted successfully");
                  confirmHideItem(activeDocId);
                  void invalidateQrCaches(queryClient, id);
                } else {
                  toast.error(result.message || "Failed to delete folder");
                }
              } else {
                const result = await deleteDocument(
                  activeDocId,
                  companyIdFromQr,
                  projectIdFromQr || undefined,
                );
                if (result.success) {
                  toast.success("Document deleted successfully");
                  confirmHideItem(activeDocId);
                  void invalidateQrCaches(queryClient, id);
                } else {
                  toast.error(result.message || "Failed to delete document");
                }
              }
            }
            setShowDocDeleteModal(false);
            setActiveDocId(null);
          },
          onClose: () => {
            setShowDocDeleteModal(false);
            setActiveDocId(null);
          },
        }}
        bulkDocDelete={{
          open: showBulkDocDeleteModal,
          selectedCount: selected.size,
          subjectLabel: "item",
          title: "Delete Selected Items",
          bodyMessage:
            "Selected documents and folders will be moved to trash. They can be restored within 30 days.",
          onConfirm: async () => {
            const itemIds = Array.from(selected);
            await handleBulkDocumentAndFolderDelete(itemIds);
            setShowBulkDocDeleteModal(false);
            setSelected(new Set());
            setbulkActions(false);
          },
          onClose: () => setShowBulkDocDeleteModal(false),
        }}
        bulkUpload={{
          open: showBulkUploadModal,
          title: "Upload Documents",
          subtitle: `Upload documents to the current folder (${selected.size} items selected)`,
          onConfirm: handleBulkUploadModalConfirm,
          onClose: () => setShowBulkUploadModal(false),
        }}
        bulkMove={{
          open: showBulkMoveModal,
          selectedCount: selected.size,
          subjectLabel: "document",
          onConfirm: async (folderId) => {
            const documentIds = Array.from(selected);

            if (documentIds.length === 0) {
              toast.error("No documents selected");
              return;
            }

            try {
              const result = await moveDocumentsBulk(
                documentIds,
                folderId,
                companyIdFromQr,
                projectIdFromQr || undefined,
              );

              if (result.success) {
                toast.success(
                  result.message ||
                    `Moved ${documentIds.length} document(s) successfully`,
                );
                setShowBulkMoveModal(false);
                setSelected(new Set());
                setbulkActions(false);
                // Refresh QR code data to show updated document locations
                void invalidateQrCaches(queryClient, id);
              } else {
                toast.error(result.message || "Failed to move documents");
              }
            } catch (error) {
              logDocumentError(error, "bulk-move-documents", {
                qrcodeId: id,
                documentCount: documentIds.length,
              });
              toast.error("An error occurred while moving documents");
            }
          },
          onClose: () => setShowBulkMoveModal(false),
          // Folder validation props
          folderOptions: folderOptions,
          currentFolderId: activeFolderId ?? undefined,
        }}
        bulkDelete={{
          open: showBulkDeleteModal,
          selectedCount: selected.size,
          subjectLabel: "item",
          title: `Delete ${selected.size} Item${selected.size !== 1 ? "s" : ""}`,
          subtitle: "Are you sure you want to delete these selected items?",
          onConfirm: async () => {
            const itemIds = Array.from(selected);
            await handleBulkDocumentAndFolderDelete(itemIds);
            setShowBulkDeleteModal(false);
            setSelected(new Set());
            setbulkActions(false);
          },
          onClose: () => setShowBulkDeleteModal(false),
        }}
        hideRemove={{
          open: showHideRemoveModal,
          title: "Hide/Remove Item",
          bodyMessage:
            "This item will be hidden from view. You can restore it later.",
          confirmLabel: "Hide",
          onConfirm: () => {
            if (activeDocId) confirmHideItem(activeDocId);
            setShowHideRemoveModal(false);
            setActiveDocId(null);
          },
          onClose: () => {
            setShowHideRemoveModal(false);
            setActiveDocId(null);
          },
        }}
        bulkHideRemove={{
          open: showBulkHideRemoveModal,
          selectedCount: selected.size,
          subjectLabel: "item",
          title: `Hide/Remove ${selected.size} Item${selected.size !== 1 ? "s" : ""}`,
          bodyMessage:
            "These items will be hidden from view. You can restore them later.",
          confirmLabel: "Hide/Remove",
          onConfirm: () => {
            confirmBulkRemove();
            setShowBulkHideRemoveModal(false);
          },
          onClose: () => setShowBulkHideRemoveModal(false),
        }}
      />

      <DeleteModal
        open={pendingRemoveItemId !== null}
        title="Remove Procore Item"
        bodyMessage="This will permanently remove this Procore item link from the QR code. This action cannot be undone."
        confirmLabel="Remove"
        onConfirm={() => {
          const itemId = pendingRemoveItemId;
          setPendingRemoveItemId(null);
          if (!itemId || !companyIdForProcore || !projectIdForProcore) return;

          // Start fade animation
          setFadingIds((prev) => {
            const next = new Set(prev);
            next.add(itemId);
            return next;
          });

          // Optimistically hide the item immediately
          setLocalHiddenIds((prev) => {
            const next = new Set(prev);
            next.add(itemId);
            return next;
          });

          // Call delete API
          deleteSingleProcoreItem({
            companyId: companyIdForProcore,
            projectId: projectIdForProcore,
            procoreItemID: String(itemId || ""),
            qrcodeId: id,
          })
            .then(() => {
              toast.success("Item removed from QR code successfully");

              // Clear fading state after animation completes
              setTimeout(() => {
                setFadingIds((prev) => {
                  const next = new Set(prev);
                  next.delete(itemId);
                  return next;
                });
              }, 300);

              // Invalidate cached data so table refreshes with item removed
              queryClient.invalidateQueries({ queryKey: ["ProcoreTool"] });
              queryClient.invalidateQueries({
                queryKey: ["QrProcoreTools", id],
              });
              void invalidateQrCaches(queryClient, id);
            })
            .catch((error) => {
              // Revert optimistic update on error
              setFadingIds((prev) => {
                const next = new Set(prev);
                next.delete(itemId);
                return next;
              });
              setLocalHiddenIds((prev) => {
                const next = new Set(prev);
                next.delete(itemId);
                return next;
              });

              // Show error toast to user
              let message = "Failed to remove item.";
              if (typeof error === "object" && error !== null) {
                const maybeResponse = (
                  error as { response?: { data?: { message?: string } } }
                ).response;
                message =
                  maybeResponse?.data?.message ??
                  (error instanceof Error ? error.message : message);
              }
              toast.error(message);
            });
        }}
        onClose={() => setPendingRemoveItemId(null)}
      />


      {/* Assign to Project Modal */}
      <AssignToModal
        open={showAssignToProjectModal}
        selectedCount={1}
        onClose={() => setShowAssignToProjectModal(false)}
        onConfirm={async (result) => {
          if (result.mode === "existing" && result.existingId) {
            await handleAssignToProject(result.existingId);
          } else if (result.mode === "new" && result.newName) {
            // Open CreateProjectModal with the new name
            setPendingProjectName(result.newName);
            setShowAssignToProjectModal(false);
            setShowCreateProjectModal(true);
          }
        }}
        title="Assign to Project"
        subtitle="Assign this QR code to a project."
        selectedSubjectLabel="QR code"
        targetLabel="Project"
        options={projectOptions}
        allowNew={true}
        existingLabel="Existing project"
        newLabel="Create new project"
        selectLabel="Select a project"
        newNameLabel="New project name"
        newNamePlaceholder="Enter project name"
        confirmLabel="Assign"
        loadingLabel="Assigning..."
        isLoading={isAssigning}
        size="lg"
      />

      {/* Create Project Modal (from assign flow) */}
      <CreateProjectModal
        open={showCreateProjectModal}
        onClose={() => {
          setShowCreateProjectModal(false);
          setPendingProjectName("");
        }}
        companyId={companyIdFromQr}
        subtitle="Create a new project and assign this QR code to it."
        initialProjectName={pendingProjectName}
        onSuccess={async (newProjectId) => {
          // Assign QR code to newly created project
          await handleAssignToProject(newProjectId);
          setShowCreateProjectModal(false);
          setPendingProjectName("");
        }}
      />

      {/* Assign to Group Modal */}
      <AssignToModal
        open={showAssignToGroupModal}
        selectedCount={1}
        onClose={() => setShowAssignToGroupModal(false)}
        onConfirm={async (result) => {
          if (result.mode === "existing" && result.existingId) {
            await handleAssignToGroup(result.existingId);
          } else if (result.mode === "new" && result.newName) {
            // Create a new group and assign the QR code to it
            if (!companyIdFromQr || !projectIdFromQr) {
              toast.error("Cannot create group: project is required");
              return;
            }
            setIsAssigning(true);
            try {
              const newGroupResponse = await createGroup({
                companyId: companyIdFromQr,
                projectId: projectIdFromQr,
                groupName: result.newName,
                type: "arrangement", // Default to arrangement type
              });
              if (newGroupResponse?.data?._id) {
                await handleAssignToGroup(newGroupResponse.data._id);
              }
            } catch (error) {
              logQRError(error, "create-group-and-assign-failed", id);
              toast.error("Failed to create group");
            } finally {
              setIsAssigning(false);
            }
          }
        }}
        title="Assign to Group"
        subtitle="Assign this QR code to a group."
        selectedSubjectLabel="QR code"
        targetLabel="Group"
        options={groupOptions}
        allowNew={true}
        existingLabel="Existing group"
        newLabel="Create new group"
        selectLabel="Select a group"
        newNameLabel="New group name"
        newNamePlaceholder="Enter group name"
        confirmLabel="Assign"
        loadingLabel="Assigning..."
        isLoading={isAssigning}
        size="lg"
      />
    </>
  );

  return (
    <div className="mx-auto h-full w-full p-8">
      <div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-5 xl:grid-cols-3 gap-6">
        <div className="h-full min-h-0 lg:col-span-2 xl:col-span-1">{left}</div>
        <div className="h-full min-h-0 lg:col-span-3 xl:col-span-2">
          {right}
        </div>
      </div>
      {modals}
      <RecentlyDeletedDocuments
        open={showRecentlyDeletedModal}
        onClose={() => setShowRecentlyDeletedModal(false)}
        companyId={companyIdFromQr}
        projectId={projectIdFromQr || undefined}
        qrcodeId={id}
      />
      <BallInCourtModal
        open={bicModalOpen}
        onClose={() => setBicModalOpen(false)}
        qrCodeId={id}
        companyId={companyIdFromQr}
        projectId={projectIdFromQr || undefined}
        procoreProjectId={project?.procoreProjectID || undefined}
      />
      <BicTradeDetailModal
        open={bicModalTradeIndex !== null && bicModalWorkflowId !== null}
        onClose={() => {
          setBicModalTradeIndex(null);
          setBicModalWorkflowId(null);
        }}
        workflowId={bicModalWorkflowId}
        tradeIndex={bicModalTradeIndex}
      />
    </div>
  );
}
