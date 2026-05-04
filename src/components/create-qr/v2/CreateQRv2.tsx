/**
 * Create-QR v2 — flat single-page Tool Tracker layout.
 *
 * Opt-in via `?layout=v2` on the existing `/create-qr` route. When the flag
 * is absent (or any other value), the original wizard renders unchanged. The
 * entire alternate experience lives in this file plus its small subcomponents
 * so reverting is "delete the v2/ folder + remove the flag check in
 * create-qr.lazy.tsx".
 *
 * Surface:
 *   - Single mode: Tool details (photo, tool name, category/serial, home,
 *     "Add more details" disclosure), QR code section (Code label, Project),
 *     Check-out rules — all on one page. Generate fires the existing
 *     createToolTrackers stub with a real projectId, then replaces the form
 *     in-place with the existing ToolTrackerGenerated screen.
 *   - Bulk mode: row table + paste-from-spreadsheet (mirrors the wizard's
 *     ConfigureToolTrackerBulk behaviour), QR code section reduced to
 *     Project only (per-row names live in the row table), Check-out rules.
 *
 * Code label is a UI-only field. On submit, each ToolInput's `name` is
 * `(codeLabel.trim() || toolName.trim())`. The field also mirrors the tool
 * name as the user types until they manually edit it, at which point the
 * field takes ownership and stops mirroring.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactNode, RefObject } from "react";
import { useNavigate } from "@tanstack/react-router";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import SearchComboBox, {
  type SearchComboBoxValue,
} from "@/components/combobox/detail/SearchComboBox";
import CreateProjectModal from "@/components/modal/taliho/CreateProjectModal";
import { useAllProjects } from "@/api/endpoints/projects";
import { canCreateProjects } from "@/utils/permissions";
import { getStoredUser } from "@/utils/getStoredUser";
import { SAMPLE_TOOL_CATEGORIES } from "@/data/seed/toolTrackerSeed";
import { icons } from "@/lib/icons";
import { createToolTrackers } from "@/api/stubs/toolTrackerStub";
import type {
  CreateToolTrackersResponse,
  ToolInput,
  ToolTrackerRules as RulesShape,
} from "@/components/create-qr/toolTracker/types";
import type { ProjectRow } from "@/components/create-qr/types";
import ToolPhotoUpload from "@/components/create-qr/ConfigureView/ToolPhotoUpload";
import ToolTrackerRulesEditor, {
  DEFAULT_RULES,
} from "@/components/create-qr/ConfigureView/ToolTrackerRulesEditor";
import ToolTrackerScanPreview from "@/components/create-qr/ConfigureView/ToolTrackerScanPreview";
import ToolTrackerGenerated from "@/components/create-qr/ConfigureView/ToolTrackerGenerated";
import QuantityModeToggle from "@/components/create-qr/ConfigureView/QuantityModeToggle";
import {
  readLastMode,
  writeLastMode,
  type ToolTrackerLastMode,
} from "@/components/create-qr/ConfigureView/toolTrackerCarryDraft";
import toolTrackerCsvTemplate from "@/assets/templates/Tool-Tracker-CSV-Template.csv?url";
import BulkMethodPicker, {
  type BulkMethod,
  type BulkMethodDefinition,
} from "./shared/BulkMethodPicker";
import {
  parseCsvLine,
  parseExcludeNumbers,
} from "./shared/bulkParsers";

const BULK_METHODS: ReadonlyArray<BulkMethodDefinition> = [
  {
    value: "manual",
    icon: "bx bx-list-ul",
    label: "Manual entry",
    description: "Type each tool or paste from a spreadsheet.",
  },
  {
    value: "prefix",
    icon: "bx bx-hash",
    label: "Prefix + quantity",
    description: "Generate a series like Drill-1 through Drill-50.",
  },
  {
    value: "csv",
    icon: "bx bx-upload",
    label: "Upload CSV",
    description: "Import a list with name, category, serial, and location.",
  },
];

function getActiveMethodCardTitle(method: BulkMethod): string {
  switch (method) {
    case "manual":
      return "Add your tools";
    case "prefix":
      return "Generate a series";
    case "csv":
      return "Import from CSV";
  }
}

function getActiveMethodCardSubtitle(method: BulkMethod): string {
  switch (method) {
    case "manual":
      return "One row per tool. Only the name is required. Each row becomes its own QR code.";
    case "prefix":
      return "Pick a prefix and a number range. We'll generate one QR code per number.";
    case "csv":
      return "Drop a .csv file or browse to upload. We'll parse it into editable rows before you generate.";
  }
}

const SENTINEL_CREATE_NEW_PROJECT = "__create-new-project__";

const BULK_MAX_ROWS = 200;
const DEFAULT_CATEGORY = "Uncategorized";

interface ToolFormState extends ToolInput {
  photoFile?: File | null;
  photoPreviewUrl?: string | null;
}

const INITIAL_TOOL: ToolFormState = {
  name: "",
  category: DEFAULT_CATEGORY,
  serial: "",
  homeLocation: "",
  manufacturer: "",
  model: "",
  barcode: "",
  description: "",
  vendor: "",
  purchaseDate: "",
  purchasePrice: "",
  warrantyDate: "",
  productUrl: "",
  manualUrl: "",
  photoFile: null,
  photoPreviewUrl: null,
};

interface BulkRow {
  id: number;
  name: string;
  category: string;
  serial: string;
  homeLocation: string;
}

function makeEmptyRow(id: number): BulkRow {
  return {
    id,
    name: "",
    category: DEFAULT_CATEGORY,
    serial: "",
    homeLocation: "",
  };
}

interface CreateQRv2Props {
  onBackToTypes?: () => void;
}

export default function CreateQRv2({ onBackToTypes }: CreateQRv2Props) {
  const navigate = useNavigate();
  const user = getStoredUser();
  const companyId = user?.companyId || "";

  // Permission gate matches the existing wizard.
  useEffect(() => {
    if (!canCreateProjects(user)) {
      toast.error("You don't have permission to create QR codes.");
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  const [mode, setMode] = useState<ToolTrackerLastMode>(() => readLastMode());
  useEffect(() => {
    writeLastMode(mode);
  }, [mode]);

  const [tool, setTool] = useState<ToolFormState>(INITIAL_TOOL);

  // Code label is UI-only. Mirrors tool name as user types until they edit
  // the Code label manually, then mirroring stops and the field takes
  // ownership. On submit, each ToolInput.name = (codeLabel || toolName).
  const [codeLabel, setCodeLabel] = useState("");
  const [codeLabelMirroring, setCodeLabelMirroring] = useState(true);

  const [showMore, setShowMore] = useState(false);
  const [touched, setTouched] = useState(false);

  // Bulk state — split per method so switching methods doesn't lose work.
  const [bulkMethod, setBulkMethod] = useState<BulkMethod>("manual");

  // Manual method
  const idCounterRef = useRef(3);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>(() => [
    makeEmptyRow(1),
    makeEmptyRow(2),
    makeEmptyRow(3),
  ]);
  const [pasteOpen, setPasteOpen] = useState(false);

  // Prefix + Quantity method
  const [prefixValue, setPrefixValue] = useState("");
  const [rangeStart, setRangeStart] = useState("1");
  const [rangeEnd, setRangeEnd] = useState("");
  const [excludeRaw, setExcludeRaw] = useState("");
  const [prefixDefaultCategory, setPrefixDefaultCategory] =
    useState<string>(DEFAULT_CATEGORY);

  // CSV method
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<BulkRow[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvDragActive, setCsvDragActive] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  // Project picker state.
  const { data: projectsData } = useAllProjects(companyId);
  const projects = useMemo(
    () => (projectsData as ProjectRow[] | undefined) ?? [],
    [projectsData],
  );
  const [projectId, setProjectId] = useState<string | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [pendingProjectName, setPendingProjectName] = useState("");
  const [projectQuery, setProjectQuery] = useState("");

  // Rules + generation.
  const [rules, setRules] = useState<RulesShape>(DEFAULT_RULES);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [createdResponse, setCreatedResponse] =
    useState<CreateToolTrackersResponse | null>(null);

  // ─── Photo upload — Single only ─────────────────────────────────────────
  useEffect(() => {
    const url = tool.photoPreviewUrl;
    return () => {
      if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [tool.photoPreviewUrl]);

  const handlePhotoSelect = (file: File) => {
    if (tool.photoPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(tool.photoPreviewUrl);
    }
    const previewUrl = URL.createObjectURL(file);
    setTool((prev) => ({
      ...prev,
      photoFile: file,
      photoPreviewUrl: previewUrl,
    }));
  };

  const handlePhotoRemove = () => {
    if (tool.photoPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(tool.photoPreviewUrl);
    }
    setTool((prev) => ({ ...prev, photoFile: null, photoPreviewUrl: null }));
  };

  // ─── Tool name + Code label mirror ──────────────────────────────────────
  const updateToolField = <K extends keyof ToolFormState>(
    key: K,
    value: ToolFormState[K],
  ) => {
    setTool((prev) => ({ ...prev, [key]: value }));
    if (key === "name" && codeLabelMirroring) {
      setCodeLabel(typeof value === "string" ? value : "");
    }
  };

  const handleCodeLabelChange = (value: string) => {
    setCodeLabel(value);
    if (codeLabelMirroring) {
      setCodeLabelMirroring(false);
    }
  };

  // ─── Bulk row helpers ───────────────────────────────────────────────────
  const filledManualCount = useMemo(
    () => bulkRows.filter((r) => r.name.trim().length > 0).length,
    [bulkRows],
  );

  // Prefix + Quantity derived state — number of names that would be generated
  // and a short preview list for the user. Memoised so recomputation is cheap
  // on every keystroke.
  const prefixGenerated = useMemo(() => {
    const start = Number(rangeStart);
    const end = Number(rangeEnd);
    if (
      !prefixValue.trim() ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end < start
    ) {
      return { count: 0, preview: [] as string[], over: false };
    }
    const excluded = parseExcludeNumbers(excludeRaw, start, end);
    const names: string[] = [];
    for (let n = start; n <= end; n++) {
      if (!excluded.has(n)) names.push(`${prefixValue}-${n}`);
      if (names.length >= BULK_MAX_ROWS + 1) break;
    }
    const over = names.length > BULK_MAX_ROWS;
    if (over) names.length = BULK_MAX_ROWS;
    return { count: names.length, preview: names, over };
  }, [prefixValue, rangeStart, rangeEnd, excludeRaw]);

  // Active count drives the Generate button label and any enable/disable
  // gates downstream — depends on which method is selected.
  const filledBulkCount = useMemo(() => {
    switch (bulkMethod) {
      case "manual":
        return filledManualCount;
      case "prefix":
        return prefixGenerated.count;
      case "csv":
        return csvRows.length;
    }
  }, [bulkMethod, filledManualCount, prefixGenerated.count, csvRows.length]);

  const addBulkRow = () => {
    if (bulkRows.length >= BULK_MAX_ROWS) {
      toast.error(
        `You've reached the limit of ${BULK_MAX_ROWS} tools per batch.`,
      );
      return;
    }
    idCounterRef.current += 1;
    setBulkRows((prev) => [...prev, makeEmptyRow(idCounterRef.current)]);
  };

  const removeBulkRow = (id: number) => {
    setBulkRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateBulkRow = (id: number, patch: Partial<BulkRow>) => {
    setBulkRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  };

  const replaceBulkRowsFromPaste = (parsed: BulkRow[]) => {
    if (parsed.length === 0) {
      setPasteOpen(false);
      return;
    }
    let imported = parsed;
    if (parsed.length > BULK_MAX_ROWS) {
      toast.error(
        `Capped at ${BULK_MAX_ROWS} tools — ${parsed.length - BULK_MAX_ROWS} extra row(s) were dropped.`,
      );
      imported = parsed.slice(0, BULK_MAX_ROWS);
    }
    idCounterRef.current = imported.length;
    setBulkRows(imported.map((r, i) => ({ ...r, id: i + 1 })));
    setPasteOpen(false);
  };

  // ─── Mode switching ─────────────────────────────────────────────────────
  const handleModeChange = (next: ToolTrackerLastMode) => {
    if (next === mode) return;
    if (next === "single" && filledBulkCount > 0) {
      const noun = filledBulkCount === 1 ? "tool" : "tools";
      const ok = window.confirm(
        `Switch to Single? Your ${filledBulkCount} ${noun} will be cleared.`,
      );
      if (!ok) return;
      // Reset all three bulk method states so re-entering Bulk starts fresh.
      setBulkRows([makeEmptyRow(1), makeEmptyRow(2), makeEmptyRow(3)]);
      idCounterRef.current = 3;
      setPrefixValue("");
      setRangeEnd("");
      setExcludeRaw("");
      setPrefixDefaultCategory(DEFAULT_CATEGORY);
      setCsvRows([]);
      setCsvFileName(null);
      setCsvError(null);
    }
    setMode(next);
  };

  // ─── Project picker ─────────────────────────────────────────────────────
  const projectOptions = useMemo(() => {
    const baseOptions = (projects as ProjectRow[])
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
        dividerBelow: false,
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

  // ─── Generate ───────────────────────────────────────────────────────────
  const buildPayloadTools = (): ToolInput[] => {
    if (mode === "single") {
      const rawName = tool.name.trim();
      if (!rawName) return [];
      const finalName = codeLabel.trim() || rawName;
      const {
        photoFile: _photoFile,
        photoPreviewUrl: _photoPreviewUrl,
        ...rest
      } = tool;
      void _photoFile;
      void _photoPreviewUrl;
      return [{ ...rest, name: finalName }];
    }
    // Bulk — payload depends on the active input method.
    switch (bulkMethod) {
      case "manual":
        return bulkRows
          .filter((r) => r.name.trim().length > 0)
          .map((r) => ({
            name: r.name,
            category: r.category,
            ...(r.serial ? { serial: r.serial } : {}),
            ...(r.homeLocation ? { homeLocation: r.homeLocation } : {}),
          }));
      case "prefix": {
        const start = Number(rangeStart);
        const end = Number(rangeEnd);
        if (
          !prefixValue.trim() ||
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          end < start
        ) {
          return [];
        }
        const excluded = parseExcludeNumbers(excludeRaw, start, end);
        const out: ToolInput[] = [];
        for (let n = start; n <= end; n++) {
          if (excluded.has(n)) continue;
          out.push({
            name: `${prefixValue}-${n}`,
            category: prefixDefaultCategory,
          });
          if (out.length >= BULK_MAX_ROWS) break;
        }
        return out;
      }
      case "csv":
        return csvRows.map((r) => ({
          name: r.name,
          category: r.category,
          ...(r.serial ? { serial: r.serial } : {}),
          ...(r.homeLocation ? { homeLocation: r.homeLocation } : {}),
        }));
    }
  };

  const validateBeforeGenerate = (toolsToCreate: ToolInput[]): string | null => {
    if (toolsToCreate.length === 0) {
      return mode === "single"
        ? "Add a tool name before generating."
        : "Add at least one tool name before generating.";
    }
    if (rules.pinEnabled && rules.pinMode === "custom") {
      const pin = (rules.customPin ?? "").trim();
      if (!/^\d{4}$/.test(pin)) {
        return "Enter a 4-digit Custom PIN before generating.";
      }
    }
    return null;
  };

  const handleGenerate = async () => {
    setTouched(true);
    const toolsToCreate = buildPayloadTools();
    const validationError = validateBeforeGenerate(toolsToCreate);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setIsGenerating(true);
    try {
      const response = await createToolTrackers({
        tools: toolsToCreate,
        rules,
        ...(projectId ? { projectId } : {}),
      });
      setCreatedResponse(response);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not generate QR codes. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateMore = () => {
    setTool(INITIAL_TOOL);
    setCodeLabel("");
    setCodeLabelMirroring(true);
    setShowMore(false);
    setTouched(false);
    setBulkMethod("manual");
    setBulkRows([makeEmptyRow(1), makeEmptyRow(2), makeEmptyRow(3)]);
    idCounterRef.current = 3;
    setPrefixValue("");
    setRangeStart("1");
    setRangeEnd("");
    setExcludeRaw("");
    setPrefixDefaultCategory(DEFAULT_CATEGORY);
    setCsvRows([]);
    setCsvFileName(null);
    setCsvError(null);
    setProjectId(null);
    setProjectQuery("");
    setRules(DEFAULT_RULES);
    setCreatedResponse(null);
  };

  const handleCancel = () => {
    navigate({ to: "/dashboard" });
  };

  // ─── CSV upload ─────────────────────────────────────────────────────────
  const handleCsvFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvError("Please upload a .csv file.");
      setCsvFileName(file.name);
      setCsvRows([]);
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setCsvError("Could not read the file. Try again.");
      return;
    }
    const result = parseCsvText(text);
    setCsvFileName(file.name);
    if (result.error && result.rows.length === 0) {
      setCsvError(result.error);
      setCsvRows([]);
      return;
    }
    if (result.error) {
      // Soft warning (e.g., capped at BULK_MAX_ROWS) but rows are usable.
      toast.error(result.error);
    }
    setCsvError(null);
    setCsvRows(result.rows);
  };

  const handleCsvDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setCsvDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) void handleCsvFile(file);
  };

  const handleCsvInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleCsvFile(file);
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  const handleCsvClear = () => {
    setCsvRows([]);
    setCsvFileName(null);
    setCsvError(null);
  };

  const generateLabel = useMemo(() => {
    if (mode === "single") return "Generate QR Code";
    const n = filledBulkCount;
    if (n === 0) return "Generate QR Codes";
    return `Generate ${n} QR Code${n === 1 ? "" : "s"}`;
  }, [mode, filledBulkCount]);

  // ─── Render ─────────────────────────────────────────────────────────────
  if (createdResponse) {
    return (
      <div className="grow flex flex-col p-8">
        <PageHeader title="Tool QR Code(s) created" />
        <div className="mt-6 max-w-4xl w-full mx-auto">
          <ToolTrackerGenerated
            response={createdResponse}
            onCreateMore={handleCreateMore}
          />
        </div>
      </div>
    );
  }

  const titleText =
    mode === "single" ? "Create Tool QR Code" : "Create Tool QR Codes";

  return (
    <div className="grow flex flex-col p-8">
      <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
        <div>
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
            {titleText}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Add a tool, choose how it should appear, set your check-out rules,
            then generate.
          </p>
        </div>
        <QuantityModeToggle mode={mode} onChange={handleModeChange} />
      </div>

      <div className="max-w-4xl w-full mx-auto space-y-5">
        {mode === "single" ? (
          <SectionCard
            title="Tool details"
            subtitle="What you're tracking. The tool name is required; everything else helps field techs confirm they've scanned the right tool."
          >
            <RequiredLegend />
            <div className="space-y-4">
              <div>
                <FieldLabel>Tool photo</FieldLabel>
                <ToolPhotoUpload
                  previewUrl={tool.photoPreviewUrl ?? null}
                  onFileSelect={handlePhotoSelect}
                  onRemove={handlePhotoRemove}
                />
              </div>

              <FlatField
                label="Tool name"
                required
                value={tool.name}
                onChange={(v) => updateToolField("name", v)}
                placeholder="e.g., DeWalt 20V Impact Driver (DCF887)"
                touched={touched && tool.name.trim().length === 0}
                errorMessage={
                  touched && tool.name.trim().length === 0
                    ? "Tool name is required."
                    : undefined
                }
                testId="v2-tool-name"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FlatSelect
                  label="Category"
                  value={tool.category ?? DEFAULT_CATEGORY}
                  onChange={(v) => updateToolField("category", v)}
                  options={SAMPLE_TOOL_CATEGORIES}
                  testId="v2-tool-category"
                />
                <FlatField
                  label="Serial number"
                  value={tool.serial ?? ""}
                  onChange={(v) => updateToolField("serial", v)}
                  placeholder="e.g., 4821-A9C"
                  testId="v2-tool-serial"
                />
              </div>

              <FlatField
                label="Home location"
                value={tool.homeLocation ?? ""}
                onChange={(v) => updateToolField("homeLocation", v)}
                placeholder="e.g., Warehouse B — Cage 3"
                helper="Where the tool lives when it's not checked out."
                testId="v2-tool-home"
              />
            </div>

            <div className="pt-4 mt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                className="group flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition"
                data-testid="v2-more-details-toggle"
                aria-expanded={showMore}
              >
                <span
                  className={
                    "inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 group-hover:bg-gray-200 transition " +
                    (showMore ? "rotate-180" : "")
                  }
                  aria-hidden
                >
                  <i className="bx bx-chevron-down text-base" />
                </span>
                {showMore ? "Hide additional details" : "Add more details"}
                {!showMore && (
                  <span className="text-xs font-normal text-gray-400">
                    — Manufacturer, purchase info, warranty, URLs
                  </span>
                )}
              </button>
              {showMore && (
                <MoreDetails
                  tool={tool}
                  update={(k, v) => updateToolField(k, v)}
                />
              )}
            </div>
          </SectionCard>
        ) : (
          <>
            {/*
              Method picker sits at the top of the bulk content, outside any
              SectionCard. This is the global pattern for "how would you like
              to add things" pickers across Create pages — keep it visually
              prominent and reusable.
            */}
            <div data-testid="v2-bulk-picker-section">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-gray-900">
                  How would you like to add tools?
                </h2>
                <p className="mt-1 text-xs text-gray-600">
                  Each option creates separate QR codes. You can switch
                  between them without losing what you've started.
                </p>
              </div>
              <BulkMethodPicker
                active={bulkMethod}
                methods={BULK_METHODS}
                onChange={setBulkMethod}
                ariaLabel="How to add tools"
                testId="v2-bulk-method-picker"
              />
            </div>

            <SectionCard
              title={getActiveMethodCardTitle(bulkMethod)}
              subtitle={getActiveMethodCardSubtitle(bulkMethod)}
            >
              {bulkMethod === "manual" && (
                <ManualPanel
                  rows={bulkRows}
                  onAdd={addBulkRow}
                  onRemove={removeBulkRow}
                  onUpdate={updateBulkRow}
                  atCap={bulkRows.length >= BULK_MAX_ROWS}
                  filledCount={filledManualCount}
                  onOpenPaste={() => setPasteOpen(true)}
                />
              )}

              {bulkMethod === "prefix" && (
                <PrefixPanel
                  prefix={prefixValue}
                  onPrefixChange={setPrefixValue}
                  rangeStart={rangeStart}
                  onRangeStartChange={setRangeStart}
                  rangeEnd={rangeEnd}
                  onRangeEndChange={setRangeEnd}
                  excludeRaw={excludeRaw}
                  onExcludeChange={setExcludeRaw}
                  defaultCategory={prefixDefaultCategory}
                  onDefaultCategoryChange={setPrefixDefaultCategory}
                  generated={prefixGenerated}
                  touched={touched}
                />
              )}

              {bulkMethod === "csv" && (
                <CsvPanel
                  fileName={csvFileName}
                  rows={csvRows}
                  error={csvError}
                  dragActive={csvDragActive}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCsvDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCsvDragActive(false);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={handleCsvDrop}
                  onPickFile={() => csvInputRef.current?.click()}
                  onClear={handleCsvClear}
                  inputRef={csvInputRef}
                  onInputChange={handleCsvInputChange}
                />
              )}
            </SectionCard>
          </>
        )}

        <SectionCard
          title={mode === "single" ? "QR code" : "Project assignment"}
          subtitle={
            mode === "single"
              ? "How this code appears in your QR Codes list, and which project it belongs to."
              : "Which project these QR codes should belong to. The list label for each code comes from its tool name."
          }
        >
          <div className="space-y-4">
            {mode === "single" && (
              <FlatField
                label="Code label"
                value={codeLabel}
                onChange={handleCodeLabelChange}
                placeholder="Defaults to the tool name"
                helper="Defaults to the tool name if left blank. Override if you want the QR list to show something different."
                testId="v2-code-label"
              />
            )}
            <div>
              <FieldLabel>Project</FieldLabel>
              <SearchComboBox
                options={projectOptions}
                value={projectId ?? undefined}
                onChange={handleProjectChange}
                onQueryChange={setProjectQuery}
                placeholder="Search projects…"
                allowCustomValue={false}
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional — can be added or changed later.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Check-out rules"
          subtitle={
            mode === "single"
              ? "These rules apply to the QR code you're about to create. You can change them anytime from the tool's settings."
              : `These rules apply to all ${filledBulkCount || ""} QR code${filledBulkCount === 1 ? "" : "s"} you're about to create.`.replace(
                  /\s+/g,
                  " ",
                )
          }
        >
          <ToolTrackerRulesEditor
            rules={rules}
            onChange={setRules}
            disabled={isGenerating}
          />
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              disabled={isGenerating}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition"
              data-testid="v2-preview-link"
            >
              <i className="bx bx-show text-base" aria-hidden /> Preview the
              scan experience
            </button>
          </div>
        </SectionCard>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button
            type="button"
            variant="secondary"
            onClick={handleCancel}
            data-testid="v2-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleGenerate}
            disabled={isGenerating}
            data-testid="v2-generate"
          >
            {isGenerating ? "Generating…" : generateLabel}
          </Button>
        </div>
      </div>

      {pasteOpen && (
        <PasteModal
          onClose={() => setPasteOpen(false)}
          onApply={replaceBulkRowsFromPaste}
        />
      )}
      {previewOpen && (
        <ToolTrackerScanPreview
          tool={
            mode === "single"
              ? {
                  name: codeLabel.trim() || tool.name.trim() || "Example Tool",
                  serial: tool.serial ?? "",
                  homeLocation: tool.homeLocation ?? "",
                }
              : bulkRows[0]?.name
                ? {
                    name: bulkRows[0].name,
                    serial: bulkRows[0].serial,
                    homeLocation: bulkRows[0].homeLocation,
                  }
                : { name: "Example Tool" }
          }
          rules={rules}
          onClose={() => setPreviewOpen(false)}
        />
      )}
      <CreateProjectModal
        open={createProjectOpen}
        onClose={() => {
          setCreateProjectOpen(false);
          setPendingProjectName("");
        }}
        companyId={companyId}
        subtitle="Create a new project for this QR code."
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
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
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
      data-testid="v2-required-legend"
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

