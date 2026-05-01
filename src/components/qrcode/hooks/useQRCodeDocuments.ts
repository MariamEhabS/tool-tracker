import { useState } from "react";

/**
 * Consolidates document-related state for the QR code detail page.
 *
 * Includes:
 * - Active document tracking (for single-doc modals)
 * - Taliho folder navigation state
 * - Procore folder navigation state
 * - Force-docs-view override
 * - Procore view state
 */
export function useQRCodeDocuments() {
  // Active document for single-document modals (edit, move, delete, upload-to)
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  // Taliho folder navigation
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // Force docs view override (when clicking into Taliho Documents from ToolType table)
  const [forceDocsView, setForceDocsView] = useState<boolean>(false);

  // Procore folder navigation state (for Documents tool)
  const [activeProcoreFolderId, setActiveProcoreFolderId] = useState<
    number | null
  >(null);

  // Store current folder data for Documents view (overrides procoreData when navigating)
  const [currentFolderData, setCurrentFolderData] = useState<Record<
    string,
    unknown
  > | null>(null);

  // Store hidden IDs from folder navigation
  const [currentFolderHiddenIds, setCurrentFolderHiddenIds] = useState<
    Array<string | number> | undefined
  >(undefined);

  // Track loading state for folder navigation (used for skeleton during folder navigation)
  const [loadingFolderId, setLoadingFolderId] = useState<number | null>(null);

  // Incrementally-built breadcrumb trail for Procore Documents folder navigation.
  // Each entry records the folder id and display name, pushed on navigate-in
  // and truncated on breadcrumb-click-back.
  const [procoreFolderTrailState, setProcoreFolderTrailState] = useState<
    Array<{ id: number; label: string }>
  >([]);

  // Procore view selection (which tool is currently displayed)
  const [procoreView, setProcoreView] = useState<string | null>(null);

  return {
    // Active document
    activeDocId,
    setActiveDocId,

    // Taliho folder navigation
    activeFolderId,
    setActiveFolderId,

    // Force docs view
    forceDocsView,
    setForceDocsView,

    // Procore folder navigation
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

    // Procore view
    procoreView,
    setProcoreView,
  };
}
