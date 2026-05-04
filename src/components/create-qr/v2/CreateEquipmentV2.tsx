/**
 * Create-QR v2 — flat single-page Equipment Code layout.
 *
 * Opt-in via `?layout=v2&typeId=equipment-code` on `/create-qr`. Reachable
 * from the Type-selection screen by clicking the Equipment Code card.
 *
 * Equipment Code is bulk-only by design — the V3 wizard already treated it
 * that way (`supportsSingle: false`, `supportsBulk: true`). The page reduces
 * to: header → method picker → active method panel → optional project →
 * optional group → Generate. After generate, replaces the form with a tight
 * success view listing the created codes plus a "Create more" CTA.
 *
 * Three input methods, all producing a flat `string[]` of codes:
 *   - Manual entry: textarea, one code per line.
 *   - Prefix + quantity: PREFIX-N for N in [start, end] minus excluded.
 *   - Upload CSV: drag-drop or browse, header-tolerant single column.
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
import { useListGroups } from "@/api/endpoints/groups";
import { canCreateProjects } from "@/utils/permissions";
import { getStoredUser } from "@/utils/getStoredUser";
import { icons } from "@/lib/icons";
import { createEquipmentCodes } from "@/api/stubs/equipmentCodeStub";
import type {
  CreateEquipmentCodesResponse,
} from "@/components/create-qr/equipmentCode/types";
import type { ProjectRow, GroupRow } from "@/components/create-qr/types";
import BulkMethodPicker, {
  type BulkMethod,
  type BulkMethodDefinition,
} from "./shared/BulkMethodPicker";
import {
  parseCsvLine,
  parseExcludeNumbers,
} from "./shared/bulkParsers";
import equipmentCsvTemplate from "@/assets/templates/Equipment-Code-CSV-Template.csv?url";

const SENTINEL_CREATE_NEW_PROJECT = "__create-new-project__";
const BULK_MAX_ROWS = 200;

const BULK_METHODS: ReadonlyArray<BulkMethodDefinition> = [
  {
    value: "manual",
    icon: "bx bx-list-ul",
    label: "Manual entry",
    description: "Type your codes, one per line.",
  },
  {
    value: "prefix",
    icon: "bx bx-hash",
    label: "Prefix + quantity",
    description: "Generate a series like AHU-1 through AHU-100.",
  },
  {
    value: "csv",
    icon: "bx bx-upload",
    label: "Upload CSV",
    description: "Import a list of codes from a spreadsheet.",
  },
];

interface CreateEquipmentV2Props {
  onBackToTypes?: () => void;
}

export default function CreateEquipmentV2({
  onBackToTypes,
}: CreateEquipmentV2Props) {
  const navigate = useNavigate();
  const user = getStoredUser();
  const companyId = user?.companyId || "";

  useEffect(() => {
    if (!canCreateProjects(user)) {
      toast.error("You don't have permission to create QR codes.");
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  const [bulkMethod, setBulkMethod] = useState<BulkMethod>("manual");

  // Manual: textarea, one code per line.
  const [manualText, setManualText] = useState("");

  // Prefix + Quantity
  const [prefixValue, setPrefixValue] = useState("");
  const [rangeStart, setRangeStart] = useState("1");
  const [rangeEnd, setRangeEnd] = useState("");
  const [excludeRaw, setExcludeRaw] = useState("");

  // CSV
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvCodes, setCsvCodes] = useState<string[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvDragActive, setCsvDragActive] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  // Project picker
  const { data: projectsData } = useAllProjects(companyId);
  const projects = useMemo(
    () => (projectsData as ProjectRow[] | undefined) ?? [],
    [projectsData],
  );
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectQuery, setProjectQuery] = useState("");
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [pendingProjectName, setPendingProjectName] = useState("");

  // Group picker — only enabled once a project is chosen, since groups are
  // scoped under projects in this app.
  const { data: groupsData } = useListGroups(
    projectId
      ? {
          companyId,
          projectId,
          per_page: 500,
          excludeArchivedProjects: true,
        }
      : { companyId: undefined },
  );
  const groups = useMemo(
    () => (groupsData?.data as GroupRow[] | undefined) ?? [],
    [groupsData],
  );
  const [groupingId, setGroupingId] = useState<string | null>(null);

  // Generate
  const [touched, setTouched] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [createdResponse, setCreatedResponse] =
    useState<CreateEquipmentCodesResponse | null>(null);

  // Reset group when project changes (a stale group from another project
  // would silently mis-associate codes).
  useEffect(() => {
    setGroupingId(null);
  }, [projectId]);

  // ─── Code building ──────────────────────────────────────────────────────
  // Each method derives a flat list of normalized code strings. Empty
  // strings are filtered, duplicates are kept (the user's choice — they may
  // want intentional duplicates), max BULK_MAX_ROWS enforced.

  const manualCodes = useMemo(() => {
    return manualText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, BULK_MAX_ROWS);
  }, [manualText]);

  const prefixGenerated = useMemo(() => {
    const start = Number(rangeStart);
    const end = Number(rangeEnd);
    if (
      !prefixValue.trim() ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end < start
    ) {
      return { codes: [] as string[], over: false };
    }
    const excluded = parseExcludeNumbers(excludeRaw, start, end);
    const codes: string[] = [];
    for (let n = start; n <= end; n++) {
      if (excluded.has(n)) continue;
      codes.push(`${prefixValue}-${n}`);
      if (codes.length >= BULK_MAX_ROWS + 1) break;
    }
    const over = codes.length > BULK_MAX_ROWS;
    if (over) codes.length = BULK_MAX_ROWS;
    return { codes, over };
  }, [prefixValue, rangeStart, rangeEnd, excludeRaw]);

  const activeCount = useMemo(() => {
    switch (bulkMethod) {
      case "manual":
        return manualCodes.length;
      case "prefix":
        return prefixGenerated.codes.length;
      case "csv":
        return csvCodes.length;
    }
  }, [bulkMethod, manualCodes.length, prefixGenerated.codes.length, csvCodes.length]);

  // ─── CSV upload ─────────────────────────────────────────────────────────
  const handleCsvFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvError("Please upload a .csv file.");
      setCsvFileName(file.name);
      setCsvCodes([]);
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setCsvError("Could not read the file. Try again.");
      return;
    }
    const result = parseEquipmentCodeCsv(text);
    setCsvFileName(file.name);
    if (result.error && result.codes.length === 0) {
      setCsvError(result.error);
      setCsvCodes([]);
      return;
    }
    if (result.error) {
      toast.error(result.error);
    }
    setCsvError(null);
    setCsvCodes(result.codes);
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
    setCsvCodes([]);
    setCsvFileName(null);
    setCsvError(null);
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

  const groupOptions = useMemo(() => {
    return groups
      .map((g) => ({
        label:
          g.groupName || g.arrangementName || g.equipmentName || "Group",
        value: g._id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [groups]);

  const handleGroupChange = (
    next: SearchComboBoxValue | SearchComboBoxValue[] | undefined,
  ) => {
    const v = Array.isArray(next) ? next[0] : next;
    setGroupingId(typeof v === "string" && v.length > 0 ? v : null);
  };

  // ─── Generate ───────────────────────────────────────────────────────────
  const buildCodes = (): string[] => {
    switch (bulkMethod) {
      case "manual":
        return manualCodes;
      case "prefix":
        return prefixGenerated.codes;
      case "csv":
        return csvCodes;
    }
  };

  const handleGenerate = async () => {
    setTouched(true);
    const codes = buildCodes();
    if (codes.length === 0) {
      toast.error(
        bulkMethod === "manual"
          ? "Add at least one code before generating."
          : bulkMethod === "prefix"
            ? "Fill in a prefix and a valid range before generating."
            : "Upload a CSV with at least one code before generating.",
      );
      return;
    }
    setIsGenerating(true);
    try {
      const response = await createEquipmentCodes({
        codes,
        ...(projectId ? { projectId } : {}),
        ...(groupingId ? { groupingId } : {}),
      });
      setCreatedResponse(response);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not generate equipment codes. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateMore = () => {
    setBulkMethod("manual");
    setManualText("");
    setPrefixValue("");
    setRangeStart("1");
    setRangeEnd("");
    setExcludeRaw("");
    setCsvCodes([]);
    setCsvFileName(null);
    setCsvError(null);
    setProjectId(null);
    setProjectQuery("");
    setGroupingId(null);
    setTouched(false);
    setCreatedResponse(null);
  };

  const handleCancel = () => {
    navigate({ to: "/dashboard" });
  };

  const generateLabel = useMemo(() => {
    if (activeCount === 0) return "Generate";
    return `Generate ${activeCount} Code${activeCount === 1 ? "" : "s"}`;
  }, [activeCount]);

  // ─── Render ─────────────────────────────────────────────────────────────
  if (createdResponse) {
    return (
      <div className="grow flex flex-col p-8">
        <PageHeader title="Equipment codes created" />
        <div className="mt-6 max-w-3xl w-full mx-auto">
          <SuccessView
            response={createdResponse}
            onCreateMore={handleCreateMore}
          />
        </div>
      </div>
    );
  }

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
          Create Equipment Codes
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Tag equipment with sequential QR codes. Pick how you want to add
          them, optionally tie them to a project and group, then generate.
        </p>
      </div>

      <div className="max-w-3xl w-full mx-auto space-y-5">
        {/* Method picker — primary nav, top of bulk content */}
        <div data-testid="equip-bulk-picker-section">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-gray-900">
              How would you like to add equipment?
            </h2>
            <p className="mt-1 text-xs text-gray-600">
              Switch between options without losing what you've started.
            </p>
          </div>
          <BulkMethodPicker
            active={bulkMethod}
            methods={BULK_METHODS}
            onChange={setBulkMethod}
            ariaLabel="How to add equipment"
            testId="equip-bulk-method-picker"
          />
        </div>

        {/* Active method panel */}
        <SectionCard
          title={getMethodCardTitle(bulkMethod)}
          subtitle={getMethodCardSubtitle(bulkMethod)}
        >
          {bulkMethod === "manual" && (
            <ManualPanel
              value={manualText}
              onChange={setManualText}
              count={manualCodes.length}
              over={manualText.split(/\r?\n/).filter((l) => l.trim()).length > BULK_MAX_ROWS}
              touched={touched}
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
              generated={prefixGenerated}
              touched={touched}
            />
          )}

          {bulkMethod === "csv" && (
            <CsvPanel
              fileName={csvFileName}
              codes={csvCodes}
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

        {/* Project + Group association — both optional */}
        <SectionCard
          title="Where do these codes live?"
          subtitle="Both fields are optional. You can also assign codes later from the QR Codes list."
        >
          <div className="space-y-4">
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
            </div>
            <div>
              <FieldLabel>Group</FieldLabel>
              <SearchComboBox
                options={groupOptions}
                value={groupingId ?? undefined}
                onChange={handleGroupChange}
                placeholder={
                  projectId
                    ? "Search groups in this project…"
                    : "Pick a project first to choose a group"
                }
                allowCustomValue={false}
              />
              {!projectId && (
                <p className="mt-1 text-xs text-gray-500">
                  Groups are scoped under projects.
                </p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button
            type="button"
            variant="secondary"
            onClick={handleCancel}
            data-testid="equip-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleGenerate}
            disabled={isGenerating}
            data-testid="equip-generate"
          >
            {isGenerating ? "Generating…" : generateLabel}
          </Button>
        </div>
      </div>

      <CreateProjectModal
        open={createProjectOpen}
        onClose={() => {
          setCreateProjectOpen(false);
          setPendingProjectName("");
        }}
        companyId={companyId}
        subtitle="Create a new project for these equipment codes."
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

// ─── Method-specific titles + copy ────────────────────────────────────────

function getMethodCardTitle(method: BulkMethod): string {
  switch (method) {
    case "manual":
      return "Type your codes";
    case "prefix":
      return "Generate a series";
    case "csv":
      return "Import from CSV";
  }
}

function getMethodCardSubtitle(method: BulkMethod): string {
  switch (method) {
    case "manual":
      return "One code per line. Each becomes its own QR code.";
    case "prefix":
      return "Pick a prefix and a number range. We'll generate one QR code per number.";
    case "csv":
      return "Drop a .csv file or browse to upload.";
  }
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
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-xs text-gray-600">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
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

// ─── Manual entry panel ───────────────────────────────────────────────────

interface ManualPanelProps {
  value: string;
  onChange: (v: string) => void;
  count: number;
  over: boolean;
  touched: boolean;
}

function ManualPanel({
  value,
  onChange,
  count,
  over,
  touched,
}: ManualPanelProps) {
  const showEmptyError = touched && count === 0;
  return (
    <div data-testid="equip-manual-panel">
      <FieldLabel required>Codes</FieldLabel>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        placeholder={"AHU-1\nAHU-2\nRT-100\nGEN-A12"}
        data-testid="equip-manual-textarea"
        className={
          "block w-full rounded-md shadow-sm text-sm font-mono focus:border-brand-400 focus:ring-2 focus:ring-brand-100 " +
          (showEmptyError
            ? "border-red-400 focus:border-red-400 focus:ring-red-100"
            : "border-gray-300")
        }
      />
      <div className="mt-1.5 flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-gray-500">
          One code per line. Empty lines are skipped.
        </p>
        <p
          className="text-xs text-gray-600 font-medium"
          data-testid="equip-manual-count"
        >
          {count} code{count === 1 ? "" : "s"}
          {over && (
            <span className="text-amber-700 ml-2 font-normal">
              (capped at {BULK_MAX_ROWS})
            </span>
          )}
        </p>
      </div>
      {showEmptyError && (
        <p className="mt-1 text-xs text-red-600">
          Add at least one code before generating.
        </p>
      )}
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
  generated: { codes: string[]; over: boolean };
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
    <div data-testid="equip-prefix-panel">
      <p
        className="mb-3 text-xs text-gray-500"
        data-testid="equip-required-legend"
      >
        <span className="text-red-600" aria-hidden="true">
          *
        </span>{" "}
        Required field
      </p>
      <div className="space-y-4">
        <div>
          <FieldLabel required>Prefix</FieldLabel>
          <input
            type="text"
            value={prefix}
            onChange={(e) => onPrefixChange(e.target.value)}
            placeholder="e.g., AHU, RT, EQ"
            data-testid="equip-prefix-input"
            className={
              "block w-full rounded-md shadow-sm text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 " +
              (prefixMissing
                ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                : "border-gray-300")
            }
          />
          {prefixMissing ? (
            <p className="mt-1 text-xs text-red-600">Prefix is required.</p>
          ) : (
            <p className="mt-1 text-xs text-gray-500">
              Codes will be generated as Prefix-1, Prefix-2, and so on.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel required>Start number</FieldLabel>
            <input
              type="number"
              value={rangeStart}
              onChange={(e) => onRangeStartChange(e.target.value)}
              placeholder="1"
              data-testid="equip-prefix-start"
              className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <FieldLabel required>End number</FieldLabel>
            <input
              type="number"
              value={rangeEnd}
              onChange={(e) => onRangeEndChange(e.target.value)}
              placeholder="100"
              data-testid="equip-prefix-end"
              className={
                "block w-full rounded-md shadow-sm text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 " +
                (endMissing || rangeInverted
                  ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                  : "border-gray-300")
              }
            />
            {rangeInverted ? (
              <p className="mt-1 text-xs text-red-600">
                End must be greater than or equal to Start.
              </p>
            ) : endMissing ? (
              <p className="mt-1 text-xs text-red-600">
                End number is required.
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <FieldLabel>Skip numbers</FieldLabel>
          <input
            type="text"
            value={excludeRaw}
            onChange={(e) => onExcludeChange(e.target.value)}
            placeholder="e.g., 4, 13, 42-50"
            data-testid="equip-prefix-exclude"
            className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <p className="mt-1 text-xs text-gray-500">
            Optional. Comma-separated values and ranges (like 42-50) are both
            supported.
          </p>
        </div>
      </div>

      <PrefixPreview generated={generated} />
    </div>
  );
}

function PrefixPreview({
  generated,
}: {
  generated: { codes: string[]; over: boolean };
}) {
  if (generated.codes.length === 0) {
    return (
      <p
        className="mt-5 text-sm text-gray-500"
        data-testid="equip-prefix-preview-empty"
      >
        Fill in the prefix and a valid range to see a preview.
      </p>
    );
  }
  const previewSlice = generated.codes.slice(0, 5);
  const showEllipsis = generated.codes.length > previewSlice.length;
  const lastName = generated.codes[generated.codes.length - 1];
  return (
    <div
      className="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
      data-testid="equip-prefix-preview"
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
        <span className="font-medium text-gray-900">
          {generated.codes.length}
        </span>{" "}
        code{generated.codes.length === 1 ? "" : "s"} will be created.
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
  codes: string[];
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
  codes,
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
  const hasCodes = codes.length > 0;
  return (
    <div data-testid="equip-csv-panel">
      {!hasCodes ? (
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
          data-testid="equip-csv-dropzone"
        >
          <i className="bx bx-cloud-upload text-3xl text-gray-400" aria-hidden />
          <p className="mt-2 text-sm text-gray-700 font-medium">
            Drop your CSV here, or{" "}
            <button
              type="button"
              onClick={onPickFile}
              className="text-brand-600 hover:text-brand-700 underline underline-offset-2"
              data-testid="equip-csv-browse"
            >
              browse for a file
            </button>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            One column with a header named{" "}
            <span className="font-mono">code</span> (or{" "}
            <span className="font-mono">equipment_code</span>). Other column
            names with the same meaning are accepted too.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onInputChange}
            data-testid="equip-csv-file-input"
          />
          <div className="mt-4">
            <a
              href={equipmentCsvTemplate}
              download="Equipment-Code-CSV-Template.csv"
              className="text-xs font-medium text-gray-600 hover:text-gray-900 inline-flex items-center gap-1.5"
              data-testid="equip-csv-template"
            >
              <i className="bx bx-download" aria-hidden /> Download CSV template
            </a>
          </div>
          {error && (
            <p
              className="mt-3 text-xs text-red-600"
              data-testid="equip-csv-error"
            >
              {error}
            </p>
          )}
        </div>
      ) : (
        <div data-testid="equip-csv-summary">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="inline-flex items-center gap-2 text-sm text-gray-800">
              <i className="bx bx-file text-base text-green-600" aria-hidden />
              <span className="font-medium">{fileName ?? "uploaded.csv"}</span>
              <span className="text-gray-500">
                — {codes.length} code{codes.length === 1 ? "" : "s"} ready
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onPickFile}
                data-testid="equip-csv-replace"
              >
                Replace file
              </Button>
              <button
                type="button"
                onClick={onClear}
                className="text-xs font-medium text-gray-500 hover:text-red-600 transition"
                data-testid="equip-csv-clear"
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
          <CodeChipPreview codes={codes} />
        </div>
      )}
    </div>
  );
}

function CodeChipPreview({ codes }: { codes: string[] }) {
  const SHOWN = 12;
  const visible = codes.slice(0, SHOWN);
  const remaining = codes.length - visible.length;
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
        Preview
      </div>
      <div
        className="flex flex-wrap items-center gap-1.5 text-sm"
        data-testid="equip-csv-preview"
      >
        {visible.map((c, i) => (
          <span
            key={`${c}-${i}`}
            className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-800 font-mono text-xs"
          >
            {c}
          </span>
        ))}
        {remaining > 0 && (
          <span className="text-xs text-gray-500">
            + {remaining} more
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Success view (post-Generate) ─────────────────────────────────────────

function SuccessView({
  response,
  onCreateMore,
}: {
  response: CreateEquipmentCodesResponse;
  onCreateMore: () => void;
}) {
  const codes = response.equipmentCodes;
  const count = codes.length;
  return (
    <section
      className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6"
      data-testid="equip-success-view"
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
            {count} equipment code{count === 1 ? "" : "s"} created
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Your QR codes are ready. They'll appear in your QR Codes list
            shortly.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
          Codes
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {codes.slice(0, 12).map((c) => (
            <span
              key={c.equipmentCodeId}
              className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-800 font-mono text-xs"
            >
              {c.code}
            </span>
          ))}
          {codes.length > 12 && (
            <span className="text-xs text-gray-500">
              + {codes.length - 12} more
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
        <Button
          type="button"
          variant="secondary"
          onClick={onCreateMore}
          data-testid="equip-create-more"
        >
          <i className="bx bx-plus mr-1.5" aria-hidden /> Create more codes
        </Button>
      </div>
    </section>
  );
}

// ─── CSV parser (header-tolerant) ─────────────────────────────────────────

/**
 * Parses an Equipment-Code CSV. Accepts header column names like `code`,
 * `equipment_code`, `Code`, `EQUIPMENT_CODE`, etc. — case- and
 * whitespace-insensitive, also accepting `equipment code` with a space.
 * If the file has multiple columns, picks the first matching column.
 *
 * Returns `{ codes }` on success, with an optional `error` string for
 * soft warnings (e.g. row cap exceeded). On hard failure, returns
 * `{ codes: [], error: <message> }`.
 */
function parseEquipmentCodeCsv(text: string): {
  codes: string[];
  error?: string;
} {
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim().length > 0);
  if (rawLines.length === 0) return { codes: [], error: "The file is empty." };
  if (rawLines.length === 1) {
    return {
      codes: [],
      error: "Add at least one equipment code below the header.",
    };
  }

  const header = parseCsvLine(rawLines[0]).map((c) => normalizeHeader(c));
  const codeIdx = header.findIndex((c) => isCodeHeader(c));
  if (codeIdx === -1) {
    return {
      codes: [],
      error:
        'CSV must include a "code" column (also accepts "equipment_code").',
    };
  }

  const codes: string[] = [];
  for (let i = 1; i < rawLines.length; i++) {
    const cells = parseCsvLine(rawLines[i]);
    const value = (cells[codeIdx] ?? "").trim();
    if (value) codes.push(value);
  }
  if (codes.length === 0) {
    return {
      codes: [],
      error: "No usable codes found. Check that the column has values.",
    };
  }
  if (codes.length > BULK_MAX_ROWS) {
    const dropped = codes.length - BULK_MAX_ROWS;
    return {
      codes: codes.slice(0, BULK_MAX_ROWS),
      error: `Capped at ${BULK_MAX_ROWS} codes — ${dropped} extra row${dropped === 1 ? "" : "s"} were dropped.`,
    };
  }
  return { codes };
}

/** Lower-cases, trims, strips quotes, and collapses whitespace. */
function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\s*"?|"?\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Header tolerance: accept any reasonable variant Excel/Sheets users may
 * produce. Centralised here so we can extend the list without hunting through
 * the parser.
 */
function isCodeHeader(normalized: string): boolean {
  switch (normalized) {
    case "code":
    case "codes":
    case "equipment_code":
    case "equipment code":
    case "equipmentcode":
    case "name":
      return true;
    default:
      return false;
  }
}
