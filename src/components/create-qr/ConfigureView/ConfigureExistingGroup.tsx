import SearchComboBox from "@/components/combobox/detail/SearchComboBox";
import Button from "@/components/ui/Button";
import type { TierConfig } from "@/lib/tiers/types";

export interface ConfigureExistingGroupProps {
  existingGroupName: string;
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
  isLoadingPermissions: boolean;
  // Tools
  procoreToolOptions: Array<{
    label: string;
    value: string;
    backendName: string;
  }>;
  assortedSelectedTools: string[] | undefined;
  setAssortedSelectedTools: (v: string[] | undefined) => void;
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
  // Validation
  inputErrorClass: (field: string) => string;
  renderValidationError: (field: string) => React.ReactNode;
  // Tier
  tierConfig: TierConfig;
  qrBatchLimit: number;
  hasUnlimitedQR: boolean;
  // Actions
  onCreateAddAnother: () => void;
  onCreateNow: () => void;
}

export default function ConfigureExistingGroup({
  existingGroupName,
  selectedProjectId,
  projectSelectorOptions,
  handleProjectChange,
  isLoadingProjects,
  projectIsConnected,
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
  isLoadingPermissions,
  procoreToolOptions,
  assortedSelectedTools,
  setAssortedSelectedTools,
  drawingsGroupsPaged,
  assortedSelectedDrawings,
  setAssortedSelectedDrawings,
  drawingsHasNext,
  drawingsFetchingNext,
  drawingsFetchNext,
  assortedSelectionHistory,
  updateSelectionHistory,
  removeAssortedSelection,
  inputErrorClass,
  renderValidationError,
  tierConfig,
  qrBatchLimit,
  hasUnlimitedQR,
  onCreateAddAnother,
  onCreateNow,
}: ConfigureExistingGroupProps) {
  return (
    <div className="grid grid-cols-16 gap-8">
      <div className="col-span-11 flex flex-col gap-4">
        <div className="pb-6 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="text-sm text-gray-600">
              Adding QR codes to group:
            </div>
            <div className="font-medium text-gray-900">{existingGroupName}</div>
          </div>
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
            </div>
            {renderValidationError("project")}
          </div>
        </div>

        {/* Selection interface - same as bulk:arrangement:assorted but without group name */}
        <div className="">
          <div className="grid grid-cols-2 gap-4">
            {/* Taliho QR Codes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Taliho QR Codes
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
                className={`${
                  !selectedProjectId || !projectIsConnected
                    ? "pointer-events-none opacity-50"
                    : ""
                } block text-sm font-medium text-gray-700 mb-1`}
              >
                Procore Location
              </label>
              <div
                className={`${
                  !selectedProjectId || !projectIsConnected
                    ? "pointer-events-none opacity-50"
                    : ""
                }`}
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
                        : procoreLocationOptions.length === 0
                          ? "No locations available"
                          : "Search or select locations"
                  }
                  className="w-full"
                  loading={isLoadingPermissions}
                  usePortal
                />
              </div>
            </div>
          </div>

          {/* Procore Tools and Drawings */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            {/* Procore Tools */}
            <div>
              <label
                className={`${
                  !selectedProjectId || !projectIsConnected
                    ? "pointer-events-none opacity-50"
                    : ""
                } block text-sm font-medium text-gray-700 mb-1`}
              >
                Procore Tools
              </label>
              <div
                className={`${
                  !selectedProjectId || !projectIsConnected
                    ? "pointer-events-none opacity-50"
                    : ""
                }`}
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

            {/* Procore Drawings */}
            <div>
              <label
                className={`${
                  !selectedProjectId || !projectIsConnected
                    ? "pointer-events-none opacity-50"
                    : ""
                } block text-sm font-medium text-gray-700 mb-1`}
              >
                Procore Drawings
              </label>
              <div
                className={`${
                  !selectedProjectId || !projectIsConnected
                    ? "pointer-events-none opacity-50"
                    : ""
                }`}
              >
                <SearchComboBox
                  groups={drawingsGroupsPaged}
                  value={assortedSelectedDrawings}
                  onChange={(v) => {
                    const prev = assortedSelectedDrawings ?? [];
                    const next = (
                      Array.isArray(v) ? v : v ? [v] : []
                    ) as string[];
                    setAssortedSelectedDrawings(next.length ? next : undefined);
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
        {renderValidationError("selection")}

        {/* QR Batch Limit Indicator */}
        {!hasUnlimitedQR && (
          <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 flex items-center">
            <i className="bx bx-info-circle text-blue-600 mr-1.5 text-sm"></i>
            Your {tierConfig.name} plan allows up to{" "}
            <span className="font-semibold mx-1">{qrBatchLimit} QR codes</span>{" "}
            at once. Upgrade for unlimited batch creation.
          </div>
        )}

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
