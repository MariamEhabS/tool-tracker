import { useMemo, useState, useEffect } from "react";
import {
  createFileRoute,
  useNavigate,
  useRouterState,
  ErrorComponentProps,
} from "@tanstack/react-router";
import { InlineError } from "@/components/error";
import { parseHttpError } from "@/utils/httpErrors";
import { logApiError } from "@/utils/rollbar";
import { getStoredUser } from "@/utils/getStoredUser";
import Button from "@components/ui/Button";
import Badge from "@components/ui/Badge";
import RowTypeIcon from "@components/ui/Icon";
import ItemComboBox from "@components/combobox/detail/ItemComboBox";
import DeleteModal from "@components/modal/taliho/DeleteModal";
import Modal from "@components/modal/Modal";
import procoreIcon from "@assets/images/procore-icon.png";
import { navigateToReturn } from "@/lib/urlState";
import {
  useSingleProject,
  patchProject,
  deleteProjectAsync,
  projectKeys,
} from "@/api/endpoints/projects";
import { addJob } from "@/utils/localStorage-jobs";
import { queryClient } from "@/api";
import { toast } from "react-hot-toast";
import { useCompany, useProcoreStatus } from "@/api/endpoints/company";
import {
  useProcoreProjectsSearch,
  type ProcoreProject,
} from "@/api/endpoints/procore";
import { canDelete, canModify } from "@/utils/permissions";
import { projectStatusBadgeVariant } from "@/utils/badge-helpers";
import type { ProjectDataType } from "@/components/project/types";
import ProjectQRCodesTab from "@/components/project/ProjectQRCodesTab";
import ProjectGroupsTab from "@/components/project/ProjectGroupsTab";

function ProjectErrorComponent({ error, reset }: ErrorComponentProps) {
  const errorInfo = parseHttpError(error);

  // Log to Rollbar on mount (skip 404s - expected navigation errors)
  useEffect(() => {
    if (errorInfo.statusCode !== 404) {
      logApiError(error, "route-error-project", {
        pathname: window.location.pathname,
        statusCode: errorInfo.statusCode,
      });
    }
  }, [error, errorInfo.statusCode]);

  if (errorInfo.statusCode === 404) {
    return (
      <InlineError
        title="Project Not Found"
        message="The project you're looking for doesn't exist or has been deleted."
        icon="not-found"
        goBackTo="/projects"
        goBackLabel="Back to Projects"
      />
    );
  }

  if (errorInfo.statusCode === 403) {
    return (
      <InlineError
        title="Access Denied"
        message="You don't have permission to view this project."
        icon="access-denied"
        goBackTo="/projects"
        goBackLabel="Back to Projects"
      />
    );
  }

  // For server errors and other unhandled cases, show retry option
  return (
    <InlineError
      title={errorInfo.title}
      message={errorInfo.message}
      icon="server-error"
      onRetry={reset}
    />
  );
}

export const Route = createFileRoute("/project/$projectId")({
  component: RouteComponent,
  errorComponent: ProjectErrorComponent,
});

function projectStatusLabel(s?: string) {
  if (!s) return "";
  return s === "on-hold" ? "On Hold" : s.charAt(0).toUpperCase() + s.slice(1);
}

