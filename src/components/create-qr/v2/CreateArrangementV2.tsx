/**
 * Create-QR v2 — flat single-page QR Arrangement layout.
 *
 * Reachable from the Type-selection screen by clicking the QR Arrangement
 * card. Routes to `?layout=v2&typeId=qr-arrangement` and renders here.
 *
 * QR Arrangement bundles existing entities — Company Categories, Procore
 * Locations, Procore Tools, and Procore Drawings — into a single printable
 * layout. The page mirrors V3's four-section picker layout so users get
 * V3 mechanics they already know, but in a flat single-page v2 shell with
 * an always-visible Selection Summary panel (drag-to-reorder + remove).
 *
 * Required: an arrangement name and at least one selected item. Project is
 * optional but unlocks the three Procore source pickers.
 */

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import toast from "react-hot-toast";
import { Reorder, useDragControls } from "framer-motion";
import Button from "@/components/ui/Button";
import SearchComboBox, {
  type SearchComboBoxValue,
} from "@/components/combobox/detail/SearchComboBox";
import CreateProjectModal from "@/components/modal/taliho/CreateProjectModal";
import { useAllProjects } from "@/api/endpoints/projects";
import { useCategories } from "@/api/endpoints/categories";
import {
  useProcoreLocations,
  useProcorePermissions,
  useProcoreDrawingsPaged,
} from "@/api/endpoints/procore";
import { canCreateProjects } from "@/utils/permissions";
import { getStoredUser } from "@/utils/getStoredUser";
import { icons } from "@/lib/icons";
import { createArrangement } from "@/api/stubs/arrangementStub";
import type {
  ArrangementItem,
  ArrangementItemSource,
  CreateArrangementResponse,
} from "@/components/create-qr/arrangement/types";
import type { ProjectRow } from "@/components/create-qr/types";

const SENTINEL_CREATE_NEW_PROJECT = "__create-new-project__";
const CUSTOM_PREFIX = "custom:";

interface CreateArrangementV2Props {
  onBackToTypes?: () => void;
}

