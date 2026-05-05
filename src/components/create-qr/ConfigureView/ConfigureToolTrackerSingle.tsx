import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import Button from "@/components/ui/Button";
import {
  readCreateQRState,
  writeCreateQRState,
  type CreateQRState,
} from "@/lib/urlState";
import {
  SAMPLE_TOOL_CATEGORIES,
  SAMPLE_TOOL_SEED,
} from "@/data/seed/toolTrackerSeed";
import type {
  CreateToolTrackersResponse,
  ToolInput,
  ToolRetirement,
  ToolRetirementReason,
} from "@/components/create-qr/toolTracker/types";
import ToolPhotoUpload from "./ToolPhotoUpload";
import ToolTrackerRules from "./ToolTrackerRules";
import ToolTrackerGenerated from "./ToolTrackerGenerated";
import QuantityModeToggle from "./QuantityModeToggle";
import RetireToolModal from "./RetireToolModal";
import {
  setCarryDraft,
  writeLastMode,
} from "./toolTrackerCarryDraft";

/**
 * Tool Tracker — Single Configure flow.
 *
 * Multi-stage Configure that dispatches by `phase` URL param:
 *   - undefined / "info" → Tool Info form
 *   - "rules"            → ToolTrackerRules (PRD §4 Stage 4)
 *   - "generated"        → ToolTrackerGenerated (PRD §4 Stage 5)
 *
 * State lifting: tool data + the createToolTrackers response live at the
 * dispatch level so they survive phase navigation. ToolInfoForm receives
 * tool + setTool; ToolTrackerRules consumes the assembled `tools` list and
 * reports its response via `onGenerated`. ToolTrackerGenerated receives
 * the response to render the printable card grid.
 */
export default function ConfigureToolTrackerSingle() {
  const navigate = useNavigate();
  const { location } = useRouterState();
  const phase = useMemo(
    () => readCreateQRState(location.search).phase,
    [location.search],
  );
  const [tool, setTool] = useState<ToolFormState>(INITIAL_TOOL);
  const [createdResponse, setCreatedResponse] =
    useState<CreateToolTrackersResponse | null>(null);
  const [retireModalOpen, setRetireModalOpen] = useState(false);

  const isRetired = !!tool.retirement;

  const handleRetireConfirm = (retirement: ToolRetirement) => {
    setTool((prev) => ({ ...prev, retirement }));
    setRetireModalOpen(false);
  };

  const handleRestore = () => {
    setTool((prev) => ({ ...prev, retirement: null }));
  };

  // Strip UI-only fields before handing off to the Rules stub call.
  const toolPayload = useMemo<ToolInput>(() => {
    const {
      photoFile: _photoFile,
      photoPreviewUrl: _photoPreviewUrl,
      ...rest
    } = tool;
    void _photoFile;
    void _photoPreviewUrl;
    return rest;
  }, [tool]);

  const handleBackToInfo = () => {
    writeCreateQRState(navigate, {
      ...readCreateQRState(location.search),
      phase: null,
      replace: false,
    });
  };

  const handleGenerated = (response: CreateToolTrackersResponse) => {
    setCreatedResponse(response);
    writeCreateQRState(navigate, {
      ...readCreateQRState(location.search),
      phase: "generated",
      replace: false,
    });
  };

  const handleCreateMore = () => {
    setTool(INITIAL_TOOL);
    setCreatedResponse(null);
    writeCreateQRState(navigate, {
      ...readCreateQRState(location.search),
      typeId: null,
      tab: null,
      sub: null,
      method: null,
      phase: null,
      replace: false,
    });
  };

  let phaseContent: React.ReactNode;
  if (phase === "rules") {
    phaseContent = (
      <ToolTrackerRules
        tools={[toolPayload]}
        onBackToInfo={handleBackToInfo}
        onGenerated={handleGenerated}
      />
    );
  } else if (phase === "generated") {
    if (!createdResponse) {
      // Edge case: page refreshed on phase=generated. State is gone — silently
      // bounce back to phase=info so the user can re-enter.
      writeCreateQRState(navigate, {
        ...readCreateQRState(location.search),
        phase: null,
        replace: true,
      });
      return null;
    }
    phaseContent = (
      <ToolTrackerGenerated
        response={createdResponse}
        onCreateMore={handleCreateMore}
      />
    );
  } else {
    phaseContent = <ToolInfoForm tool={tool} setTool={setTool} />;
  }

  return (
    <div className="space-y-4" data-testid="tool-tracker-single-shell">
      {isRetired && tool.retirement && (
        <RetiredBanner
          retirement={tool.retirement}
          onRestore={handleRestore}
        />
      )}
      {phaseContent}
      {/*
        PLACEHOLDER LOCATION — per design review request.
        The "Retire tool" CTA logically belongs on the tool's detail page
        (post-creation), not the create-flow. Surfaced here on every phase
        so the team can review the lifecycle UX end-to-end. Move to the
        tool detail page before merge.
      */}
      <LifecycleSection
        isRetired={isRetired}
        onRetireClick={() => setRetireModalOpen(true)}
        onRestore={handleRestore}
      />
      <RetireToolModal
        open={retireModalOpen}
        toolName={tool.name}
        onClose={() => setRetireModalOpen(false)}
        onConfirm={handleRetireConfirm}
      />
    </div>
  );
}

