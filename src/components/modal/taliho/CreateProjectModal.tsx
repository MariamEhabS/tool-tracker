import { useState, useMemo, useEffect } from "react";
import Button from "@components/ui/Button";
import Modal from "@components/modal/Modal";
import procoreIcon from "@assets/images/procore-icon.png";
import {
  createProject,
  patchProject,
  projectKeys,
} from "@/api/endpoints/projects";
import { queryClient } from "@/api";
import {
  useProcoreProjectsSearch,
  type ProcoreProject,
} from "@/api/endpoints/procore";
import { useProcoreStatus } from "@/api/endpoints/company";
import toast from "react-hot-toast";
import { handleModalErrorWithPermissionCheck } from "@/utils/modalErrorHandler";

export type CreateProjectModalProps = {
  open: boolean;
  onClose: () => void;
  companyId: string;
  /**
   * Subtitle displayed below the title
   */
  subtitle?: string;
  /**
   * If true, a Procore project must be selected before creating the project
   */
  requireProcoreProject?: boolean;
  /**
   * Initial project name to pre-fill the form (e.g., from AssignToModal)
   */
  initialProjectName?: string;
  /**
   * Called after the project is successfully created (and optionally linked to Procore)
   * @param newProjectId - The ID of the newly created project
   * @param procoreProjectId - The Procore project ID if one was selected
   * @param procoreCompanyId - The Procore company ID if one was selected
   */
  onSuccess?: (
    newProjectId: string,
    procoreProjectId?: string,
    procoreCompanyId?: string,
  ) => void | Promise<void>;
};

