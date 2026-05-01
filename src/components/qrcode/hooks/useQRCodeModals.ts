import { useState } from "react";

/**
 * Consolidates all modal open/close state for the QR code detail page.
 *
 * Each modal has a boolean state and open/close handlers.
 */
export function useQRCodeModals() {
  // QR-level action modals
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);

  // Document action modals
  const [showDocEditModal, setShowDocEditModal] = useState<boolean>(false);
  const [showDocUploadModal, setShowDocUploadModal] = useState<boolean>(false);
  const [showDocMoveModal, setShowDocMoveModal] = useState<boolean>(false);
  const [showDocDeleteModal, setShowDocDeleteModal] = useState<boolean>(false);

  // Bulk action modals
  const [showBulkUploadModal, setShowBulkUploadModal] =
    useState<boolean>(false);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState<boolean>(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] =
    useState<boolean>(false);
  const [showBulkDocDeleteModal, setShowBulkDocDeleteModal] =
    useState<boolean>(false);
  const [showHideRemoveModal, setShowHideRemoveModal] =
    useState<boolean>(false);
  const [showBulkHideRemoveModal, setShowBulkHideRemoveModal] =
    useState<boolean>(false);

  // Convert notice modal
  const [showConvertNoticeModal, setShowConvertNoticeModal] =
    useState<boolean>(false);

  // Recently deleted modal
  const [showRecentlyDeletedModal, setShowRecentlyDeletedModal] =
    useState<boolean>(false);

  // Assign to project/group modals
  const [showAssignToProjectModal, setShowAssignToProjectModal] =
    useState<boolean>(false);
  const [showAssignToGroupModal, setShowAssignToGroupModal] =
    useState<boolean>(false);
  const [showCreateProjectModal, setShowCreateProjectModal] =
    useState<boolean>(false);
  const [pendingProjectName, setPendingProjectName] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [pendingAddAction, setPendingAddAction] = useState<
    "fetch" | "add" | null
  >(null);

  // Procore item remove confirmation
  const [pendingRemoveItemId, setPendingRemoveItemId] = useState<string | null>(
    null,
  );

  return {
    // QR-level modals
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

    // Document action modals
    showDocEditModal,
    setShowDocEditModal,
    showDocUploadModal,
    setShowDocUploadModal,
    showDocMoveModal,
    setShowDocMoveModal,
    showDocDeleteModal,
    setShowDocDeleteModal,

    // Bulk action modals
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

    // Convert notice modal
    showConvertNoticeModal,
    setShowConvertNoticeModal,

    // Recently deleted modal
    showRecentlyDeletedModal,
    setShowRecentlyDeletedModal,

    // Assign to project/group modals
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

    // Procore item remove confirmation
    pendingRemoveItemId,
    setPendingRemoveItemId,
  };
}