// Friendly Procore tool name → backend enum value. Mirrors V3's
// ConfigureView/index.tsx so the submit-time payload uses the same
// canonical names the rest of the app expects.
const PROCORE_TOOL_FRIENDLY_TO_BACKEND: Record<string, string> = {
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

/** Source badge styles + label, keyed by source. */
const SOURCE_PILL: Record<
  ArrangementItemSource,
  { label: string; cls: string }
> = {
  category: {
    label: "Category",
    cls: "bg-rose-50 text-rose-800 ring-rose-200",
  },
  taliho: {
    label: "Taliho",
    cls: "bg-amber-50 text-amber-800 ring-amber-200",
  },
  location: {
    label: "Location",
    cls: "bg-blue-50 text-blue-800 ring-blue-200",
  },
  tool: {
    label: "Tool",
    cls: "bg-violet-50 text-violet-800 ring-violet-200",
  },
  drawing: {
    label: "Drawing",
    cls: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
};

// ─── Combo-value derivation ───────────────────────────────────────────────
// Each picker's SearchComboBox holds string values keyed to its source.
// We store the picks as a single ArrangementItem[] (so the Selection
// Summary can render + reorder them across sources) and derive each
// picker's `value` array from that single source of truth on every render.

const comboValueFor = (item: ArrangementItem): string => {
  if (item.source === "category" && item.extras?.isCustomCategory) {
    return `${CUSTOM_PREFIX}${item.label}`;
  }
  // Strip the source prefix — id format is `{source}-{rest}`.
  const dashIdx = item.id.indexOf("-");
  return dashIdx === -1 ? item.id : item.id.slice(dashIdx + 1);
};

export default function CreateArrangementV2({
  onBackToTypes,
}: CreateArrangementV2Props) {
  const navigate = useNavigate();
  const user = getStoredUser();
  const companyId = user?.companyId || "";

  useEffect(() => {
    if (!canCreateProjects(user)) {
      toast.error("You don't have permission to create QR codes.");
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  // ─── Form state ─────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectQuery, setProjectQuery] = useState("");
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [pendingProjectName, setPendingProjectName] = useState("");

  const [selectedItems, setSelectedItems] = useState<ArrangementItem[]>([]);
  const [categoryQuery, setCategoryQuery] = useState("");

  const [touched, setTouched] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [createdResponse, setCreatedResponse] =
    useState<CreateArrangementResponse | null>(null);

  // ─── Project picker data ────────────────────────────────────────────────
  const { data: projectsData } = useAllProjects(companyId);
  const projects = useMemo(
    () => (projectsData as ProjectRow[] | undefined) ?? [],
    [projectsData],
  );

  const selectedProject = useMemo(
    () => (projectId ? projects.find((p) => p._id === projectId) : null),
    [projectId, projects],
  );

  const procoreCompanyId = selectedProject?.procoreCompanyID ?? "";
  const procoreProjectId = selectedProject?.procoreProjectID ?? "";
  const procoreConnected = Boolean(
    procoreProjectId && procoreProjectId !== "none",
  );

  // ─── Source data hooks ──────────────────────────────────────────────────
  const { data: categoriesData } = useCategories(companyId);
  const { data: procoreLocations } = useProcoreLocations(
    companyId,
    projectId ?? "",
    procoreCompanyId,
    procoreProjectId,
  );
  const { data: procorePermissions } = useProcorePermissions(
    companyId,
    projectId ?? "",
    procoreCompanyId,
    procoreProjectId,
  );
  const procoreDrawings = useProcoreDrawingsPaged(
    companyId,
    projectId ?? "",
    procoreCompanyId,
    procoreProjectId,
    50,
  );

  // ─── Picker option shapes (mirror V3 ConfigureView/index.tsx) ──────────
  type CategoryOption = { label: string; value: string };
  type CategoryGroup = { label: string; options: CategoryOption[] };

  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const cats =
      (categoriesData as
        | Array<{ _id?: string; categoryName?: string; categoryClass?: string }>
        | undefined) ?? [];
    const byClass = new Map<string, CategoryOption[]>();
    for (const cat of cats) {
      const id = String(cat._id ?? "");
      const label = (cat.categoryName ?? "").trim();
      const cls = (cat.categoryClass ?? "Uncategorized").trim() || "Uncategorized";
      if (!id || !label) continue;
      if (!byClass.has(cls)) byClass.set(cls, []);
      byClass.get(cls)!.push({ label, value: id });
    }
    return Array.from(byClass.entries())
      .map(([label, options]) => ({
        label,
        options: options.sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categoriesData]);

  const procoreLocationOptions = useMemo(() => {
    const arr = Array.isArray(procoreLocations)
      ? (procoreLocations as Array<Record<string, unknown>>)
      : [];
    return arr
      .map((loc) => {
        const id = String(loc.id ?? "");
        if (!id) return null;
        const label =
          (typeof loc.name === "string" && loc.name) ||
          (typeof loc.location_name === "string" && loc.location_name) ||
          `Location ${id}`;
        return { label, value: id };
      })
      .filter((o): o is { label: string; value: string } => o !== null)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [procoreLocations]);

  const procoreToolOptions = useMemo(() => {
    const tools =
      (procorePermissions as
        | { tools?: Array<Record<string, unknown>> }
        | undefined)?.tools ?? [];
    return tools
      .filter((t) => {
        if (t.available_for_user !== true) return false;
        const friendly = String(t.friendly_name ?? "").trim().toLowerCase();
        return Boolean(PROCORE_TOOL_FRIENDLY_TO_BACKEND[friendly]);
      })
      .map((t) => {
        const friendly = String(t.friendly_name ?? "");
        const friendlyLower = friendly.trim().toLowerCase();
        const backendName =
          PROCORE_TOOL_FRIENDLY_TO_BACKEND[friendlyLower] ||
          String(t.name ?? "");
        return { label: friendly, value: backendName, backendName };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [procorePermissions]);

  // Drawings: flat list with area/discipline metadata, and a grouped
  // shape for the SearchComboBox. Same transform V3 applies.
  type DrawingFlat = {
    label: string;
    value: string;
    area: string;
    discipline: string;
  };

  const drawingsFlat = useMemo<DrawingFlat[]>(() => {
    type PageData = { data?: Array<Record<string, unknown>> };
    const flat = (procoreDrawings.data?.pages || []).flatMap(
      (p) => ((p as PageData)?.data ?? []) as Array<Record<string, unknown>>,
    );
    return flat
      .map((d, idx): DrawingFlat | null => {
        const codeMatch =
          (typeof d.number === "string" && d.number) ||
          (typeof d.code === "string" && d.code) ||
          `Drawing ${idx + 1}`;
        const title =
          (typeof d.title === "string" && d.title) ||
          (typeof d.name === "string" && d.name) ||
          "Untitled";
        const area =
          (typeof d.drawing_area_name === "string" && d.drawing_area_name) ||
          (typeof d.area === "string" && d.area) ||
          "—";
        const discipline =
          (typeof d.discipline === "string" && d.discipline) || "—";
        const revisionNumber =
          typeof d.latestRevisionNumber === "string"
            ? ` (Rev ${d.latestRevisionNumber})`
            : "";
        const revId =
          typeof d.latestRevisionId === "string" ? d.latestRevisionId : null;
        if (!revId) return null;
        return {
          label: `${codeMatch} — ${title}${revisionNumber}`,
          value: revId,
          area,
          discipline,
        };
      })
      .filter((o): o is DrawingFlat => o !== null);
  }, [procoreDrawings.data?.pages]);

  const drawingsGroups = useMemo(() => {
    const byKey = new Map<
      string,
      { label: string; options: Array<{ label: string; value: string }> }
    >();
    for (const opt of drawingsFlat) {
      const key = `${opt.area} • ${opt.discipline}`;
      if (!byKey.has(key)) byKey.set(key, { label: key, options: [] });
      byKey.get(key)!.options.push({ label: opt.label, value: opt.value });
    }

    const naturalCompare = (a: string, b: string): number => {
      const aParts = a.split(/(\d+)/);
      const bParts = b.split(/(\d+)/);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] ?? "";
        const bPart = bParts[i] ?? "";
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

    const sheetOf = (label: string) => {
      const idx = label.indexOf(" — ");
      return idx === -1 ? label : label.slice(0, idx);
    };

    return Array.from(byKey.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(({ label, options }) => ({
        label,
        options: options.sort((a, b) =>
          naturalCompare(sheetOf(a.label), sheetOf(b.label)),
        ),
      }));
  }, [drawingsFlat]);

  // ─── Per-source selection arrays (derived from selectedItems) ──────────
  const selectedCategoryValues = useMemo(
    () =>
      selectedItems
        .filter((it) => it.source === "category")
        .map(comboValueFor),
    [selectedItems],
  );
  const selectedLocationValues = useMemo(
    () =>
      selectedItems
        .filter((it) => it.source === "location")
        .map(comboValueFor),
    [selectedItems],
  );
  const selectedToolValues = useMemo(
    () =>
      selectedItems.filter((it) => it.source === "tool").map(comboValueFor),
    [selectedItems],
  );
  const selectedDrawingValues = useMemo(
    () =>
      selectedItems
        .filter((it) => it.source === "drawing")
        .map(comboValueFor),
    [selectedItems],
  );

  // ─── Diff helper — used by every picker's onChange ─────────────────────
  // Append newly-added items, drop newly-removed ones, leave the rest of
  // selectedItems untouched (preserving any drag-reorder the user did).
  const applyDiff = (
    source: ArrangementItemSource,
    nextValues: string[],
    buildItem: (value: string) => ArrangementItem | null,
  ) => {
    setSelectedItems((prev) => {
      const currentValuesForSource = prev
        .filter((it) => it.source === source)
        .map(comboValueFor);
      const removed = new Set(
        currentValuesForSource.filter((v) => !nextValues.includes(v)),
      );
      const added = nextValues.filter(
        (v) => !currentValuesForSource.includes(v),
      );

      let result = prev;
      if (removed.size > 0) {
        result = result.filter(
          (it) => it.source !== source || !removed.has(comboValueFor(it)),
        );
      }
      for (const v of added) {
        const item = buildItem(v);
        if (item) result = [...result, item];
      }
      return result;
    });
  };

  // ─── Per-picker change handlers ────────────────────────────────────────
  const handleCategoriesChange = (
    next: SearchComboBoxValue | SearchComboBoxValue[] | undefined,
  ) => {
    const values = (Array.isArray(next) ? next : next ? [next] : []) as string[];
    applyDiff("category", values, (val) => {
      if (val.startsWith(CUSTOM_PREFIX)) {
        const label = val.slice(CUSTOM_PREFIX.length);
        return {
          id: `category-custom-${label.toLowerCase()}`,
          source: "category",
          label,
          extras: { isCustomCategory: true },
        };
      }
      // Existing category — look up label
      for (const grp of categoryGroups) {
        const found = grp.options.find((o) => o.value === val);
        if (found) {
          return {
            id: `category-${val}`,
            source: "category",
            label: found.label,
          };
        }
      }
      return null;
    });
  };

  const handleAddCustomCategory = () => {
    const label = categoryQuery.trim();
    if (!label) return;
    const value = `${CUSTOM_PREFIX}${label}`;
    if (selectedCategoryValues.includes(value)) {
      setCategoryQuery("");
      return;
    }
    handleCategoriesChange([...selectedCategoryValues, value]);
    setCategoryQuery("");
  };

  const handleLocationsChange = (
    next: SearchComboBoxValue | SearchComboBoxValue[] | undefined,
  ) => {
    const values = (Array.isArray(next) ? next : next ? [next] : []) as string[];
    applyDiff("location", values, (val) => {
      const found = procoreLocationOptions.find((o) => o.value === val);
      if (!found) return null;
      return {
        id: `location-${val}`,
        source: "location",
        label: found.label,
        extras: { procoreLinkedItemId: val },
      };
    });
  };

  const handleToolsChange = (
    next: SearchComboBoxValue | SearchComboBoxValue[] | undefined,
  ) => {
    const values = (Array.isArray(next) ? next : next ? [next] : []) as string[];
    applyDiff("tool", values, (val) => {
      const found = procoreToolOptions.find((o) => o.value === val);
      if (!found) return null;
      return {
        id: `tool-${val}`,
        source: "tool",
        label: found.label,
        extras: { procoreTool: found.backendName },
      };
    });
  };

  const handleDrawingsChange = (
    next: SearchComboBoxValue | SearchComboBoxValue[] | undefined,
  ) => {
    const values = (Array.isArray(next) ? next : next ? [next] : []) as string[];
    applyDiff("drawing", values, (val) => {
      const found = drawingsFlat.find((o) => o.value === val);
      if (!found) return null;
      return {
        id: `drawing-${val}`,
        source: "drawing",
        label: found.label,
        extras: {
          procoreLinkedItemId: val,
          drawingArea: `${found.area} • ${found.discipline}`,
          drawingDiscipline: found.discipline,
        },
      };
    });
  };

  const removeSelected = (id: string) => {
    setSelectedItems((prev) => prev.filter((p) => p.id !== id));
  };

  // ─── Project picker ─────────────────────────────────────────────────────
  const projectOptions = useMemo(() => {
    const baseOptions = projects
      .filter((p) => !p.archived)
      .map((p) => ({
        label: p.projectName ?? "Untitled Project",
        value: p._id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [
      ...baseOptions,
      {
        label: "+ Create new project…",
        value: SENTINEL_CREATE_NEW_PROJECT,
      },
    ];
  }, [projects]);

  const handleProjectChange = (
    next: SearchComboBoxValue | SearchComboBoxValue[] | undefined,
  ) => {
    const v = Array.isArray(next) ? next[0] : next;
    if (v === SENTINEL_CREATE_NEW_PROJECT) {
      setPendingProjectName(projectQuery);
      setCreateProjectOpen(true);
      return;
    }
    setProjectId(typeof v === "string" && v.length > 0 ? v : null);
  };

  // When the project changes, drop any selected Procore items — they
  // belong to the prior project's Procore tenant. Categories survive.
  useEffect(() => {
    setSelectedItems((prev) =>
      prev.filter((it) => it.source === "category" || it.source === "taliho"),
    );
  }, [projectId]);

  // ─── Generate ───────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setTouched(true);
    if (name.trim().length === 0) {
      toast.error("Give your arrangement a name before generating.");
      return;
    }
    if (selectedItems.length === 0) {
      toast.error("Add at least one item before generating.");
      return;
    }
    setIsGenerating(true);
    try {
      const response = await createArrangement({
        name: name.trim(),
        ...(projectId ? { projectId } : {}),
        items: selectedItems,
      });
      setCreatedResponse(response);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not create the arrangement. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateMore = () => {
    setName("");
    setProjectId(null);
    setProjectQuery("");
    setSelectedItems([]);
    setCategoryQuery("");
    setTouched(false);
    setCreatedResponse(null);
  };

  const handleCancel = () => {
    navigate({ to: "/dashboard" });
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  if (createdResponse) {
    return (
      <div className="grow flex flex-col p-8">
        <PageHeader title="Arrangement created" />
        <div className="mt-6 max-w-3xl w-full mx-auto">
          <SuccessView
            response={createdResponse}
            onCreateMore={handleCreateMore}
          />
        </div>
      </div>
    );
  }

  const nameMissing = touched && name.trim().length === 0;
  const itemsMissing = touched && selectedItems.length === 0;
  const procoreDisabledHint = !projectId
    ? "Pick a project first to enable Procore sources."
    : !procoreConnected
      ? "This project isn't connected to Procore."
      : "";

  return (
    <div className="grow flex flex-col p-8">
      <div className="mb-6">
        {onBackToTypes && (
          <button
            type="button"
            onClick={onBackToTypes}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded"
            data-testid="v2-back-to-types"
          >
            <i className="bx bx-chevron-left" aria-hidden="true" />
            Back to type
          </button>
        )}
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
          <i className={`${icons.qr} text-green-600 mr-2`}></i>
          Create QR Arrangement
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Group existing QR codes, Procore locations, tools, and drawings
          into a single printable layout.
        </p>
      </div>

      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ─── Left column: form ─── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Arrangement details */}
          <SectionCard
            title="Arrangement details"
            subtitle="Give it a name so you can find it later. Tying it to a project is optional and unlocks Procore sources."
          >
            <RequiredLegend />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Name</FieldLabel>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Floor 3 Inspection Sheet"
                  data-testid="arr-name-input"
                  className={
                    "block w-full rounded-md shadow-sm text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 " +
                    (nameMissing
                      ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                      : "border-gray-300")
                  }
                />
                {nameMissing && (
                  <p className="mt-1 text-xs text-red-600">
                    Name is required.
                  </p>
                )}
              </div>
              <div>
                <FieldLabel>Project</FieldLabel>
                <SearchComboBox
                  options={projectOptions}
                  value={projectId ?? undefined}
                  onChange={handleProjectChange}
                  onQueryChange={setProjectQuery}
                  placeholder="Search projects…"
                  allowCustomValue={false}
                  usePortal
                />
                <p className="mt-1 text-xs text-gray-500">
                  {procoreConnected
                    ? "Procore is connected on this project."
                    : "Optional. Pick a Procore-connected project to also pick from Procore items."}
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Build your arrangement */}
          <SectionCard
            title="Build your arrangement"
            subtitle="Pick items from any of the four sources. Selections appear in the Selection Summary on the right and become the QR codes inside the arrangement."
          >
            {itemsMissing && (
              <p
                className="mb-3 text-xs text-red-600"
                data-testid="arr-items-error"
              >
                Add at least one item before generating.
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Company Categories */}
              <div>
                <FieldLabel>Company Categories</FieldLabel>
                <div className="relative">
                  <SearchComboBox
                    groups={categoryGroups}
                    value={selectedCategoryValues}
                    onChange={handleCategoriesChange}
                    multiple
                    placeholder="Enter names or search…"
                    inputClassName="text-sm pr-16"
                    hideClearButton
                    query={categoryQuery}
                    onQueryChange={setCategoryQuery}
                    hideNoResults
                    usePortal
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded bg-brand-500 text-white disabled:opacity-50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddCustomCategory();
                    }}
                    disabled={!categoryQuery.trim()}
                    data-testid="arr-cat-add"
                  >
                    Add
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Type a new name and click <span className="font-medium">Add</span> to create a custom category for this arrangement.
                </p>
              </div>

              {/* Procore Location */}
              <ProcoreFieldWrapper
                label="Procore Location"
                disabled={!procoreConnected}
                disabledHint={procoreDisabledHint}
              >
                <SearchComboBox
                  options={procoreLocationOptions}
                  value={selectedLocationValues}
                  onChange={handleLocationsChange}
                  multiple
                  placeholder={
                    !procoreConnected
                      ? "Pick a Procore-connected project to enable"
                      : "Search or select locations"
                  }
                  className="w-full"
                  usePortal
                />
              </ProcoreFieldWrapper>

              {/* Procore Tool */}
              <ProcoreFieldWrapper
                label="Procore Tool"
                disabled={!procoreConnected}
                disabledHint={procoreDisabledHint}
              >
                <SearchComboBox
                  options={procoreToolOptions}
                  value={selectedToolValues}
                  onChange={handleToolsChange}
                  multiple
                  placeholder={
                    !procoreConnected
                      ? "Pick a Procore-connected project to enable"
                      : procoreToolOptions.length === 0
                        ? "No tools available"
                        : "Search or select tools"
                  }
                  className="w-full"
                  usePortal
                />
              </ProcoreFieldWrapper>

              {/* Procore Drawings */}
              <ProcoreFieldWrapper
                label="Procore Drawings"
                disabled={!procoreConnected}
                disabledHint={procoreDisabledHint}
              >
                <SearchComboBox
                  groups={drawingsGroups}
                  value={selectedDrawingValues}
                  onChange={handleDrawingsChange}
                  multiple
                  placeholder={
                    !procoreConnected
                      ? "Pick a Procore-connected project to enable"
                      : "Search or select drawings"
                  }
                  className="w-full"
                  onEndReached={() => {
                    if (
                      procoreDrawings.hasNextPage &&
                      !procoreDrawings.isFetchingNextPage
                    ) {
                      void procoreDrawings.fetchNextPage();
                    }
                  }}
                  loading={procoreDrawings.isFetchingNextPage}
                  usePortal
                />
              </ProcoreFieldWrapper>
            </div>
          </SectionCard>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              data-testid="arr-cancel"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleGenerate}
              disabled={isGenerating}
              data-testid="arr-generate"
            >
              {isGenerating
                ? "Creating…"
                : selectedItems.length > 0
                  ? `Create arrangement (${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"})`
                  : "Create arrangement"}
            </Button>
          </div>
        </div>

        {/* ─── Right column: Selection Summary (sticky on lg+) ─── */}
        <aside className="lg:sticky lg:top-6 self-start">
          <SelectionSummaryCard
            items={selectedItems}
            onReorder={setSelectedItems}
            onRemove={removeSelected}
          />
        </aside>
      </div>

      <CreateProjectModal
        open={createProjectOpen}
        onClose={() => {
          setCreateProjectOpen(false);
          setPendingProjectName("");
        }}
        companyId={companyId}
        subtitle="Create a new project for this arrangement."
        initialProjectName={pendingProjectName}
        onSuccess={(newProjectId) => {
          setProjectId(newProjectId);
          setCreateProjectOpen(false);
          setPendingProjectName("");
        }}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function PageHeader({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
        <i className={`${icons.qr} text-green-600 mr-2`}></i>
        {title}
      </h1>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  headerRight,
  children,
}: {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-600">{subtitle}</p>
          )}
        </div>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

function RequiredLegend() {
  return (
    <p
      className="mb-3 text-xs text-gray-500"
      data-testid="arr-required-legend"
    >
      <span className="text-red-600" aria-hidden="true">
        *
      </span>{" "}
      Required field
    </p>
  );
}

function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}
      {required && (
        <span className="text-red-500 ml-0.5" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

function ProcoreFieldWrapper({
  label,
  disabled,
  disabledHint,
  children,
}: {
  label: string;
  disabled: boolean;
  disabledHint: string;
  children: ReactNode;
}) {
  return (
    <div title={disabled ? disabledHint : undefined}>
      <label
        className={
          "block text-sm font-medium mb-1 " +
          (disabled ? "text-gray-400" : "text-gray-700")
        }
      >
        {label}
      </label>
      <div className={disabled ? "pointer-events-none opacity-50" : ""}>
        {children}
      </div>
    </div>
  );
}

function SourcePill({ source }: { source: ArrangementItemSource }) {
  const def = SOURCE_PILL[source];
  return (
    <span
      className={
        "inline-flex items-center px-1.5 py-0.5 rounded ring-1 text-[10px] font-medium uppercase tracking-wide " +
        def.cls
      }
    >
      {def.label}
    </span>
  );
}

// ─── Selection Summary panel ──────────────────────────────────────────────

function SelectionSummaryCard({
  items,
  onReorder,
  onRemove,
}: {
  items: ArrangementItem[];
  onReorder: (next: ArrangementItem[]) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <SectionCard
      title="Selection Summary"
      headerRight={
        <span
          className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
          data-testid="arr-summary-count"
        >
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      }
    >
      {items.length === 0 ? (
        <div
          className="text-center text-xs text-gray-500 py-8 rounded-lg border border-dashed border-gray-200 bg-gray-50"
          data-testid="arr-summary-empty"
        >
          No items yet — pick from any source on the left.
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={onReorder}
          className="space-y-1.5"
          data-testid="arr-summary-list"
        >
          {items.map((item) => (
            <SummaryRow key={item.id} item={item} onRemove={onRemove} />
          ))}
        </Reorder.Group>
      )}

      {items.length > 0 && (
        <p className="mt-3 text-[11px] text-gray-500 leading-snug">
          Drag the handle to reorder. Click <span className="font-medium">×</span> to remove.
        </p>
      )}
    </SectionCard>
  );
}

function SummaryRow({
  item,
  onRemove,
}: {
  item: ArrangementItem;
  onRemove: (id: string) => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 transition"
      data-testid={`arr-summary-row-${item.id}`}
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${item.label}`}
        onPointerDown={(e) => controls.start(e)}
        className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
        data-testid={`arr-summary-handle-${item.id}`}
      >
        <i className="bx bx-grid-vertical text-base" />
      </button>
      <SourcePill source={item.source} />
      <span
        className="flex-1 min-w-0 truncate text-sm text-gray-900"
        title={item.label}
      >
        {item.label}
      </span>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label={`Remove ${item.label}`}
        className="inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
        data-testid={`arr-summary-remove-${item.id}`}
      >
        <i className="bx bx-x text-base" />
      </button>
    </Reorder.Item>
  );
}

// ─── Success view ─────────────────────────────────────────────────────────

function SuccessView({
  response,
  onCreateMore,
}: {
  response: CreateArrangementResponse;
  onCreateMore: () => void;
}) {
  const { arrangement, items } = response;
  return (
    <section
      className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6"
      data-testid="arr-success-view"
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-green-100 text-green-600 flex-shrink-0"
          aria-hidden
        >
          <i className="bx bx-check text-xl" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            "{arrangement.name}" created
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {arrangement.itemCount} item
            {arrangement.itemCount === 1 ? "" : "s"} grouped into your new
            arrangement. It'll appear in your Groups list shortly.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
          Items
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {items.slice(0, 12).map((it) => (
            <span
              key={it.id}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-800 text-xs"
            >
              <SourcePill source={it.source} />
              <span className="truncate max-w-[14rem]" title={it.label}>
                {it.label}
              </span>
            </span>
          ))}
          {items.length > 12 && (
            <span className="text-xs text-gray-500">
              + {items.length - 12} more
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
        <Button
          type="button"
          variant="secondary"
          onClick={onCreateMore}
          data-testid="arr-create-more"
        >
          <i className="bx bx-plus mr-1.5" aria-hidden /> Create another
          arrangement
        </Button>
      </div>
    </section>
  );
}
