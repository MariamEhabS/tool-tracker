import type { RefObject } from "react";
import SearchComboBox from "@/components/combobox/detail/SearchComboBox";
import Button from "@/components/ui/Button";
import ProcoreStatusIndicator from "@/components/create-qr/ProcoreStatusIndicator";
import type { TierConfig } from "@/lib/tiers/types";
import talihoCsvTemplate from "@/assets/templates/Taliho-CSV-Template.csv?url";

export interface ConfigureBulkGroupProps {
  configureKey: string;
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
  isLoadingProjects: boolean;
  projectIsConnected: boolean;
  selectedProjectRow: { projectName?: string } | undefined;
  buildProjectEditHref: (id?: string) => string;
  setShowProjectEditModal: (v: boolean) => void;
  // Target group field
  renderTargetGroupField: () => React.ReactNode;
  // Categories
  categoryGroups: Array<{
    label: string;
    options: Array<{ label: string; value: string }>;
  }>;
  assortedSelectedTalihoCodes: string[] | undefined;
  setAssortedSelectedTalihoCodes: (v: string[] | undefined) => void;
  talihoQuery: string;
  setTalihoQuery: (q: string) => void;
  handleCategoriesDropdownOpen: () => void;
  isLoadingCategories: boolean;
  // Locations
  procoreLocationOptions: Array<{ label: string; value: string }>;
  assortedSelectedLocations: string[] | undefined;
  setAssortedSelectedLocations: (v: string[] | undefined) => void;
  isLoadingLocations: boolean;
  // Tools
  procoreToolOptions: Array<{
    label: string;
    value: string;
    backendName: string;
  }>;
  assortedSelectedTools: string[] | undefined;
  setAssortedSelectedTools: (v: string[] | undefined) => void;
  isLoadingPermissions: boolean;
  // Drawings
  drawingsGroupsPaged: Array<{
    label: string;
    options: Array<{ label: string; value: string }>;
  }>;
  assortedSelectedDrawings: string[] | undefined;
  setAssortedSelectedDrawings: (v: string[] | undefined) => void;
  drawingsHasNext: boolean;
  drawingsFetchingNext: boolean;
  drawingsFetchNext: () => void;
  // Selection history
  assortedSelectionHistory: Array<{
    type: "taliho" | "location" | "tool" | "drawing";
    value: string;
    label: string;
  }>;
  updateSelectionHistory: (
    prev: string[],
    next: string[],
    type: "taliho" | "location" | "tool" | "drawing",
    resolveLabel: (v: string) => string,
  ) => void;
  removeAssortedSelection: (entry: {
    type: "taliho" | "location" | "tool" | "drawing";
    value: string;
  }) => void;
  // Prefix-quantity refs
  prefixRef: RefObject<HTMLInputElement | null>;
  startRef: RefObject<HTMLInputElement | null>;
  endRef: RefObject<HTMLInputElement | null>;
  excludeNumbersRef: RefObject<HTMLInputElement | null>;
  // CSV refs
  uploadCsvRef: RefObject<HTMLInputElement | null>;
  csvFileName: string | null;
  isCsvDragging: boolean;
  onCsvInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCsvDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onCsvDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onCsvDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  onCsvDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  // Manual entry ref
  manualItemsRef: RefObject<HTMLTextAreaElement | null>;
  // Validation
  isFieldInvalid: (field: string) => boolean;
  inputErrorClass: (field: string) => string;
  renderValidationError: (field: string) => React.ReactNode;
  clearValidationError: (field: string) => void;
  // Tier
  tierConfig: TierConfig;
  qrBatchLimit: number;
  hasUnlimitedQR: boolean;
  // Actions
  onCreateAddAnother: () => void;
  onCreateNow: () => void;
}