interface ToolFormState extends ToolInput {
  /** Object URL preview kept alongside the File so we can render the tile. */
  photoFile?: File | null;
  photoPreviewUrl?: string | null;
  /** Set when the tool has been decommissioned via RetireToolModal. */
  retirement?: ToolRetirement | null;
}

const INITIAL_TOOL: ToolFormState = {
  ...SAMPLE_TOOL_SEED,
  photoFile: null,
  photoPreviewUrl: null,
  retirement: null,
};

interface ToolInfoFormProps {
  tool: ToolFormState;
  setTool: Dispatch<SetStateAction<ToolFormState>>;
}

function ToolInfoForm({ tool, setTool }: ToolInfoFormProps) {
  const navigate = useNavigate();
  const { location } = useRouterState();
  const [showMore, setShowMore] = useState(false);
  const [touched, setTouched] = useState(false);

  const update = <K extends keyof ToolFormState>(
    key: K,
    value: ToolFormState[K],
  ) => {
    setTool((prev) => ({ ...prev, [key]: value }));
  };

  const canContinue = tool.name.trim().length > 0;

  // Revoke object URL on unmount or replacement to avoid leaks.
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
    setTool((prev) => ({ ...prev, photoFile: file, photoPreviewUrl: previewUrl }));
  };

  const handlePhotoRemove = () => {
    if (tool.photoPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(tool.photoPreviewUrl);
    }
    setTool((prev) => ({ ...prev, photoFile: null, photoPreviewUrl: null }));
  };

  // Record that the user is engaging with the Single form so the next visit
  // to Tool Tracker lands them in Single by default. Fires once per mount.
  useEffect(() => {
    writeLastMode("single");
  }, []);

  const handleSwitchToBulk = () => {
    setCarryDraft({
      name: tool.name,
      category: tool.category ?? "Uncategorized",
      serial: tool.serial ?? "",
      homeLocation: tool.homeLocation ?? "",
    });
    const merged: CreateQRState & { replace?: boolean } = {
      ...readCreateQRState(location.search),
      tab: "bulk",
      sub: "tool-tracker",
      phase: null,
      replace: false,
    };
    writeCreateQRState(navigate, merged);
  };

  const handleBack = () => {
    // Tool Tracker skips the Quantity step, so Back returns the user all the
    // way to Type selection rather than looping back into Configure.
    const merged: CreateQRState & { replace?: boolean } = {
      ...readCreateQRState(location.search),
      typeId: null,
      tab: null,
      sub: null,
      method: null,
      phase: null,
      replace: false,
    };
    writeCreateQRState(navigate, merged);
  };

  const handleContinue = () => {
    setTouched(true);
    if (!canContinue) return;
    // Advance to phase=rules (Stage 4 placeholder for now).
    const merged: CreateQRState & { replace?: boolean } = {
      ...readCreateQRState(location.search),
      phase: "rules",
      replace: false,
    };
    writeCreateQRState(navigate, merged);
  };

  return (
    <div className="space-y-4" data-testid="configure-tool-tracker-single">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Tool details
          </h3>
          <p className="mt-1 text-xs text-gray-600">
            Just a name to start — everything else helps field techs confirm
            the right tool.
          </p>
          <p
            className="mt-1.5 text-xs text-gray-500"
            data-testid="required-field-legend"
          >
            <span className="text-red-600" aria-hidden="true">
              *
            </span>{" "}
            Required field
          </p>
        </div>
        <QuantityModeToggle mode="single" onChange={(next) => {
          if (next === "bulk") handleSwitchToBulk();
        }} />
      </div>

      <div className="space-y-4">
        <div>
          <FieldLabel>Tool photo</FieldLabel>
          <ToolPhotoUpload
            previewUrl={tool.photoPreviewUrl ?? null}
            onFileSelect={handlePhotoSelect}
            onRemove={handlePhotoRemove}
          />
        </div>

        <Field
          label="Tool name"
          required
          value={tool.name}
          onChange={(v) => update("name", v)}
          placeholder="e.g., DeWalt 20V Impact Driver (DCF887)"
          touched={touched && !canContinue}
          errorMessage={
            touched && !canContinue ? "Tool name is required." : undefined
          }
          testId="tool-name"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Category"
            value={tool.category ?? "Uncategorized"}
            onChange={(v) => update("category", v)}
            options={SAMPLE_TOOL_CATEGORIES}
            testId="tool-category"
          />
          <Field
            label="Serial number"
            value={tool.serial ?? ""}
            onChange={(v) => update("serial", v)}
            placeholder="e.g., 4821-A9C"
            testId="tool-serial"
          />
        </div>

        <Field
          label="Home location"
          value={tool.homeLocation ?? ""}
          onChange={(v) => update("homeLocation", v)}
          placeholder="e.g., Warehouse B — Cage 3"
          helper="Where the tool lives when it's not checked out."
          testId="tool-home"
        />
      </div>

      <div className="pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="group flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition"
          data-testid="tool-more-details-toggle"
          aria-expanded={showMore}
        >
          <span
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 group-hover:bg-gray-200 transition ${
              showMore ? "rotate-180" : ""
            }`}
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
          <div
            className="mt-5 space-y-6"
            data-testid="tool-more-details-panel"
          >
            <SubSection label="Identification">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field
                  label="Manufacturer"
                  value={tool.manufacturer ?? ""}
                  onChange={(v) => update("manufacturer", v)}
                  placeholder="e.g., DeWalt"
                  testId="tool-manufacturer"
                />
                <Field
                  label="Model number"
                  value={tool.model ?? ""}
                  onChange={(v) => update("model", v)}
                  placeholder="e.g., DCF887"
                  testId="tool-model"
                />
                <Field
                  label="Barcode"
                  value={tool.barcode ?? ""}
                  onChange={(v) => update("barcode", v)}
                  placeholder="Scan or enter"
                  testId="tool-barcode"
                />
              </div>
            </SubSection>

            <SubSection label="Description">
              <textarea
                value={tool.description ?? ""}
                onChange={(e) => update("description", e.target.value)}
                rows={3}
                placeholder="Notes, accessories included, condition, etc."
                data-testid="tool-description"
                className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-brand-400 focus:ring-brand-400"
              />
            </SubSection>

            <SubSection label="Purchase &amp; warranty">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Field
                  label="Vendor"
                  value={tool.vendor ?? ""}
                  onChange={(v) => update("vendor", v)}
                  placeholder="Where purchased"
                  testId="tool-vendor"
                />
                <Field
                  label="Purchase date"
                  type="date"
                  value={tool.purchaseDate ?? ""}
                  onChange={(v) => update("purchaseDate", v)}
                  testId="tool-purchase-date"
                />
                <PriceField
                  label="Purchase price"
                  value={tool.purchasePrice ?? ""}
                  onChange={(v) => update("purchasePrice", v)}
                  testId="tool-purchase-price"
                />
                <Field
                  label="Warranty date"
                  type="date"
                  value={tool.warrantyDate ?? ""}
                  onChange={(v) => update("warrantyDate", v)}
                  testId="tool-warranty-date"
                />
              </div>
            </SubSection>

            <SubSection label="Documentation">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Product website URL"
                  value={tool.productUrl ?? ""}
                  onChange={(v) => update("productUrl", v)}
                  placeholder="https://"
                  testId="tool-product-url"
                />
                <Field
                  label="Owner's manual URL"
                  value={tool.manualUrl ?? ""}
                  onChange={(v) => update("manualUrl", v)}
                  placeholder="https://"
                  testId="tool-manual-url"
                />
              </div>
            </SubSection>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-4 border-t border-gray-100">
        <Button
          type="button"
          variant="secondary"
          onClick={handleBack}
          data-testid="tool-info-back"
        >
          Back
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleContinue}
          disabled={touched && !canContinue}
          data-testid="tool-info-continue"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
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

interface FieldProps {
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

function Field({
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
}: FieldProps) {
  const showError = Boolean(touched);
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        className={`block w-full rounded-md shadow-sm text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 ${
          showError
            ? "border-red-400 focus:border-red-400 focus:ring-red-100"
            : "border-gray-300"
        }`}
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

interface SelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  testId: string;
}

function Select({ label, value, onChange, options, testId }: SelectProps) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-brand-400 focus:ring-brand-400 bg-white"
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

interface PriceFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
}

function PriceField({ label, value, onChange, testId }: PriceFieldProps) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          data-testid={testId}
          className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-brand-400 focus:ring-brand-400 pl-7"
        />
      </div>
    </div>
  );
}

function SubSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
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

const REASON_LABELS: Record<ToolRetirementReason, string> = {
  broken: "Broken / no longer functional",
  lost: "Lost or stolen",
  sold: "Sold or transferred",
  scrapped: "Scrapped / disposed",
  other: "Other",
};

function formatRetirementDate(iso: string): string {
  // Accept YYYY-MM-DD; fall back to the raw string if unparseable.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function RetiredBanner({
  retirement,
  onRestore,
}: {
  retirement: ToolRetirement;
  onRestore: () => void;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
      data-testid="tool-retired-banner"
      role="status"
    >
      <i
        className="bx bx-archive text-amber-600 text-xl mt-0.5"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-amber-900">
          Retired — hidden from the active list
        </div>
        <div className="mt-0.5 text-xs text-amber-800">
          {REASON_LABELS[retirement.reason]} ·{" "}
          {formatRetirementDate(retirement.retiredAt)}
          {retirement.notes ? ` · ${retirement.notes}` : ""}
        </div>
        <div className="mt-1 text-xs text-amber-700">
          History and metadata are preserved. Scans of this QR will show a
          retired notice.
        </div>
      </div>
      <button
        type="button"
        onClick={onRestore}
        className="text-xs font-medium text-amber-900 hover:text-amber-950 underline underline-offset-2 shrink-0"
        data-testid="tool-retired-restore"
      >
        Restore
      </button>
    </div>
  );
}

function LifecycleSection({
  isRetired,
  onRetireClick,
  onRestore,
}: {
  isRetired: boolean;
  onRetireClick: () => void;
  onRestore: () => void;
}) {
  return (
    <div
      className="rounded-lg border border-dashed border-gray-300 bg-gray-50/60 px-4 py-3"
      data-testid="tool-lifecycle-section"
    >
      <div className="flex items-center gap-2 mb-1">
        <i
          className="bx bx-recycle text-gray-500 text-base"
          aria-hidden="true"
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Tool lifecycle
        </span>
        <span
          className="ml-auto text-[10px] font-medium uppercase tracking-wider text-gray-400"
          title="Placeholder — dev will move this CTA to the tool detail page"
        >
          Placeholder
        </span>
      </div>
      <p className="text-xs text-gray-600 mb-3">
        Decommission this tool when it&apos;s broken, lost, sold, or scrapped.
        It&apos;s removed from the active list, but its history stays
        searchable.
      </p>
      {isRetired ? (
        <Button
          type="button"
          variant="secondary"
          onClick={onRestore}
          data-testid="tool-lifecycle-restore"
          leftIconClass="bx bx-undo"
        >
          Restore tool to active
        </Button>
      ) : (
        <Button
          type="button"
          variant="danger"
          onClick={onRetireClick}
          data-testid="tool-lifecycle-retire"
          leftIconClass="bx bx-archive-in"
        >
          Retire tool…
        </Button>
      )}
    </div>
  );
}
