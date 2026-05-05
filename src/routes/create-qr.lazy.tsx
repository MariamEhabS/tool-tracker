import { useState, useMemo, useEffect, useCallback } from "react";
import {
  useNavigate,
  useRouterState,
  createLazyFileRoute,
} from "@tanstack/react-router";
import { canCreateProjects } from "@/utils/permissions";
import Button from "@/components/ui/Button";
import CreateProjectModal from "@/components/modal/taliho/CreateProjectModal";
import AssignToModal from "@/components/modal/taliho/AssignToModal";
import { toProject, toGroup } from "@/lib/paths";
import {
  readCreateQRState,
  writeCreateQRState,
  type CreateQRState,
} from "@/lib/urlState";
import { icons } from "@/lib/icons";
import { toast } from "react-hot-toast";
import { useAllProjects } from "@/api/endpoints/projects";
import { useListGroups, useSingleGroup } from "@/api/endpoints/groups";
import { useTier } from "@/lib/tiers";
import type { ProjectRow, GroupRow } from "@/components/create-qr/types";
import { getLabelByKey } from "@/components/create-qr/constants";
import CreateQRStepTracker from "@/components/create-qr/CreateQRStepTracker";
import ConfigureView from "@/components/create-qr/ConfigureView";
import { getTypeById } from "@/components/create-qr/typeCatalog";
import type { TypeId } from "@/components/create-qr/typeCatalog";
import {
  computeFlowModel,
  deriveStageLabels,
  isActiveTypeId,
  stageToCurrentStep,
  toLegacyState,
} from "@/components/create-qr/typeMapping";
import TypeSelectionView from "@/components/create-qr/TypeSelectionView";
import QuantitySelectionView from "@/components/create-qr/QuantitySelectionView";
import BulkMethodSelectionView from "@/components/create-qr/BulkMethodSelectionView";
import type { BulkMethod } from "@/components/create-qr/typeMapping";
import { readLastMode } from "@/components/create-qr/ConfigureView/toolTrackerCarryDraft";
import CreateQRv2 from "@/components/create-qr/v2/CreateQRv2";
import CreateEquipmentV2 from "@/components/create-qr/v2/CreateEquipmentV2";
import CreateArrangementV2 from "@/components/create-qr/v2/CreateArrangementV2";
import CreateVCardV2 from "@/components/create-qr/v2/CreateVCardV2";
import CreateHardHatV2 from "@/components/create-qr/v2/CreateHardHatV2";
import { getStoredUser } from "@/utils/getStoredUser";


export const Route = createLazyFileRoute("/create-qr")({
  component: CreateQR,
});

