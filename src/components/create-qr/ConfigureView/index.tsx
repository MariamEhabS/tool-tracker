import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import SearchComboBox, {
  type SearchComboBoxValue,
} from "@/components/combobox/detail/SearchComboBox";
import LoadingModal from "@/components/modal/taliho/LoadingModal";
import ProjectEditModal from "@/components/modal/taliho/ProjectEditModal";
import { buildReturnParams, readCreateQRState } from "@/lib/urlState";
import { toast } from "react-hot-toast";
import {
  createQRCode,
  type CreateQRCodeDto,
  QrKeys,
  createBulkQRItemsJob,
} from "@/api/endpoints/qr-codes";
import { queryClient } from "@/api";
import { useAllProjects, projectKeys } from "@/api/endpoints/projects";
import {
  useProcoreLocations,
  useProcorePermissions,
  useProcoreDrawingsPaged,
} from "@/api/endpoints/procore";
import { useCategories } from "@/api/endpoints/categories";
import { procoreApiNameToBackendEnum } from "@/utils/toolMap";
import {
  createGroup,
  groupsKeys,
  useListGroups,
  useSingleGroup,
} from "@/api/endpoints/groups";
import { createBulkQRJob } from "@/api/endpoints/qr-codes";
import { QrProcoreToolsKeys } from "@/api/endpoints/qr-procore-tools";
import { companyKeys } from "@/api/endpoints/company";
import { addJob } from "@/utils/localStorage-jobs";
import { logQRError } from "@/utils/rollbar";
import { getStoredUser } from "@/utils/getStoredUser";
import type {
  ProjectRow,
  GroupRow,
  ProcoreTool,
  ProcoreLocation,
  DrawingEntry,
} from "@/components/create-qr/types";
import {
  MAX_BULK_QR_BATCH_SIZE,
  CREATE_NEW_GROUP_OPTION_VALUE,
  ADD_TO_EXISTING_GROUP_OPTION_VALUE,
  CREATE_NEW_PROJECT_OPTION_VALUE,
} from "@/components/create-qr/constants";
import type { TierConfig } from "@/lib/tiers/types";
import ConfigureSingleTaliho from "./ConfigureSingleTaliho";
import ConfigureSingleProcore from "./ConfigureSingleProcore";
import ConfigureExistingGroup from "./ConfigureExistingGroup";
import ConfigureBulkGroup from "./ConfigureBulkGroup";
import ConfigureBulkDrawings from "./ConfigureBulkDrawings";
import ConfigureVCard from "./ConfigureVCard";
import ConfigureURL from "./ConfigureURL";