export default function CreateProjectModal(props: CreateProjectModalProps) {
  const {
    open,
    onClose,
    companyId,
    subtitle = "Enter details for your new project.",
    requireProcoreProject = false,
    initialProjectName,
    onSuccess,
  } = props;

  // Form state
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [projectAddress, setProjectAddress] = useState("");
  const [projectCity, setProjectCity] = useState("");
  const [projectState, setProjectState] = useState("");
  const [projectZIP, setProjectZIP] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Procore selection state
  const [selectedProcoreProjectId, setSelectedProcoreProjectId] = useState("");
  const [selectedProcoreCompanyId, setSelectedProcoreCompanyId] = useState("");
  const [procoreSearchQuery, setProcoreSearchQuery] = useState("");
  const [isProcoreSectionExpanded, setIsProcoreSectionExpanded] =
    useState(false);

  // Procore integration status
  const { data: procoreStatus } = useProcoreStatus(companyId);

  // Procore projects search
  const {
    data: procoreProjectsData,
    isLoading: isProcoreSearchLoading,
    isError: hasProcoreSearchError,
    error: procoreSearchError,
  } = useProcoreProjectsSearch(
    companyId,
    procoreSearchQuery,
    open && !!procoreStatus?.isConnected,
  );

  const procoreSearchErrorMessage = useMemo(() => {
    if (!hasProcoreSearchError || !procoreSearchError) return "";
    const err = procoreSearchError as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    return (
      err?.response?.data?.message ||
      err?.message ||
      "Unable to load Procore projects right now."
    );
  }, [hasProcoreSearchError, procoreSearchError]);

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

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setProjectName("");
      setClientName("");
      setProjectAddress("");
      setProjectCity("");
      setProjectState("");
      setProjectZIP("");
      setSelectedProcoreProjectId("");
      setSelectedProcoreCompanyId("");
      setProcoreSearchQuery("");
      setIsProcoreSectionExpanded(false);
      setIsCreating(false);
    }
  }, [open]);

  // Apply initial project name when modal opens (e.g., from AssignToModal)
  useEffect(() => {
    if (open && initialProjectName) {
      setProjectName(initialProjectName);
    }
  }, [open, initialProjectName]);

  const resetForm = () => {
    setProjectName("");
    setClientName("");
    setProjectAddress("");
    setProjectCity("");
    setProjectState("");
    setProjectZIP("");
    setSelectedProcoreProjectId("");
    setSelectedProcoreCompanyId("");
    setProcoreSearchQuery("");
    setIsProcoreSectionExpanded(false);
  };

  const handleCreate = async () => {
    if (!companyId) {
      toast.error("Company ID is missing");
      return;
    }

    // Get user ID from localStorage for permission validation
    // Note: The login response stores the user ID as "userId", not "_id"
    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;
    const userId = user?.userId || user?._id; // Support both field names

    if (!userId) {
      toast.error("User session not found. Please log in again.");
      return;
    }

    try {
      setIsCreating(true);

      const createResp = await createProject({
        companyId,
        userId,
        projectName: projectName.trim(),
        projectAddress: projectAddress.trim(),
        projectCity: projectCity.trim(),
        projectState: projectState.trim(),
        projectZIP: projectZIP.trim(),
        clientName: clientName.trim(),
      });
      const newProjectId = createResp.data._id;

      // 2. If Procore project selected, link it
      if (selectedProcoreProjectId && selectedProcoreCompanyId) {
        await patchProject(newProjectId, {
          companyId,
          procoreProjectID: selectedProcoreProjectId,
          procoreCompanyID: selectedProcoreCompanyId,
        });
        toast.success("Project created and linked to Procore!");
      } else {
        toast.success("Project created successfully!");
      }

      // 3. Invalidate all project queries to ensure fresh data when navigating back
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });

      // 5. Call success callback
      if (onSuccess) {
        await onSuccess(
          newProjectId,
          selectedProcoreProjectId || undefined,
          selectedProcoreCompanyId || undefined,
        );
      }

      // 6. Reset and close
      resetForm();
      onClose();
    } catch (e: unknown) {
      handleModalErrorWithPermissionCheck(e, {
        action: "create-project-modal-failed",
        permissionMessage:
          "You don't have permission to create projects. Please contact your admin to request Project Manager or Admin access.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const isFormValid = Boolean(
    projectName.trim() &&
      clientName.trim() &&
      projectAddress.trim() &&
      projectCity.trim() &&
      projectState.trim() &&
      projectZIP.trim() &&
      (!requireProcoreProject || selectedProcoreProjectId),
  );

  // Determine which required fields are missing for user feedback
  const missingFields: string[] = [];
  if (!projectName.trim()) missingFields.push("Project Name");
  if (!clientName.trim()) missingFields.push("Client Name");
  if (!projectAddress.trim()) missingFields.push("Address");
  if (!projectCity.trim()) missingFields.push("City");
  if (!projectState.trim()) missingFields.push("State");
  if (!projectZIP.trim()) missingFields.push("ZIP");
  if (requireProcoreProject && !selectedProcoreProjectId)
    missingFields.push("Procore Project");

  const selectedProject = flatProcoreProjects.find(
    (p) => String(p.id) === selectedProcoreProjectId,
  );

  return (
    <Modal
      open={open}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title="Create Project"
      subtitle={<span>{subtitle}</span>}
      size="lg"
      scrollable
      footer={
        <div className="flex flex-col w-full gap-2">
          {/* Missing fields feedback - more prominent */}
          {!isFormValid && missingFields.length > 0 && (
            <div className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-md flex items-center">
              <i className="bx bx-error-circle mr-2"></i>
              Please fill in: {missingFields.join(", ")}
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                resetForm();
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={isCreating || !isFormValid}
              onClick={handleCreate}
              title={
                !isFormValid
                  ? `Missing: ${missingFields.join(", ")}`
                  : undefined
              }
            >
              {isCreating ? "Creating…" : "Create Project"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Procore Integration Section - Collapsible */}
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
              {requireProcoreProject ? (
                <span className="text-red-500">*</span>
              ) : (
                <span className="text-gray-400 text-xs font-normal ml-1">
                  (Optional)
                </span>
              )}
              {selectedProcoreProjectId && (
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
                      selectedProcoreProjectId
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
                            {selectedProject?.name ||
                              `Procore Project #${selectedProcoreProjectId}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            {selectedProject?.procoreCompanyName ||
                              "Procore Company"}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setSelectedProcoreProjectId("");
                          setSelectedProcoreCompanyId("");
                        }}
                      >
                        Change
                      </Button>
                    </div>
                  </div>

                  {/* Search/Selection UI */}
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      !selectedProcoreProjectId
                        ? "max-h-96 opacity-100"
                        : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-600 mb-3">
                        {requireProcoreProject
                          ? "Select a Procore project to link with this Taliho project."
                          : "Optionally link this project to a Procore project to sync data."}
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
                            isProcoreSearchLoading
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
                            !isProcoreSearchLoading && hasProcoreSearchError
                              ? "max-h-24 opacity-100"
                              : "max-h-0 opacity-0"
                          }`}
                        >
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                            <i className="bx bx-error-circle mr-2"></i>
                            {procoreSearchErrorMessage}
                          </div>
                        </div>

                        {/* Projects List */}
                        <div
                          className={`overflow-hidden transition-all duration-200 ease-in-out ${
                            !isProcoreSearchLoading &&
                            !hasProcoreSearchError &&
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
                                  setSelectedProcoreProjectId(
                                    String(project.id),
                                  );
                                  setSelectedProcoreCompanyId(
                                    String(project.procoreCompanyId),
                                  );
                                  // Auto-fill project details from Procore data
                                  if (project.name) {
                                    setProjectName(
                                      project.display_name || project.name,
                                    );
                                  }
                                  if (project.address) {
                                    setProjectAddress(project.address);
                                  }
                                  if (project.city) {
                                    setProjectCity(project.city);
                                  }
                                  if (project.state_code) {
                                    setProjectState(project.state_code);
                                  }
                                  if (project.zip) {
                                    setProjectZIP(project.zip);
                                  }
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
                            !isProcoreSearchLoading &&
                            !hasProcoreSearchError &&
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

                        {/* Default Message */}
                        <div
                          className={`overflow-hidden transition-all duration-200 ease-in-out ${
                            !isProcoreSearchLoading &&
                            !hasProcoreSearchError &&
                            flatProcoreProjects.length === 0 &&
                            !procoreSearchQuery
                              ? "max-h-12 opacity-100"
                              : "max-h-0 opacity-0"
                          }`}
                        >
                          <p className="text-sm text-gray-500 text-center py-2">
                            Type to search for Procore projects.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center transition-all duration-300 ease-in-out">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <i className="bx bx-error text-amber-600"></i>
                  </div>
                  <p className="text-sm text-gray-700 font-medium">
                    Procore Not Connected
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {requireProcoreProject
                      ? "Your company needs to connect to Procore first. Please go to Settings → Integrations to connect Procore."
                      : "Connect Procore in Settings → Integrations to link projects."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Project Details Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <i className="bx bx-building-house text-gray-500"></i>
            Project Details
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
              placeholder="Enter project name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client Name <span className="text-red-500">*</span>
            </label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
              placeholder="Enter client name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              value={projectAddress}
              onChange={(e) => setProjectAddress(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
              placeholder="123 Main St"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <input
                value={projectCity}
                onChange={(e) => setProjectCity(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                placeholder="Anytown"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <input
                value={projectState}
                onChange={(e) => setProjectState(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                placeholder="CA"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ZIP <span className="text-red-500">*</span>
              </label>
              <input
                value={projectZIP}
                onChange={(e) => setProjectZIP(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                placeholder="90001"
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
