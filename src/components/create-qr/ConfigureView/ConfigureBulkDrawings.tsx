import SearchComboBox from "@/components/combobox/detail/SearchComboBox";
import Button from "@/components/ui/Button";
import ProcoreStatusIndicator from "@/components/create-qr/ProcoreStatusIndicator";
import type { TierConfig } from "@/lib/tiers/types";

export interface ConfigureBulkDrawingsProps {
  selectedProjectId: string | undefined;
  projectSelectorOptions: Array<{
    value: string;
    label: string;
    hideIndicator?: boolean;
    dividerBelow?: boolean;
    hideWhenQueryNotEmpty?: boolean;
  }>;
  handleProjectChange: (
    next: string | number | (string | number)[] | undefined,
  ) => void;
  projectIsConnected: boolean;
  selectedProjectRow: { projectName?: string } | undefined;
  buildProjectEditHref: (id?: string) => string;
  setShowProjectEditModal: (v: boolean) => void;
  // Target group field
  renderTargetGroupField: () => React.ReactNode;
  // Drawings
  drawingsGroupsPaged: Array<{
    label: string;
    options: Array<{ label: string; value: string }>;
  }>;
  selectedDrawingCodes: string[] | undefined;
  setSelectedDrawingCodes: (v: string[] | undefined) => void;
  drawingsHasNext: boolean;
  drawingsFetchingNext: boolean;
  drawingsFetchNext: () => void;
  // Validation
  inputErrorClass: (field: string) => string;
  renderValidationError: (field: string) => React.ReactNode;
  clearValidationError: (field: string) => void;
  // Tier
  tierConfig: TierConfig;
  qrBatchLimit: number;
  hasUnlimitedQR: boolean;
  // Actions
  configureKey: string | null;
  onCreateAddAnother: () => void;
  onCreateNow: () => void;
}

export default function ConfigureBulkDrawings({
  selectedProjectId,
  projectSelectorOptions,
  handleProjectChange,
  projectIsConnected,
  selectedProjectRow,
  buildProjectEditHref,
  setShowProjectEditModal,
  renderTargetGroupField,
  drawingsGroupsPaged,
  selectedDrawingCodes,
  setSelectedDrawingCodes,
  drawingsHasNext,
  drawingsFetchingNext,
  drawingsFetchNext,
  inputErrorClass,
  renderValidationError,
  clearValidationError,
  tierConfig,
  qrBatchLimit,
  hasUnlimitedQR,
  configureKey,
  onCreateAddAnother,
  onCreateNow,
}: ConfigureBulkDrawingsProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Group Name and Project row */}
      <div className="grid grid-cols-2 gap-4">
        {renderTargetGroupField()}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project
          </label>
          <div className="flex items-center gap-2">
            <SearchComboBox
              options={projectSelectorOptions}
              value={selectedProjectId}
              onChange={handleProjectChange}
              placeholder="Search or select project"
              className="w-full"
              inputClassName={inputErrorClass("project")}
              allowCustomValue={false}
              usePortal
            />
            <ProcoreStatusIndicator
              selectedProjectId={selectedProjectId}
              projectIsConnected={projectIsConnected}
              projectName={selectedProjectRow?.projectName}
              buildProjectEditHref={buildProjectEditHref}
              onConnectClick={() => setShowProjectEditModal(true)}
            />
          </div>
          {renderValidationError("project")}
        </div>
      </div>

      {/* Drawings */}
      <div>
        <label
          className={`${!selectedProjectId || !projectIsConnected ? "pointer-events-none opacity-50" : ""} block text-sm font-medium text-gray-700 mb-1`}
        >
          Drawings
        </label>
        <div
          className={`${!selectedProjectId || !projectIsConnected ? "pointer-events-none opacity-50" : ""}`}
        >
          <SearchComboBox
            groups={drawingsGroupsPaged}
            value={selectedDrawingCodes}
            onChange={(v) => {
              setSelectedDrawingCodes(
                (Array.isArray(v) ? v : v ? [v] : undefined) as
                  | string[]
                  | undefined,
              );
              clearValidationError("drawing");
            }}
            multiple
            placeholder={
              !selectedProjectId
                ? "Select a project to enable"
                : !projectIsConnected
                  ? "Project not connected to Procore"
                  : "Search or select drawings"
            }
            className="w-full"
            onEndReached={() => {
              if (drawingsHasNext && !drawingsFetchingNext) {
                void drawingsFetchNext();
              }
            }}
            loading={drawingsFetchingNext}
            inputClassName={inputErrorClass("drawing")}
            usePortal
          />
        </div>
        {renderValidationError("drawing")}
      </div>

      {/* QR Batch Limit Indicator */}
      {!hasUnlimitedQR && (
        <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 flex items-center">
          <i className="bx bx-info-circle text-blue-600 mr-1.5 text-sm"></i>
          Your {tierConfig.name} plan allows up to{" "}
          <span className="font-semibold mx-1">{qrBatchLimit} QR codes</span> at
          once. Upgrade for unlimited batch creation.
        </div>
      )}

      {configureKey ? (
        <div className="flex items-center gap-2 justify-end pt-2 border-t border-gray-100 mt-1">
          <Button
            type="button"
            variant="secondary"
            onClick={onCreateAddAnother}
          >
            Create & Add Another
          </Button>
          <Button type="button" variant="primary" onClick={onCreateNow}>
            Create & Populate
          </Button>
        </div>
      ) : null}
    </div>
  );
}