export default function ConfigureView({
  configureKey,
  onBack,
  showLoading,
  setShowLoading,
  tierConfig,
  qrBatchLimit,
  hasUnlimitedQR,
  pendingGroupName,
  onPendingGroupNameConsumed,
  onRequestAddGroupFromDropdown,
  onRequestCreateProject,
}: {
  configureKey: string | null;
  onBack: () => void;
  showLoading?: boolean;
  setShowLoading?: (v: boolean) => void;
  tierConfig: TierConfig;
  qrBatchLimit: number;
  hasUnlimitedQR: boolean;
  pendingGroupName?: string;
  onPendingGroupNameConsumed?: () => void;
  onRequestAddGroupFromDropdown?: (mode: "new" | "existing") => void;
  onRequestCreateProject?: () => void;
}) {
  const navigate = useNavigate();

  const user = getStoredUser();
  const companyId = user?.companyId || "";

  const { data: projectsData, isLoading: isLoadingProjects } =
    useAllProjects(companyId);

  // Fetch the existing group name for "bulk:existing-group" mode
  const { location } = useRouterState();
  const existingGroupId = useMemo(
    () => readCreateQRState(location.search).groupingId || "",
    [location.search],
  );
  const { data: existingGroupData } = useSingleGroup(existingGroupId);
  const existingGroupName = useMemo(() => {
    const grp = existingGroupData?.data;
    if (!grp) return "Group";
    return grp.groupName || grp.arrangementName || grp.equipmentName || "Group";
  }, [existingGroupData]);

  const [shouldFetchCategories, setShouldFetchCategories] = useState(false);
  const canFetchCategories = Boolean(companyId) && shouldFetchCategories;

  const {
    data: categoriesData,
    isLoading: isLoadingCategories,
    isFetched: isCategoriesFetched,
  } = useCategories(companyId, canFetchCategories);

  const handleCategoriesDropdownOpen = useCallback(() => {
    setShouldFetchCategories((prev) => {
      if (!prev) {
        return true;
      }
      return prev;
    });
  }, []);

  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const prefixRef = useRef<HTMLInputElement | null>(null);
  const startRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLInputElement | null>(null);
  const excludeNumbersRef = useRef<HTMLInputElement | null>(null);
  const uploadCsvRef = useRef<HTMLInputElement | null>(null);
  const manualItemsRef = useRef<HTMLTextAreaElement | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState<
    string | undefined
  >(() => {
    const current = readCreateQRState(window.location.search).groupingId;
    return current || undefined;
  });
  const [selectedTargetGroupName, setSelectedTargetGroupName] = useState("");
  const [targetGroupQuery, setTargetGroupQuery] = useState("");
  const previousUrlGroupingIdRef = useRef<string | undefined>(
    selectedTargetGroupId,
  );
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [categoryValue, setCategoryValue] = useState<
    SearchComboBoxValue | SearchComboBoxValue[] | undefined
  >(undefined);
  // Category selection state for assorted group form
  const [assortedCategories, setAssortedCategories] = useState<string[]>([]);
  const [internalShowLoading, setInternalShowLoading] =
    useState<boolean>(false);
  // State for project edit modal (to connect Procore directly from this page)
  const [showProjectEditModal, setShowProjectEditModal] = useState(false);
  const routerSearch = useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );
  const { location: configureLocation } = useRouterState();
  const [selectedProjectId, setSelectedProjectId] = useState<
    string | undefined
  >(
    () =>
      (routerSearch.get("projectId") ??
        routerSearch.get("project") ??
        undefined) ||
      undefined,
  );

  const projects = useMemo(() => projectsData || [], [projectsData]);
  const selectedProjectRow = useMemo(
    () =>
      selectedProjectId
        ? (projects as ProjectRow[]).find((p) => p._id === selectedProjectId)
        : undefined,
    [selectedProjectId, projects],
  );
  const projectOptions = useMemo(
    () =>
      (projects as ProjectRow[])
        .filter((p) => !p.archived)
        .map((p) => ({
          label: p.projectName ?? "",
          value: p._id,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [projects],
  );
  const { data: groupsData, isLoading: isLoadingGroups } = useListGroups(
    selectedProjectId
      ? {
          companyId,
          projectId: selectedProjectId,
          per_page: 500,
          excludeArchivedProjects: true,
        }
      : { companyId: undefined },
  );
  const projectSelectorOptions = useMemo(
    () => [
      {
        value: CREATE_NEW_PROJECT_OPTION_VALUE,
        label: "+ Create New Project",
        hideIndicator: true,
        dividerBelow: true,
        hideWhenQueryNotEmpty: true,
      },
      ...projectOptions,
    ],
    [projectOptions],
  );
  const existingGroupOptions = useMemo(() => {
    if (!selectedProjectId) return [];
    return ((groupsData?.data as GroupRow[] | undefined) ?? [])
      .map((group) => ({
        value: group._id,
        label:
          group.groupName ||
          group.arrangementName ||
          group.equipmentName ||
          "Group",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [groupsData?.data, selectedProjectId]);
  const existingGroupLabelById = useMemo(() => {
    const map = new Map<string, string>();
    existingGroupOptions.forEach((option) => {
      map.set(String(option.value), option.label);
    });
    return map;
  }, [existingGroupOptions]);
  const existingGroupTypeById = useMemo(() => {
    const map = new Map<string, GroupRow["type"]>();
    ((groupsData?.data as GroupRow[] | undefined) ?? []).forEach((group) => {
      map.set(group._id, group.type);
    });
    return map;
  }, [groupsData?.data]);
  const targetGroupOptions = useMemo(
    () => [
      {
        value: CREATE_NEW_GROUP_OPTION_VALUE,
        label: "+ Create New Group",
        hideIndicator: true,
        hideWhenQueryNotEmpty: true,
      },
      {
        value: ADD_TO_EXISTING_GROUP_OPTION_VALUE,
        label: "+ Add to Existing Group",
        hideIndicator: true,
        dividerBelow: true,
        hideWhenQueryNotEmpty: true,
      },
      ...existingGroupOptions,
    ],
    [existingGroupOptions],
  );

  const categoryGroups = useMemo(() => {
    if (!categoriesData || categoriesData.length === 0) {
      return [];
    }

    const groupMap = new Map<string, Array<{ label: string; value: string }>>();

    categoriesData.forEach((category) => {
      const groupLabel = category.categoryClass;
      const option = {
        label: category.categoryName,
        value: category._id,
      };

      if (!groupMap.has(groupLabel)) {
        groupMap.set(groupLabel, []);
      }
      groupMap.get(groupLabel)!.push(option);
    });

    const groups = Array.from(groupMap.entries())
      .map(([label, options]) => ({
        label,
        options: options.sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return groups;
  }, [categoriesData]);

  // Eagerly fetch categories when entering the single:taliho configuration view
  useEffect(() => {
    if (configureKey === "single:taliho" && !shouldFetchCategories) {
      setShouldFetchCategories(true);
    }
  }, [configureKey, shouldFetchCategories]);

  // Only fetch Procore data when the current mode actually needs it.
  // Non-Procore modes (prefix-quantity, upload-csv, manual-entry, single:taliho)
  // should not trigger Procore API calls that produce confusing error toasts.
  const needsProcoreData =
    configureKey?.startsWith("single:procore") ||
    configureKey === "bulk:arrangement:assorted" ||
    configureKey === "bulk:arrangement:procore-drawings";

  const procoreCompanyID = needsProcoreData
    ? selectedProjectRow?.procoreCompanyID || ""
    : "";
  const procoreProjectID = needsProcoreData
    ? selectedProjectRow?.procoreProjectID || ""
    : "";

  const {
    data: locationsData,
    isLoading: isLoadingLocations,
    error: locationsError,
  } = useProcoreLocations(
    companyId,
    selectedProjectId || "",
    procoreCompanyID,
    procoreProjectID,
  );

  useEffect(() => {
    if (locationsError) {
      const err = locationsError as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load Procore locations";
      toast.error(errorMessage);
    }
  }, [locationsError]);

  const {
    data: permissionsData,
    isLoading: isLoadingPermissions,
    error: permissionsError,
  } = useProcorePermissions(
    companyId,
    selectedProjectId || "",
    procoreCompanyID,
    procoreProjectID,
  );

  useEffect(() => {
    if (permissionsError) {
      console.error(
        "❌ [ConfigureView] Permissions fetch error:",
        permissionsError,
      );
    }
  }, [permissionsError]);

  const {
    data: drawingsPages,
    error: drawingsError,
    hasNextPage: drawingsHasNext,
    isFetchingNextPage: drawingsFetchingNext,
    fetchNextPage: drawingsFetchNext,
  } = useProcoreDrawingsPaged(
    companyId,
    selectedProjectId || "",
    procoreCompanyID,
    procoreProjectID,
    50,
  );

  useEffect(() => {
    if (drawingsError) {
      console.error("❌ [ConfigureView] Drawings fetch error:", drawingsError);
    }
  }, [drawingsError]);

  const projectIsConnected = !!(
    selectedProjectRow?.procoreProjectID &&
    selectedProjectRow?.procoreProjectID !== "none"
  );

  const procoreToolOptions = useMemo(() => {
    const tools =
      (permissionsData as { tools?: ProcoreTool[] } | undefined)?.tools ?? [];

    const friendlyNameToBackend: Record<string, string> = {
      "coordination issues": "coordination-issues",
      directory: "directory",
      documents: "documents",
      drawings: "drawings",
      forms: "forms",
      incidents: "incidents",
      inspections: "inspections",
      instructions: "instructions",
      observations: "observations",
      photos: "photos",
      "punch list": "punch-list",
      rfis: "rfis",
      "rfi's": "rfis",
      specifications: "specifications",
      submittals: "submittals",
      tasks: "tasks",
    };

    const filtered = tools
      .filter((tool) => {
        if (tool.available_for_user !== true) return false;
        const friendlyLower = (tool.friendly_name || "").trim().toLowerCase();
        return Boolean(friendlyNameToBackend[friendlyLower]);
      })
      .map((tool) => {
        const friendlyLower = (tool.friendly_name || "").trim().toLowerCase();
        const backendName = friendlyNameToBackend[friendlyLower] || tool.name;
        return {
          label: tool.friendly_name,
          value: backendName,
          backendName: backendName,
        };
      });
    return filtered.sort((a, b) => a.label.localeCompare(b.label));
  }, [permissionsData]);

  const procoreLocationOptions = useMemo(() => {
    if (!locationsData || !Array.isArray(locationsData)) return [];
    return (locationsData as ProcoreLocation[]).map((location) => ({
      label:
        location.name || location.location_name || `Location ${location.id}`,
      value: String(location.id),
    }));
  }, [locationsData]);
  const drawingsOptionsAll = useMemo(() => {
    type PageData = { data?: DrawingEntry[] };
    const flat = (drawingsPages?.pages || []).flatMap((p) =>
      Array.isArray((p as PageData)?.data) ? (p as PageData).data! : [],
    );
    if (!Array.isArray(flat)) return [];
    type DrawingWithExtras = DrawingEntry & {
      number?: string;
      code?: string;
      drawing_area_name?: string;
      area?: string;
      latestRevisionNumber?: string;
      latestRevisionId?: string;
    };
    return flat
      .map((d, idx: number) => {
        const de = d as DrawingWithExtras;
        const codeMatch = de.number || de.code || `Drawing ${idx + 1}`;
        const title = d.title || d.name || "Untitled";
        const area = de.drawing_area_name || de.area || "—";
        const discipline = d.discipline || "—";
        const revisionNumber = de.latestRevisionNumber
          ? ` (Rev ${d.latestRevisionNumber})`
          : "";
        const revId = de.latestRevisionId;
        if (!revId) return null;
        return {
          label: `${codeMatch} — ${title}${revisionNumber}`,
          value: String(revId),
          area,
          discipline,
        };
      })
      .filter(
        (
          opt,
        ): opt is {
          label: string;
          value: string;
          area: string;
          discipline: string;
        } => Boolean(opt && opt.area && opt.discipline),
      )
      .sort(
        (a, b) =>
          a.area.localeCompare(b.area) ||
          a.discipline.localeCompare(b.discipline) ||
          a.label.localeCompare(b.label),
      );
  }, [drawingsPages?.pages]);
  const drawingsGroupsPaged = useMemo(() => {
    const slice = drawingsOptionsAll;
    const byKey = new Map<
      string,
      {
        label: string;
        area: string;
        discipline: string;
        options: { label: string; value: string }[];
      }
    >();
    slice.forEach((opt) => {
      const key = `${opt.area} • ${opt.discipline}`;
      const grp = byKey.get(key) ?? {
        label: key,
        area: opt.area,
        discipline: opt.discipline,
        options: [],
      };
      grp.options.push({ label: opt.label, value: opt.value });
      byKey.set(key, grp);
    });

    const naturalCompare = (a: string, b: string): number => {
      const aParts = a.split(/(\d+)/);
      const bParts = b.split(/(\d+)/);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || "";
        const bPart = bParts[i] || "";
        const aNum = parseInt(aPart, 10);
        const bNum = parseInt(bPart, 10);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          if (aNum !== bNum) return aNum - bNum;
        } else {
          const cmp = aPart.localeCompare(bPart);
          if (cmp !== 0) return cmp;
        }
      }
      return 0;
    };

    const getSheetNumber = (label: string): string => {
      const idx = label.indexOf(" — ");
      return idx !== -1 ? label.substring(0, idx) : label;
    };

    return Array.from(byKey.values())
      .sort(
        (a, b) =>
          a.area.localeCompare(b.area) ||
          a.discipline.localeCompare(b.discipline),
      )
      .map(({ label, options }) => ({
        label,
        options: options.sort((a, b) =>
          naturalCompare(getSheetNumber(a.label), getSheetNumber(b.label)),
        ),
      }));
  }, [drawingsOptionsAll]);
  const [selectedProcoreTool, setSelectedProcoreTool] = useState<
    string | undefined
  >(undefined);
  const [selectedProcoreLocation, setSelectedProcoreLocation] = useState<
    string | undefined
  >(undefined);
  const [selectedDrawingCodes, setSelectedDrawingCodes] = useState<
    string[] | undefined
  >(undefined);
  const [assortedSelectedTalihoCodes, setAssortedSelectedTalihoCodes] =
    useState<string[] | undefined>(undefined);
  const [assortedSelectedLocations, setAssortedSelectedLocations] = useState<
    string[] | undefined
  >(undefined);
  const [assortedSelectedTools, setAssortedSelectedTools] = useState<
    string[] | undefined
  >(undefined);
  const [assortedSelectedDrawings, setAssortedSelectedDrawings] = useState<
    string[] | undefined
  >(undefined);
  const [assortedSelectionHistory, setAssortedSelectionHistory] = useState<
    Array<{
      type: "taliho" | "location" | "tool" | "drawing";
      value: string;
      label: string;
    }>
  >([]);
  const [talihoQuery, setTalihoQuery] = useState<string>("");
  const [isCsvDragging, setIsCsvDragging] = useState<boolean>(false);

  function parseExcludeNumbers(input: string): number[] {
    if (!input || !input.trim()) return [];

    const result: number[] = [];
    const parts = input.split(",").map((p) => p.trim());

    for (const part of parts) {
      if (!part) continue;

      if (part.includes("-")) {
        const [startStr, endStr] = part.split("-").map((s) => s.trim());
        const rangeStart = parseInt(startStr, 10);
        const rangeEnd = parseInt(endStr, 10);

        if (!isNaN(rangeStart) && !isNaN(rangeEnd) && rangeEnd >= rangeStart) {
          for (let i = rangeStart; i <= rangeEnd; i++) {
            result.push(i);
          }
        }
      } else {
        const num = parseInt(part, 10);
        if (!isNaN(num)) {
          result.push(num);
        }
      }
    }

    return [...new Set(result)];
  }

  const hasTargetGroupSelection = Boolean(
    selectedTargetGroupId ||
      selectedTargetGroupName.trim() ||
      targetGroupQuery.trim(),
  );

  function getValidationErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    switch (configureKey) {
      case "single:taliho":
        if (!categoryValue && !talihoQuery?.trim()) {
          errors.name = "Name is required.";
        }
        break;
      case "single:procore-location":
        if (!selectedProjectId) errors.project = "Project is required.";
        if (!selectedProcoreLocation)
          errors.procoreLocation = "Procore location is required.";
        break;
      case "single:procore-tool":
        if (!selectedProjectId) errors.project = "Project is required.";
        if (!selectedProcoreTool)
          errors.procoreTool = "Procore tool is required.";
        break;
      case "single:procore-drawing":
        if (!selectedProjectId) errors.project = "Project is required.";
        if (!selectedDrawingCodes?.length)
          errors.drawing = "Drawing is required.";
        break;
      case "bulk:existing-group":
        if (!selectedProjectId) errors.project = "Project is required.";
        if (!assortedSelectionHistory.length)
          errors.selection = "Select at least one item.";
        break;
      case "bulk:arrangement:assorted":
        if (!selectedProjectId) errors.project = "Project is required.";
        if (!hasTargetGroupSelection) errors.group = "Group is required.";
        if (!assortedSelectionHistory.length)
          errors.selection = "Select at least one item.";
        break;
      case "bulk:arrangement:procore-drawings":
        if (!hasTargetGroupSelection) errors.group = "Group is required.";
        if (!selectedProjectId) errors.project = "Project is required.";
        if (!selectedDrawingCodes?.length)
          errors.drawing = "Select one or more drawings.";
        break;
      case "bulk:equipment:prefix-quantity": {
        const startVal = startRef.current?.value?.trim();
        const endVal = endRef.current?.value?.trim();
        const start = startVal ? Number(startVal) : NaN;
        const end = endVal ? Number(endVal) : NaN;
        if (!selectedProjectId) errors.project = "Project is required.";
        if (!hasTargetGroupSelection) errors.group = "Group is required.";
        if (!prefixRef.current?.value?.trim())
          errors.prefix = "Prefix is required.";
        if (!Number.isFinite(start)) errors.start = "Start number is required.";
        if (!Number.isFinite(end)) errors.end = "End number is required.";
        if (
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          Number(end) < Number(start)
        ) {
          errors.range = "End must be greater than or equal to Start.";
        }
        break;
      }
      case "bulk:equipment:upload-csv":
        if (!selectedProjectId) errors.project = "Project is required.";
        if (!hasTargetGroupSelection) errors.group = "Group is required.";
        if (!uploadCsvRef.current?.files?.length) {
          errors.csv = "CSV file is required.";
        }
        break;
      case "bulk:equipment:manual-entry":
        if (!selectedProjectId) errors.project = "Project is required.";
        if (!hasTargetGroupSelection) errors.group = "Group is required.";
        if (!manualItemsRef.current?.value?.trim()) {
          errors.items = "At least one item is required.";
        }
        break;
      default:
        break;
    }
    return errors;
  }

  function clearValidationError(field: string) {
    setValidationErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function resetFields() {
    setValidationErrors({});
    switch (configureKey) {
      case "single:taliho":
        setCategoryValue(undefined);
        if (descriptionRef.current) descriptionRef.current.value = "";
        break;
      case "single:procore-location":
        setSelectedProcoreLocation(undefined);
        break;
      case "single:procore-tool":
        setSelectedProcoreTool(undefined);
        break;
      case "single:procore-drawing":
        setSelectedDrawingCodes(undefined);
        break;
      case "bulk:existing-group":
        setAssortedSelectionHistory([]);
        setTalihoQuery("");
        setAssortedSelectedTalihoCodes(undefined);
        setAssortedSelectedLocations(undefined);
        setAssortedSelectedTools(undefined);
        setAssortedSelectedDrawings(undefined);
        break;
      case "bulk:arrangement:assorted":
        if (!selectedTargetGroupId) {
          setSelectedTargetGroupName("");
          setTargetGroupQuery("");
        }
        setAssortedSelectionHistory([]);
        setTalihoQuery("");
        setAssortedSelectedTalihoCodes(undefined);
        setAssortedSelectedLocations(undefined);
        setAssortedSelectedTools(undefined);
        setAssortedSelectedDrawings(undefined);
        setAssortedCategories([]);
        break;
      case "bulk:arrangement:procore-drawings":
        if (!selectedTargetGroupId) {
          setSelectedTargetGroupName("");
          setTargetGroupQuery("");
        }
        setSelectedDrawingCodes(undefined);
        break;
      case "bulk:equipment:prefix-quantity":
        if (prefixRef.current) prefixRef.current.value = "";
        if (startRef.current) startRef.current.value = "1";
        if (endRef.current) endRef.current.value = "";
        if (!selectedTargetGroupId) {
          setSelectedTargetGroupName("");
          setTargetGroupQuery("");
        }
        if (excludeNumbersRef.current) excludeNumbersRef.current.value = "";
        break;
      case "bulk:equipment:upload-csv":
        if (uploadCsvRef.current) uploadCsvRef.current.value = "";
        if (!selectedTargetGroupId) {
          setSelectedTargetGroupName("");
          setTargetGroupQuery("");
        }
        setCsvFileName(null);
        break;
      case "bulk:equipment:manual-entry":
        if (manualItemsRef.current) manualItemsRef.current.value = "";
        if (!selectedTargetGroupId) {
          setSelectedTargetGroupName("");
          setTargetGroupQuery("");
        }
        break;
    }
  }

  const isFieldInvalid = useCallback(
    (field: string) => Boolean(validationErrors[field]),
    [validationErrors],
  );
  const errorMessage = useCallback(
    (field: string) => validationErrors[field],
    [validationErrors],
  );
  const inputErrorClass = useCallback(
    (field: string) =>
      isFieldInvalid(field)
        ? "border-red-500 ring-1 ring-red-400 focus:border-red-500 focus:ring-red-400"
        : "",
    [isFieldInvalid],
  );
  const targetGroupValue = useMemo(
    () =>
      selectedTargetGroupId ||
      selectedTargetGroupName ||
      targetGroupQuery ||
      undefined,
    [selectedTargetGroupId, selectedTargetGroupName, targetGroupQuery],
  );
  const selectedTargetGroupLabel = useMemo(() => {
    if (selectedTargetGroupId) {
      return (
        existingGroupLabelById.get(selectedTargetGroupId) ||
        selectedTargetGroupName ||
        targetGroupQuery ||
        "Group"
      );
    }
    return selectedTargetGroupName.trim() || targetGroupQuery.trim();
  }, [
    selectedTargetGroupId,
    selectedTargetGroupName,
    targetGroupQuery,
    existingGroupLabelById,
  ]);

  /** Invalidate all caches that may become stale after QR creation. */
  function invalidatePostCreateCaches() {
    void queryClient.invalidateQueries({ queryKey: QrKeys.all });
    void queryClient.invalidateQueries({
      queryKey: QrProcoreToolsKeys.all,
    });
    void queryClient.invalidateQueries({ queryKey: groupsKeys.all });
    void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    void queryClient.invalidateQueries({
      queryKey: ["Aggregation", "project-qrcodes"],
    });
    if (companyId) {
      void queryClient.invalidateQueries({
        queryKey: companyKeys.dashboardStats(companyId),
      });
    }
  }

  function handleProjectChange(
    next: SearchComboBoxValue | SearchComboBoxValue[] | undefined,
  ) {
    const nextValue =
      typeof next === "string" || typeof next === "number"
        ? String(next).trim()
        : "";
    if (!nextValue) {
      setSelectedProjectId(undefined);
      clearValidationError("project");
      return;
    }
    if (nextValue === CREATE_NEW_PROJECT_OPTION_VALUE) {
      clearValidationError("project");
      onRequestCreateProject?.();
      return;
    }
    setSelectedProjectId(nextValue);
    clearValidationError("project");
  }

  function handleTargetGroupChange(
    next: SearchComboBoxValue | SearchComboBoxValue[] | undefined,
  ) {
    const nextValue =
      typeof next === "string" || typeof next === "number"
        ? String(next).trim()
        : "";
    if (!nextValue) {
      setSelectedTargetGroupId(undefined);
      setSelectedTargetGroupName("");
      setTargetGroupQuery("");
      clearValidationError("group");
      return;
    }
    if (nextValue === CREATE_NEW_GROUP_OPTION_VALUE) {
      clearValidationError("group");
      onRequestAddGroupFromDropdown?.("new");
      return;
    }
    if (nextValue === ADD_TO_EXISTING_GROUP_OPTION_VALUE) {
      clearValidationError("group");
      onRequestAddGroupFromDropdown?.("existing");
      return;
    }
    if (existingGroupLabelById.has(nextValue)) {
      const existingLabel = existingGroupLabelById.get(nextValue) || "";
      setSelectedTargetGroupId(nextValue);
      setSelectedTargetGroupName(existingLabel);
      setTargetGroupQuery(existingLabel);
      clearValidationError("group");
      return;
    }
    setSelectedTargetGroupId(undefined);
    setSelectedTargetGroupName(nextValue);
    setTargetGroupQuery(nextValue);
    clearValidationError("group");
  }

  async function resolveTargetGroup(input: {
    createType: "arrangement" | "equipment" | "procore-drawing-codes";
    emptyGroupMessage: string;
    equipmentID?: string;
    categories?: string[];
  }): Promise<{
    groupId: string;
    groupName: string;
    isExisting: boolean;
  } | null> {
    if (!companyId || !selectedProjectId) {
      toast.error("Company or Project not found.");
      return null;
    }
    if (selectedTargetGroupId) {
      return {
        groupId: selectedTargetGroupId,
        groupName: selectedTargetGroupLabel || "Group",
        isExisting: true,
      };
    }
    const groupName = selectedTargetGroupName.trim() || targetGroupQuery.trim();
    if (!groupName) {
      toast.error(input.emptyGroupMessage);
      return null;
    }
    const created = await createGroup({
      companyId,
      projectId: selectedProjectId,
      groupName,
      type: input.createType,
      equipmentID: input.equipmentID,
      categories: input.categories?.length ? input.categories : undefined,
    });
    const groupId = created?.data?._id as string | undefined;
    if (!groupId) {
      toast.error("Failed to create group.");
      return null;
    }
    return { groupId, groupName, isExisting: false };
  }

  function getGroupingTypeForExistingGroup(
    groupId: string,
  ): "group" | "equipment" {
    return existingGroupTypeById.get(groupId) === "equipment"
      ? "equipment"
      : "group";
  }

  function buildPrefixCodeNames(input: {
    prefix: string;
    start: number;
    end: number;
    excludeNumbers: number[];
  }): string[] {
    const { prefix, start, end, excludeNumbers } = input;
    const excludeSet = new Set(excludeNumbers);
    const names: string[] = [];
    for (let i = start; i <= end; i += 1) {
      if (!excludeSet.has(i)) {
        names.push(`${prefix}-${i}`);
      }
    }
    return names;
  }

  function buildExistingGroupPayloads(
    projectId: string,
    groupingId: string,
  ): CreateQRCodeDto[] {
    const payloads: CreateQRCodeDto[] = [];
    const labelByValue = new Map<string, string>();
    assortedSelectionHistory.forEach((h) => labelByValue.set(h.value, h.label));

    (assortedSelectedTalihoCodes || []).forEach((val) => {
      const label =
        labelByValue.get(val) ||
        (val.startsWith("custom:") ? val.slice(7) : val);
      payloads.push({
        companyId,
        projectId,
        groupingId,
        groupingType: "group",
        name: label,
        type: "folder",
      });
    });

    (assortedSelectedLocations || []).forEach((loc) => {
      const label = labelByValue.get(loc) || loc;
      payloads.push({
        companyId,
        projectId,
        groupingId,
        groupingType: "group",
        name: label,
        type: "procore-location",
        procoreLinkedItemId: loc,
      });
    });

    (assortedSelectedTools || []).forEach((toolApiName) => {
      const backendToolName =
        procoreApiNameToBackendEnum[toolApiName] || toolApiName;
      const label = labelByValue.get(toolApiName) || toolApiName;
      payloads.push({
        companyId,
        projectId,
        groupingId,
        groupingType: "group",
        name: label,
        type: "procore-tool",
        procoreTool: backendToolName,
      });
    });

    (assortedSelectedDrawings || []).forEach((revId) => {
      const label = labelByValue.get(revId) || revId;
      payloads.push({
        companyId,
        projectId,
        groupingId,
        groupingType: "group",
        name: label,
        type: "procore-drawing-code",
        procoreLinkedItemId: revId,
      });
    });

    return payloads;
  }

  async function queueBulkItemsAsyncJob({
    payloads,
    groupId,
    groupName,
    groupingType,
  }: {
    payloads: CreateQRCodeDto[];
    groupId: string;
    groupName: string;
    groupingType?: string;
  }): Promise<boolean> {
    try {
      const jobResponse = await createBulkQRItemsJob({
        projectId: selectedProjectId || "",
        companyId,
        createdBy:
          (user?.email as string) ||
          ((user as Record<string, unknown> | null)?.emailAddress as string) ||
          undefined,
        groupId,
        groupName,
        items: payloads,
      });

      addJob({
        jobId: jobResponse.jobId,
        status: "pending",
        progress: 0,
        total: payloads.length,
        groupName,
        groupId,
        groupingType,
        type: "bulk-qr-creation",
      });

      return true;
    } catch (error: unknown) {
      logQRError(error, "create-bulk-qr-items-job-failed", undefined, {
        projectId: selectedProjectId,
        qrCount: payloads.length,
      });

      let message = "Failed to create bulk QR job.";
      if (typeof error === "object" && error !== null) {
        const maybeResponse = (
          error as { response?: { data?: { message?: string } } }
        ).response;
        message =
          maybeResponse?.data?.message ??
          (error instanceof Error ? error.message : message);
      }
      toast.error(message);
      return false;
    }
  }

  async function createSingleQR(): Promise<string | null> {
    if (!companyId) {
      toast.error("Company not found. Please log in again.");
      return null;
    }

    let formData: CreateQRCodeDto | null = null;

    switch (configureKey) {
      case "single:taliho": {
        const effectiveValue = categoryValue || talihoQuery?.trim();
        if (!effectiveValue) {
          toast.error("Please enter a name or select a category.");
          return null;
        }

        let qrName = String(effectiveValue);
        if (categoriesData) {
          const matchedCategory = categoriesData.find(
            (cat) => cat._id === effectiveValue,
          );
          if (matchedCategory) {
            qrName = matchedCategory.categoryName;
          }
        }

        formData = {
          companyId,
          name: qrName,
          type: "folder",
          description: descriptionRef.current?.value || undefined,
        };
        if (selectedProjectId) {
          formData.projectId = selectedProjectId;
        }
        break;
      }

      case "single:procore-location": {
        if (!selectedProcoreLocation) {
          console.error("❌ [CreateQR] No Procore location selected");
          toast.error("Please select a Procore location.");
          return null;
        }
        const locationOption = procoreLocationOptions.find(
          (opt) => String(opt.value) === selectedProcoreLocation,
        );
        const locationName = locationOption?.label || selectedProcoreLocation;
        formData = {
          companyId,
          name: locationName,
          type: "procore-location",
          procoreLinkedItemId: selectedProcoreLocation,
          description: descriptionRef.current?.value || undefined,
        };
        if (selectedProjectId) {
          formData.projectId = selectedProjectId;
        }
        break;
      }

      case "single:procore-tool": {
        if (!selectedProcoreTool) {
          toast.error("Please select a Procore tool.");
          return null;
        }

        const backendToolName = selectedProcoreTool;

        const selectedToolOption = procoreToolOptions.find(
          (opt) => opt.value === selectedProcoreTool,
        );
        const friendlyName = selectedToolOption?.label || selectedProcoreTool;

        formData = {
          companyId,
          name: friendlyName,
          type: "procore-tool",
          procoreTool: backendToolName,
          description: descriptionRef.current?.value || undefined,
        };
        if (selectedProjectId) {
          formData.projectId = selectedProjectId;
        }
        break;
      }

      case "single:procore-drawing": {
        if (!selectedDrawingCodes || selectedDrawingCodes.length === 0) {
          toast.error("Please select a drawing.");
          return null;
        }
        const drawingId = selectedDrawingCodes[0];
        const drawingLabel =
          drawingsOptionsAll.find((d) => d.value === drawingId)?.label ||
          drawingId;
        formData = {
          companyId,
          name: drawingLabel,
          type: "procore-drawing-code",
          procoreLinkedItemId: drawingId,
          description: descriptionRef.current?.value || undefined,
        };
        if (selectedProjectId) {
          formData.projectId = selectedProjectId;
        }
        break;
      }

      default:
        toast.error("Unsupported QR code type.");
        return null;
    }

    if (existingGroupId) {
      formData.groupingId = existingGroupId;
      formData.groupingType = "group";
    }

    try {
      const response = await createQRCode(formData);
      return response.data._id;
    } catch (error: unknown) {
      logQRError(error, "create-qr-single-failed", undefined, {
        projectId: selectedProjectId,
      });
      let message = "Failed to create QR code.";
      if (typeof error === "object" && error !== null) {
        const maybeResponse = (
          error as { response?: { data?: { message?: string } } }
        ).response;
        message =
          maybeResponse?.data?.message ??
          (error instanceof Error ? error.message : message);
      }
      toast.error(message);
      return null;
    }
  }

  async function onCreateAddAnother() {
    const errors = getValidationErrors();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please complete all required fields.");
      return;
    }

    const setLoading = setShowLoading ?? setInternalShowLoading;
    setLoading(true);

    const disableLoading = () => {
      setLoading(false);
      setInternalShowLoading(false);
      if (setShowLoading) setShowLoading(false);
    };

    try {
      if (configureKey === "bulk:existing-group") {
        const groupingId = existingGroupId;
        if (!companyId || !selectedProjectId || !groupingId) {
          toast.error("Company, Project, or Group not found.");
          return;
        }

        const payloads = buildExistingGroupPayloads(
          selectedProjectId,
          groupingId,
        );
        if (payloads.length === 0) {
          toast.error(
            "Please select at least one item to create QR codes for.",
          );
          return;
        }

        if (payloads.length > MAX_BULK_QR_BATCH_SIZE) {
          toast.error(
            `Cannot create more than ${MAX_BULK_QR_BATCH_SIZE.toLocaleString()} QR codes at once. Please reduce the quantity and try again.`,
          );
          return;
        }

        const queued = await queueBulkItemsAsyncJob({
          payloads,
          groupId: groupingId,
          groupName: existingGroupName,
          groupingType: "group",
        });
        if (!queued) {
          return;
        }

        disableLoading();
        toast.success(
          `Creating QR codes for "${existingGroupName}"... You can create another batch.`,
        );
        invalidatePostCreateCaches();
        resetFields();
        return;
      }

      if (configureKey === "bulk:equipment:prefix-quantity") {
        if (!companyId || !selectedProjectId) {
          toast.error("Company or Project not found.");
          return;
        }
        const prefix = prefixRef.current?.value?.trim() || "";
        const startVal = startRef.current?.value?.trim();
        const endVal = endRef.current?.value?.trim();
        const start = startVal ? Number(startVal) : NaN;
        const end = endVal ? Number(endVal) : NaN;
        if (
          !prefix ||
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          end < start
        ) {
          toast.error("Please provide a valid prefix and range.");
          return;
        }

        const excludeNumbersInput =
          excludeNumbersRef.current?.value?.trim() || "";
        const excludeNumbers = parseExcludeNumbers(excludeNumbersInput);

        const excludedInRange = excludeNumbers.filter(
          (n) => n >= start && n <= end,
        ).length;
        const count = Math.max(0, end - start + 1 - excludedInRange);

        if (count <= 0) {
          toast.error("Invalid range for quantity.");
          return;
        }
        if (count > MAX_BULK_QR_BATCH_SIZE) {
          toast.error(
            `Cannot create more than ${MAX_BULK_QR_BATCH_SIZE.toLocaleString()} QR codes at once. Please reduce the quantity and try again.`,
          );
          return;
        }
        if (!hasUnlimitedQR && count > qrBatchLimit) {
          toast.error(
            `Your ${tierConfig.name} plan allows up to ${qrBatchLimit} QR codes at once. Upgrade to Professional or Business for unlimited batch creation.`,
          );
          return;
        }
        const targetGroup = await resolveTargetGroup({
          createType: "equipment",
          emptyGroupMessage: "Please enter a group name.",
          equipmentID: prefix,
        });
        if (!targetGroup) {
          return;
        }
        const { groupId, groupName, isExisting } = targetGroup;

        if (isExisting) {
          const groupingType = getGroupingTypeForExistingGroup(groupId);
          const codeNames = buildPrefixCodeNames({
            prefix,
            start,
            end,
            excludeNumbers,
          });
          const payloads = codeNames.map((name) => ({
            companyId,
            projectId: selectedProjectId,
            groupingId: groupId,
            groupingType,
            name,
            type: "folder" as const,
          }));
          const queued = await queueBulkItemsAsyncJob({
            payloads,
            groupId,
            groupName,
            groupingType,
          });
          if (!queued) {
            return;
          }
          disableLoading();
          toast.success(
            `Creating QR codes for "${groupName}"... You can create another batch.`,
          );
          invalidatePostCreateCaches();
          resetFields();
          return;
        }

        let jobResponse;
        try {
          jobResponse = await createBulkQRJob({
            equipmentId: groupId,
            projectId: selectedProjectId,
            numberOfCodes: count,
            companyId,
            createdBy:
              (user?.email as string) ||
              ((user as Record<string, unknown> | null)
                ?.emailAddress as string) ||
              undefined,
            groupName,
            startNumber: start,
            excludeNumbers:
              excludeNumbers.length > 0 ? excludeNumbers : undefined,
          });
        } catch (error: unknown) {
          logQRError(error, "create-bulk-qr-job-failed", undefined, {
            projectId: selectedProjectId,
            qrCount: count,
          });
          let message = "Failed to create bulk QR job.";
          if (typeof error === "object" && error !== null) {
            const maybeResponse = (
              error as { response?: { data?: { message?: string } } }
            ).response;
            message =
              maybeResponse?.data?.message ??
              (error instanceof Error ? error.message : message);
          }
          toast.error(message);
          return;
        }
        addJob({
          jobId: jobResponse.jobId,
          status: "pending",
          progress: 0,
          total: count,
          groupName,
          groupId,
          type: "bulk-qr-creation",
        });
        disableLoading();
        toast.success(
          `QR code generation started for "${groupName}"! You can create another group.`,
        );
        invalidatePostCreateCaches();
        resetFields();
        return;
      } else if (configureKey === "bulk:arrangement:assorted") {
        if (!companyId || !selectedProjectId) {
          toast.error("Company or Project not found.");
          return;
        }
        const targetGroup = await resolveTargetGroup({
          createType: "arrangement",
          emptyGroupMessage: "Please enter a group name.",
          categories: assortedCategories,
        });
        if (!targetGroup) {
          return;
        }
        const { groupId, groupName } = targetGroup;
        const payloads: CreateQRCodeDto[] = [];
        const labelByValue = new Map<string, string>();
        assortedSelectionHistory.forEach((h) =>
          labelByValue.set(h.value, h.label),
        );
        (assortedSelectedTalihoCodes || []).forEach((val) => {
          const label =
            labelByValue.get(val) ||
            (val.startsWith("custom:") ? val.substring(7) : val);
          payloads.push({
            companyId,
            projectId: selectedProjectId,
            groupingId: groupId,
            groupingType: "group",
            name: label,
            type: "folder",
          });
        });
        (assortedSelectedLocations || []).forEach((loc) => {
          const label = labelByValue.get(loc) || loc;
          payloads.push({
            companyId,
            projectId: selectedProjectId,
            groupingId: groupId,
            groupingType: "group",
            name: label,
            type: "procore-location",
            procoreLinkedItemId: loc,
          });
        });
        (assortedSelectedTools || []).forEach((toolApiName) => {
          const backendToolName =
            procoreApiNameToBackendEnum[toolApiName] || toolApiName;
          const label = labelByValue.get(toolApiName) || toolApiName;
          payloads.push({
            companyId,
            projectId: selectedProjectId,
            groupingId: groupId,
            groupingType: "group",
            name: label,
            type: "procore-tool",
            procoreTool: backendToolName,
          });
        });
        (assortedSelectedDrawings || []).forEach((revId) => {
          const label = labelByValue.get(revId) || revId;
          payloads.push({
            companyId,
            projectId: selectedProjectId,
            groupingId: groupId,
            groupingType: "group",
            name: label,
            type: "procore-drawing-code",
            procoreLinkedItemId: revId,
          });
        });
        if (payloads.length === 0) {
          toast.error("No items selected to populate.");
          return;
        }
        if (payloads.length > MAX_BULK_QR_BATCH_SIZE) {
          toast.error(
            `Cannot create more than ${MAX_BULK_QR_BATCH_SIZE.toLocaleString()} QR codes at once. Please reduce the quantity and try again.`,
          );
          return;
        }
        if (!hasUnlimitedQR && payloads.length > qrBatchLimit) {
          toast.error(
            `Your ${tierConfig.name} plan allows up to ${qrBatchLimit} QR codes at once. Upgrade to Professional or Business for unlimited batch creation.`,
          );
          return;
        }
        const queued = await queueBulkItemsAsyncJob({
          payloads,
          groupId,
          groupName,
          groupingType: "group",
        });
        if (!queued) {
          return;
        }
        disableLoading();
        toast.success(
          `Creating QR codes for "${groupName}"... You can create another group.`,
        );
        invalidatePostCreateCaches();
        resetFields();
        return;
      } else if (configureKey === "bulk:arrangement:procore-drawings") {
        if (!companyId || !selectedProjectId) {
          toast.error("Company or Project not found.");
          return;
        }
        if (!selectedDrawingCodes || selectedDrawingCodes.length === 0) {
          toast.error("Please select one or more drawings.");
          return;
        }
        if (selectedDrawingCodes.length > MAX_BULK_QR_BATCH_SIZE) {
          toast.error(
            `Cannot create more than ${MAX_BULK_QR_BATCH_SIZE.toLocaleString()} QR codes at once. Please reduce the quantity and try again.`,
          );
          return;
        }
        const targetGroup = await resolveTargetGroup({
          createType: "procore-drawing-codes",
          emptyGroupMessage: "Please enter a group name.",
        });
        if (!targetGroup) {
          return;
        }
        const { groupId, groupName } = targetGroup;
        const payloads = selectedDrawingCodes.map((revId) => {
          const label =
            drawingsOptionsAll.find((d) => d.value === revId)?.label || revId;
          return {
            companyId,
            projectId: selectedProjectId,
            groupingId: groupId,
            groupingType: "group" as const,
            name: label,
            type: "procore-drawing-code" as const,
            procoreLinkedItemId: revId,
          };
        });
        const queued = await queueBulkItemsAsyncJob({
          payloads,
          groupId,
          groupName,
          groupingType: "group",
        });
        if (!queued) {
          return;
        }
        disableLoading();
        toast.success(
          `Creating drawing QR codes for "${groupName}"... You can create another group.`,
        );
        invalidatePostCreateCaches();
        resetFields();
        return;
      } else if (configureKey === "bulk:equipment:upload-csv") {
        if (!companyId || !selectedProjectId) {
          toast.error("Company or Project not found.");
          return;
        }
        const file = uploadCsvRef.current?.files?.[0] || null;
        if (!file) {
          toast.error("Please provide a CSV file.");
          return;
        }
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          toast.error("CSV must include a header and at least one row.");
          return;
        }
        const headers = lines[0]
          .split(",")
          .map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
        const codeIdx = headers.indexOf("equipment_code");
        if (codeIdx === -1) {
          toast.error(
            'CSV must include a header column named "equipment_code".',
          );
          return;
        }
        const codes: string[] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i]
            .split(",")
            .map((c) => c.trim().replace(/^"|"$/g, ""));
          const code = row[codeIdx];
          if (code) codes.push(code);
        }
        if (codes.length === 0) {
          toast.error("No valid equipment codes found in CSV.");
          return;
        }
        if (codes.length > MAX_BULK_QR_BATCH_SIZE) {
          toast.error(
            `Cannot create more than ${MAX_BULK_QR_BATCH_SIZE.toLocaleString()} QR codes at once. Please reduce the quantity and try again.`,
          );
          return;
        }
        if (!hasUnlimitedQR && codes.length > qrBatchLimit) {
          toast.error(
            `Your ${tierConfig.name} plan allows up to ${qrBatchLimit} QR codes at once. Upgrade to Professional or Business for unlimited batch creation.`,
          );
          return;
        }
        const targetGroup = await resolveTargetGroup({
          createType: "equipment",
          emptyGroupMessage: "Please enter a group name.",
        });
        if (!targetGroup) {
          return;
        }
        const { groupId, groupName } = targetGroup;
        const payloads = codes.map((code) => ({
          companyId,
          projectId: selectedProjectId,
          groupingId: groupId,
          groupingType: "equipment" as const,
          name: code,
          type: "folder" as const,
        }));
        const queued = await queueBulkItemsAsyncJob({
          payloads,
          groupId,
          groupName,
          groupingType: "equipment",
        });
        if (!queued) {
          return;
        }
        disableLoading();
        toast.success(
          `Creating QR codes from CSV for "${groupName}"... You can create another group.`,
        );
        invalidatePostCreateCaches();
        resetFields();
        return;
      } else if (configureKey === "bulk:equipment:manual-entry") {
        if (!companyId || !selectedProjectId) {
          toast.error("Company or Project not found.");
          return;
        }
        const raw = manualItemsRef.current?.value || "";
        const codes = raw
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (codes.length === 0) {
          toast.error("Please enter at least one item.");
          return;
        }
        if (codes.length > MAX_BULK_QR_BATCH_SIZE) {
          toast.error(
            `Cannot create more than ${MAX_BULK_QR_BATCH_SIZE.toLocaleString()} QR codes at once. Please reduce the quantity and try again.`,
          );
          return;
        }
        if (!hasUnlimitedQR && codes.length > qrBatchLimit) {
          toast.error(
            `Your ${tierConfig.name} plan allows up to ${qrBatchLimit} QR codes at once. Upgrade to Professional or Business for unlimited batch creation.`,
          );
          return;
        }
        const targetGroup = await resolveTargetGroup({
          createType: "equipment",
          emptyGroupMessage: "Please enter a group name.",
        });
        if (!targetGroup) {
          return;
        }
        const { groupId, groupName } = targetGroup;
        const payloads = codes.map((code) => ({
          companyId,
          projectId: selectedProjectId,
          groupingId: groupId,
          groupingType: "equipment" as const,
          name: code,
          type: "folder" as const,
        }));
        const queued = await queueBulkItemsAsyncJob({
          payloads,
          groupId,
          groupName,
          groupingType: "equipment",
        });
        if (!queued) {
          return;
        }
        disableLoading();
        toast.success(
          `Creating QR codes from manual list for "${groupName}"... You can create another group.`,
        );
        invalidatePostCreateCaches();
        resetFields();
        return;
      }

      // Handle single QR types
      const qrId = await createSingleQR();
      if (qrId) {
        toast.success("QR code successfully created!");
        invalidatePostCreateCaches();
        resetFields();
      } else {
        logQRError(
          new Error("QR creation returned null"),
          "qr-creation-returned-null",
          undefined,
          {
            companyId,
            projectId: selectedProjectId,
          },
        );
        console.error("❌ [CreateQR] QR creation returned null");
      }
    } finally {
      disableLoading();
    }
  }

  async function onCreateNow() {
    const errors = getValidationErrors();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please complete all required fields.");
      return;
    }

    console.log("[onCreateNow] Starting, configureKey:", configureKey);
    const setLoading = setShowLoading ?? setInternalShowLoading;
    setLoading(true);

    const disableLoading = () => {
      setLoading(false);
      setInternalShowLoading(false);
      if (setShowLoading) setShowLoading(false);
    };

    try {
      if (configureKey === "bulk:existing-group") {
        const groupingId = existingGroupId;
        if (!companyId || !selectedProjectId || !groupingId) {
          toast.error("Company, Project, or Group not found.");
          return;
        }

        const payloads = buildExistingGroupPayloads(
          selectedProjectId,
          groupingId,
        );

        if (payloads.length === 0) {
          toast.error(
            "Please select at least one item to create QR codes for.",
          );
          return;
        }

        if (payloads.length > MAX_BULK_QR_BATCH_SIZE) {
          toast.error(
            `Cannot create more than ${MAX_BULK_QR_BATCH_SIZE.toLocaleString()} QR codes at once. Please reduce the quantity and try again.`,
          );
          return;
        }

        const queued = await queueBulkItemsAsyncJob({
          payloads,
          groupId: groupingId,
          groupName: existingGroupName,
          groupingType: "group",
        });
        if (!queued) {
          return;
        }

        disableLoading();
        toast.success(
          `Creating QR codes for "${existingGroupName}"... You can navigate away while they process.`,
        );

        invalidatePostCreateCaches();

        navigate({ to: "/group/$groupId", params: { groupId: groupingId } });
        return;
      }

      if (configureKey === "bulk:equipment:prefix-quantity") {
        console.log(
          "✅ [MATCHED] bulk:equipment:prefix-quantity - Will use NEW /bulk-async endpoint",
        );
        if (!companyId || !selectedProjectId) {
          toast.error("Company or Project not found.");
          return;
        }
        const prefix = prefixRef.current?.value?.trim() || "";
        const startVal = startRef.current?.value?.trim();
        const endVal = endRef.current?.value?.trim();
        const start = startVal ? Number(startVal) : NaN;
        const end = endVal ? Number(endVal) : NaN;
        if (
          !prefix ||
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          end < start
        ) {
          toast.error("Please provide a valid prefix and range.");
          return;
        }
        const excludeNumbersInput =
          excludeNumbersRef.current?.value?.trim() || "";
        const excludeNumbers = parseExcludeNumbers(excludeNumbersInput);

        const excludedInRange = excludeNumbers.filter(
          (n) => n >= start && n <= end,
        ).length;
        const count = Math.max(0, end - start + 1 - excludedInRange);

        if (count <= 0) {
          toast.error("Invalid range for quantity.");
          return;
        }

        if (count > MAX_BULK_QR_BATCH_SIZE) {
          toast.error(
            `Cannot create more than ${MAX_BULK_QR_BATCH_SIZE.toLocaleString()} QR codes at once. Please reduce the quantity and try again.`,
          );
          return;
        }

        if (!hasUnlimitedQR && count > qrBatchLimit) {
          toast.error(
            `Your ${tierConfig.name} plan allows up to ${qrBatchLimit} QR codes at once. Upgrade to Professional or Business for unlimited batch creation.`,
          );
          return;
        }
        const targetGroup = await resolveTargetGroup({
          createType: "equipment",
          emptyGroupMessage: "Please enter a group name.",
          equipmentID: prefix,
        });
        if (!targetGroup) {
          return;
        }
        const { groupId, groupName, isExisting } = targetGroup;

        if (isExisting) {
          const groupingType = getGroupingTypeForExistingGroup(groupId);
          const codeNames = buildPrefixCodeNames({
            prefix,
            start,
            end,
            excludeNumbers,
          });
          const payloads = codeNames.map((name) => ({
            companyId,
            projectId: selectedProjectId,
            groupingId: groupId,
            groupingType,
            name,
            type: "folder" as const,
          }));

          const queued = await queueBulkItemsAsyncJob({
            payloads,
            groupId,
            groupName,
            groupingType,
          });
          if (!queued) {
            return;
          }

          disableLoading();
          toast.success(
            `Creating QR codes for "${groupName}"... You can navigate away while they process.`,
          );
          invalidatePostCreateCaches();
          navigate({ to: "/group/$groupId", params: { groupId } });

          return;
        }

        let jobResponse;
        try {
          jobResponse = await createBulkQRJob({
            equipmentId: groupId,
            projectId: selectedProjectId,
            numberOfCodes: count,
            companyId,
            createdBy:
              (user?.email as string) ||
              ((user as Record<string, unknown> | null)
                ?.emailAddress as string) ||
              undefined,
            groupName,
            startNumber: start,
            excludeNumbers:
              excludeNumbers.length > 0 ? excludeNumbers : undefined,
          });
        } catch (error: unknown) {
          logQRError(error, "create-bulk-qr-job-failed", undefined, {
            projectId: selectedProjectId,
            qrCount: count,
          });
          let message = "Failed to create bulk QR job.";
          if (typeof error === "object" && error !== null) {
            const maybeResponse = (
              error as { response?: { data?: { message?: string } } }
            ).response;
            message =
              maybeResponse?.data?.message ??
              (error instanceof Error ? error.message : message);
          }
          toast.error(message);
          return;
        }

        addJob({
          jobId: jobResponse.jobId,
          status: "pending",
          progress: 0,
          total: count,
          groupName,
          groupId,
          type: "bulk-qr-creation",
        });

        disableLoading();

        console.log(
          "[Bulk QR] Started backend async job:",
          jobResponse.jobId,
          "Total:",
          count,
        );
        toast.success(
          "QR code generation started! You can navigate away while it processes.",
        );

        invalidatePostCreateCaches();

        navigate({ to: "/group/$groupId", params: { groupId } });

        return;
      } else if (configureKey === "bulk:arrangement:assorted") {
        if (!companyId || !selectedProjectId) {
          toast.error("Company or Project not found.");
          return;
        }
        const targetGroup = await resolveTargetGroup({
          createType: "arrangement",
          emptyGroupMessage: "Please enter a group name.",
          categories: assortedCategories,
        });
        if (!targetGroup) {
          return;
        }
        const { groupId, groupName } = targetGroup;
        const payloads: CreateQRCodeDto[] = [];
        const labelByValue = new Map<string, string>();
        assortedSelectionHistory.forEach((h) =>
          labelByValue.set(h.value, h.label),
        );
        (assortedSelectedTalihoCodes || []).forEach((val) => {
          const label =
            labelByValue.get(val) ||
            (val.startsWith("custom:") ? val.substring(7) : val);
          payloads.push({
            companyId,
            projectId: selectedProjectId,
            groupingId: groupId,
            groupingType: "group",
            name: label,
            type: "folder",
          });
        });
        (assortedSelectedLocations || []).forEach((loc) => {
          const label = labelByValue.get(loc) || loc;
          payloads.push({
            companyId,
            projectId: selectedProjectId,
            groupingId: groupId,
            groupingType: "group",
            name: label,
            type: "procore-location",
            procoreLinkedItemId: loc,
          });
        });
        (assortedSelectedTools || []).forEach((toolApiName) => {
          const backendToolName =
            procoreApiNameToBackendEnum[toolApiName] || toolApiName;
          const label = labelByValue.get(toolApiName) || toolApiName;
          payloads.push({
            companyId,
            projectId: selectedProjectId,
            groupingId: groupId,
            groupingType: "group",
            name: label,
            type: "procore-tool",
            procoreTool: backendToolName,
          });
        });
        (assortedSelectedDrawings || []).forEach((revId) => {
          const label = labelByValue.get(revId) || revId;
          payloads.push({
            companyId,
            projectId: selectedProjectId,
            groupingId: groupId,
            groupingType: "group",
            name: label,
            type: "procore-drawing-code",
            procoreLinkedItemId: revId,
          });
        });
        if (payloads.length === 0) {
          toast.error("No items selected to populate.");
          return;
        }

        if (payloads.length > MAX_BULK_QR_BATCH_SIZE) {
          toast.error(
            `Cannot create more than ${MAX_BULK_QR_BATCH_SIZE.toLocaleString()} QR codes at once. Please reduce the quantity and try again.`,
          );
          return;
        }

        if (!hasUnlimitedQR && payloads.length > qrBatchLimit) {
          toast.error(
            `Your ${tierConfig.name} plan allows up to ${qrBatchLimit} QR codes at once. Upgrade to Professional or Business for unlimited batch creation.`,
          );
          return;
        }

        const queued = await queueBulkItemsAsyncJob({
          payloads,
          groupId,
          groupName,
          groupingType: "group",
        });
        if (!queued) {
          return;
        }

        disableLoading();
        toast.success(
          "Creating QR codes... You can navigate away while they process.",
        );

        invalidatePostCreateCaches();

        navigate({ to: "/group/$groupId", params: { groupId } });
        return;
      } else if (configureKey === "bulk:arrangement:procore-drawings") {
        if (!companyId || !selectedProjectId) {
          toast.error("Company or Project not found.");
          return;
        }
        if (!selectedDrawingCodes || selectedDrawingCodes.length === 0) {
          toast.error("Please select one or more drawings.");
          return;
        }
        if (selectedDrawingCodes.length > MAX_BULK_QR_BATCH_SIZE) {
          toast.error(
            `Cannot create more than ${MAX_BULK_QR_BATCH_SIZE.toLocaleString()} QR codes at once. Please reduce the quantity and try again.`,
          );
          return;
        }
        const targetGroup = await resolveTargetGroup({
          createType: "procore-drawing-codes",
          emptyGroupMessage: "Please enter a group name.",
        });
        if (!targetGroup) {
          return;
        }
        const { groupId, groupName } = targetGroup;
        const payloads = selectedDrawingCodes.map((revId) => {
          const label =
            drawingsOptionsAll.find((d) => d.value === revId)?.label || revId;
          return {
            companyId,
            projectId: selectedProjectId,
            groupingId: groupId,
            groupingType: "group" as const,
            name: label,
            type: "procore-drawing-code" as const,
            procoreLinkedItemId: revId,
          };
        });
        const queued = await queueBulkItemsAsyncJob({
          payloads,
          groupId,
          groupName,
          groupingType: "group",
        });
        if (!queued) {
          return;
        }

        disableLoading();
        toast.success(
          "Creating drawing QR codes... You can navigate away while they process.",
        );

        invalidatePostCreateCaches();

        navigate({ to: "/group/$groupId", params: { groupId } });
        return;
      } else if (configureKey === "bulk:equipment:upload-csv") {
        if (!companyId || !selectedProjectId) {
          toast.error("Company or Project not found.");
          return;
        }
        const file = uploadCsvRef.current?.files?.[0] || null;
        if (!file) {
          toast.error("Please provide a CSV file.");
          return;
        }
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          toast.error("CSV must include a header and at least one row.");
          return;
        }
        const headers = lines[0]
          .split(",")
          .map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
        const codeIdx = headers.indexOf("equipment_code");
        if (codeIdx === -1) {
          toast.error(
            'CSV must include a header column named "equipment_code".',
          );
          return;
        }
        const codes: string[] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i]
            .split(",")
            .map((c) => c.trim().replace(/^"|"$/g, ""));
          const code = row[codeIdx];
          if (code) codes.push(code);
        }
        if (codes.length === 0) {
          toast.error("No valid equipment codes found in CSV.");
          return;
        }

        if (codes.length > MAX_BULK_QR_BATCH_SIZE) {
          toast.error(
            `Cannot create more than ${MAX_BULK_QR_BATCH_SIZE.toLocaleString()} QR codes at once. Please reduce the quantity and try again.`,
          );
          return;
        }

        if (!hasUnlimitedQR && codes.length > qrBatchLimit) {
          toast.error(
            `Your ${tierConfig.name} plan allows up to ${qrBatchLimit} QR codes at once. Upgrade to Professional or Business for unlimited batch creation.`,
          );
          return;
        }

        const targetGroup = await resolveTargetGroup({
          createType: "equipment",
          emptyGroupMessage: "Please enter a group name.",
        });
        if (!targetGroup) {
          return;
        }
        const { groupId, groupName } = targetGroup;
        const payloads = codes.map((code) => ({
          companyId,
          projectId: selectedProjectId,
          groupingId: groupId,
          groupingType: "equipment" as const,
          name: code,
          type: "folder" as const,
        }));
        const queued = await queueBulkItemsAsyncJob({
          payloads,
          groupId,
          groupName,
          groupingType: "equipment",
        });
        if (!queued) {
          return;
        }

        disableLoading();
        toast.success(
          "Creating QR codes from CSV... You can navigate away while they process.",
        );

        invalidatePostCreateCaches();

        navigate({ to: "/group/$groupId", params: { groupId } });
        return;
      } else if (configureKey === "bulk:equipment:manual-entry") {
        if (!companyId || !selectedProjectId) {
          toast.error("Company or Project not found.");
          return;
        }
        const raw = manualItemsRef.current?.value || "";
        const codes = raw
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (codes.length === 0) {
          toast.error("Please enter at least one item.");
          return;
        }

        if (codes.length > MAX_BULK_QR_BATCH_SIZE) {
          toast.error(
            `Cannot create more than ${MAX_BULK_QR_BATCH_SIZE.toLocaleString()} QR codes at once. Please reduce the quantity and try again.`,
          );
          return;
        }

        if (!hasUnlimitedQR && codes.length > qrBatchLimit) {
          toast.error(
            `Your ${tierConfig.name} plan allows up to ${qrBatchLimit} QR codes at once. Upgrade to Professional or Business for unlimited batch creation.`,
          );
          return;
        }

        const targetGroup = await resolveTargetGroup({
          createType: "equipment",
          emptyGroupMessage: "Please enter a group name.",
        });
        if (!targetGroup) {
          return;
        }
        const { groupId, groupName } = targetGroup;
        const payloads = codes.map((code) => ({
          companyId,
          projectId: selectedProjectId,
          groupingId: groupId,
          groupingType: "equipment" as const,
          name: code,
          type: "folder" as const,
        }));
        const queued = await queueBulkItemsAsyncJob({
          payloads,
          groupId,
          groupName,
          groupingType: "equipment",
        });
        if (!queued) {
          return;
        }

        disableLoading();
        toast.success(
          "Creating QR codes from manual list... You can navigate away while they process.",
        );

        invalidatePostCreateCaches();

        navigate({ to: "/group/$groupId", params: { groupId } });
        return;
      } else {
        // single-create flows
        const qrId = await createSingleQR();
        if (qrId) {
          toast.success("QR code successfully created!");
          invalidatePostCreateCaches();
          navigate({ to: "/qrcode/$qrcodeId", params: { qrcodeId: qrId } });
        } else {
          logQRError(
            new Error("QR creation returned null"),
            "qr-creation-returned-null",
            undefined,
            {
              companyId,
              projectId: selectedProjectId,
            },
          );
          console.error("❌ [CreateQR] QR creation returned null");
        }
      }
    } finally {
      disableLoading();
    }
  }

  function onCsvInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const f = list[0];
    if (!f.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please select a .csv file");
      if (uploadCsvRef.current) uploadCsvRef.current.value = "";
      return;
    }
    setCsvFileName(f.name);
  }

  function onCsvDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsCsvDragging(false);
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please drop a .csv file");
      return;
    }
    try {
      if (uploadCsvRef.current) {
        const dt = new DataTransfer();
        dt.items.add(f);
        uploadCsvRef.current.files = dt.files;
      }
    } catch {
      /* noop */
    }
    setCsvFileName(f.name);
  }

  function onCsvDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsCsvDragging(true);
  }
  function onCsvDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsCsvDragging(true);
  }
  function onCsvDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsCsvDragging(false);
  }
  function stringifySearch(search: unknown): string {
    if (!search) return "";
    if (typeof search === "string")
      return search.startsWith("?") ? search.substring(1) : search;
    if (search instanceof URLSearchParams) return search.toString();
    if (typeof search === "object") {
      try {
        const entries: Array<[string, string]> = [];
        for (const [key, value] of Object.entries(
          search as Record<string, unknown>,
        )) {
          if (value == null) continue;
          if (Array.isArray(value)) {
            value.forEach((v) => {
              if (v != null) entries.push([key, String(v)]);
            });
          } else {
            entries.push([key, String(value)]);
          }
        }
        return new URLSearchParams(entries).toString();
      } catch {
        return "";
      }
    }
    return "";
  }
  const buildProjectEditHref = (id?: string) => {
    if (!id) return "#";
    const { returnTo, returnQuery } = buildReturnParams({
      pathname: "/create-qr",
      search:
        configureLocation.search instanceof URLSearchParams
          ? `?${configureLocation.search.toString()}`
          : typeof configureLocation.search === "string"
            ? configureLocation.search
            : `?${stringifySearch(configureLocation.search)}`,
    });
    const qp = new URLSearchParams();
    qp.set("edit", "1");
    qp.set("returnTo", returnTo);
    qp.set("returnQuery", returnQuery);
    return `/project/${id}?${qp.toString()}`;
  };
  useEffect(() => {
    const params = new URLSearchParams(
      stringifySearch(configureLocation.search),
    );
    const current = params.get("projectId") ?? params.get("project") ?? "";
    const normalized = current || undefined;
    setSelectedProjectId(normalized);
  }, [configureLocation.search]);

  useEffect(() => {
    const params = new URLSearchParams(
      stringifySearch(configureLocation.search),
    );
    const nextGroupingId = params.get("groupingId") || undefined;
    const previousGroupingId = previousUrlGroupingIdRef.current;
    previousUrlGroupingIdRef.current = nextGroupingId;
    setSelectedTargetGroupId(nextGroupingId);
    setSelectedTargetGroupName((currentName) => {
      if (!nextGroupingId) {
        if (previousGroupingId) return "";
        return currentName;
      }
      return existingGroupLabelById.get(nextGroupingId) || currentName;
    });
    setTargetGroupQuery((currentQuery) => {
      if (!nextGroupingId) {
        if (previousGroupingId) return "";
        return currentQuery;
      }
      return existingGroupLabelById.get(nextGroupingId) || currentQuery;
    });
  }, [configureLocation.search, existingGroupLabelById]);

  useEffect(() => {
    if (!pendingGroupName?.trim()) return;
    setSelectedTargetGroupId(undefined);
    setSelectedTargetGroupName(pendingGroupName.trim());
    setTargetGroupQuery(pendingGroupName.trim());
    clearValidationError("group");
    onPendingGroupNameConsumed?.();
  }, [pendingGroupName, onPendingGroupNameConsumed]);

  useEffect(() => {
    if (configureKey === "single:taliho") return;

    const params = new URLSearchParams(window.location.search);
    const current = params.get("projectId") ?? params.get("project");
    const next = selectedProjectId ?? "";
    if ((current ?? "") !== (next ?? "")) {
      if (selectedProjectId) {
        params.set("projectId", selectedProjectId);
      } else {
        params.delete("projectId");
        params.delete("project");
      }
      if (params.has("groupingId")) params.delete("groupingId");
      setSelectedTargetGroupId(undefined);
      setSelectedTargetGroupName("");
      setTargetGroupQuery("");
      navigate({
        to: "/create-qr",
        search: Object.fromEntries(params.entries()),
      });
    }
  }, [selectedProjectId, navigate, configureKey]);

  useEffect(() => {
    if (!configureKey?.startsWith("bulk:")) return;
    if (configureKey === "bulk:existing-group") return;
    const params = new URLSearchParams(window.location.search);
    const current = params.get("groupingId") ?? "";
    const next = selectedTargetGroupId ?? "";
    if (current === next) return;
    if (next) params.set("groupingId", next);
    else params.delete("groupingId");
    navigate({
      to: "/create-qr",
      search: Object.fromEntries(params.entries()),
    });
  }, [selectedTargetGroupId, navigate, configureKey]);

  const titleByKey: Record<string, string> = {
    "single:taliho": "Configure Taliho QR Code",
    "single:procore-location": "Configure Procore Location",
    "single:procore-tool": "Configure Procore Tool",
    "single:procore-drawing": "Configure Procore Drawing",
    "bulk:arrangement:assorted": "Configure Assorted Group",
    "bulk:arrangement:procore-drawings": "Configure Procore Drawings",
    "bulk:equipment:prefix-quantity": "Configure Prefix + Quantity",
    "bulk:equipment:upload-csv": "Configure Upload CSV",
    "bulk:equipment:manual-entry": "Configure Manual Entry",
  };
  const title = (configureKey && titleByKey[configureKey]) || "Configure";

  function updateSelectionHistory(
    prev: string[],
    next: string[],
    type: "taliho" | "location" | "tool" | "drawing",
    resolveLabel: (v: string) => string,
  ) {
    if (next.length > 0) {
      clearValidationError("selection");
    }
    const prevSet = new Set(prev);
    const nextSet = new Set(next);
    const added = next.filter((v) => !prevSet.has(v));
    const removed = prev.filter((v) => !nextSet.has(v));

    setAssortedSelectionHistory((curr) => {
      let updated = curr;
      if (removed.length) {
        const removedSet = new Set(removed);
        updated = updated.filter(
          (entry) => !(entry.type === type && removedSet.has(entry.value)),
        );
      }
      if (added.length) {
        const additions = added.map((v) => ({
          type,
          value: v,
          label: resolveLabel(v),
        }));
        updated = [...updated, ...additions];
      }
      return updated;
    });
  }

  function removeAssortedSelection(entry: {
    type: "taliho" | "location" | "tool" | "drawing";
    value: string;
  }) {
    setAssortedSelectionHistory((curr) =>
      curr.filter((e) => !(e.type === entry.type && e.value === entry.value)),
    );
    switch (entry.type) {
      case "taliho":
        setAssortedSelectedTalihoCodes((prev) => {
          const next = (prev ?? []).filter((v) => v !== entry.value);
          return next.length ? next : undefined;
        });
        break;
      case "location":
        setAssortedSelectedLocations((prev) => {
          const next = (prev ?? []).filter((v) => v !== entry.value);
          return next.length ? next : undefined;
        });
        break;
      case "tool":
        setAssortedSelectedTools((prev) => {
          const next = (prev ?? []).filter((v) => v !== entry.value);
          return next.length ? next : undefined;
        });
        break;
      case "drawing":
        setAssortedSelectedDrawings((prev) => {
          const next = (prev ?? []).filter((v) => v !== entry.value);
          return next.length ? next : undefined;
        });
        break;
    }
  }

  function renderValidationError(field: string) {
    const message = errorMessage(field);
    if (!message) return null;
    return <p className="mt-1 text-xs text-red-600">{message}</p>;
  }

  function renderTargetGroupField() {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Group Name{" "}
          {isFieldInvalid("group") ? (
            <span className="text-red-500" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        <SearchComboBox
          options={targetGroupOptions}
          value={targetGroupValue}
          query={targetGroupQuery}
          onChange={handleTargetGroupChange}
          onQueryChange={(nextQuery) => {
            setSelectedTargetGroupId(undefined);
            setSelectedTargetGroupName(nextQuery);
            setTargetGroupQuery(nextQuery);
            clearValidationError("group");
          }}
          placeholder="Search or select group"
          className="w-full"
          loading={isLoadingGroups}
          inputClassName={inputErrorClass("group")}
          allowCustomValue
          usePortal
        />
        {renderValidationError("group")}
      </div>
    );
  }

  function renderBody() {
    switch (configureKey) {
      case "single:taliho":
        return (
          <ConfigureSingleTaliho
            categoryValue={categoryValue}
            setCategoryValue={setCategoryValue}
            talihoQuery={talihoQuery}
            setTalihoQuery={setTalihoQuery}
            descriptionRef={descriptionRef}
            isLoadingCategories={isLoadingCategories}
            isCategoriesFetched={isCategoriesFetched}
            categoryGroups={categoryGroups}
            handleCategoriesDropdownOpen={handleCategoriesDropdownOpen}
            isFieldInvalid={isFieldInvalid}
            inputErrorClass={inputErrorClass}
            renderValidationError={renderValidationError}
            clearValidationError={clearValidationError}
            onCreateAddAnother={onCreateAddAnother}
            onCreateNow={onCreateNow}
            configureKey={configureKey}
          />
        );
      case "single:procore-location":
      case "single:procore-tool":
      case "single:procore-drawing":
        return (
          <ConfigureSingleProcore
            configureKey={configureKey}
            selectedProjectId={selectedProjectId}
            projectSelectorOptions={projectSelectorOptions}
            handleProjectChange={handleProjectChange}
            isLoadingProjects={isLoadingProjects}
            projectIsConnected={projectIsConnected}
            selectedProjectRow={selectedProjectRow}
            buildProjectEditHref={buildProjectEditHref}
            setShowProjectEditModal={setShowProjectEditModal}
            procoreLocationOptions={procoreLocationOptions}
            selectedProcoreLocation={selectedProcoreLocation}
            setSelectedProcoreLocation={setSelectedProcoreLocation}
            isLoadingLocations={isLoadingLocations}
            procoreToolOptions={procoreToolOptions}
            selectedProcoreTool={selectedProcoreTool}
            setSelectedProcoreTool={setSelectedProcoreTool}
            isLoadingPermissions={isLoadingPermissions}
            drawingsGroupsPaged={drawingsGroupsPaged}
            selectedDrawingCodes={selectedDrawingCodes}
            setSelectedDrawingCodes={setSelectedDrawingCodes}
            drawingsHasNext={drawingsHasNext ?? false}
            drawingsFetchingNext={drawingsFetchingNext}
            drawingsFetchNext={() => {
              void drawingsFetchNext();
            }}
            isFieldInvalid={isFieldInvalid}
            inputErrorClass={inputErrorClass}
            renderValidationError={renderValidationError}
            clearValidationError={clearValidationError}
            onCreateAddAnother={onCreateAddAnother}
            onCreateNow={onCreateNow}
          />
        );
      case "single:vcard":
        return <ConfigureVCard />;
      case "single:url":
        return <ConfigureURL />;
      case "bulk:existing-group":
        return (
          <ConfigureExistingGroup
            existingGroupName={existingGroupName}
            selectedProjectId={selectedProjectId}
            projectSelectorOptions={projectSelectorOptions}
            handleProjectChange={handleProjectChange}
            isLoadingProjects={isLoadingProjects}
            projectIsConnected={projectIsConnected}
            categoryGroups={categoryGroups}
            assortedSelectedTalihoCodes={assortedSelectedTalihoCodes}
            setAssortedSelectedTalihoCodes={setAssortedSelectedTalihoCodes}
            talihoQuery={talihoQuery}
            setTalihoQuery={setTalihoQuery}
            handleCategoriesDropdownOpen={handleCategoriesDropdownOpen}
            isLoadingCategories={isLoadingCategories}
            procoreLocationOptions={procoreLocationOptions}
            assortedSelectedLocations={assortedSelectedLocations}
            setAssortedSelectedLocations={setAssortedSelectedLocations}
            isLoadingPermissions={isLoadingPermissions}
            procoreToolOptions={procoreToolOptions}
            assortedSelectedTools={assortedSelectedTools}
            setAssortedSelectedTools={setAssortedSelectedTools}
            drawingsGroupsPaged={drawingsGroupsPaged}
            assortedSelectedDrawings={assortedSelectedDrawings}
            setAssortedSelectedDrawings={setAssortedSelectedDrawings}
            drawingsHasNext={drawingsHasNext ?? false}
            drawingsFetchingNext={drawingsFetchingNext}
            drawingsFetchNext={() => {
              void drawingsFetchNext();
            }}
            assortedSelectionHistory={assortedSelectionHistory}
            updateSelectionHistory={updateSelectionHistory}
            removeAssortedSelection={removeAssortedSelection}
            inputErrorClass={inputErrorClass}
            renderValidationError={renderValidationError}
            tierConfig={tierConfig}
            qrBatchLimit={qrBatchLimit}
            hasUnlimitedQR={hasUnlimitedQR}
            onCreateAddAnother={onCreateAddAnother}
            onCreateNow={onCreateNow}
          />
        );
      case "bulk:arrangement:assorted":
      case "bulk:equipment:prefix-quantity":
      case "bulk:equipment:upload-csv":
      case "bulk:equipment:manual-entry":
        return (
          <ConfigureBulkGroup
            configureKey={configureKey}
            selectedProjectId={selectedProjectId}
            projectSelectorOptions={projectSelectorOptions}
            handleProjectChange={handleProjectChange}
            isLoadingProjects={isLoadingProjects}
            projectIsConnected={projectIsConnected}
            selectedProjectRow={selectedProjectRow}
            buildProjectEditHref={buildProjectEditHref}
            setShowProjectEditModal={setShowProjectEditModal}
            renderTargetGroupField={renderTargetGroupField}
            categoryGroups={categoryGroups}
            assortedSelectedTalihoCodes={assortedSelectedTalihoCodes}
            setAssortedSelectedTalihoCodes={setAssortedSelectedTalihoCodes}
            talihoQuery={talihoQuery}
            setTalihoQuery={setTalihoQuery}
            handleCategoriesDropdownOpen={handleCategoriesDropdownOpen}
            isLoadingCategories={isLoadingCategories}
            procoreLocationOptions={procoreLocationOptions}
            assortedSelectedLocations={assortedSelectedLocations}
            setAssortedSelectedLocations={setAssortedSelectedLocations}
            isLoadingLocations={isLoadingLocations}
            procoreToolOptions={procoreToolOptions}
            assortedSelectedTools={assortedSelectedTools}
            setAssortedSelectedTools={setAssortedSelectedTools}
            isLoadingPermissions={isLoadingPermissions}
            drawingsGroupsPaged={drawingsGroupsPaged}
            assortedSelectedDrawings={assortedSelectedDrawings}
            setAssortedSelectedDrawings={setAssortedSelectedDrawings}
            drawingsHasNext={drawingsHasNext ?? false}
            drawingsFetchingNext={drawingsFetchingNext}
            drawingsFetchNext={() => {
              void drawingsFetchNext();
            }}
            assortedSelectionHistory={assortedSelectionHistory}
            updateSelectionHistory={updateSelectionHistory}
            removeAssortedSelection={removeAssortedSelection}
            prefixRef={prefixRef}
            startRef={startRef}
            endRef={endRef}
            excludeNumbersRef={excludeNumbersRef}
            uploadCsvRef={uploadCsvRef}
            csvFileName={csvFileName}
            isCsvDragging={isCsvDragging}
            onCsvInputChange={onCsvInputChange}
            onCsvDrop={onCsvDrop}
            onCsvDragOver={onCsvDragOver}
            onCsvDragEnter={onCsvDragEnter}
            onCsvDragLeave={onCsvDragLeave}
            manualItemsRef={manualItemsRef}
            isFieldInvalid={isFieldInvalid}
            inputErrorClass={inputErrorClass}
            renderValidationError={renderValidationError}
            clearValidationError={clearValidationError}
            tierConfig={tierConfig}
            qrBatchLimit={qrBatchLimit}
            hasUnlimitedQR={hasUnlimitedQR}
            onCreateAddAnother={onCreateAddAnother}
            onCreateNow={onCreateNow}
          />
        );
      case "bulk:arrangement:procore-drawings":
        return (
          <ConfigureBulkDrawings
            selectedProjectId={selectedProjectId}
            projectSelectorOptions={projectSelectorOptions}
            handleProjectChange={handleProjectChange}
            projectIsConnected={projectIsConnected}
            selectedProjectRow={selectedProjectRow}
            buildProjectEditHref={buildProjectEditHref}
            setShowProjectEditModal={setShowProjectEditModal}
            renderTargetGroupField={renderTargetGroupField}
            drawingsGroupsPaged={drawingsGroupsPaged}
            selectedDrawingCodes={selectedDrawingCodes}
            setSelectedDrawingCodes={setSelectedDrawingCodes}
            drawingsHasNext={drawingsHasNext ?? false}
            drawingsFetchingNext={drawingsFetchingNext}
            drawingsFetchNext={() => {
              void drawingsFetchNext();
            }}
            inputErrorClass={inputErrorClass}
            renderValidationError={renderValidationError}
            clearValidationError={clearValidationError}
            tierConfig={tierConfig}
            qrBatchLimit={qrBatchLimit}
            hasUnlimitedQR={hasUnlimitedQR}
            configureKey={configureKey}
            onCreateAddAnother={onCreateAddAnother}
            onCreateNow={onCreateNow}
          />
        );
      default:
        return (
          <div className="text-sm text-gray-600">
            Select an option to configure.
          </div>
        );
    }
  }

  return (
    <div
      className={`w-full mx-auto flex flex-col min-h-0 ${configureKey === "bulk:arrangement:assorted" || configureKey === "bulk:existing-group" ? "max-w-none" : "max-w-4xl"}`}
    >
      <div className="w-full relative flex justify-center items-between gap-4 pr-10">
        <div className="flex items-center pt-1">
          <button
            aria-label="Back"
            onClick={onBack}
            className="group text-2xl text-gray-600 transition-all duration-200 ease-out flex items-center justify-center hover:text-gray-900"
          >
            <i
              className={`bx bx-chevron-left transition-transform group-hover:-translate-x-0.5`}
            ></i>
          </button>
        </div>

        <div
          className={`flex-1 flex flex-col min-h-0 ${configureKey === "bulk:arrangement:assorted" || configureKey === "bulk:existing-group" ? "max-w-none" : "max-w-2xl"}`}
        >
          <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                <p className="text-gray-600 mt-0.5 text-sm">
                  Adjust settings below, then continue.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              {renderBody()}
            </div>
          </div>
        </div>
      </div>
      <LoadingModal open={showLoading ?? internalShowLoading} />

      {/* Project Edit Modal for connecting Procore directly from this page */}
      <ProjectEditModal
        open={showProjectEditModal}
        onClose={() => setShowProjectEditModal(false)}
        projectId={selectedProjectId || ""}
        projectData={
          selectedProjectRow
            ? {
                _id: selectedProjectRow._id,
                projectName: selectedProjectRow.projectName,
                procoreProjectID: selectedProjectRow.procoreProjectID,
                procoreCompanyID: selectedProjectRow.procoreCompanyID,
              }
            : null
        }
        companyId={companyId}
        mode="procore-only"
        onSave={() => {
          void queryClient.invalidateQueries({ queryKey: projectKeys.all });
        }}
      />
    </div>
  );
}