export default function ConfigureBulkGroup({
  configureKey,
  selectedProjectId,
  projectSelectorOptions,
  handleProjectChange,
  isLoadingProjects,
  projectIsConnected,
  selectedProjectRow,
  buildProjectEditHref,
  setShowProjectEditModal,
  renderTargetGroupField,
  categoryGroups,
  assortedSelectedTalihoCodes,
  setAssortedSelectedTalihoCodes,
  talihoQuery,
  setTalihoQuery,
  handleCategoriesDropdownOpen,
  isLoadingCategories,
  procoreLocationOptions,
  assortedSelectedLocations,
  setAssortedSelectedLocations,
  isLoadingLocations,
  procoreToolOptions,
  assortedSelectedTools,
  setAssortedSelectedTools,
  isLoadingPermissions,
  drawingsGroupsPaged,
  assortedSelectedDrawings,
  setAssortedSelectedDrawings,
  drawingsHasNext,
  drawingsFetchingNext,
  drawingsFetchNext,
  assortedSelectionHistory,
  updateSelectionHistory,
  removeAssortedSelection,
  prefixRef,
  startRef,
  endRef,
  excludeNumbersRef,
  uploadCsvRef,
  csvFileName,
  isCsvDragging,
  onCsvInputChange,
  onCsvDrop,
  onCsvDragOver,
  onCsvDragEnter,
  onCsvDragLeave,
  manualItemsRef,
  isFieldInvalid,
  inputErrorClass,
  renderValidationError,
  clearValidationError,
  tierConfig,
  qrBatchLimit,
  hasUnlimitedQR,
  onCreateAddAnother,
  onCreateNow,
}: ConfigureBulkGroupProps) {
  if (configureKey === "bulk:arrangement:assorted") {
    return (
      <div className="grid grid-cols-16 gap-6">
        <div className="col-span-11 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-200">
            {/* Group Name */}
            {renderTargetGroupField()}
            {/* Project */}
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
                  loading={isLoadingProjects}
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
          <div className="">
            <div className="grid grid-cols-2 gap-4">
              {/* Taliho QR Codes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Categories
                </label>
                <div className="relative">
                  <SearchComboBox
                    groups={categoryGroups}
                    value={assortedSelectedTalihoCodes}
                    onChange={(v) => {
                      const prev = assortedSelectedTalihoCodes ?? [];
                      const next = (
                        Array.isArray(v) ? v : v ? [v] : []
                      ) as string[];
                      setAssortedSelectedTalihoCodes(
                        next.length ? next : undefined,
                      );
                      const getLabel = (val: string) => {
                        for (const grp of categoryGroups) {
                          const found = grp.options.find(
                            (o) => String(o.value) === val,
                          );
                          if (found) return found.label;
                        }
                        return val;
                      };
                      updateSelectionHistory(prev, next, "taliho", getLabel);
                    }}
                    multiple
                    placeholder="Enter names or search..."
                    inputClassName="text-sm pr-24"
                    hideClearButton
                    query={talihoQuery}
                    onQueryChange={(q) => setTalihoQuery(q)}
                    onOpen={handleCategoriesDropdownOpen}
                    loading={isLoadingCategories}
                    hideNoResults
                    usePortal
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded bg-brand-500 text-white disabled:opacity-50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      const label = (talihoQuery ?? "").trim();
                      if (!label) return;
                      const value = `custom:${label}`;
                      const prev = assortedSelectedTalihoCodes ?? [];
                      if (prev.includes(value)) {
                        setTalihoQuery("");
                        return;
                      }
                      const next = [...prev, value];
                      setAssortedSelectedTalihoCodes(next);
                      updateSelectionHistory(prev, next, "taliho", (v) =>
                        v.startsWith("custom:") ? v.substring(7) : v,
                      );
                      setTalihoQuery("");
                    }}
                    disabled={!talihoQuery || !talihoQuery.trim()}
                  >
                    Add
                  </button>
                </div>
              </div>
              {/* Procore Location */}
              <div>
                <label
                  className={`${!selectedProjectId || !projectIsConnected ? "pointer-events-none opacity-50" : ""} block text-sm font-medium text-gray-700 mb-1`}
                >
                  Procore Location
                </label>
                <div
                  className={`${!selectedProjectId || !projectIsConnected ? "pointer-events-none opacity-50" : ""}`}
                >
                  <SearchComboBox
                    options={procoreLocationOptions}
                    value={assortedSelectedLocations}
                    onChange={(v) => {
                      const prev = assortedSelectedLocations ?? [];
                      const next = (
                        Array.isArray(v) ? v : v ? [v] : []
                      ) as string[];
                      setAssortedSelectedLocations(
                        next.length ? next : undefined,
                      );
                      const getLabel = (val: string) => {
                        const found = procoreLocationOptions.find(
                          (o) => String(o.value) === val,
                        );
                        return found?.label ?? val;
                      };
                      updateSelectionHistory(prev, next, "location", getLabel);
                    }}
                    multiple
                    placeholder={
                      !selectedProjectId
                        ? "Select a project to enable"
                        : !projectIsConnected
                          ? "Project not connected to Procore"
                          : "Search or select locations"
                    }
                    className="w-full"
                    loading={isLoadingLocations}
                    usePortal
                  />
                </div>
              </div>
              {/* Procore Tool */}
              <div>
                <label
                  className={`${!selectedProjectId || !projectIsConnected ? "pointer-events-none opacity-50" : ""} block text-sm font-medium text-gray-700 mb-1`}
                >
                  Procore Tool
                </label>
                <div
                  className={`${!selectedProjectId || !projectIsConnected ? "pointer-events-none opacity-50" : ""}`}
                >
                  <SearchComboBox
                    options={procoreToolOptions}
                    value={assortedSelectedTools}
                    onChange={(v) => {
                      const prev = assortedSelectedTools ?? [];
                      const next = (
                        Array.isArray(v) ? v : v ? [v] : []
                      ) as string[];
                      setAssortedSelectedTools(next.length ? next : undefined);
                      const getLabel = (val: string) => {
                        const found = procoreToolOptions.find(
                          (o) => String(o.value) === val,
                        );
                        return found?.label ?? val;
                      };
                      updateSelectionHistory(prev, next, "tool", getLabel);
                    }}
                    multiple
                    placeholder={
                      !selectedProjectId
                        ? "Select a project to enable"
                        : !projectIsConnected
                          ? "Project not connected to Procore"
                          : procoreToolOptions.length === 0
                            ? "No tools available"
                            : "Search or select tools"
                    }
                    className="w-full"
                    loading={isLoadingPermissions}
                    usePortal
                  />
                </div>
              </div>
              {/* Procore Drawing */}
              <div>
                <label
                  className={`${!selectedProjectId || !projectIsConnected ? "pointer-events-none opacity-50" : ""} block text-sm font-medium text-gray-700 mb-1`}
                >
                  Procore Drawings
                </label>
                <div
                  className={`${!selectedProjectId || !projectIsConnected ? "pointer-events-none opacity-50" : ""}`}
                >
                  <SearchComboBox
                    groups={drawingsGroupsPaged}
                    value={assortedSelectedDrawings}
                    onChange={(v) => {
                      const prev = assortedSelectedDrawings ?? [];
                      const next = (
                        Array.isArray(v) ? v : v ? [v] : []
                      ) as string[];
                      setAssortedSelectedDrawings(
                        next.length ? next : undefined,
                      );
                      const getLabel = (val: string) => {
                        for (const grp of drawingsGroupsPaged) {
                          const found = grp.options.find(
                            (o) => String(o.value) === val,
                          );
                          if (found) return found.label;
                        }
                        return val;
                      };
                      updateSelectionHistory(prev, next, "drawing", getLabel);
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
                    usePortal
                  />
                </div>
              </div>
            </div>
          </div>

          {/* QR Batch Limit Indicator */}
          {!hasUnlimitedQR && (
            <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 flex items-center mt-3">
              <i className="bx bx-info-circle text-blue-600 mr-1.5 text-sm"></i>
              Your {tierConfig.name} plan allows up to{" "}
              <span className="font-semibold mx-1">
                {qrBatchLimit} QR codes
              </span>{" "}
              at once. Upgrade for unlimited batch creation.
            </div>
          )}

          {configureKey ? (
            <div className="flex items-center gap-2 justify-end pt-3 border-t border-gray-100 mt-2">
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

        {/* Summary Card */}
        <div className="col-span-5 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">
              Selection Summary
            </h3>
            <span className="text-xs text-gray-500">
              {assortedSelectionHistory.length} items
            </span>
          </div>
          {assortedSelectionHistory.length === 0 ? (
            <div className="text-xs text-gray-500">No selections yet</div>
          ) : (
            <div className="grow relative h-40 overflow-y-auto">
              <ul className="divide-y divide-gray-100">
                {assortedSelectionHistory.map((it, idx) => (
                  <li
                    key={`${it.type}-${it.value}-${idx}`}
                    className="py-2 flex items-center gap-2"
                  >
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${it.type === "taliho" ? "bg-gray-50 text-gray-700 border-gray-200" : it.type === "location" ? "bg-orange-50 text-orange-700 border-orange-200" : it.type === "tool" ? "bg-orange-50 text-orange-700 border-orange-200" : it.type === "drawing" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-gray-50 text-gray-700 border-gray-200"}`}
                    >
                      {it.type}
                    </span>
                    <span className="text-xs text-gray-800 truncate flex-1">
                      {it.label}
                    </span>
                    <button
                      type="button"
                      aria-label="Remove item"
                      className="pr-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
                      onClick={() => removeAssortedSelection(it)}
                    >
                      <i className="bx bx-x"></i>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (configureKey === "bulk:equipment:prefix-quantity") {
    return (
      <div className="flex flex-col gap-3">
        {/* Group Name and Project row */}
        <div className="grid grid-cols-2 gap-4">
          {renderTargetGroupField()}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project
            </label>
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
            {renderValidationError("project")}
          </div>
        </div>

        {/* Prefix and Range row */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prefix
            </label>
            <input
              ref={prefixRef}
              onChange={() => clearValidationError("prefix")}
              className={`block w-full rounded-md border-gray-300 text-sm focus:border-yellow-500 focus:ring-yellow-500 ${inputErrorClass("prefix")}`}
              placeholder="AHU"
            />
            {renderValidationError("prefix")}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start
            </label>
            <input
              ref={startRef}
              type="number"
              // min={1}
              defaultValue={1}
              onChange={() => {
                clearValidationError("start");
                clearValidationError("range");
              }}
              className={`block w-full rounded-md border-gray-300 text-sm focus:border-yellow-500 focus:ring-yellow-500 ${inputErrorClass("start")} ${inputErrorClass("range")}`}
              placeholder="1"
            />
            {renderValidationError("start")}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End
            </label>
            <input
              ref={endRef}
              type="number"
              onChange={() => {
                clearValidationError("end");
                clearValidationError("range");
              }}
              className={`block w-full rounded-md border-gray-300 text-sm focus:border-yellow-500 focus:ring-yellow-500 ${inputErrorClass("end")} ${inputErrorClass("range")}`}
              placeholder="100"
            />
            {renderValidationError("end")}
          </div>
        </div>
        {renderValidationError("range")}

        {/* QR Batch Limit Indicator */}
        {!hasUnlimitedQR && (
          <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 flex items-center">
            <i className="bx bx-info-circle text-blue-600 mr-1.5 text-sm"></i>
            Your {tierConfig.name} plan allows up to{" "}
            <span className="font-semibold mx-1">{qrBatchLimit} QR codes</span>{" "}
            at once. Upgrade for unlimited batch creation.
          </div>
        )}

        {/* Exclude Numbers */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Exclude Numbers{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            ref={excludeNumbersRef}
            className="block w-full rounded-md border-gray-300 text-sm focus:border-yellow-500 focus:ring-yellow-500"
            placeholder="e.g., 4, 13, 42-50"
          />
          <p className="text-xs text-gray-500 mt-0.5">
            Comma-separated values and ranges are supported.
          </p>
        </div>

        {/* Action buttons */}
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
      </div>
    );
  }

  if (configureKey === "bulk:equipment:upload-csv") {
    return (
      <div className="flex flex-col gap-3">
        {/* Group Name and Project row */}
        <div className="grid grid-cols-2 gap-4">
          {renderTargetGroupField()}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project
            </label>
            <SearchComboBox
              options={projectSelectorOptions}
              value={selectedProjectId}
              onChange={handleProjectChange}
              placeholder="Search or select project"
              className="w-full"
              loading={isLoadingProjects}
              inputClassName={inputErrorClass("project")}
              allowCustomValue={false}
              usePortal
            />
            {renderValidationError("project")}
          </div>
        </div>

        {/* CSV File upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            CSV File
          </label>
          <div
            onDragEnter={onCsvDragEnter}
            onDragOver={onCsvDragOver}
            onDragLeave={onCsvDragLeave}
            onDrop={onCsvDrop}
            onClick={() => {
              uploadCsvRef.current?.click();
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                uploadCsvRef.current?.click();
              }
            }}
            className={`w-full rounded-md border-2 border-dashed px-4 py-3 transition duration-150 ease-in-out cursor-pointer flex items-center gap-4 ${isCsvDragging ? "border-yellow-400 bg-yellow-50/40" : "border-gray-300 hover:border-gray-400"} ${isFieldInvalid("csv") ? "border-red-500 bg-red-50/30" : ""}`}
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <i className="bx bx-cloud-upload text-xl text-gray-500"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700">
                <span className="font-medium text-yellow-700">
                  Click to upload
                </span>{" "}
                or drag and drop
              </p>
              {csvFileName ? (
                <p className="text-xs text-green-700 truncate">
                  Selected: {csvFileName}
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  Only .csv files are accepted
                </p>
              )}
            </div>
          </div>
          <input
            ref={uploadCsvRef}
            type="file"
            accept=".csv"
            onChange={onCsvInputChange}
            className="sr-only"
          />
          {renderValidationError("csv")}
        </div>

        {/* QR Batch Limit Indicator */}
        {!hasUnlimitedQR && (
          <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 flex items-center">
            <i className="bx bx-info-circle text-blue-600 mr-1.5 text-sm"></i>
            Your {tierConfig.name} plan allows up to{" "}
            <span className="font-semibold mx-1">{qrBatchLimit} QR codes</span>{" "}
            at once. Upgrade for unlimited batch creation.
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 justify-between pt-2 border-t border-gray-100 mt-1">
          <Button
            type="button"
            variant="secondary"
            href={talihoCsvTemplate}
            download
          >
            Download CSV template
          </Button>
          <div className="flex items-center gap-2">
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
        </div>
      </div>
    );
  }

  // bulk:equipment:manual-entry
  return (
    <div className="flex flex-col gap-3">
      {/* Group Name and Project row */}
      <div className="grid grid-cols-2 gap-4">
        {renderTargetGroupField()}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project
          </label>
          <SearchComboBox
            options={projectSelectorOptions}
            value={selectedProjectId}
            onChange={handleProjectChange}
            placeholder="Search or select project"
            className="w-full"
            loading={isLoadingProjects}
            inputClassName={inputErrorClass("project")}
            allowCustomValue={false}
            usePortal
          />
          {renderValidationError("project")}
        </div>
      </div>

      {/* Items textarea */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Items
        </label>
        <textarea
          ref={manualItemsRef}
          rows={4}
          onChange={() => clearValidationError("items")}
          className={`block w-full resize-none rounded-md border-gray-300 text-sm focus:border-yellow-500 focus:ring-yellow-500 ${inputErrorClass("items")}`}
          placeholder="Enter one item per line"
        ></textarea>
        {renderValidationError("items")}
        <p className="text-xs text-gray-500 mt-0.5">
          Each line will create a separate QR code
        </p>
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

      {/* Action buttons */}
      <div className="flex items-center gap-2 justify-end pt-2 border-t border-gray-100 mt-1">
        <Button type="button" variant="secondary" onClick={onCreateAddAnother}>
          Create & Add Another
        </Button>
        <Button type="button" variant="primary" onClick={onCreateNow}>
          Create & Populate
        </Button>
      </div>
    </div>
  );
}