export default function CreateQR() {
  const navigate = useNavigate();
  const { location } = useRouterState();
  const [showLoading, setShowLoading] = useState<boolean>(false);

  // Get companyId for fetching projects
  const user = getStoredUser();
  const companyId = user?.companyId || "";

  // Permission check: redirect users who can't create projects/QR codes
  useEffect(() => {
    if (!canCreateProjects(user)) {
      toast.error("You don't have permission to create QR codes.");
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  // Get tier limits for QR batch creation
  const { config: tierConfig } = useTier();
  const qrBatchLimit = tierConfig.qrBatchLimit;
  const hasUnlimitedQR = qrBatchLimit === Infinity;

  // Fetch all projects for this company
  const { data: projectsData } = useAllProjects(companyId);
  const projects = useMemo(() => projectsData || [], [projectsData]);

  const urlState = useMemo(
    () => readCreateQRState(location.search),
    [location.search],
  );

  type Merged = CreateQRState & { replace?: boolean };

  const writeState = useCallback(
    (next: Partial<CreateQRState> & { replace?: boolean } = {}) => {
      if (!navigate) {
        console.error("❌ [CreateQR] navigate function is undefined");
        return;
      }

      const merged: Merged = {
        step: urlState.step,
        tab: urlState.tab,
        sub: urlState.sub,
        method: urlState.method,
        phase: urlState.phase,
        projectId: urlState.projectId ?? undefined,
        groupingId: urlState.groupingId ?? undefined,
        groupAction: urlState.groupAction ?? undefined,
        typeId: urlState.typeId ?? undefined,
      };

      const normalized: Partial<Merged> = {};
      if (Object.prototype.hasOwnProperty.call(next, "step"))
        normalized.step = (next.step ?? undefined) as Merged["step"];
      if (Object.prototype.hasOwnProperty.call(next, "tab"))
        normalized.tab = (next.tab ?? undefined) as Merged["tab"];
      if (Object.prototype.hasOwnProperty.call(next, "sub"))
        normalized.sub = (next.sub ?? undefined) as Merged["sub"];
      if (Object.prototype.hasOwnProperty.call(next, "method"))
        normalized.method = (next.method ?? undefined) as Merged["method"];
      if (Object.prototype.hasOwnProperty.call(next, "phase"))
        normalized.phase = (next.phase ?? undefined) as Merged["phase"];
      if (Object.prototype.hasOwnProperty.call(next, "projectId"))
        normalized.projectId = (next.projectId ??
          undefined) as Merged["projectId"];
      if (Object.prototype.hasOwnProperty.call(next, "groupingId"))
        normalized.groupingId = (next.groupingId ??
          undefined) as Merged["groupingId"];
      if (Object.prototype.hasOwnProperty.call(next, "groupAction"))
        normalized.groupAction = (next.groupAction ??
          undefined) as Merged["groupAction"];
      if (Object.prototype.hasOwnProperty.call(next, "typeId"))
        normalized.typeId = (next.typeId ?? undefined) as Merged["typeId"];
      if (Object.prototype.hasOwnProperty.call(next, "replace"))
        normalized.replace = next.replace as Merged["replace"];
      Object.assign(merged, normalized);

      writeCreateQRState(navigate, merged);
    },
    [
      navigate,
      urlState.step,
      urlState.tab,
      urlState.sub,
      urlState.method,
      urlState.phase,
      urlState.projectId,
      urlState.groupingId,
      urlState.groupAction,
      urlState.typeId,
    ],
  );

  const originProjectId = urlState.projectId;
  const originProjectName = useMemo(
    () =>
      originProjectId
        ? ((projects as ProjectRow[]).find((p) => p._id === originProjectId)
            ?.projectName ?? null)
        : null,
    [originProjectId, projects],
  );
  const originGroupingId = urlState.groupingId;
  const { data: originGroupData } = useSingleGroup(originGroupingId || "");
  const originGrouping = useMemo(() => {
    if (!originGroupingId)
      return null as null | {
        kind: "Group";
        name: string;
        href: string;
        iconClass: string;
      };
    const grp = originGroupData?.data;
    if (grp)
      return {
        kind: "Group" as const,
        name:
          grp.groupName || grp.arrangementName || grp.equipmentName || "Group",
        href: toGroup(originGroupingId),
        iconClass: `${grp.type === "arrangement" ? "bx bx-layer" : "bx bx-wrench"}`,
      };
    return null;
  }, [originGroupingId, originGroupData]);

  // State for "Add to Project" flow (single:taliho header)
  const [showAddToProjectModal, setShowAddToProjectModal] = useState(false);
  const [showAddToGroupModal, setShowAddToGroupModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [pendingProjectName, setPendingProjectName] = useState("");
  const [pendingGroupName, setPendingGroupName] = useState("");
  const [openAddGroupAsNew, setOpenAddGroupAsNew] = useState(false);
  const [openAddProjectAsNew, setOpenAddProjectAsNew] = useState(false);
  const [isProjectRequiredForGroupFlow, setIsProjectRequiredForGroupFlow] =
    useState(false);

  const { data: headerGroupsData } = useListGroups(
    originProjectId
      ? {
          companyId,
          projectId: originProjectId,
          per_page: 500,
          excludeArchivedProjects: true,
        }
      : { companyId: undefined },
  );

  const projectAssignOptions = useMemo(
    () =>
      (projects as ProjectRow[])
        .filter((p) => !p.archived)
        .map((p) => ({ id: p._id, name: p.projectName ?? "" }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );
  const groupAssignOptions = useMemo(() => {
    if (!originProjectId) return [];
    return ((headerGroupsData?.data as GroupRow[] | undefined) ?? [])
      .map((g) => ({
        id: g._id,
        name: g.groupName || g.arrangementName || g.equipmentName || "Group",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [headerGroupsData?.data, originProjectId]);
  const originProjectDisplayName = useMemo(() => {
    if (!originProjectId) return null;
    return (
      originProjectName ||
      (projects as ProjectRow[]).find((p) => p._id === originProjectId)
        ?.projectName ||
      "Project"
    );
  }, [originProjectId, originProjectName, projects]);

  const handleRequestAddGroupFromDropdown = useCallback(
    (mode: "new" | "existing") => {
      setOpenAddGroupAsNew(mode === "new");
      setOpenAddProjectAsNew(false);
      if (!originProjectId) {
        setIsProjectRequiredForGroupFlow(true);
        setShowAddToProjectModal(true);
        return;
      }
      setShowAddToGroupModal(true);
    },
    [originProjectId],
  );

  const handleRequestCreateProjectFromDropdown = useCallback(() => {
    setOpenAddProjectAsNew(true);
    setOpenAddGroupAsNew(false);
    setIsProjectRequiredForGroupFlow(false);
    setShowAddToProjectModal(true);
  }, []);

  useEffect(() => {
    if (originProjectId) return;
    setPendingGroupName("");
  }, [originProjectId]);

  useEffect(() => {
    if (urlState.groupAction !== "create") return;
    setOpenAddProjectAsNew(false);
    setOpenAddGroupAsNew(true);
    setIsProjectRequiredForGroupFlow(true);
    setShowAddToProjectModal(true);
    writeState({ groupAction: null, replace: true });
  }, [urlState.groupAction, writeState]);

  const resolveConfigureKey = (s: CreateQRState): string | null => {
    // Existing-group mode is explicit to avoid auto-skipping bulk type selection
    if (s.tab === "bulk" && s.groupingId && s.sub === "existing-group") {
      return "bulk:existing-group";
    }

    if (s.typeId === "tool-tracker" || s.sub === "tool-tracker") {
      const toolTrackerMode =
        s.tab === "bulk"
          ? "bulk"
          : s.tab === "single"
            ? "single"
            : readLastMode();
      return toolTrackerMode === "bulk"
        ? "bulk:tool-tracker"
        : "single:tool-tracker";
    }

    if (s.tab === "single") {
      if (s.sub === "taliho" || s.sub === "folder") return "single:taliho";
      if (s.sub === "procore-location" || s.sub === "location")
        return "single:procore-location";
      if (s.sub === "procore-tool" || s.sub === "tool")
        return "single:procore-tool";
      if (
        s.sub === "procore-drawing" ||
        s.sub === "drawing" ||
        s.sub === "drawings"
      )
        return "single:procore-drawing";
      if (s.sub === "vcard") return "single:vcard";
      if (s.sub === "url") return "single:url";
    } else if (s.tab === "bulk") {
      if (s.sub === "arrangements" || s.sub === "arrangement") {
        if (
          s.method === "procore" ||
          s.method === "drawings" ||
          s.method === "procore-drawings"
        )
          return "bulk:arrangement:procore-drawings";
        return "bulk:arrangement:assorted";
      }
      if (s.sub === "equipments" || s.sub === "equipment") {
        if (s.method === "csv" || s.method === "upload-csv")
          return "bulk:equipment:upload-csv";
        if (s.method === "manual" || s.method === "manual-entry")
          return "bulk:equipment:manual-entry";
        return "bulk:equipment:prefix-quantity";
      }
      if (s.sub === "drawings") return "bulk:arrangement:procore-drawings";
    }
    return null;
  };
  const configureKey = resolveConfigureKey(urlState);
  const labelByKey = getLabelByKey(originGrouping?.name);
  const step2Label = configureKey
    ? (labelByKey[configureKey] ?? "Type")
    : "Type";

  const flowModel = useMemo(
    () => computeFlowModel(urlState, true, configureKey !== null),
    [urlState, configureKey],
  );

  const flowTypeName = useMemo(() => {
    const card = getTypeById(flowModel.typeId);
    return card?.name ?? null;
  }, [flowModel.typeId]);

  const flowLabels = useMemo(
    () => deriveStageLabels(flowModel, flowTypeName),
    [flowModel, flowTypeName],
  );

  const currentStep = urlState.step ?? 1;

  useEffect(() => {
    const totalSteps = flowLabels.length;
    const computedStep = stageToCurrentStep(flowModel, totalSteps);
    const urlStep = urlState.step ?? 1;
    if (urlStep !== computedStep) {
      const replace = computedStep < urlStep;
      writeState({
        step: computedStep as 1 | 2 | 3,
        replace,
      });
    }
  }, [flowModel, flowLabels, urlState.step, writeState]);

  const handleTypePick = useCallback(
    (typeId: TypeId) => {
      const card = getTypeById(typeId);
      if (!card || card.comingSoon || !isActiveTypeId(typeId)) return;
      if (card.supportsBulk && card.supportsSingle) {
        // Dual-quantity: advance to Quantity step.
        writeState({
          typeId,
          tab: null,
          sub: null,
          method: null,
          phase: null,
        });
        return;
      }
      // Single-only or bulk-only: jump straight to Configure via legacy state.
      const quantity = card.supportsSingle ? "single" : "bulk";
      const legacy = toLegacyState(typeId, quantity, null);
      writeState({
        typeId,
        tab: legacy.tab ?? null,
        sub: legacy.sub ?? null,
        method: legacy.method ?? null,
        phase: null,
      });
    },
    [writeState],
  );

  const handleQuantityBack = useCallback(() => {
    // Return to Type step: clear typeId, tab, sub, method.
    writeState({
      typeId: null,
      tab: null,
      sub: null,
      method: null,
      phase: null,
    });
  }, [writeState]);

  const handleQuantityPick = useCallback(
    (quantity: "single" | "bulk") => {
      const typeId = flowModel.typeId;
      if (!typeId) return;
      if (typeId === "taliho-code" && quantity === "bulk") {
        // Taliho Code → Bulk advances to Method step, not Configure.
        writeState({
          typeId,
          tab: "bulk",
          sub: null,
          method: null,
          phase: null,
        });
        return;
      }
      const legacy = toLegacyState(typeId, quantity, null);
      writeState({
        typeId,
        tab: legacy.tab ?? null,
        sub: legacy.sub ?? null,
        method: legacy.method ?? null,
        phase: null,
      });
    },
    [flowModel.typeId, writeState],
  );

  const handleMethodBack = useCallback(() => {
    // Return to Quantity step: clear quantity by nulling tab; preserve typeId.
    writeState({
      tab: null,
      sub: null,
      method: null,
      phase: null,
    });
  }, [writeState]);

  const handleMethodPick = useCallback(
    (method: BulkMethod) => {
      const typeId = flowModel.typeId;
      if (!typeId) return;
      const legacy = toLegacyState(typeId, "bulk", method);
      writeState({
        typeId,
        tab: legacy.tab ?? null,
        sub: legacy.sub ?? null,
        method: legacy.method ?? null,
        phase: null,
      });
    },
    [flowModel.typeId, writeState],
  );

  const handleBackToTypeSelection = useCallback(() => {
    writeState({
      typeId: null,
      tab: null,
      sub: null,
      method: null,
      phase: null,
    });
  }, [writeState]);

  if (flowModel.typeId === "tool-tracker" && flowModel.stage !== "type") {
    return (
      <CreateQRv2
        onBackToTypes={handleBackToTypeSelection}
      />
    );
  }

  if (flowModel.typeId === "equipment-code" && flowModel.stage !== "type") {
    return <CreateEquipmentV2 onBackToTypes={handleBackToTypeSelection} />;
  }

  if (flowModel.typeId === "qr-arrangement" && flowModel.stage !== "type") {
    return <CreateArrangementV2 onBackToTypes={handleBackToTypeSelection} />;
  }

  if (flowModel.typeId === "vcard" && flowModel.stage !== "type") {
    return <CreateVCardV2 onBackToTypes={handleBackToTypeSelection} />;
  }

  if (flowModel.typeId === "hard-hat" && flowModel.stage !== "type") {
    return <CreateHardHatV2 onBackToTypes={handleBackToTypeSelection} />;
  }

  return (
    <div className="grow flex flex-col p-8">
      <div className="flex justify-between items-center mb-6">
        <div className="mb-4 md:mb-0">
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            <i className={`${icons.qr} text-green-600 mr-2`}></i>
            Create QR Codes
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            One centralized location to create all your QR codes
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          {originGroupingId ? (
            <div className="inline-flex items-center gap-1 px-2 py-1.5 text-sm text-gray-800 bg-white border border-gray-200 rounded-md">
              <a
                href={originGrouping?.href || toGroup(originGroupingId)}
                className="inline-flex items-center gap-2 hover:bg-gray-50 rounded"
              >
                <i
                  className={`${originGrouping?.iconClass || "bx bx-layer"} text-gray-600`}
                ></i>
                <span className="text-gray-600">Group:</span>
                <span className="font-medium text-gray-900">
                  {originGrouping?.name || "Group"}
                </span>
              </a>
              <button
                aria-label="Clear group"
                className="ml-1 text-gray-400 hover:text-gray-600 flex items-center justify-center"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPendingGroupName("");
                  writeState({ groupingId: null, replace: true });
                }}
              >
                <i className="bx bx-x text-lg"></i>
              </button>
            </div>
          ) : null}
          {!originGroupingId ? (
            <button
              type="button"
              onClick={() => {
                setOpenAddGroupAsNew(false);
                setOpenAddProjectAsNew(false);
                if (!originProjectId) {
                  setIsProjectRequiredForGroupFlow(true);
                  setShowAddToProjectModal(true);
                  return;
                }
                setShowAddToGroupModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-dashed border-gray-300 rounded-md hover:border-gray-400 hover:text-gray-800 transition-colors"
            >
              <i className="bx bx-plus text-base"></i>
              Add to Group
            </button>
          ) : null}
          {originProjectId ? (
            <div className="inline-flex items-center gap-1 px-2 py-1.5 text-sm text-gray-800 bg-white border border-gray-200 rounded-md">
              <a
                href={toProject(originProjectId)}
                className="inline-flex items-center gap-2 hover:bg-gray-50 rounded"
              >
                <i className="bx bx-folder text-gray-600"></i>
                <span className="text-gray-600">Project:</span>
                <span className="font-medium text-gray-900">
                  {originProjectDisplayName}
                </span>
              </a>
              <button
                aria-label="Clear project"
                className="ml-1 text-gray-400 hover:text-gray-600 flex items-center justify-center"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPendingGroupName("");
                  writeState({
                    projectId: null,
                    groupingId: null,
                    replace: true,
                  });
                }}
              >
                <i className="bx bx-x text-lg"></i>
              </button>
            </div>
          ) : null}
          {!originProjectId ? (
            <button
              type="button"
              onClick={() => {
                setOpenAddProjectAsNew(false);
                setIsProjectRequiredForGroupFlow(false);
                setShowAddToProjectModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-dashed border-gray-300 rounded-md hover:border-gray-400 hover:text-gray-800 transition-colors"
            >
              <i className="bx bx-plus text-base"></i>
              Add to Project
            </button>
          ) : null}
        </div>
      </div>

      <div className="grow relative w-full flex flex-col min-h-0 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.06),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(234,179,8,0.06),transparent_40%)]"
        />

        {flowModel.stage !== "type" && (
          <CreateQRStepTracker
            currentStep={currentStep}
            labels={flowLabels}
            step2Label={step2Label}
            showLoading={showLoading}
          />
        )}

        <div className="z-10 w-full flex-1 flex flex-col min-h-0 justify-start overflow-y-auto">
          {flowModel.stage === "type" ? (
            <TypeSelectionView onPick={handleTypePick} />
          ) : flowModel.stage === "quantity" && flowModel.typeId ? (
            <QuantitySelectionView
              typeId={flowModel.typeId}
              onBack={handleQuantityBack}
              onPick={handleQuantityPick}
            />
          ) : flowModel.stage === "method" ? (
            <BulkMethodSelectionView
              onBack={handleMethodBack}
              onPick={handleMethodPick}
            />
          ) : flowModel.stage === "configure" ? (
            <ConfigureView
              configureKey={configureKey}
              onBack={() => {
                // Type-first back: clear quantity/method; if single-only type,
                // or a type that skips the Quantity step, also clear typeId
                // so user returns to the Type step.
                const isSingleOnly = flowModel.typeId
                  ? getTypeById(flowModel.typeId)?.supportsBulk === false
                  : false;
                const skipsQuantityStep = flowModel.typeId === "tool-tracker";
                writeState({
                  tab: null,
                  sub: null,
                  method: null,
                  phase: null,
                  ...(isSingleOnly || skipsQuantityStep
                    ? { typeId: null }
                    : {}),
                });
              }}
              showLoading={showLoading}
              setShowLoading={setShowLoading}
              tierConfig={tierConfig}
              qrBatchLimit={qrBatchLimit}
              hasUnlimitedQR={hasUnlimitedQR}
              pendingGroupName={pendingGroupName}
              onPendingGroupNameConsumed={() => setPendingGroupName("")}
              onRequestAddGroupFromDropdown={handleRequestAddGroupFromDropdown}
              onRequestCreateProject={handleRequestCreateProjectFromDropdown}
            />
          ) : null}
        </div>

        <div className="z-0 flex-shrink-0 mt-4">
          <div className="border border-gray-200 rounded-lg bg-white/80 backdrop-blur px-6 py-3 flex items-center justify-between text-sm">
            <div className="text-gray-700">
              <span className="font-medium">Need help?</span> Learn about QR
              types and best practices.
            </div>
            <div className="flex items-center gap-3">
              <Button
                href="mailto:support@taliho.com?subject=Help%20Request"
                variant="secondary"
              >
                Contact support
              </Button>
              <Button
                href="mailto:support@taliho.com?subject=Help%20Request"
                variant="secondary"
                rightIconClass="bx bx-link-external"
              >
                Help Center
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AssignToModal
        open={showAddToProjectModal}
        onClose={() => {
          setShowAddToProjectModal(false);
          setIsProjectRequiredForGroupFlow(false);
          setOpenAddGroupAsNew(false);
          setOpenAddProjectAsNew(false);
        }}
        selectedCount={1}
        initialExistingId={originProjectId ?? undefined}
        initialMode={openAddProjectAsNew ? "new" : "existing"}
        title="Add to Project"
        subtitle={
          isProjectRequiredForGroupFlow ? (
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <i className="bx bx-error-circle" />
              Select a project before selecting or creating a group.
            </span>
          ) : (
            "Select a project for this QR code."
          )
        }
        selectedSubjectLabel="QR code"
        targetLabel="Project"
        options={projectAssignOptions}
        allowNew={true}
        existingLabel="Select existing project"
        newLabel="Create new project"
        selectLabel="Project"
        newNameLabel="New project name"
        newNamePlaceholder="Enter project name"
        confirmLabel="Select"
        onConfirm={(result) => {
          if (result.mode === "existing" && result.existingId) {
            writeState({
              projectId: result.existingId,
              groupingId:
                originProjectId && originProjectId === result.existingId
                  ? undefined
                  : null,
              replace: true,
            });
            setShowAddToProjectModal(false);
            if (isProjectRequiredForGroupFlow) {
              setShowAddToGroupModal(true);
            }
            setIsProjectRequiredForGroupFlow(false);
            setOpenAddProjectAsNew(false);
          } else if (result.mode === "new") {
            setPendingProjectName(result.newName || "");
            setShowAddToProjectModal(false);
            setShowCreateProjectModal(true);
            setOpenAddProjectAsNew(false);
          }
        }}
      />
      <AssignToModal
        open={showAddToGroupModal}
        onClose={() => {
          setShowAddToGroupModal(false);
          setOpenAddGroupAsNew(false);
        }}
        selectedCount={1}
        initialExistingId={originGroupingId ?? undefined}
        initialMode={openAddGroupAsNew ? "new" : "existing"}
        title="Add to Group"
        subtitle="Select an existing group or start a new group."
        selectedSubjectLabel="QR code"
        targetLabel="Group"
        options={groupAssignOptions}
        allowNew={true}
        existingLabel="Select existing group"
        newLabel="Create new group"
        selectLabel="Group"
        newNameLabel="New group name"
        newNamePlaceholder="Enter group name"
        confirmLabel="Select"
        onConfirm={(result) => {
          if (result.mode === "existing" && result.existingId) {
            setPendingGroupName("");
            writeState({ groupingId: result.existingId, replace: true });
          } else if (result.mode === "new") {
            const nextName = result.newName?.trim() || "";
            setPendingGroupName(nextName);
            writeState({ groupingId: null, replace: true });
          }
          setShowAddToGroupModal(false);
          setOpenAddGroupAsNew(false);
        }}
      />
      <CreateProjectModal
        open={showCreateProjectModal}
        onClose={() => {
          setShowCreateProjectModal(false);
          setPendingProjectName("");
          setIsProjectRequiredForGroupFlow(false);
          setOpenAddGroupAsNew(false);
          setOpenAddProjectAsNew(false);
        }}
        companyId={companyId}
        subtitle="Create a new project for this QR code."
        initialProjectName={pendingProjectName}
        onSuccess={(newProjectId) => {
          setShowCreateProjectModal(false);
          setPendingProjectName("");
          writeState({
            projectId: newProjectId,
            groupingId: null,
            replace: true,
          });
          if (isProjectRequiredForGroupFlow) {
            setShowAddToGroupModal(true);
          }
          setIsProjectRequiredForGroupFlow(false);
          setOpenAddProjectAsNew(false);
        }}
      />
    </div>
  );
}
