import { useEffect, useMemo, useState, useCallback } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/modal/Modal";
import procoreIcon from "@/assets/images/procore-icon.png";
import { useProcoreStatus } from "@/api/endpoints/company";
import {
  useProcoreProjectsSearch,
  type ProcoreProject,
} from "@/api/endpoints/procore";
import { patchProject, projectKeys } from "@/api/endpoints/projects";
import { QrKeys } from "@/api/endpoints/qr-codes";
import { groupsKeys } from "@/api/endpoints/groups";
import { queryClient } from "@/api";
import { toast } from "react-hot-toast";
import { handleModalError } from "@/utils/modalErrorHandler";

export type ProjectEditModalMode = "full" | "procore-only";

export type ProjectData = {
  _id: string;
  projectName?: string;
  clientName?: string;
  projectAddress?: string;
  projectCity?: string;
  projectState?: string;
  projectZIP?: string;
  projectStatus?: string;
  status?: string;
  procoreProjectID?: string;
  procoreCompanyID?: string;
};

type ProjectEditModalProps = {
  open: boolean;
  onClose: () => void;
  onSave?: (data: ProjectData) => void;
  projectId: string;
  projectData?: ProjectData | null;
  companyId: string;
  /** Mode: 'full' shows all fields, 'procore-only' shows only Procore linking */
  mode?: ProjectEditModalMode;
};