function RouteComponent() {
  const navigate = useNavigate();
  const { projectId: projectId } = Route.useParams();

  const [activeTab, setActiveTab] = useState<"quick" | "groups">("quick");

  const user = useMemo(() => getStoredUser(), []);
  const userCanDelete = canDelete(user);
  const userCanModify = canModify(user);
  const companyId = String((user as { companyId?: string })?.companyId || "");
  const {
    data: projectData,
    isLoading: projectLoading,
    error: projectError,
  } = useSingleProject(companyId, projectId);
  const companyRes = useCompany(companyId);

  // Bulk action toggles (passed down to tabs)
  const [bulkActions, setbulkActions] = useState(false);
  const [bulkActionsGroup, setbulkActionsGroup] = useState(false);

  // Project-level Modals
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);

  // Edit Project Modal state
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
  // Edit modal accordion state
  const [isProcoreSectionExpanded, setIsProcoreSectionExpanded] =
    useState(false);

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
    showEditProjectModal && !!procoreStatus?.isConnected,
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

  // Initialize edit form when modal opens
  useEffect(() => {
    if (showEditProjectModal && projectData?.data) {
      const data = projectData.data as ProjectDataType;
      setEditProjectName(data.projectName || "");
      setEditClientName(data.clientName || "");
      setEditProjectAddress(data.projectAddress || "");
      setEditProjectCity(data.projectCity || "");
      setEditProjectState(data.projectState || "");
      setEditProjectZIP(data.projectZIP || "");
      setEditProjectStatus(data.projectStatus || data.status || "active");
      setEditProcoreProjectID(data.procoreProjectID || "");
      setEditProcoreCompanyID(data.procoreCompanyID || "");
      setProcoreSearchQuery("");
    }
  }, [showEditProjectModal, projectData]);

  // Auto-open Edit Project modal when ?edit query is present
  const { location } = useRouterState();
  useEffect(() => {
    try {
      // Ensure location.search is a string
      const search = typeof location.search === "string" ? location.search : "";
      const params = new URLSearchParams(search);
      if (params.get("edit")) {
        setShowEditProjectModal(true);
      }
    } catch (_e) {
      // In case location.search is not a valid query string
      // Optionally: log or ignore error
    }
  }, [location.search]);

  // Extract typed project details for use in render
  const projectDetails = projectData?.data as ProjectDataType | undefined;

  // Check if project is archived
  const isProjectArchived = useMemo(() => {
    const status = projectDetails?.projectStatus?.toLowerCase();
    return status === "archived";
  }, [projectDetails?.projectStatus]);

  // Check if project has a valid Procore connection
  // TODO: REIMPLEMENT FETCH FROM PROCORE WITH PROJECT CONTEXT
  // const hasProcoreConnection = Boolean(
  //   projectDetails?.procoreCompanyID && projectDetails?.procoreProjectID,
  // );

  // Show loading state while fetching project data
  if (projectLoading) {
    return (
      <main className="h-full min-h-0 flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading project...</p>
        </div>
      </main>
    );
  }

  // Show 404 error if project not found
  if (projectError || (!projectLoading && !projectData?.data)) {
    return (
      <InlineError
        title="Project Not Found"
        message="This project may have been deleted or you may have an incorrect URL."
        icon="not-found"
        goBackTo="/projects"
        goBackLabel="Back to Projects"
      />
    );
  }

  return (
    <main className="h-full min-h-0 flex flex-col p-8">
      {/* Project-level Modals */}
      <Modal
        open={showEditProjectModal}
        onClose={() => {
          setShowEditProjectModal(false);
          setIsProcoreSectionExpanded(false);
        }}
        title="Edit Project"
        subtitle={<span>Update project details and Procore integration.</span>}
        size="lg"
        scrollable
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowEditProjectModal(false);
                setIsProcoreSectionExpanded(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={
                isSavingProject ||
                !editProjectName.trim() ||
                !editProjectCity.trim() ||
                !editProjectState.trim() ||
                !editProjectZIP.trim()
              }
              onClick={async () => {
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
                  toast.success("Project updated successfully");
                  setShowEditProjectModal(false);
                  setIsProcoreSectionExpanded(false);
                  navigateToReturn(
                    navigate,
                    location.search as unknown as string,
                  );
                } catch (e: unknown) {
                  const err = e as {
                    response?: { data?: { message?: string } };
                    message?: string;
                  };
                  toast.error(
                    err?.response?.data?.message ||
                      err?.message ||
                      "Failed to update project",
                  );
                } finally {
                  setIsSavingProject(false);
                }
              }}
            >
              {isSavingProject ? "Saving\u2026" : "Save Changes"}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Procore Integration Section - Collapsible Accordion */}
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
                <span className="text-gray-400 text-xs font-normal ml-1">
                  (Optional)
                </span>
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

                          {/* Default Message */}
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
                      Connect Procore in Settings &rarr; Integrations to link
                      projects.
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
                Project Name
              </label>
              <input
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
                value={editProjectAddress}
                onChange={(e) => setEditProjectAddress(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                placeholder="123 Main St"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  value={editProjectCity}
                  onChange={(e) => setEditProjectCity(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                  placeholder="Anytown"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <input
                  value={editProjectState}
                  onChange={(e) => setEditProjectState(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                  placeholder="CA"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ZIP
                </label>
                <input
                  value={editProjectZIP}
                  onChange={(e) => setEditProjectZIP(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                  placeholder="90001"
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
                <option value="on-hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>
      <DeleteModal
        open={showDeleteProjectModal}
        subjectLabel="project"
        title="Delete Project"
        selectedCount={1}
        bodyMessage="This will permanently delete this project and all associated groups, QR codes, folders, documents, and Procore item links. This action cannot be undone."
        onClose={() => setShowDeleteProjectModal(false)}
        onConfirm={async () => {
          if (!companyId) {
            toast.error("Session expired. Please log in again.");
            return;
          }
          try {
            const { jobId } = await deleteProjectAsync(companyId, projectId);
            addJob({
              jobId,
              status: "pending",
              progress: 0,
              total: 1,
              type: "bulk-project-delete",
            });
            toast.success("Deletion started");
            setShowDeleteProjectModal(false);
            navigate({ to: "/projects" });
          } catch (e) {
            logApiError(e, "delete-project", { projectId });
            toast.error("Failed to delete project.");
          }
        }}
      />

      <div className="flex flex-col h-full">
        {/* Project Header */}
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <RowTypeIcon
                type={
                  (projectDetails?.projectStatus ?? "active") as
                    | "active"
                    | "completed"
                    | "on-hold"
                    | "archived"
                }
                className="h-6 w-6"
              />
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl md:text-2xl font-semibold text-gray-800">
                    {projectDetails?.projectName ?? "Project"}
                  </h2>
                  {projectData?.data && projectDetails?.projectStatus ? (
                    <Badge
                      variant={projectStatusBadgeVariant(
                        (projectDetails?.projectStatus ?? "active") as
                          | "active"
                          | "completed"
                          | "on-hold"
                          | "archived"
                          | "others",
                      )}
                      shape="full"
                    >
                      {projectStatusLabel(
                        (projectDetails?.projectStatus ?? "active") as
                          | "active"
                          | "completed"
                          | "on-hold"
                          | "archived"
                          | "others",
                      )}
                    </Badge>
                  ) : null}
                  {projectData?.data &&
                    projectDetails?.procoreCompanyID &&
                    projectDetails?.procoreProjectID && (
                      <img
                        src={procoreIcon}
                        alt="Procore"
                        className="h-3 w-3"
                      />
                    )}
                </div>
                <p className="text-xs md:text-sm text-gray-600 mt-1">
                  {projectData
                    ? `${projectDetails?.projectAddress}, ${projectDetails?.projectCity}, ${projectDetails?.projectState} ${projectDetails?.projectZIP}`
                    : ""}
                </p>
                <p className="text-xs md:text-sm text-gray-600">
                  {projectDetails?.clientName ?? ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Settings combobox (left of Bulk Actions) */}
              <ItemComboBox
                buttonVariant="secondary"
                buttonLabel="Settings"
                buttonLeftIconClass="bx bx-cog text-gray-600"
                buttonRightIconClass="bx bx-chevron-down text-gray-400"
                align="right"
                menuWidthClassName="w-48"
                options={[
                  ...(userCanModify
                    ? [
                        {
                          label: "Edit Project",
                          value: "edit",
                          iconClass: "bx bx-pencil",
                          onSelect: () => setShowEditProjectModal(true),
                        },
                      ]
                    : []),
                  ...(userCanDelete
                    ? [
                        {
                          label: "Delete Project",
                          value: "delete",
                          iconClass: "bx bx-trash",
                          onSelect: () => setShowDeleteProjectModal(true),
                        },
                      ]
                    : []),
                ]}
              />
              {/* TODO: REIMPLEMENT FETCH FROM PROCORE WITH PROJECT CONTEXT */}
              {/* {hasProcoreConnection && (
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={
                    <img src={procoreIcon} alt="Procore" className="h-4 w-4" />
                  }
                  onClick={() =>
                    navigate({
                      to: "/procore/fetch",
                      search: {
                        selectedIds: undefined,
                        groupId: undefined,
                        projectId,
                        returnTo: "/project/$projectId",
                        returnParams: { projectId },
                      },
                    })
                  }
                >
                  Fetch from Procore
                </Button>
              )} */}
              <Button
                variant="secondary"
                leftIconClass={`bx ${(activeTab === "quick" ? bulkActions : bulkActionsGroup) ? "bx-x" : "bx-grid-alt"} text-gray-500`}
                onClick={() => {
                  if (activeTab === "quick") {
                    setbulkActions((g) => !g);
                  } else {
                    setbulkActionsGroup((g) => !g);
                  }
                }}
              >
                {(activeTab === "quick" ? bulkActions : bulkActionsGroup)
                  ? "Cancel"
                  : "Bulk Actions"}
              </Button>
              {/* Create button (right of Bulk Actions) */}
              {userCanModify && (
                <Button
                  variant="primary"
                  onClick={() => {
                    if (activeTab === "quick")
                      navigate({ to: "/create-qr", search: { projectId } });
                    else
                      navigate({
                        to: "/create-qr",
                        search: { projectId, tab: "bulk", groupMode: "new" },
                      });
                  }}
                  disabled={isProjectArchived}
                  title={
                    isProjectArchived
                      ? "This project has been archived"
                      : undefined
                  }
                >
                  {activeTab === "quick" ? "Create QR Code" : "Create Group"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="relative gap-6 min-h-0 grid grid-cols-12 h-full">
          {/* Left vertical tabs */}
          <aside className="col-span-2 h-full">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
              Sections
            </div>
            <nav className="space-y-2">
              <Button
                type="button"
                className="w-full justify-start"
                variant={activeTab === "quick" ? "tabActive" : "tab"}
                leftIconClass="bx bx-qr-scan"
                onClick={() => setActiveTab("quick")}
              >
                QR Codes
              </Button>
              <Button
                type="button"
                className="w-full justify-start"
                variant={activeTab === "groups" ? "tabActive" : "tab"}
                leftIconClass="bx bx-collection"
                onClick={() => setActiveTab("groups")}
              >
                Groups
              </Button>
            </nav>
          </aside>

          {/* Right content area */}
          <div className="col-span-10 flex flex-col min-h-0 h-full">
            {activeTab === "quick" && (
              <ProjectQRCodesTab
                companyId={companyId}
                projectId={projectId}
                projectData={projectData}
                projectDetails={projectDetails}
                companyRes={companyRes}
                isProjectArchived={isProjectArchived}
                userCanDelete={userCanDelete}
                userCanModify={userCanModify}
                bulkActions={bulkActions}
                setbulkActions={setbulkActions}
              />
            )}

            {activeTab === "groups" && (
              <ProjectGroupsTab
                companyId={companyId}
                projectId={projectId}
                projectData={projectData}
                projectDetails={projectDetails}
                companyRes={companyRes}
                isProjectArchived={isProjectArchived}
                userCanDelete={userCanDelete}
                userCanModify={userCanModify}
                bulkActionsGroup={bulkActionsGroup}
                setbulkActionsGroup={setbulkActionsGroup}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
