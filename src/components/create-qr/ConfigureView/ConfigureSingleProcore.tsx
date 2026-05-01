import SearchComboBox from "@/components/combobox/detail/SearchComboBox";
import Button from "@/components/ui/Button";
import ProcoreStatusIndicator from "@/components/create-qr/ProcoreStatusIndicator";

export interface ConfigureSingleProcoreProps {
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
  // Procore location
  procoreLocationOptions: Array<{ label: string; value: string }>;
  selectedProcoreLocation: string | undefined;
  setSelectedProcoreLocation: (v: string | undefined) => void;
  isLoadingLocations: boolean;
  // Procore tool
  procoreToolOptions: Array<{
    label: string;
    value: string;
    backendName: string;
  }>;
  selectedProcoreTool: string | undefined;
  setSelectedProcoreTool: (v: string | undefined) => void;
  isLoadingPermissions: boolean;
  // Procore drawing
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
  isFieldInvalid: (field: string) => boolean;
  inputErrorClass: (field: string) => string;
  renderValidationError: (field: string) => React.ReactNode;
  clearValidationError: (field: string) => void;
  // Actions
  onCreateAddAnother: () => void;
  onCreateNow: () => void;
}

export default function ConfigureSingleProcore({
  configureKey,
  selectedProjectId,
  projectSelectorOptions,
  handleProjectChange,
  isLoadingProjects,
  projectIsConnected,
  selectedProjectRow,
  buildProjectEditHref,
  setShowProjectEditModal,
  procoreLocationOptions,
  selectedProcoreLocation,
  setSelectedProcoreLocation,
  isLoadingLocations,
  procoreToolOptions,
  selectedProcoreTool,
  setSelectedProcoreTool,
  isLoadingPermissions,
  drawingsGroupsPaged,
  selectedDrawingCodes,
  setSelectedDrawingCodes,
  drawingsHasNext,
  drawingsFetchingNext,
  drawingsFetchNext,
  isFieldInvalid: _isFieldInvalid,
  inputErrorClass,
  renderValidationError,
  clearValidationError,
  onCreateAddAnother,
  onCreateNow,
}: ConfigureSingleProcoreProps) {
  if (configureKey === "single:procore-location") {
    return (
      <div className="space-y-4">
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
              value={selectedProcoreLocation}
              onChange={(v) => {
                setSelectedProcoreLocation(v as string | undefined);
                clearValidationError("procoreLocation");
              }}
              placeholder={
                !selectedProjectId
                  ? "Select a project to enable"
                  : !projectIsConnected
                    ? "Project not connected to Procore"
                    : "Search or select location"
              }
              className="w-full"
              loading={isLoadingLocations}
              inputClassName={inputErrorClass("procoreLocation")}
              usePortal
            />
          </div>
          {renderValidationError("procoreLocation")}
        </div>
        <div className="flex items-center gap-2 justify-end pt-4">
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

  if (configureKey === "single:procore-tool") {
    return (
      <div className="space-y-4">
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
        <div>
          <label
            className={`${!selectedProjectId || !projectIsConnected ? "pointer-events-none opacity-50" : ""} block text-sm font-medium text-gray-700 mb-1`}
          >
            Tool
          </label>
          <div
            className={`${!selectedProjectId || !projectIsConnected ? "pointer-events-none opacity-50" : ""}`}
          >
            <SearchComboBox
              options={procoreToolOptions}
              value={selectedProcoreTool}
              onChange={(v) => {
                setSelectedProcoreTool(v as string | undefined);
                clearValidationError("procoreTool");
              }}
              placeholder={
                !selectedProjectId
                  ? "Select a project to enable"
                  : !projectIsConnected
                    ? "Project not connected to Procore"
                    : procoreToolOptions.length === 0
                      ? "No tools available"
                      : "Search or select tool"
              }
              className="w-full"
              loading={isLoadingPermissions}
              inputClassName={inputErrorClass("procoreTool")}
              usePortal
            />
          </div>
          {renderValidationError("procoreTool")}
        </div>
        <div className="flex items-center gap-2 justify-end pt-4">
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

  // single:procore-drawing
  return (
    <div className="space-y-4">
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
      <div>
        <label
          className={`${!selectedProjectId || !projectIsConnected ? "pointer-events-none opacity-50" : ""} block text-sm font-medium text-gray-700 mb-1`}
        >
          Drawing
        </label>
        <div
          className={`${!selectedProjectId || !projectIsConnected ? "pointer-events-none opacity-50" : ""}`}
        >
          <SearchComboBox
            groups={drawingsGroupsPaged}
            value={selectedDrawingCodes ? selectedDrawingCodes[0] : undefined}
            onChange={(v) => {
              setSelectedDrawingCodes(v ? [v as string] : undefined);
              clearValidationError("drawing");
            }}
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
      <div className="flex items-center gap-2 justify-end pt-4">
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
