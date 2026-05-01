// import AppShell from '@components/layout/AppShell';
import Button from "@components/ui/Button";
import Breadcrumbs from "@components/ui/Breadcrumbs";
import ItemCard from "@components/ui/ItemCard";
import EmptyState from "@components/ui/EmptyState";
import Badge from "@components/ui/Badge";
import { computeTypeBadge } from "@/lib/badges";
import { ProcoreFetchGate, useProcoreAccess } from "@components/procore";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import procoreIcon from "@assets/images/procore-icon.png";
import { useState, useMemo, useRef, useEffect } from "react";
import {
  createFileRoute,
  Link,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import {
  PROCORE_TOOL_CONFIGS,
  type ProcoreToolKey,
} from "@components/modal/config/ProcoreFetchToolConfig";
import Modal from "@components/modal/Modal";
import CreateProjectModal from "@components/modal/taliho/CreateProjectModal";
import CSVImportModal from "@components/modal/taliho/CSVImportModal";
import DataTable, { type Column } from "@components/table/DataTable";
import { useSingleQRCode } from "@/api/endpoints/qr-codes";
import {
  useSingleProject,
  useSingleProjectByIdOnly,
} from "@/api/endpoints/projects";
import {
  useProcorePermissions,
  useProcoreTools,
} from "@/api/endpoints/procore";
import { toolsMap } from "@/utils/toolMap";
import { useProcoreToolData } from "@/utils/hooks/useProcoreToolData";
import { getFolders } from "@/api/endpoints/tools";
import {
  createProcoreItemsBulk,
  type BulkProcoreItemEntry,
} from "@/api/endpoints/procore-item";
import { updateQRCodeDetails } from "@/api/endpoints/qr-codes";
import {
  useProcoreFetchGlobalTool,
  useSingleGroup,
  groupsKeys,
} from "@/api/endpoints/groups";
import { procoreToolKeys } from "@/api/endpoints/procore-tools";
import { QrProcoreToolsKeys } from "@/api/endpoints/qr-procore-tools";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { logProcoreError } from "@/utils/rollbar";
import { getStoredUser } from "@/utils/getStoredUser";

type ToolCard = {
  key: string;
  label: string;
  iconClass: string;
  bgClass: string;
  textClass: string;
};

// Trial status badge component - displays remaining trial days
// Must be rendered inside ProcoreFetchGate to access the context
function TrialBadge() {
  const { accessStatus } = useProcoreAccess();
  if (
    accessStatus?.reason !== "free_trial" ||
    !accessStatus.trialDaysRemaining
  ) {
    return null;
  }
  return (
    <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-md px-3 py-1.5 text-sm ml-4">
      <i className="bx bx-time text-orange-500" />
      <span className="text-orange-800">
        Trial: {accessStatus.trialDaysRemaining} day
        {accessStatus.trialDaysRemaining !== 1 ? "s" : ""} remaining
      </span>
    </div>
  );
}

// const STATIC_TOOL_CARDS: ToolCard[] = Object.values(PROCORE_TOOL_CONFIGS).map(
//   (cfg) => ({
//     key: cfg.key,
//     label: cfg.label,
//     iconClass: cfg.iconClass,
//     bgClass: cfg.bgClass,
//     textClass: cfg.textClass,
//   }),
// );

type SelectedItem = {
  id: string;
  title: string;
  label: string;
  bgClass: string;
  textClass: string;
  iconClass: string;
  qrCodeName?: string;
};

/**
 * Entry Point Validation Note:
 *
 * This route validates entry points (selectedIds for QR context, groupId for Group context)
 * within the component rather than using TanStack Router's beforeLoad/loader.
 *
 * Rationale:
 * 1. The project's established pattern uses component-level validation (no routes use beforeLoad/loader)
 * 2. validateSearch handles parameter parsing and type coercion (lines below)
 * 3. The component's hasNoEntryPoint, hasDataError, and hasGlobalFetchError states provide
 *    appropriate error UI with contextual messages and "Go Back" buttons
 * 4. This approach allows for more nuanced error handling based on cascading data dependencies
 *    (e.g., QR -> Project -> Procore connection chain)
 */
export const Route = createFileRoute("/procore/fetch")({
  component: RouteComponent,
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    selectedIds: string[] | undefined;
    groupId: string | undefined;
    projectId?: string | undefined;
    returnTo: string | undefined;
    returnParams: Record<string, string> | undefined;
  } => {
    // Parse and validate search parameters
    const selectedIds = Array.isArray(search.selectedIds)
      ? search.selectedIds.filter((id): id is string => typeof id === "string")
      : typeof search.selectedIds === "string"
        ? [search.selectedIds]
        : undefined;
    const groupId =
      typeof search.groupId === "string" ? search.groupId : undefined;
    const projectId =
      typeof search.projectId === "string" ? search.projectId : undefined;
    const returnTo =
      typeof search.returnTo === "string" ? search.returnTo : undefined;
    const returnParams =
      search.returnParams &&
      typeof search.returnParams === "object" &&
      !Array.isArray(search.returnParams)
        ? (search.returnParams as Record<string, string>)
        : undefined;

    // Validate: must have selectedIds OR groupId OR projectId
    if ((!selectedIds || selectedIds.length === 0) && !groupId && !projectId) {
      // Return empty values - component will handle showing error UI
      return {
        selectedIds: undefined,
        groupId: undefined,
        projectId: undefined,
        returnTo,
        returnParams,
      };
    }

    return { selectedIds, groupId, projectId, returnTo, returnParams };
  },
});