interface FlatFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  touched?: boolean;
  errorMessage?: string;
  helper?: string;
  type?: string;
  testId: string;
}

function FlatField({
  label,
  value,
  onChange,
  placeholder,
  required,
  touched,
  errorMessage,
  helper,
  type = "text",
  testId,
}: FlatFieldProps) {
  const showError = Boolean(touched);
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        data-testid={testId}
        className={
          "block w-full rounded-md shadow-sm text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 " +
          (showError
            ? "border-red-400 focus:border-red-400 focus:ring-red-100"
            : "border-gray-300")
        }
      />
      {showError && errorMessage && (
        <p className="mt-1 text-xs text-red-600">{errorMessage}</p>
      )}
      {!showError && helper && (
        <p className="mt-1 text-xs text-gray-500">{helper}</p>
      )}
    </div>
  );
}

interface FlatSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  testId: string;
}

function FlatSelect({
  label,
  value,
  onChange,
  options,
  testId,
}: FlatSelectProps) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function MoreDetails({
  tool,
  update,
}: {
  tool: ToolFormState;
  update: <K extends keyof ToolFormState>(
    key: K,
    value: ToolFormState[K],
  ) => void;
}) {
  return (
    <div className="mt-5 space-y-6" data-testid="v2-more-details-panel">
      <SubSection label="Identification">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FlatField
            label="Manufacturer"
            value={tool.manufacturer ?? ""}
            onChange={(v) => update("manufacturer", v)}
            placeholder="e.g., DeWalt"
            testId="v2-tool-manufacturer"
          />
          <FlatField
            label="Model number"
            value={tool.model ?? ""}
            onChange={(v) => update("model", v)}
            placeholder="e.g., DCF887"
            testId="v2-tool-model"
          />
          <FlatField
            label="Barcode"
            value={tool.barcode ?? ""}
            onChange={(v) => update("barcode", v)}
            placeholder="Scan or enter"
            testId="v2-tool-barcode"
          />
        </div>
      </SubSection>

      <SubSection label="Description">
        <textarea
          value={tool.description ?? ""}
          onChange={(e) => update("description", e.target.value)}
          rows={3}
          placeholder="Notes, accessories included, condition, etc."
          data-testid="v2-tool-description"
          className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </SubSection>

      <SubSection label="Purchase &amp; warranty">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FlatField
            label="Vendor"
            value={tool.vendor ?? ""}
            onChange={(v) => update("vendor", v)}
            placeholder="Where purchased"
            testId="v2-tool-vendor"
          />
          <FlatField
            label="Purchase date"
            type="date"
            value={tool.purchaseDate ?? ""}
            onChange={(v) => update("purchaseDate", v)}
            testId="v2-tool-purchase-date"
          />
          <div>
            <FieldLabel>Purchase price</FieldLabel>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"
                aria-hidden
              >
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={tool.purchasePrice ?? ""}
                onChange={(e) => update("purchasePrice", e.target.value)}
                placeholder="0.00"
                data-testid="v2-tool-purchase-price"
                className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 pl-7"
              />
            </div>
          </div>
          <FlatField
            label="Warranty date"
            type="date"
            value={tool.warrantyDate ?? ""}
            onChange={(v) => update("warrantyDate", v)}
            testId="v2-tool-warranty-date"
          />
        </div>
      </SubSection>

      <SubSection label="Documentation">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FlatField
            label="Product website URL"
            value={tool.productUrl ?? ""}
            onChange={(v) => update("productUrl", v)}
            placeholder="https://"
            testId="v2-tool-product-url"
          />
          <FlatField
            label="Owner's manual URL"
            value={tool.manualUrl ?? ""}
            onChange={(v) => update("manualUrl", v)}
            placeholder="https://"
            testId="v2-tool-manual-url"
          />
        </div>
      </SubSection>
    </div>
  );
}

function SubSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2.5">
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Manual entry panel ───────────────────────────────────────────────────

interface ManualPanelProps {
  rows: BulkRow[];
  onAdd: () => void;
  onRemove: (id: number) => void;
  onUpdate: (id: number, patch: Partial<BulkRow>) => void;
  atCap: boolean;
  filledCount: number;
  onOpenPaste: () => void;
}

function ManualPanel({
  rows,
  onAdd,
  onRemove,
  onUpdate,
  atCap,
  filledCount,
  onOpenPaste,
}: ManualPanelProps) {
  return (
    <div data-testid="v2-bulk-manual-panel">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <RequiredLegend />
        <Button
          type="button"
          variant="secondary"
          onClick={onOpenPaste}
          data-testid="v2-bulk-paste-open"
        >
          Paste from spreadsheet
        </Button>
      </div>
      <BulkTable
        rows={rows}
        onAdd={onAdd}
        onRemove={onRemove}
        onUpdate={onUpdate}
        atCap={atCap}
      />
      <div className="text-xs text-gray-500 mt-3" data-testid="v2-bulk-counter">
        {filledCount} of {rows.length} tools ready.
        {atCap && (
          <span className="text-amber-700 ml-2">
            (At the {BULK_MAX_ROWS}-row batch limit.)
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Prefix + Quantity panel ──────────────────────────────────────────────

interface PrefixPanelProps {
  prefix: string;
  onPrefixChange: (v: string) => void;
  rangeStart: string;
  onRangeStartChange: (v: string) => void;
  rangeEnd: string;
  onRangeEndChange: (v: string) => void;
  excludeRaw: string;
  onExcludeChange: (v: string) => void;
  defaultCategory: string;
  onDefaultCategoryChange: (v: string) => void;
  generated: { count: number; preview: string[]; over: boolean };
  touched: boolean;
}

function PrefixPanel({
  prefix,
  onPrefixChange,
  rangeStart,
  onRangeStartChange,
  rangeEnd,
  onRangeEndChange,
  excludeRaw,
  onExcludeChange,
  defaultCategory,
  onDefaultCategoryChange,
  generated,
  touched,
}: PrefixPanelProps) {
  const start = Number(rangeStart);
  const end = Number(rangeEnd);
  const rangeInverted =
    Number.isFinite(start) && Number.isFinite(end) && end < start;
  const prefixMissing = touched && prefix.trim().length === 0;
  const endMissing = touched && rangeEnd.trim().length === 0;

  return (
    <div data-testid="v2-bulk-prefix-panel">
      <RequiredLegend />
      <div className="space-y-4">
        <FlatField
          label="Prefix"
          required
          value={prefix}
          onChange={onPrefixChange}
          placeholder="e.g., Drill, AHU, Tool"
          touched={prefixMissing}
          errorMessage={prefixMissing ? "Prefix is required." : undefined}
          helper="Codes will be generated as Prefix-1, Prefix-2, and so on."
          testId="v2-bulk-prefix-input"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FlatField
            label="Start number"
            required
            type="number"
            value={rangeStart}
            onChange={onRangeStartChange}
            placeholder="1"
            testId="v2-bulk-prefix-start"
          />
          <FlatField
            label="End number"
            required
            type="number"
            value={rangeEnd}
            onChange={onRangeEndChange}
            placeholder="50"
            touched={endMissing || rangeInverted}
            errorMessage={
              rangeInverted
                ? "End must be greater than or equal to Start."
                : endMissing
                  ? "End number is required."
                  : undefined
            }
            testId="v2-bulk-prefix-end"
          />
        </div>

        <FlatField
          label="Skip numbers"
          value={excludeRaw}
          onChange={onExcludeChange}
          placeholder="e.g., 4, 13, 42-50"
          helper="Optional. Comma-separated values and ranges (like 42-50) are both supported."
          testId="v2-bulk-prefix-exclude"
        />

        <FlatSelect
          label="Default category"
          value={defaultCategory}
          onChange={onDefaultCategoryChange}
          options={SAMPLE_TOOL_CATEGORIES}
          testId="v2-bulk-prefix-category"
        />
        <p className="-mt-2 text-xs text-gray-500">
          Applied to every code in this batch. You can edit categories per tool
          later.
        </p>
      </div>

      <PrefixPreview generated={generated} />
    </div>
  );
}

function PrefixPreview({
  generated,
}: {
  generated: { count: number; preview: string[]; over: boolean };
}) {
  if (generated.count === 0) {
    return (
      <p
        className="mt-5 text-sm text-gray-500"
        data-testid="v2-bulk-prefix-preview-empty"
      >
        Fill in the prefix and a valid range to see a preview.
      </p>
    );
  }
  const previewSlice = generated.preview.slice(0, 5);
  const showEllipsis = generated.preview.length > previewSlice.length;
  const lastName = generated.preview[generated.preview.length - 1];
  return (
    <div
      className="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
      data-testid="v2-bulk-prefix-preview"
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
        Preview
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        {previewSlice.map((name) => (
          <span
            key={name}
            className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-800 font-mono text-xs"
          >
            {name}
          </span>
        ))}
        {showEllipsis && (
          <>
            <span className="text-gray-400">…</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-800 font-mono text-xs">
              {lastName}
            </span>
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-600">
        <span className="font-medium text-gray-900">{generated.count}</span>{" "}
        tool{generated.count === 1 ? "" : "s"} will be created.
        {generated.over && (
          <span className="text-amber-700 ml-2">
            (Capped at the {BULK_MAX_ROWS}-row batch limit.)
          </span>
        )}
      </p>
    </div>
  );
}

// ─── CSV upload panel ─────────────────────────────────────────────────────

interface CsvPanelProps {
  fileName: string | null;
  rows: BulkRow[];
  error: string | null;
  dragActive: boolean;
  onDragEnter: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onPickFile: () => void;
  onClear: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

function CsvPanel({
  fileName,
  rows,
  error,
  dragActive,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onPickFile,
  onClear,
  inputRef,
  onInputChange,
}: CsvPanelProps) {
  const hasRows = rows.length > 0;
  return (
    <div data-testid="v2-bulk-csv-panel">
      {!hasRows ? (
        <div
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          className={
            "rounded-xl border-2 border-dashed transition px-6 py-10 text-center " +
            (dragActive
              ? "border-brand-500 bg-brand-50/40"
              : "border-gray-300 bg-gray-50")
          }
          data-testid="v2-bulk-csv-dropzone"
        >
          <i className="bx bx-cloud-upload text-3xl text-gray-400" aria-hidden />
          <p className="mt-2 text-sm text-gray-700 font-medium">
            Drop your CSV here, or{" "}
            <button
              type="button"
              onClick={onPickFile}
              className="text-brand-600 hover:text-brand-700 underline underline-offset-2"
              data-testid="v2-bulk-csv-browse"
            >
              browse for a file
            </button>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Required column: <span className="font-mono">name</span>. Optional:{" "}
            <span className="font-mono">category</span>,{" "}
            <span className="font-mono">serial</span>,{" "}
            <span className="font-mono">home_location</span>.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onInputChange}
            data-testid="v2-bulk-csv-file-input"
          />
          <div className="mt-4">
            <a
              href={toolTrackerCsvTemplate}
              download="Tool-Tracker-CSV-Template.csv"
              className="text-xs font-medium text-gray-600 hover:text-gray-900 inline-flex items-center gap-1.5"
              data-testid="v2-bulk-csv-template"
            >
              <i className="bx bx-download" aria-hidden /> Download CSV template
            </a>
          </div>
          {error && (
            <p
              className="mt-3 text-xs text-red-600"
              data-testid="v2-bulk-csv-error"
            >
              {error}
            </p>
          )}
        </div>
      ) : (
        <div data-testid="v2-bulk-csv-summary">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="inline-flex items-center gap-2 text-sm text-gray-800">
              <i className="bx bx-file text-base text-green-600" aria-hidden />
              <span className="font-medium">{fileName ?? "uploaded.csv"}</span>
              <span className="text-gray-500">
                — {rows.length} row{rows.length === 1 ? "" : "s"} ready
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onPickFile}
                data-testid="v2-bulk-csv-replace"
              >
                Replace file
              </Button>
              <button
                type="button"
                onClick={onClear}
                className="text-xs font-medium text-gray-500 hover:text-red-600 transition"
                data-testid="v2-bulk-csv-clear"
              >
                Clear
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onInputChange}
            />
          </div>
          <CsvPreviewTable rows={rows} />
        </div>
      )}
    </div>
  );
}

function CsvPreviewTable({ rows }: { rows: BulkRow[] }) {
  const SHOWN = 8;
  const visible = rows.slice(0, SHOWN);
  const remaining = rows.length - visible.length;
  return (
    <div
      className="border border-gray-200 rounded-xl overflow-hidden"
      data-testid="v2-bulk-csv-preview-table"
    >
      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
        <div className="col-span-4">Tool name</div>
        <div className="col-span-3">Category</div>
        <div className="col-span-2">Serial</div>
        <div className="col-span-3">Home location</div>
      </div>
      {visible.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-12 gap-2 px-4 py-2 border-t border-gray-100 text-sm text-gray-800"
        >
          <div className="col-span-4 truncate" title={row.name}>
            {row.name}
          </div>
          <div className="col-span-3 truncate text-gray-600" title={row.category}>
            {row.category}
          </div>
          <div className="col-span-2 truncate text-gray-600" title={row.serial}>
            {row.serial || <span className="text-gray-300">—</span>}
          </div>
          <div
            className="col-span-3 truncate text-gray-600"
            title={row.homeLocation}
          >
            {row.homeLocation || <span className="text-gray-300">—</span>}
          </div>
        </div>
      ))}
      {remaining > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500 bg-gray-50">
          + {remaining} more row{remaining === 1 ? "" : "s"} not shown.
        </div>
      )}
    </div>
  );
}

// ─── Helpers (parsing) ────────────────────────────────────────────────────

/**
 * Parses a CSV file's text content into BulkRow[] for the Tool Tracker
 * batch import. Required header column: `name`. Optional columns:
 * `category`, `serial`, `home_location` (also accepts `homelocation` and
 * `home location`). Unknown categories fall back to the default — the user
 * can fix per-row after import if we surface the parsed rows in an editable
 * table; current panel shows them read-only.
 *
 * Returns up to BULK_MAX_ROWS rows with an `error` field set when something
 * unrecoverable happened (no name column, empty file). Soft warnings (row
 * cap exceeded) come through as both rows and a warning string.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function parseCsvText(text: string): {
  rows: BulkRow[];
  error?: string;
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], error: "The file is empty." };
  if (lines.length === 1) {
    return {
      rows: [],
      error: "Add at least one tool row below the header.",
    };
  }

  const header = parseCsvLine(lines[0]).map((c) => c.toLowerCase().trim());
  const nameIdx = header.indexOf("name");
  if (nameIdx === -1) {
    return {
      rows: [],
      error: 'CSV must include a "name" column in the header row.',
    };
  }
  const categoryIdx = header.indexOf("category");
  const serialIdx = header.indexOf("serial");
  const homeIdx = header.findIndex(
    (c) => c === "home_location" || c === "homelocation" || c === "home location",
  );

  const rows: BulkRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const name = (cells[nameIdx] ?? "").trim();
    if (!name) continue;
    const cat = categoryIdx >= 0 ? (cells[categoryIdx] ?? "").trim() : "";
    rows.push({
      id: rows.length + 1,
      name,
      category: SAMPLE_TOOL_CATEGORIES.includes(cat) ? cat : DEFAULT_CATEGORY,
      serial: serialIdx >= 0 ? (cells[serialIdx] ?? "").trim() : "",
      homeLocation: homeIdx >= 0 ? (cells[homeIdx] ?? "").trim() : "",
    });
  }
  if (rows.length === 0) {
    return {
      rows: [],
      error: "No usable rows found. Check that the name column has values.",
    };
  }
  if (rows.length > BULK_MAX_ROWS) {
    const dropped = rows.length - BULK_MAX_ROWS;
    return {
      rows: rows.slice(0, BULK_MAX_ROWS),
      error: `Capped at ${BULK_MAX_ROWS} rows — ${dropped} extra row${dropped === 1 ? "" : "s"} were dropped.`,
    };
  }
  return { rows };
}

// ─── Bulk row table (manual entry) ────────────────────────────────────────

interface BulkTableProps {
  rows: BulkRow[];
  onAdd: () => void;
  onRemove: (id: number) => void;
  onUpdate: (id: number, patch: Partial<BulkRow>) => void;
  atCap: boolean;
}

function BulkTable({ rows, onAdd, onRemove, onUpdate, atCap }: BulkTableProps) {
  return (
    <div
      className="border border-gray-200 rounded-xl overflow-hidden"
      data-testid="v2-bulk-row-table"
    >
      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
        <div className="col-span-4">
          Tool name
          <span className="text-red-600 ml-0.5" aria-hidden="true">
            *
          </span>
        </div>
        <div className="col-span-3">Category</div>
        <div className="col-span-2">Serial</div>
        <div className="col-span-2">Home location</div>
        <div className="col-span-1" aria-hidden />
      </div>
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-12 gap-2 px-4 py-2 border-t border-gray-100 items-center"
          data-testid={`v2-bulk-row-${row.id}`}
        >
          <input
            value={row.name}
            onChange={(e) => onUpdate(row.id, { name: e.target.value })}
            placeholder="e.g., Milwaukee M18 Drill"
            data-testid="v2-bulk-name"
            aria-label="Tool name"
            className="col-span-4 border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <select
            value={row.category}
            onChange={(e) => onUpdate(row.id, { category: e.target.value })}
            data-testid="v2-bulk-category"
            aria-label="Category"
            className="col-span-3 border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-brand-500"
          >
            {SAMPLE_TOOL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            value={row.serial}
            onChange={(e) => onUpdate(row.id, { serial: e.target.value })}
            data-testid="v2-bulk-serial"
            aria-label="Serial number"
            className="col-span-2 border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-brand-500"
          />
          <input
            value={row.homeLocation}
            onChange={(e) => onUpdate(row.id, { homeLocation: e.target.value })}
            data-testid="v2-bulk-home"
            aria-label="Home location"
            className="col-span-2 border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-brand-500"
          />
          <button
            type="button"
            onClick={() => onRemove(row.id)}
            className="col-span-1 text-gray-400 hover:text-red-500 justify-self-end p-1 transition"
            aria-label="Remove row"
            data-testid={`v2-bulk-remove-${row.id}`}
          >
            <i className="bx bx-trash text-base" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        disabled={atCap}
        className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        data-testid="v2-bulk-add-row"
      >
        <i className="bx bx-plus text-sm" />
        Add another tool
      </button>
    </div>
  );
}

interface PasteModalProps {
  onClose: () => void;
  onApply: (rows: BulkRow[]) => void;
}

function PasteModal({ onClose, onApply }: PasteModalProps) {
  const [text, setText] = useState("");

  const handleApply = () => {
    const parsed = parsePastedRows(text);
    onApply(parsed);
    setText("");
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="v2-bulk-paste-title"
      data-testid="v2-bulk-paste-modal"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 id="v2-bulk-paste-title" className="font-semibold text-gray-900">
            Paste from spreadsheet
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            <i className="bx bx-x text-xl" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm text-gray-600 mb-3">
            Copy a block of cells from Excel or Google Sheets and paste below.
            Column order: Name, Category, Serial, Home location.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            data-testid="v2-bulk-paste-textarea"
            placeholder={
              "DeWalt DCF887\tPower Tools\t4821-A9C\tWarehouse B\nMilwaukee M18\tPower Tools\t7733-B1\tWarehouse B"
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-xs focus:outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleApply}>
            Import rows
          </Button>
        </div>
      </div>
    </div>
  );
}

function parsePastedRows(text: string): BulkRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim().length > 0);

  return lines.map((line, i) => {
    const parts = line.includes("\t")
      ? line.split("\t").map((p) => p.trim())
      : line.split(",").map((p) => p.trim());
    const category = parts[1] && SAMPLE_TOOL_CATEGORIES.includes(parts[1])
      ? parts[1]
      : DEFAULT_CATEGORY;
    return {
      id: i + 1,
      name: parts[0] ?? "",
      category,
      serial: parts[2] ?? "",
      homeLocation: parts[3] ?? "",
    };
  });
}