export default function ProjectEditModal({
  open,
  onClose,
  onSave,
  projectId,
  projectData,
  companyId,
  mode = "full",
}: ProjectEditModalProps) {
  // Form state
  const [editProjectName, setEditProjectName] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editProjectAddress, setEditProjectAddress] = useState("");
  const [editProjectCity, setEditProjectCity] = useState("");
  const [editProjectState, setEditProjectState] = useState("");
  const [editProjectZIP, setEditProjectZIP] = useState("");
  const [editProjectStatus, setEditProjectStatus] = useState<string>("active");
  const [editProcoreProjectID, setEditProcoreProjectID] = useState<string>("");
  const [editProcoreCompanyID, setEditProcoreCompanyID] = useState<string>("");
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [procoreSearchQuery, setProcoreSearchQuery] = useState("");
  const [isProcoreSectionExpanded, setIsProcoreSectionExpanded] = useState(
    mode === "procore-only",
  );

  // Procore integration
  const { data: procoreStatus } = useProcoreStatus(companyId);
  const {
    data: procoreProjectsData,
    isLoading: isProcoreLoading,
    isError: hasProcoreProjectsError,
    error: procoreProjectsError,
  } = useProcoreProjectsSearch(
    companyId,
    procoreSearchQuery,
    open && !!procoreStatus?.isConnected,
  );

  const procoreProjectsErrorMessage = useMemo(() => {
    if (!hasProcoreProjectsError || !procoreProjectsError) return "";
    const err = procoreProjectsError as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    return (
      err?.response?.data?.message ||
      err?.message ||
      "Unable to load Procore projects right now."
    );
  }, [hasProcoreProjectsError, procoreProjectsError]);

  // Flatten Procore projects for easier selection
  const flatProcoreProjects = useMemo(() => {
    if (!procoreProjectsData?.projects || !procoreProjectsData?.companies)
      return [];
    const result: Array<
      ProcoreProject & { procoreCompanyId: number; procoreCompanyName: string }
    > = [];
    procoreProjectsData.companies.forEach((company, idx) => {
      const projects = procoreProjectsData.projects[idx] || [];
      projects.forEach((project) => {
        result.push({
          ...project,
          procoreCompanyId: company.id,
          procoreCompanyName: company.name,
        });
      });
    });
    return result;
  }, [procoreProjectsData]);

  // Initialize form when modal opens
  useEffect(() => {
    if (open && projectData) {
      setEditProjectName(projectData.projectName || "");
      setEditClientName(projectData.clientName || "");
      setEditProjectAddress(projectData.projectAddress || "");
      setEditProjectCity(projectData.projectCity || "");
      setEditProjectState(projectData.projectState || "");
      setEditProjectZIP(projectData.projectZIP || "");
      setEditProjectStatus(
        projectData.projectStatus || projectData.status || "active",
      );
      setEditProcoreProjectID(projectData.procoreProjectID || "");
      setEditProcoreCompanyID(projectData.procoreCompanyID || "");
      setProcoreSearchQuery("");
      // Auto-expand Procore section in procore-only mode
      setIsProcoreSectionExpanded(mode === "procore-only");
    }
  }, [open, projectData, mode]);

  const handleClose = useCallback(() => {
    setIsProcoreSectionExpanded(false);
    onClose();
  }, [onClose]);

  const handleSave = useCallback(async () => {
    try {
      setIsSavingProject(true);
      const normalized =
        editProjectStatus === "archived" ||
        editProjectStatus === "active" ||
        editProjectStatus === "completed" ||
        editProjectStatus === "on-hold"
          ? editProjectStatus
          : undefined;

      await patchProject(projectId, {
        companyId,
        projectName: editProjectName.trim() || undefined,
        projectAddress: editProjectAddress.trim() || undefined,
        projectCity: editProjectCity.trim() || undefined,
        projectState: editProjectState.trim() || undefined,
        projectZIP: editProjectZIP.trim() || undefined,
        clientName: editClientName.trim() || undefined,
        projectStatus: normalized,
        archived: normalized === "archived",
        procoreProjectID: editProcoreProjectID || undefined,
        procoreCompanyID: editProcoreCompanyID || undefined,
      });

      await queryClient.invalidateQueries({
        queryKey: projectKeys.all,
      });
      void queryClient.invalidateQueries({ queryKey: QrKeys.all });
      void queryClient.invalidateQueries({ queryKey: groupsKeys.all });

      toast.success("Project updated successfully");

      const updatedData: ProjectData = {
        _id: projectId,
        projectName: editProjectName.trim(),
        clientName: editClientName.trim(),
        projectAddress: editProjectAddress.trim(),
        projectCity: editProjectCity.trim(),
        projectState: editProjectState.trim(),
        projectZIP: editProjectZIP.trim(),
        projectStatus: normalized,
        procoreProjectID: editProcoreProjectID,
        procoreCompanyID: editProcoreCompanyID,
      };

      onSave?.(updatedData);
      handleClose();
    } catch (e: unknown) {
      handleModalError(e, { action: "edit-project-modal-failed" });
    } finally {
      setIsSavingProject(false);
    }
  }, [
    projectId,
    companyId,
    editProjectName,
    editClientName,
    editProjectAddress,
    editProjectCity,
    editProjectState,
    editProjectZIP,
    editProjectStatus,
    editProcoreProjectID,
    editProcoreCompanyID,
    onSave,
    handleClose,
  ]);

  const canSubmit = useMemo(() => {
    if (mode === "procore-only") {
      // In procore-only mode, just need to have made a change
      return true;
    }
    // In full mode, require essential fields
    return (
      editProjectName.trim() &&
      editProjectCity.trim() &&
      editProjectState.trim() &&
      editProjectZIP.trim()
    );
  }, [
    mode,
    editProjectName,
    editProjectCity,
    editProjectState,
    editProjectZIP,
  ]);

  const title = mode === "procore-only" ? "Connect Procore" : "Edit Project";
  const subtitle =
    mode === "procore-only"
      ? "Link this project to a Procore project to access locations, tools, and drawings."
      : "Update project details and Procore integration.";

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      subtitle={<span>{subtitle}</span>}
      size="lg"
      scrollable
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={isSavingProject || !canSubmit}
            onClick={handleSave}
          >
            {isSavingProject ? "Saving..." : "Save Changes"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Procore Integration Section */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() =>
              setIsProcoreSectionExpanded(!isProcoreSectionExpanded)
            }
            className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <img src={procoreIcon} alt="Procore" className="w-4 h-4" />
              Link to Procore Project
              {mode === "full" && (
                <span className="text-gray-400 text-xs font-normal ml-1">
                  (Optional)
                </span>
              )}
              {editProcoreProjectID && editProcoreProjectID !== "none" && (
                <span className="text-green-600 text-xs font-normal ml-1 flex items-center gap-1">
                  <i className="bx bx-check-circle"></i>
                  Linked
                </span>
              )}
            </h3>
            <i
              className={`bx bx-chevron-down text-gray-500 text-lg transition-transform duration-200 ${
                isProcoreSectionExpanded ? "rotate-180" : ""
              }`}
            ></i>
          </button>

          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              isProcoreSectionExpanded
                ? "max-h-[500px] opacity-100"
                : "max-h-0 opacity-0"
            }`}
          >
            <div className="p-4 space-y-4">
              {procoreStatus?.isConnected ? (
                <div className="transition-all duration-300 ease-in-out">
                  {/* Selected Project Display */}
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      editProcoreProjectID && editProcoreProjectID !== "none"
                        ? "max-h-24 opacity-100"
                        : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <i className="bx bx-check text-green-600"></i>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {flatProcoreProjects.find(
                              (p) => String(p.id) === editProcoreProjectID,
                            )?.name ||
                              `Procore Project #${editProcoreProjectID}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            Linked to Procore
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setEditProcoreProjectID("");
                          setEditProcoreCompanyID("");
                        }}
                      >
                        Change
                      </Button>
                    </div>
                  </div>

                  {/* Search/Selection UI */}
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      !editProcoreProjectID || editProcoreProjectID === "none"
                        ? "max-h-96 opacity-100"
                        : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-600 mb-3">
                        Optionally link this project to a Procore project to
                        sync data.
                      </p>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={procoreSearchQuery}
                          onChange={(e) =>
                            setProcoreSearchQuery(e.target.value)
                          }
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 text-sm"
                          placeholder="Search Procore projects..."
                        />
                        {/* Loading State */}
                        <div
                          className={`overflow-hidden transition-all duration-200 ease-in-out ${
                            isProcoreLoading
                              ? "max-h-16 opacity-100"
                              : "max-h-0 opacity-0"
                          }`}
                        >
                          <div className="flex items-center justify-center py-4">
                            <i className="bx bx-loader-alt bx-spin text-orange-500 text-xl"></i>
                            <span className="ml-2 text-sm text-gray-500">
                              Loading projects...
                            </span>
                          </div>
                        </div>

                        {/* Error State */}
                        <div
                          className={`overflow-hidden transition-all duration-200 ease-in-out ${
                            !isProcoreLoading && hasProcoreProjectsError
                              ? "max-h-24 opacity-100"
                              : "max-h-0 opacity-0"
                          }`}
                        >
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                            <i className="bx bx-error-circle mr-2"></i>
                            {procoreProjectsErrorMessage}
                          </div>
                        </div>

                        {/* Projects List */}
                        <div
                          className={`overflow-hidden transition-all duration-200 ease-in-out ${
                            !isProcoreLoading &&
                            !hasProcoreProjectsError &&
                            flatProcoreProjects.length > 0
                              ? "max-h-40 opacity-100"
                              : "max-h-0 opacity-0"
                          }`}
                        >
                          <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
                            {flatProcoreProjects.map((project) => (
                              <button
                                key={`${project.procoreCompanyId}-${project.id}`}
                                type="button"
                                onClick={() => {
                                  setEditProcoreProjectID(String(project.id));
                                  setEditProcoreCompanyID(
                                    String(project.procoreCompanyId),
                                  );
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-orange-50 transition-colors"
                              >
                                <p className="text-sm font-medium text-gray-900">
                                  {project.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {project.procoreCompanyName}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* No Results Message */}
                        <div
                          className={`overflow-hidden transition-all duration-200 ease-in-out ${
                            !isProcoreLoading &&
                            !hasProcoreProjectsError &&
                            flatProcoreProjects.length === 0 &&
                            procoreSearchQuery
                              ? "max-h-12 opacity-100"
                              : "max-h-0 opacity-0"
                          }`}
                        >
                          <p className="text-sm text-gray-500 text-center py-2">
                            No Procore projects found. Try a different search
                            term.
                          </p>
                        </div>

                        {/* Initial State - No Search */}
                        <div
                          className={`overflow-hidden transition-all duration-200 ease-in-out ${
                            !isProcoreLoading &&
                            !hasProcoreProjectsError &&
                            flatProcoreProjects.length === 0 &&
                            !procoreSearchQuery
                              ? "max-h-12 opacity-100"
                              : "max-h-0 opacity-0"
                          }`}
                        >
                          <p className="text-sm text-gray-500 text-center py-2">
                            Start typing to search Procore projects.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <i className="bx bx-info-circle text-amber-500 text-xl mt-0.5"></i>
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        Procore Not Connected
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        Your company is not connected to Procore. Contact your
                        administrator to set up the integration.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Project Details Section - Only in full mode */}
        {mode === "full" && (
          <>
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Project Details
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                  placeholder="Enter project name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Name
                </label>
                <input
                  type="text"
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                  placeholder="Enter client name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={editProjectAddress}
                  onChange={(e) => setEditProjectAddress(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                  placeholder="Enter address"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editProjectCity}
                    onChange={(e) => setEditProjectCity(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editProjectState}
                    onChange={(e) => setEditProjectState(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                    placeholder="State"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ZIP <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editProjectZIP}
                    onChange={(e) => setEditProjectZIP(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                    placeholder="ZIP"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={editProjectStatus}
                  onChange={(e) => setEditProjectStatus(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on-hold">On Hold</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