function RouteComponent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Get company from Redux for early gate check
  const reduxCompany = useSelector((state: RootState) => state.company);
  const reduxCompanyId = reduxCompany?._id || "";

  const search = useSearch({ from: "/procore/fetch" }) as {
    selectedIds?: string[];
    groupId?: string;
    projectId?: string;
    returnTo?: string;
    returnParams?: Record<string, string>;
  };
  const firstQrId = (search?.selectedIds && search.selectedIds[0]) || "";
  const groupId = search?.groupId || "";
  const projectIdParam = search?.projectId || "";

  // Early entry point validation - detect missing params before data fetching
  // This allows us to show error UI immediately without waiting for API calls.
  // The hooks below use `enabled` conditions so they won't make unnecessary requests.
  const hasNoEntryPoint = !firstQrId && !groupId && !projectIdParam;

  // Determine if this is a global group fetch or single QR fetch
  const isGlobalFetch = Boolean(groupId && !firstQrId);
  // Determine if this is a project-level fetch (project context without QR or group)
  const isProjectFetch = Boolean(projectIdParam && !firstQrId && !groupId);

  // Fetch group data for global fetch
  const { data: groupData, isLoading: groupLoading } = useSingleGroup(groupId);
  // activeToolKey must be declared before the per-tool hook that depends on it
  const [activeToolKey, setActiveToolKey] = useState<ProcoreToolKey | null>(
    null,
  );
  // Per-tool global fetch: only fetch the specific tool's data when user opens a tool modal
  // Each tool gets its own React Query cache entry for independent fetching and caching
  const { data: globalToolData, isLoading: globalToolLoading } =
    useProcoreFetchGlobalTool(
      isGlobalFetch ? groupId : "",
      activeToolKey || "",
    );

  // Fetch QR and then project to discover Procore IDs (for single QR fetch)
  const { data: qrData, isLoading: qrLoading } = useSingleQRCode(firstQrId);

  // Use group data for global fetch, QR data for single fetch
  // Note: company and project fields can be:
  // 1. A string ID (already serialized)
  // 2. A MongoDB ObjectId (object that converts to string via toString())
  // 3. A populated object with _id property
  type GroupDataResponse = { data?: { company?: unknown; project?: unknown } };
  type QRDataResponse = { data?: { company?: unknown; project?: unknown } };

  // Helper to extract ID from a field that could be a string, ObjectId, or populated object
  const extractId = (value: unknown): string => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object" && value !== null) {
      // Check for populated object with _id first
      const obj = value as Record<string, unknown>;
      if (obj._id) return String(obj._id);
      // MongoDB ObjectId - convert directly to string (calls toString())
      return String(value);
    }
    return "";
  };

  // Extract initial IDs from QR/group data (or use projectIdParam for project context)
  const initialCompanyId = isProjectFetch
    ? "" // Will be derived from project data below
    : isGlobalFetch
      ? extractId((groupData as GroupDataResponse | undefined)?.data?.company)
      : extractId((qrData as QRDataResponse | undefined)?.data?.company);
  const projectId = isProjectFetch
    ? projectIdParam
    : isGlobalFetch
      ? extractId((groupData as GroupDataResponse | undefined)?.data?.project)
      : extractId((qrData as QRDataResponse | undefined)?.data?.project);

  // Use standard project fetch when we have both IDs
  const { data: projectResp, isLoading: projectLoading } = useSingleProject(
    initialCompanyId || "",
    projectId || "",
  );

  // Fallback: fetch project by ID only when companyId is missing but projectId exists
  // This handles legacy QR codes that have project but no company reference,
  // and also handles the project context where we only have a projectId
  const { data: projectByIdResp, isLoading: projectByIdLoading } =
    useSingleProjectByIdOnly(!initialCompanyId && projectId ? projectId : "");

  // Handle both wrapped { data: Project } and unwrapped Project response structures
  type ProjectData = {
    procoreCompanyID?: string | number;
    procoreProjectID?: string | number;
    projectName?: string;
    company?: string | { _id?: string };
  };
  type ProjectResponse = { data?: ProjectData } & ProjectData;

  // Use whichever project response is available (prefer standard fetch, fallback to by-id-only)
  const effectiveProjectResp = projectResp || projectByIdResp;
  const effectiveProjectLoading = initialCompanyId
    ? projectLoading
    : projectByIdLoading;

  const projectRespCast = effectiveProjectResp as unknown as
    | ProjectResponse
    | undefined;
  // Try nested data first, fall back to top-level (handles both response formats)
  const projectRespData = projectRespCast?.data || projectRespCast;

  // Derive companyId from project if missing from QR code (handles legacy data)
  const companyId =
    initialCompanyId || extractId(projectRespData?.company) || "";

  const procoreCompanyId =
    projectRespData?.procoreCompanyID || projectRespData?.procoreCompanyID === 0
      ? String(projectRespData.procoreCompanyID)
      : "";
  const procoreProjectId =
    projectRespData?.procoreProjectID || projectRespData?.procoreProjectID === 0
      ? String(projectRespData.procoreProjectID)
      : "";
  // For global fetch, use the data from the backend endpoint
  // For single QR fetch, use the existing permissions/tools queries
  const {
    data: permissionsData,
    isLoading: permissionsLoading,
    error: permissionsError,
  } = useProcorePermissions(
    companyId || "",
    projectId || "",
    procoreCompanyId || "",
    procoreProjectId || "",
  );
  const {
    data: toolsData,
    isLoading: toolsLoading,
    error: toolsError,
  } = useProcoreTools(companyId || "", projectId || "");

  // Track loading state for tool cards - account for cascading dependencies
  // Only show loading if queries are actively running, not if they're disabled
  // group/QR/project -> project data -> permissions/tools
  const isLoadingToolCards = isGlobalFetch
    ? groupLoading ||
      effectiveProjectLoading ||
      // Only show permissionsLoading if the query is actually enabled
      (Boolean(procoreCompanyId) &&
        Boolean(procoreProjectId) &&
        permissionsLoading) ||
      // Only show toolsLoading if the query is actually enabled
      (Boolean(companyId) && Boolean(projectId) && toolsLoading)
    : isProjectFetch
      ? effectiveProjectLoading ||
        // Only show permissionsLoading if the query is actually enabled
        (Boolean(procoreCompanyId) &&
          Boolean(procoreProjectId) &&
          permissionsLoading) ||
        // Only show toolsLoading if the query is actually enabled
        (Boolean(companyId) && Boolean(projectId) && toolsLoading)
      : qrLoading ||
        // Show loading while fetching project (either with companyId or by-id-only fallback)
        effectiveProjectLoading ||
        // Only show permissionsLoading if the query is actually enabled
        (Boolean(procoreCompanyId) &&
          Boolean(procoreProjectId) &&
          permissionsLoading) ||
        // Only show toolsLoading if the query is actually enabled
        (Boolean(companyId) && Boolean(projectId) && toolsLoading);

  // Detect error states - when data chain is broken
  // Use effectiveProjectResp to check if project was fetched (either via standard or fallback hook)
  const hasDataError =
    !isGlobalFetch &&
    !isLoadingToolCards &&
    // No QR ID provided
    (!firstQrId ||
      // QR fetched but no project association (companyId can be derived from project)
      (qrData && !projectId) ||
      // Project fetched but no Procore connection
      (effectiveProjectResp &&
        (!procoreCompanyId ||
          !procoreProjectId ||
          procoreProjectId === "none")));

  // Detect error states for global fetch (Group context)
  const hasGlobalFetchError =
    isGlobalFetch &&
    !isLoadingToolCards &&
    // No group ID provided
    (!groupId ||
      // Group fetched but doesn't exist (no data returned)
      (groupData && !groupData.data) ||
      // Group fetched but no project association (companyId can be derived from project)
      (groupData?.data && !projectId) ||
      // Project fetched but no Procore connection
      (effectiveProjectResp &&
        (!procoreCompanyId ||
          !procoreProjectId ||
          procoreProjectId === "none")));

  // Note: hasNoEntryPoint is defined earlier (after search param extraction)
  // to enable early detection before data fetching hooks

  type ProcoreTool = {
    available_for_user?: boolean;
    name: string;
    friendly_name: string;
  };

  // Primary matching: Procore friendly_name -> our tool.title
  const titleToConfigKey = useMemo(() => {
    const map: Record<string, ProcoreToolKey> = {};
    const add = (k: string, v: ProcoreToolKey) => {
      const key = k.trim().toLowerCase();
      map[key] = v;
      // Also add a sanitized variant without punctuation/spaces for robustness (e.g., "rfi's" -> "rfis")
      const sanitized = key.replace(/[^a-z0-9]+/g, "");
      if (sanitized && !(sanitized in map)) {
        map[sanitized] = v;
      }
    };
    Object.entries(toolsMap).forEach(([, val]) => {
      const backend = (val as { backendEnumValue: string }).backendEnumValue;
      const title = (val as { title: string }).title;
      if (
        title &&
        backend &&
        (backend as ProcoreToolKey) in PROCORE_TOOL_CONFIGS
      ) {
        add(title, backend as ProcoreToolKey);
      }
    });
    return map;
  }, []);

  const procoreToolOptions = useMemo(() => {
    // Both single QR and global fetch contexts use the same logic:
    // Build tool options from permissions and active tools data.
    // This avoids fetching all Procore tool data upfront for global fetch.

    // Whitelist matching v2 fetch page
    const WHITELIST = new Set(
      [
        "Coordination Issues",
        "Directory",
        "Documents",
        "Drawings",
        "Forms",
        "Incidents",
        "Inspections",
        "Instructions",
        "Observations",
        "Photos",
        "Punch List",
        "RFIs",
        "Specifications",
        "Submittals",
        "Tasks",
      ].map((s) => s.toLowerCase()),
    );

    const perms =
      (permissionsData as { tools?: ProcoreTool[] } | undefined)?.tools ?? [];
    const normalize = (s: string) => s.trim().toLowerCase();
    const normalizeSlim = (s: string) =>
      normalize(s).replace(/[^a-z0-9]+/g, "");
    const permissionTitles = new Set(
      perms
        .filter((t) => t.available_for_user === true)
        .map((t) => String(t.friendly_name || ""))
        .map((s) => [normalize(s), normalizeSlim(s)])
        .flat()
        .filter((t) => t),
    );
    const activeTools = Array.isArray(toolsData) ? toolsData : [];
    const activeTitles = new Set(
      activeTools
        .map((t: { title?: string }) => String(t.title || ""))
        .map((s) => [normalize(s), normalizeSlim(s)])
        .flat()
        .filter((t) => t),
    );

    // Intersection of (whitelist ∩ permissions ∩ active)
    const allowedTitles = Array.from(permissionTitles).filter(
      (title) => WHITELIST.has(title) && activeTitles.has(title),
    );

    // Map allowed titles -> config keys
    const keys = new Set<ProcoreToolKey>();
    allowedTitles.forEach((friendlyKey) => {
      const mapped = titleToConfigKey[friendlyKey] as
        | ProcoreToolKey
        | undefined;
      if (mapped) keys.add(mapped);
    });

    const filtered = Array.from(keys).map((key) => {
      const friendly = Object.entries(titleToConfigKey).find(
        ([, v]) => v === key,
      )?.[0];
      return {
        label:
          (friendly && friendly.charAt(0).toUpperCase() + friendly.slice(1)) ||
          PROCORE_TOOL_CONFIGS[key].label,
        value: key,
        backendName: key as string,
      };
    });
    return filtered.sort((a, b) => a.label.localeCompare(b.label));
  }, [permissionsData, toolsData, titleToConfigKey]);

  // Build tool cards from available tool options; no static fallback
  const TOOL_CARDS: ToolCard[] = useMemo(() => {
    return procoreToolOptions
      .map((opt: { backendName: string }) => {
        const cfg = PROCORE_TOOL_CONFIGS[opt.backendName as ProcoreToolKey];
        if (!cfg) return null;
        return {
          key: cfg.key,
          label: cfg.label,
          iconClass: cfg.iconClass,
          bgClass: cfg.bgClass,
          textClass: cfg.textClass,
        } as ToolCard;
      })
      .filter(Boolean) as ToolCard[];
  }, [procoreToolOptions]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  // Track modal closing state to allow exit animation to play before unmounting
  const [isModalClosing, setIsModalClosing] = useState(false);
  // Per-tool selection state: Map of tool key → Set of selected row IDs
  const [toolSelections, setToolSelections] = useState<
    Map<ProcoreToolKey, Set<string>>
  >(new Map());
  // Documents folder navigation state
  const [activeProcoreFolderId, setActiveProcoreFolderId] = useState<
    number | null
  >(null);
  const [currentFolderData, setCurrentFolderData] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [loadingFolderId, setLoadingFolderId] = useState<number | null>(null);
  // Maintain folder trail as explicit state for breadcrumb navigation
  // This is needed because getFolders API returns only the current folder's contents,
  // not the full tree, so we can't compute the trail from the data structure alone.
  const [folderTrailState, setFolderTrailState] = useState<
    Array<{ id: number; label: string }>
  >([]);
  // Get current tool's selected IDs
  const selectedIds = activeToolKey
    ? (toolSelections.get(activeToolKey) ?? new Set<string>())
    : new Set<string>();
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const selectedCount = selectedItems.length;
  const [saving, setSaving] = useState(false);

  // Shared normalize function for comparing IDs across different formats.
  // Extracts digits from a value if present, otherwise trims the string.
  // Used by isRowSelected, onRowClick, and isRowDisabled callbacks.
  const normalizeValue = (v: unknown) => {
    const s = String(v ?? "");
    const digits = s.match(/[0-9]+/g)?.join("") ?? "";
    return digits.length > 0 ? String(Number(digits)) : s.trim();
  };

  // Cache for tool data to avoid refetching on subsequent opens
  type CachedToolData = {
    data: unknown;
    hiddenIds: Array<string | number> | undefined;
  };
  const toolDataCacheRef = useRef<Map<ProcoreToolKey, CachedToolData>>(
    new Map(),
  );
  // Track which tools have been fetched
  const fetchedToolsRef = useRef<Set<ProcoreToolKey>>(new Set());

  // Refs to track latest values of IDs for save handler to avoid stale closures
  // This prevents issues if user rapidly switches context during save operation
  const companyIdRef = useRef(companyId);
  const projectIdRef = useRef(projectId);
  const firstQrIdRef = useRef(firstQrId);
  const isGlobalFetchRef = useRef(isGlobalFetch);
  const isProjectFetchRef = useRef(isProjectFetch);
  const projectIdParamRef = useRef(projectIdParam);
  const globalFetchDataRef = useRef(globalToolData);

  // Clear cache when QR code, group, or project changes to prevent stale data from previous context
  useEffect(() => {
    toolDataCacheRef.current.clear();
    fetchedToolsRef.current.clear();
  }, [firstQrId, groupId, projectIdParam]);

  // Keep ID refs in sync with current values to prevent stale closure issues in save handler
  useEffect(() => {
    companyIdRef.current = companyId;
    projectIdRef.current = projectId;
    firstQrIdRef.current = firstQrId;
    isGlobalFetchRef.current = isGlobalFetch;
    isProjectFetchRef.current = isProjectFetch;
    projectIdParamRef.current = projectIdParam;
    // Only update when globalToolData has data — prevents ref from being
    // cleared when activeToolKey resets to null after modal close, which
    // changes the React Query cache key to an unfetched entry (data=undefined)
    if (globalToolData) {
      globalFetchDataRef.current = globalToolData;
    }
  }, [
    companyId,
    projectId,
    firstQrId,
    isGlobalFetch,
    isProjectFetch,
    projectIdParam,
    globalToolData,
  ]);

  // Warn users about unsaved selections when navigating away or closing the page
  // This prevents accidental data loss from browser navigation, tab close, or page refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (selectedItems.length > 0) {
        // Standard way to trigger browser's "unsaved changes" dialog
        e.preventDefault();
        // Chrome requires returnValue to be set (even though the message is ignored)
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [selectedItems.length]);

  // Create Project Modal state
  const user = getStoredUser();
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showCSVImportModal, setShowCSVImportModal] = useState(false);

  // Internal mapping of UI-selected items to backend save payloads
  type SavePayload = {
    toolKey: ProcoreToolKey;
    procoreToolName: string; // backend enum value, e.g., 'rfi', 'drawing', 'document', 'folder'
    procoreItemID: string;
  };
  // Keyed by UI card id (SelectedItem.id) to support removal UX
  const [selectedSaveMap, setSelectedSaveMap] = useState<
    Map<string, SavePayload>
  >(new Map());

  const TOOL_KEY_TO_ITEM_ENUM: Record<ProcoreToolKey, string> = {
    "coordination-issues": "coordination-issue",
    directory: "directory",
    documents: "document", // may become 'folder' per row shape
    drawings: "drawing",
    forms: "form",
    incidents: "incident",
    inspections: "inspection",
    instructions: "instruction",
    observations: "observation",
    photos: "photo",
    "punch-list": "punch-list",
    rfis: "rfi",
    specifications: "specification",
    submittals: "submittal",
    tasks: "task",
  };

  function deriveProcoreItemIdAndType(
    toolKey: ProcoreToolKey,
    row: Record<string, unknown>,
  ): { procoreItemID: string; procoreToolName: string } | null {
    // Documents have special handling for folders vs files.
    // ProcoreDocumentsTable sets row.kind = "folder" | "file" and
    // row.folderId for folder rows. Use these to determine the correct
    // procoreToolName so the backend calls /folders/{id} vs /files/{id}.
    if (toolKey === "documents") {
      if (row?.kind === "folder" || row?.__isFolder === true) {
        const folderId =
          row?.folderId != null ? String(row.folderId) : String(row?.id ?? "");
        return {
          procoreItemID: normalizeValue(folderId),
          procoreToolName: "folder",
        };
      }
      // Explicit file — use row.id as the Procore file ID
      const rowId: string = String(row?.id ?? "");
      if (rowId.trim()) {
        return {
          procoreItemID: normalizeValue(rowId),
          procoreToolName: "document",
        };
      }
    }
    // Prefer explicit procore identifiers if provided by the row
    if (typeof row?.procoreItemID === "string" && row.procoreItemID.trim()) {
      return {
        procoreItemID: row.procoreItemID,
        procoreToolName: TOOL_KEY_TO_ITEM_ENUM[toolKey],
      };
    }
    if (typeof row?.procoreId === "string" && row.procoreId.trim()) {
      return {
        procoreItemID: row.procoreId,
        procoreToolName: TOOL_KEY_TO_ITEM_ENUM[toolKey],
      };
    }
    if (typeof row?.id === "string" && row.id.trim()) {
      return {
        procoreItemID: normalizeValue(row.id),
        procoreToolName: TOOL_KEY_TO_ITEM_ENUM[toolKey],
      };
    }
    return null;
  }

  // Map config key (PROCORE_TOOL_CONFIGS key) -> toolsMap key
  const configKeyToToolMapKey = useMemo(() => {
    const map: Partial<Record<ProcoreToolKey, keyof typeof toolsMap>> = {};
    Object.entries(toolsMap).forEach(([toolKey, val]) => {
      const backend = (val as { backendEnumValue: string }).backendEnumValue;
      if (backend && (backend as ProcoreToolKey) in PROCORE_TOOL_CONFIGS) {
        map[backend as ProcoreToolKey] = toolKey as keyof typeof toolsMap;
      }
    });
    return map;
  }, []);

  const selectedToolMapKey =
    (activeToolKey && configKeyToToolMapKey[activeToolKey]) || undefined;

  // Map tool keys to global fetch data keys
  const toolKeyToGlobalDataKey: Record<string, string> = {
    "coordination-issues": "procoreCoordinationIssues",
    directory: "procoreDirectory",
    documents: "procoreDocuments",
    drawings: "procoreDrawings",
    forms: "procoreForms",
    incidents: "procoreIncidents",
    inspections: "procoreInspections",
    instructions: "procoreInstructions",
    observations: "procoreObservations",
    photos: "procorePhotos",
    "punch-list": "procorePunchList",
    rfis: "procoreRFIs",
    specifications: "procoreSpecifications",
    submittals: "procoreSubmittals",
    tasks: "procoreTasks",
  };

  // For global fetch, use the data from globalToolData (per-tool fetch)
  // For single QR fetch, use useProcoreToolData
  // Always pass real params to allow React Query to refetch after cache invalidation
  const {
    data: singleToolData,
    hiddenIds: fetchedHiddenIds,
    loading: toolFetching,
    error: toolError,
  } = useProcoreToolData(
    (selectedToolMapKey as keyof typeof toolsMap) ||
      ("" as keyof typeof toolsMap),
    firstQrId,
    companyId || "",
    projectId || "",
    true,
    true,
  );

  // Cache the fetched data when it arrives
  // Always update cache to ensure fresh data from React Query (after invalidation) is used
  useEffect(() => {
    if (activeToolKey && !toolFetching && singleToolData && !isGlobalFetch) {
      const dataArray = Array.isArray(singleToolData)
        ? singleToolData
        : singleToolData;
      if (
        dataArray &&
        (Array.isArray(dataArray)
          ? dataArray.length > 0
          : Object.keys(dataArray as object).length > 0)
      ) {
        toolDataCacheRef.current.set(activeToolKey, {
          data: singleToolData,
          hiddenIds: fetchedHiddenIds,
        });
        fetchedToolsRef.current.add(activeToolKey);
      }
    }
  }, [
    activeToolKey,
    singleToolData,
    fetchedHiddenIds,
    toolFetching,
    isGlobalFetch,
  ]);

  // Get Procore item IDs that have already been added to the right panel (from selectedSaveMap)
  // These should show as checked+disabled in the tool table
  const alreadyAddedItemIds = useMemo(() => {
    const ids = new Set<string>();
    selectedSaveMap.forEach((payload) => {
      if (activeToolKey && payload.toolKey === activeToolKey) {
        ids.add(payload.procoreItemID);
      }
    });
    return ids;
  }, [selectedSaveMap, activeToolKey]);

  // Check if we have cached data for the current tool (to skip skeleton)
  const hasCachedData = activeToolKey
    ? fetchedToolsRef.current.has(activeToolKey)
    : false;

  // Use cached data if available, otherwise use freshly fetched data
  const cachedData = activeToolKey
    ? toolDataCacheRef.current.get(activeToolKey)
    : undefined;

  // For group context, use hiddenIdsByTool from backend (intersection of items on ALL QRs)
  // For single QR context, use cached or fetched hiddenIds
  const toolHiddenIds = useMemo(() => {
    if (
      isGlobalFetch &&
      globalToolData?.data?.hiddenIdsByTool &&
      activeToolKey
    ) {
      // Backend returns { [toolKey]: string[] } - get IDs for the active tool
      const hiddenIds = globalToolData.data.hiddenIdsByTool[activeToolKey];
      return hiddenIds || [];
    }
    // Single QR context: use cached or fetched hidden IDs
    return cachedData?.hiddenIds ?? fetchedHiddenIds;
  }, [
    isGlobalFetch,
    globalToolData,
    activeToolKey,
    cachedData?.hiddenIds,
    fetchedHiddenIds,
  ]);

  // Show loading only when actually fetching (not when using cached data)
  // For global fetch, show loading while the per-tool data is being fetched
  // toolFetching (isPending) is false when React Query has cached data, so no loading spinner shows
  const toolLoading = isGlobalFetch
    ? Boolean(globalToolLoading && !globalToolData)
    : toolFetching;

  const toolData = useMemo(() => {
    if (isGlobalFetch && globalToolData?.data && activeToolKey) {
      const dataKey = toolKeyToGlobalDataKey[activeToolKey];
      if (dataKey) {
        return globalToolData.data[dataKey];
      }
    }
    // Use cached data if available
    if (cachedData?.data) {
      return cachedData.data;
    }
    return singleToolData;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isGlobalFetch,
    globalToolData,
    activeToolKey,
    singleToolData,
    cachedData,
  ]);

  const tableBundle = useMemo(() => {
    if (!activeToolKey) return null;
    const cfg = PROCORE_TOOL_CONFIGS[activeToolKey];
    if (!cfg) return null;

    // For documents, use currentFolderData if navigated into a folder
    let effectiveData: unknown = toolData;
    if (activeToolKey === "documents" && currentFolderData) {
      effectiveData = currentFolderData;
    }

    // Normalize data into the structure expected by getTable(opts)
    let normalizedData: unknown = effectiveData;
    if (
      effectiveData &&
      typeof effectiveData === "object" &&
      !Array.isArray(effectiveData)
    ) {
      const obj = effectiveData as Record<string, unknown>;
      if (Array.isArray(obj.data)) {
        normalizedData = obj.data;
      } else if (
        obj.data &&
        typeof obj.data === "object" &&
        Array.isArray((obj.data as Record<string, unknown>).data)
      ) {
        normalizedData = (obj.data as Record<string, unknown>)
          .data as unknown[];
      } else if (
        obj.data &&
        typeof obj.data === "object" &&
        Array.isArray((obj.data as Record<string, unknown>).items)
      ) {
        normalizedData = (obj.data as Record<string, unknown>)
          .items as unknown[];
      } else if (Array.isArray(obj.items)) {
        normalizedData = obj.items as unknown[];
      } else {
        // Keep object as-is for tables that expect non-array (e.g., Documents with folders/files)
        normalizedData = obj;
      }
    }

    const opts = {
      qrId: firstQrId,
      data: normalizedData,
      activeFolderId:
        activeToolKey === "documents" ? activeProcoreFolderId : null,
      hiddenIds: toolHiddenIds
        ? new Set(Array.isArray(toolHiddenIds) ? toolHiddenIds.map(String) : [])
        : undefined,
    };

    const getTableWithOpts = cfg.getTable as unknown as (
      o?: Record<string, unknown>,
    ) => {
      columns: Column<unknown>[];
      rows: unknown[];
      getRowId: (r: unknown) => string;
      folderTrail?: Array<{ id: number; label: string }>;
    };

    return getTableWithOpts(opts as Record<string, unknown>);
  }, [
    activeToolKey,
    toolData,
    currentFolderData,
    activeProcoreFolderId,
    toolHiddenIds,
    firstQrId,
  ]);

  // Note: We no longer use tableBundle.folderTrail for breadcrumbs because the API returns
  // only the current folder's contents, not the full tree needed for trail computation.
  // Instead, we maintain folderTrailState explicitly (see state declaration above).

  function goBack() {
    if (search && search.returnTo) {
      navigate({
        to: search.returnTo as string,
        params: (search.returnParams ?? {}) as Record<string, string>,
      });
      return;
    }
    navigate({ to: "/dashboard" });
  }

  function addSelectedFromConfig<Row>(key: ProcoreToolKey, rows: Row[]) {
    const cfg = PROCORE_TOOL_CONFIGS[key];
    const mapped = cfg.mapRowsToSelectedItems(rows);
    setSelectedItems((prev) => {
      const existing = new Set(prev.map((i) => i.id));
      const deduped = mapped.filter((m) => !existing.has(m.id));
      return [...prev, ...deduped];
    });
  }

  function removeSelectedItem(id: string) {
    setRemovingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    window.setTimeout(() => {
      setSelectedItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedSaveMap((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 200);
  }

  function handleToolClick(key: string) {
    setActiveToolKey(key as ProcoreToolKey);
    // Reset folder navigation when switching tools
    setActiveProcoreFolderId(null);
    setCurrentFolderData(null);
    setLoadingFolderId(null);
    setFolderTrailState([]);
    // Don't reset selections - they persist per tool
    // Note: Per-tool data fetching is driven by activeToolKey via useProcoreFetchGlobalTool
  }

  // Handler to navigate into a folder
  const handleNavigateToFolder = async (
    folderId: number,
    folderName: string,
  ) => {
    if (!companyId || !projectId) return;

    try {
      setLoadingFolderId(folderId);

      const response = await getFolders(
        firstQrId || "",
        companyId,
        projectId,
        String(folderId),
        true, // desktop mode
      );

      // Handle response structure - may be wrapped in { data: ... }
      if (
        response &&
        typeof response === "object" &&
        !Array.isArray(response)
      ) {
        const resp = response as { data?: Record<string, unknown> };
        setCurrentFolderData(
          resp.data || (response as Record<string, unknown>),
        );
      } else {
        setCurrentFolderData(response as Record<string, unknown> | null);
      }

      setActiveProcoreFolderId(folderId);
      // Add folder to trail for breadcrumb navigation
      setFolderTrailState((prev) => [
        ...prev,
        { id: folderId, label: folderName },
      ]);
    } catch (error) {
      logProcoreError(error, "procore-folder-load-failed", { folderId });
      if (import.meta.env.DEV) {
        console.error("Error loading folder:", error);
      }
    } finally {
      setLoadingFolderId(null);
    }
  };

  // Handler for breadcrumb navigation - uses trail index for correct navigation
  const handleNavigateToBreadcrumb = async (trailIndex: number) => {
    if (trailIndex < 0) {
      // Navigate back to root (Documents root)
      setActiveProcoreFolderId(null);
      setCurrentFolderData(null);
      setLoadingFolderId(null);
      setFolderTrailState([]);
    } else if (trailIndex < folderTrailState.length) {
      // Navigate to a folder in the trail
      const targetFolder = folderTrailState[trailIndex];
      if (!companyId || !projectId) return;

      try {
        setLoadingFolderId(targetFolder.id);

        const response = await getFolders(
          firstQrId || "",
          companyId,
          projectId,
          String(targetFolder.id),
          true, // desktop mode
        );

        // Handle response structure - may be wrapped in { data: ... }
        if (
          response &&
          typeof response === "object" &&
          !Array.isArray(response)
        ) {
          const resp = response as { data?: Record<string, unknown> };
          setCurrentFolderData(
            resp.data || (response as Record<string, unknown>),
          );
        } else {
          setCurrentFolderData(response as Record<string, unknown> | null);
        }

        setActiveProcoreFolderId(targetFolder.id);
        // Slice trail to the target index (inclusive)
        setFolderTrailState((prev) => prev.slice(0, trailIndex + 1));
      } catch (error) {
        logProcoreError(error, "procore-folder-load-failed", {
          folderId: targetFolder.id,
        });
        if (import.meta.env.DEV) {
          console.error("Error loading folder:", error);
        }
      } finally {
        setLoadingFolderId(null);
      }
    }
  };

  function toggleRow(id: string) {
    if (!activeToolKey) return;
    setToolSelections((prev) => {
      const next = new Map(prev);
      const currentSet = new Set(prev.get(activeToolKey) ?? []);
      if (currentSet.has(id)) {
        currentSet.delete(id);
      } else {
        currentSet.add(id);
      }
      next.set(activeToolKey, currentSet);
      return next;
    });
  }

  // Close modal with animation - waits for Modal's exit animation to complete before unmounting
  function closeToolModal() {
    setIsModalClosing(true);
    // Match Modal component's 200ms exit animation duration
    window.setTimeout(() => {
      setActiveToolKey(null);
      setIsModalClosing(false);
      // Reset folder navigation state
      setActiveProcoreFolderId(null);
      setCurrentFolderData(null);
      setLoadingFolderId(null);
      setFolderTrailState([]);
    }, 200);
  }

  // Early return if no company ID available - can't validate access without it
  if (!reduxCompanyId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 mb-4"></div>
        <p className="text-sm text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    // <AppShell>
    <ProcoreFetchGate companyId={reduxCompanyId}>
      <div className="relative grow p-8">
        {/* Left/Main Panel: Procore Tools Selection */}
        <div data-page-id="procore-fetch" className="pr-[340px]">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
                <img src={procoreIcon} alt="Procore" className="h-6 w-6 mr-2" />
                Fetch Procore Items
              </h1>
              <TrialBadge />
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {isGlobalFetch
                ? `Select items from Procore tools to add to all QR Codes in this group.`
                : isProjectFetch
                  ? `Select items from Procore tools or upload a CSV to add to QR Codes in this project.`
                  : `Select items from Procore tools to add to this Folder QR Code.`}
            </p>

            {/* Breadcrumb Navigation Pills */}
            {!hasNoEntryPoint && !isLoadingToolCards && (
              <nav className="flex items-center gap-2 mt-3 text-sm">
                {/* Project Pill */}
                {projectId && projectRespData?.projectName && (
                  <>
                    <Link
                      to="/project/$projectId"
                      params={{ projectId }}
                      className="inline-flex transition-all duration-150 hover:scale-105 hover:brightness-95"
                    >
                      <Badge variant="green" shape="md">
                        <i className="bx bx-folder mr-1" />
                        {projectRespData.projectName}
                      </Badge>
                    </Link>
                    <i className="bx bx-chevron-right text-gray-400" />
                  </>
                )}

                {/* Group Pill (for global fetch) or QR Code Pill (for single fetch) */}
                {isGlobalFetch && groupId ? (
                  <>
                    <Link
                      to="/group/$groupId"
                      params={{ groupId }}
                      className="inline-flex transition-all duration-150 hover:scale-105 hover:brightness-95"
                    >
                      <Badge
                        variant={
                          (groupData?.data as { type?: string })?.type ===
                          "equipment"
                            ? "red"
                            : "indigo"
                        }
                        shape="md"
                      >
                        <i className="bx bx-collection mr-1" />
                        {(
                          groupData?.data as {
                            groupName?: string;
                            arrangementName?: string;
                            equipmentName?: string;
                          }
                        )?.groupName ||
                          (groupData?.data as { arrangementName?: string })
                            ?.arrangementName ||
                          (groupData?.data as { equipmentName?: string })
                            ?.equipmentName ||
                          "Group"}
                      </Badge>
                    </Link>
                    {/* <i className="bx bx-chevron-right text-gray-400" /> */}
                  </>
                ) : firstQrId ? (
                  (() => {
                    // Get QR code type, defaulting to "folder" for legacy QR codes without type
                    const qrType =
                      (qrData?.data as { type?: string })?.type || "folder";
                    const typeBadge = computeTypeBadge(qrType);
                    const badgeVariant = (typeBadge?.variant ??
                      "indigo") as Parameters<typeof Badge>[0]["variant"];
                    return (
                      <>
                        <Link
                          to="/qrcode/$qrcodeId"
                          params={{ qrcodeId: firstQrId }}
                          className="inline-flex transition-all duration-150 hover:scale-105 hover:brightness-95"
                        >
                          <Badge variant={badgeVariant} shape="md">
                            <i className="bx bx-qr mr-1" />
                            {(qrData?.data as { qrcodeName?: string })
                              ?.qrcodeName || "QR Code"}
                          </Badge>
                        </Link>
                        {/* <i className="bx bx-chevron-right text-gray-400" /> */}
                      </>
                    );
                  })()
                ) : null}

                {/* Current Page Indicator */}
                {/* <Badge variant="orange" shape="md">
                  <i className="bx bx-download mr-1" />
                  Fetch Procore Items
                </Badge> */}
              </nav>
            )}
          </div>

          {/* Grid of Procore Tools */}
          {hasNoEntryPoint ? (
            <div className="min-h-[50vh] flex items-center justify-center">
              <EmptyState
                icon={
                  <i className="bx bx-error-circle text-red-500 text-3xl" />
                }
                title="No QR Code or Group Selected"
                description="Please navigate to this page from a QR Code or Group to fetch Procore items."
                iconBgClass="bg-red-100"
                actionLabel="Go Back"
                onActionClick={() => goBack()}
              />
            </div>
          ) : isLoadingToolCards ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 mb-4"></div>
              <p className="text-sm text-gray-600">Loading Procore tools...</p>
            </div>
          ) : hasGlobalFetchError ? (
            <div className="min-h-[50vh] flex items-center justify-center">
              <EmptyState
                icon={
                  <i className="bx bx-folder-open text-amber-500 text-3xl" />
                }
                title={
                  !groupId
                    ? "No Group Selected"
                    : groupData && !groupData.data
                      ? "Group Not Found"
                      : !projectId
                        ? "Group Not Linked to a Project"
                        : !procoreCompanyId ||
                            !procoreProjectId ||
                            procoreProjectId === "none"
                          ? "Group's Project Not Connected to Procore"
                          : "Unable to Load Procore Tools"
                }
                description={
                  !groupId
                    ? "Please select a Group to fetch Procore items for."
                    : groupData && !groupData.data
                      ? "The specified Group could not be found. It may have been deleted or you may not have access to it."
                      : !projectId
                        ? "This Group is not associated with any project. To fetch items from Procore, the Group must belong to a project that is linked to Procore."
                        : !procoreCompanyId ||
                            !procoreProjectId ||
                            procoreProjectId === "none"
                          ? "The project associated with this Group is not connected to Procore. Please connect it in project settings to access Procore tools."
                          : "An unexpected error occurred while loading Procore tools. Please try again."
                }
                iconBgClass="bg-amber-100"
                actionLabel="Go Back"
                onActionClick={() => goBack()}
              />
            </div>
          ) : hasDataError ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
              <i className="bx bx-folder-open text-5xl text-amber-400 mb-4"></i>
              <p className="text-lg font-medium text-gray-700 mb-2">
                {!firstQrId
                  ? "No QR Code Selected"
                  : !projectId
                    ? "QR Code Not Linked to a Project"
                    : !procoreCompanyId ||
                        !procoreProjectId ||
                        procoreProjectId === "none"
                      ? "Project Not Connected to Procore"
                      : "Unable to Load Procore Tools"}
              </p>
              <p className="text-sm text-gray-500 max-w-md mb-6">
                {!firstQrId
                  ? "Please select a QR Code to fetch Procore items for."
                  : !projectId
                    ? "This QR Code is not associated with any project. To fetch items from Procore, you need to create a project linked to Procore and associate this QR Code with it."
                    : !procoreCompanyId ||
                        !procoreProjectId ||
                        procoreProjectId === "none"
                      ? "The project associated with this QR Code is not connected to Procore. Please connect it in project settings to access Procore tools."
                      : "An unexpected error occurred while loading Procore tools. Please try again."}
              </p>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    // Warn user if they have unsaved selections before going back
                    if (selectedItems.length > 0) {
                      const confirmed = window.confirm(
                        "You have unsaved selections. Are you sure you want to leave?",
                      );
                      if (!confirmed) return;
                    }
                    goBack();
                  }}
                >
                  Go Back
                </Button>
                {!projectId && firstQrId && (
                  <Button
                    type="button"
                    variant="primary"
                    leftIconClass="bx bx-plus"
                    onClick={() => setShowCreateProjectModal(true)}
                  >
                    Create Project & Link to Procore
                  </Button>
                )}
              </div>
            </div>
          ) : TOOL_CARDS.length === 0 ? (
            <div className="min-h-[50vh] flex items-center justify-center">
              <EmptyState
                icon={
                  <i className="bx bx-error-circle text-gray-400 text-3xl" />
                }
                title="No Procore Tools Available"
                description={
                  permissionsError || toolsError
                    ? "Failed to load Procore permissions. Please check your Procore connection."
                    : "This project may not have any Procore tools configured, or your user may not have permissions to access them."
                }
                iconBgClass="bg-gray-100"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {TOOL_CARDS.map((tool) => (
                <Button
                  key={tool.key}
                  type="button"
                  variant="procoreTool"
                  className="cursor-pointer"
                  onClick={() => handleToolClick(tool.key)}
                >
                  <div
                    className={`h-12 w-12 rounded-full ${tool.bgClass} flex items-center justify-center mb-3`}
                  >
                    <i
                      className={`${tool.iconClass} ${tool.textClass} text-xl`}
                    ></i>
                  </div>
                  <span className="text-sm font-medium text-gray-900 text-center">
                    {tool.label}
                  </span>
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel: Selected Items Summary (fixed, flush with viewport edges below header) */}
        <aside className="fixed top-16 right-0 bottom-0 w-[340px] bg-white border-l border-gray-200 p-6 flex flex-col">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Selected Items ({selectedCount})
          </h2>
          <div className="flex-1 overflow-y-auto -mr-6 pr-6 space-y-3">
            {selectedItems.length === 0 ? (
              <div className="flex items-center justify-center h-full p-6 text-center">
                <div>
                  <i className="bx bx-list-plus text-4xl text-gray-300 mb-2" />
                  <p className="text-sm text-gray-600 mb-1">
                    No items selected
                  </p>
                  <p className="text-xs text-gray-400">
                    Click a Procore tool to add items.
                  </p>
                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white text-gray-500">or</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4">
                    <p className="text-xs text-gray-400 mb-3">
                      Import items from a CSV or Excel file
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      leftIconClass="bx bx-upload"
                      onClick={() => setShowCSVImportModal(true)}
                      className="text-sm"
                    >
                      Upload CSV
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              selectedItems.map((item) => (
                <div
                  key={item.id}
                  className={`relative transition-all duration-200 ease-in-out ${removingIds.has(item.id) ? "opacity-0 -translate-y-1" : ""}`}
                >
                  <ItemCard
                    icon={<i className={`${item.iconClass} text-lg`}></i>}
                    iconContainerClassName={`${item.bgClass} ${item.textClass}`}
                    title={item.title}
                    subtitle={item.label}
                    className="pr-10"
                    variant="list"
                    suppressRightIcon
                  />
                  {item.qrCodeName && (
                    <span className="text-xs text-gray-400 block mt-0.5">
                      QR: {item.qrCodeName}
                    </span>
                  )}
                  <Button
                    variant="iconGhost"
                    aria-label="Remove item"
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 hover:text-red-500"
                    onClick={() => removeSelectedItem(item.id)}
                  >
                    <i className="bx bx-x text-lg"></i>
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="primary"
              className="w-full justify-center disabled:opacity-70 disabled:transition-none disabled:transform-none disabled:animate-none disabled:pointer-events-none"
              onClick={async () => {
                // Use ref values to get latest IDs at save time, avoiding stale closure issues
                // if user rapidly switches context during save operation
                const currentCompanyId = companyIdRef.current;
                const currentProjectId = projectIdRef.current;
                const currentQrId = firstQrIdRef.current;
                const currentIsGlobalFetch = isGlobalFetchRef.current;
                const currentGlobalFetchData = globalFetchDataRef.current;

                // For single QR context, require QR ID; for group context, require global fetch data
                if (!currentCompanyId || !currentProjectId) return;
                if (!currentIsGlobalFetch && !currentQrId) return;
                if (
                  currentIsGlobalFetch &&
                  (!currentGlobalFetchData?.data?.qrcodes ||
                    currentGlobalFetchData.data.qrcodes.length === 0)
                )
                  return;
                if (selectedSaveMap.size === 0) return;

                try {
                  setSaving(true);
                  // Deduplicate by toolName:itemID
                  const uniq = new Map<string, SavePayload>();
                  for (const [, payload] of selectedSaveMap) {
                    const key = `${payload.procoreToolName}:${payload.procoreItemID}`;
                    if (!uniq.has(key)) uniq.set(key, payload);
                  }
                  const uniquePayloads = Array.from(uniq.values());

                  if (currentIsGlobalFetch) {
                    // GROUP CONTEXT: Create items for ALL QR codes in the group
                    const qrcodes = currentGlobalFetchData?.data?.qrcodes || [];
                    const qrcodeIds = qrcodes.map(
                      (qr: { _id: string }) => qr._id,
                    );

                    // Build bulk items: each selected item × each QR code
                    const bulkItems: BulkProcoreItemEntry[] = [];
                    for (const payload of uniquePayloads) {
                      for (const qrcodeId of qrcodeIds) {
                        bulkItems.push({
                          qrcodeId,
                          procoreToolName: payload.procoreToolName,
                          procoreItemID: String(payload.procoreItemID),
                        });
                      }
                    }

                    // Send single bulk request
                    await createProcoreItemsBulk({
                      companyId: currentCompanyId,
                      projectId: currentProjectId,
                      items: bulkItems,
                    });

                    // Enable procoreFetch on all QR codes in the group
                    const updatePromises = qrcodeIds.map((qrcodeId: string) =>
                      updateQRCodeDetails(qrcodeId, {
                        companyId: currentCompanyId,
                        projectId: currentProjectId,
                        procoreFetch: true,
                      }),
                    );
                    await Promise.allSettled(updatePromises);
                  } else {
                    // SINGLE QR CONTEXT: Create items for the single QR code using bulk endpoint
                    const bulkItems: BulkProcoreItemEntry[] =
                      uniquePayloads.map((p) => ({
                        qrcodeId: currentQrId,
                        procoreToolName: p.procoreToolName,
                        procoreItemID: String(p.procoreItemID),
                      }));

                    await createProcoreItemsBulk({
                      companyId: currentCompanyId,
                      projectId: currentProjectId,
                      items: bulkItems,
                    });

                    // Enable procoreFetch on the QR Code so its view shows selected Procore items
                    await updateQRCodeDetails(currentQrId, {
                      companyId: currentCompanyId,
                      projectId: currentProjectId,
                      procoreFetch: true,
                    });
                  }

                  // Invalidate React Query cache so next visit shows newly added items as checked/disabled
                  // This ensures hiddenIds are refetched from the backend with the updated list
                  await queryClient.invalidateQueries({
                    queryKey: procoreToolKeys.all,
                  });

                  // Invalidate the QR code detail page's data sources so newly
                  // fetched Procore items appear immediately after navigation
                  if (!currentIsGlobalFetch && currentQrId) {
                    // Single QR: invalidate this QR's procore tools + scanned aggregate + single QR data.
                    // ["Qrs", currentQrId] matches useScannedQR (prefix match).
                    // ["Qrs", "single", currentQrId] matches useSingleQRCode exactly
                    // (needed so the QR detail page sees the updated procoreFetch flag).
                    await Promise.all([
                      queryClient.invalidateQueries({
                        queryKey: QrProcoreToolsKeys.detail(currentQrId),
                      }),
                      queryClient.invalidateQueries({
                        queryKey: ["Qrs", currentQrId],
                      }),
                      queryClient.invalidateQueries({
                        queryKey: ["Qrs", "single", currentQrId],
                      }),
                    ]);
                  } else if (currentIsGlobalFetch) {
                    // Group context: invalidate ALL QrProcoreTools (affects every QR in group)
                    await Promise.all([
                      queryClient.invalidateQueries({
                        queryKey: QrProcoreToolsKeys.all,
                      }),
                      queryClient.invalidateQueries({
                        queryKey: ["Qrs"],
                      }),
                    ]);
                    if (groupId) {
                      await queryClient.invalidateQueries({
                        queryKey: [
                          ...groupsKeys.detail(groupId),
                          "procore-fetch-global",
                        ],
                      });
                    }
                  }

                  goBack();
                } catch (e) {
                  logProcoreError(e, "procore-add-items-failed", {
                    itemCount: selectedItems?.length,
                  });
                  if (import.meta.env.DEV) {
                    console.error("Failed to add Procore items:", e);
                  }
                  toast.error("Failed to add Procore items. Please try again.");
                } finally {
                  setSaving(false);
                }
              }}
              disabled={
                selectedCount === 0 ||
                saving ||
                (isGlobalFetch && globalToolLoading)
              }
            >
              {saving
                ? "Adding..."
                : isGlobalFetch && globalToolLoading
                  ? "Loading..."
                  : isGlobalFetch
                    ? `Add ${selectedCount} Items to Group`
                    : isProjectFetch
                      ? `Add ${selectedCount} Items to Project`
                      : `Add ${selectedCount} Items to Folder QR Code`}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="mt-2 w-full justify-center"
              onClick={() => {
                // Warn user if they have unsaved selections before canceling
                if (selectedItems.length > 0) {
                  const confirmed = window.confirm(
                    "You have unsaved selections. Are you sure you want to leave?",
                  );
                  if (!confirmed) return;
                }
                goBack();
              }}
            >
              Cancel
            </Button>
          </div>
        </aside>

        {activeToolKey
          ? (() => {
              const cfg = PROCORE_TOOL_CONFIGS[activeToolKey];
              const columns = tableBundle?.columns || [];
              const rows = tableBundle?.rows || [];
              const getRowId =
                tableBundle?.getRowId ||
                ((r: unknown) =>
                  String(
                    (r as Record<string, unknown>)?.id ??
                      (r as Record<string, unknown>)?.__rowId ??
                      "",
                  ));
              return (
                <Modal
                  open={!isModalClosing}
                  onClose={closeToolModal}
                  title={
                    <div className="flex items-center gap-2">
                      <i className={`${cfg.modalIconClass}`}></i>
                      <span>{cfg.modalTitle}</span>
                    </div>
                  }
                  size="2xl"
                  withoutPadding={true}
                  footer={
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={closeToolModal}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => {
                          const selected = rows.filter((r) =>
                            selectedIds.has(getRowId(r)),
                          );
                          // Build UI cards for the selected rows to get stable ids for removal mapping
                          const mappedCards = (
                            PROCORE_TOOL_CONFIGS[activeToolKey!]
                              .mapRowsToSelectedItems as unknown as (
                              rows: unknown[],
                            ) => SelectedItem[]
                          )(selected as unknown[]);
                          // Save mapping UI id -> backend payload
                          setSelectedSaveMap((prev) => {
                            const next = new Map(prev);
                            mappedCards.forEach((card, idx) => {
                              const payload = deriveProcoreItemIdAndType(
                                activeToolKey!,
                                (selected as Record<string, unknown>[])[idx],
                              );
                              if (payload) {
                                next.set(card.id, {
                                  toolKey: activeToolKey!,
                                  procoreToolName: payload.procoreToolName,
                                  procoreItemID: payload.procoreItemID,
                                });
                              }
                            });
                            return next;
                          });
                          addSelectedFromConfig(activeToolKey, selected);
                          // Clear selections for this tool after adding
                          setToolSelections((prev) => {
                            const next = new Map(prev);
                            next.set(activeToolKey!, new Set());
                            return next;
                          });
                          closeToolModal();
                        }}
                        disabled={toolLoading || selectedIds.size === 0}
                      >
                        Add Selected ({selectedIds.size})
                      </Button>
                    </>
                  }
                >
                  <div className="h-[70vh] flex flex-col">
                    {/* Breadcrumb navigation for Documents */}
                    {activeToolKey === "documents" &&
                      (activeProcoreFolderId !== null ||
                        folderTrailState.length > 0) && (
                        <div className="flex-none px-4 py-3 border-b border-gray-200 bg-gray-50">
                          <Breadcrumbs
                            variant="folder"
                            items={[
                              { label: "Documents" },
                              ...folderTrailState.map((f) => ({
                                label: f.label,
                              })),
                            ]}
                            onCrumbClick={(index) => {
                              if (index === 0) {
                                // Clicked "Documents" root - use -1 to indicate root
                                handleNavigateToBreadcrumb(-1);
                              } else {
                                // Clicked a folder in the trail - pass trail index (0-based)
                                handleNavigateToBreadcrumb(index - 1);
                              }
                            }}
                          />
                        </div>
                      )}
                    <DataTable<unknown>
                      key={String(activeToolKey)}
                      columns={columns}
                      rows={rows}
                      getRowId={getRowId}
                      loading={
                        (toolLoading && !hasCachedData) ||
                        loadingFolderId !== null
                      }
                      showSelection
                      isRowSelected={(r) => {
                        // Check if explicitly selected in current session
                        if (selectedIds.has(getRowId(r))) return true;
                        // Check if already linked (hidden) or already added to right panel
                        const hiddenSet = new Set(
                          (toolHiddenIds ?? []).map((v: unknown) =>
                            normalizeValue(v),
                          ),
                        );
                        const row = r as Record<string, unknown>;
                        const cand1 = row?.procoreId;
                        const cand2 = row?.id;
                        const cand3 = row?.issueNumber;
                        const cand4 = row?.procoreItemID; // For Drawings table
                        const idsToCheck = [
                          cand1,
                          cand2,
                          cand3,
                          cand4,
                          getRowId(r),
                        ]
                          .filter((x) => x != null)
                          .map((x) => normalizeValue(x));
                        // Check if in hidden set (already linked) or already added to right panel
                        if (idsToCheck.some((id) => hiddenSet.has(id)))
                          return true;
                        if (
                          idsToCheck.some((id) => alreadyAddedItemIds.has(id))
                        )
                          return true;
                        return false;
                      }}
                      onToggleRow={(r) => toggleRow(getRowId(r))}
                      onRowClick={(r) => {
                        const row = r as Record<string, unknown>;

                        // For Documents tool: clicking a folder row navigates into it
                        if (
                          activeToolKey === "documents" &&
                          row.__isFolder === true &&
                          typeof row.folderId === "number"
                        ) {
                          const folderName =
                            typeof row.name === "string" ? row.name : "Folder";
                          handleNavigateToFolder(row.folderId, folderName);
                          return;
                        }

                        // For all other cases: toggle selection if not disabled
                        const hiddenSet = new Set(
                          (toolHiddenIds ?? []).map((v: unknown) =>
                            normalizeValue(v),
                          ),
                        );
                        const cand1 = row?.procoreId;
                        const cand2 = row?.id;
                        const cand3 = row?.issueNumber;
                        const cand4 = row?.procoreItemID; // For Drawings table
                        const idsToCheck = [
                          cand1,
                          cand2,
                          cand3,
                          cand4,
                          getRowId(r),
                        ]
                          .filter((x) => x != null)
                          .map((x) => normalizeValue(x));
                        const isDisabled = idsToCheck.some(
                          (id) =>
                            hiddenSet.has(id) || alreadyAddedItemIds.has(id),
                        );
                        if (!isDisabled) {
                          toggleRow(getRowId(r));
                        }
                      }}
                      isRowDisabled={(r) => {
                        // Disable rows whose IDs are in hiddenIds or already added to right panel
                        const hiddenSet = new Set(
                          (toolHiddenIds ?? []).map((v: unknown) =>
                            normalizeValue(v),
                          ),
                        );
                        const row = r as Record<string, unknown>;
                        const cand1 = row?.procoreId;
                        const cand2 = row?.id;
                        const cand3 = row?.issueNumber;
                        const cand4 = row?.procoreItemID; // For Drawings table
                        const idsToCheck = [
                          cand1,
                          cand2,
                          cand3,
                          cand4,
                          getRowId(r),
                        ]
                          .filter((x) => x != null)
                          .map((x) => normalizeValue(x));
                        return idsToCheck.some(
                          (id) =>
                            hiddenSet.has(id) || alreadyAddedItemIds.has(id),
                        );
                      }}
                    />
                    {toolError ? (
                      <div className="px-4 py-2 text-sm text-red-600">
                        Failed to load data for this tool.
                      </div>
                    ) : null}
                  </div>
                </Modal>
              );
            })()
          : null}

        {/* Create Project Modal */}
        <CreateProjectModal
          open={showCreateProjectModal}
          onClose={() => setShowCreateProjectModal(false)}
          companyId={String(user?.companyId ?? "")}
          subtitle="Create a new project and link it to a Procore project. The QR Code will be associated with this project."
          requireProcoreProject
          onSuccess={async (newProjectId) => {
            // Update the QR code to reference this project
            await updateQRCodeDetails(firstQrId, {
              companyId: String(user?.companyId ?? ""),
              projectId: newProjectId,
            });
            // Reload the page to refetch data with the new project
            window.location.reload();
          }}
        />

        {/* CSV Import Modal */}
        <CSVImportModal
          open={showCSVImportModal}
          onClose={() => setShowCSVImportModal(false)}
          companyId={companyId}
          projectId={projectId}
          context={isGlobalFetch ? "group" : isProjectFetch ? "project" : "qr"}
          contextId={
            isGlobalFetch
              ? groupId
              : isProjectFetch
                ? projectIdParam
                : firstQrId
          }
          onConfirmed={async (_result) => {
            // Invalidate caches and navigate back (reuse existing save handler's cache logic)
            await queryClient.invalidateQueries({
              queryKey: procoreToolKeys.all,
            });
            if (!isGlobalFetch && !isProjectFetch && firstQrId) {
              await queryClient.invalidateQueries({
                queryKey: QrProcoreToolsKeys.detail(firstQrId),
              });
              await queryClient.invalidateQueries({
                queryKey: ["Qrs", firstQrId],
              });
              await queryClient.invalidateQueries({
                queryKey: ["Qrs", "single", firstQrId],
              });
            } else if (isGlobalFetch || isProjectFetch) {
              await queryClient.invalidateQueries({
                queryKey: QrProcoreToolsKeys.all,
              });
              await queryClient.invalidateQueries({ queryKey: ["Qrs"] });
            }
            toast.success("Procore items added successfully");
            goBack();
          }}
        />
      </div>
    </ProcoreFetchGate>
    // </AppShell>
  );
}
