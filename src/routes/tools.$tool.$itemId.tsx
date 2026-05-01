import { createFileRoute } from "@tanstack/react-router";
import { RootState } from "../store";
import { useDispatch, useSelector } from "react-redux";
import { logProcoreError } from "@/utils/rollbar";
import { DrawingsPageComponent } from "../components/secondary-page-components/drawings";
import { CoordinationIssuesPageComponent } from "../components/secondary-page-components/coordination-issues";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { toolsMap } from "../utils/toolMap";
import { useQrCompanyProjectAggregation } from "../api/endpoints/aggregation";
import { updateProject } from "../store/slices/projectSlice";
import { ProcoreToolData } from "../types";
import { updateCompany } from "../store/slices/companySlice";
import { IncidentsPageComponent } from "../components/secondary-page-components/incidents";
import { ObservationsPageComponent } from "../components/secondary-page-components/observations";
import { InspectionsPageComponent } from "../components/secondary-page-components/inspections";
import { DocumentsPageComponent } from "../components/secondary-page-components/documents";
import { PhotosPageComponent } from "../components/secondary-page-components/photos";
import { PunchListsPageComponent } from "../components/secondary-page-components/punch-lists";
import { RfisPageComponent } from "../components/secondary-page-components/rfis";
import { SpecificationsPageComponent } from "../components/secondary-page-components/specifications";
import { SubmittalsPageComponent } from "../components/secondary-page-components/submittals";
import { TalihoSplashScreen } from "../components/taliho-splash-screen";
import { InstructionsPageComponent } from "../components/secondary-page-components/instructions";
import { TasksPageComponent } from "../components/secondary-page-components/tasks";
import { DirectoryPageComponent } from "../components/secondary-page-components/directory";
import { FormsPageComponent } from "../components/secondary-page-components/forms";
import { setSelectedTool } from "../store/slices/appSlice";
import useDeviceDetection from "../utils/hooks/deviceDetect";
import { MobileInlineError } from "@/components/error";

export const Route = createFileRoute("/tools/$tool/$itemId")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    qrCodeId: typeof search.qrCodeId === "string" ? search.qrCodeId : undefined,
    openEdit: typeof search.openEdit === "string" ? search.openEdit : undefined,
    created: typeof search.created === "string" ? search.created : undefined,
  }),
});

function RouteComponent() {
  const { qrCodeId, openEdit, created } = Route.useSearch();
  const device = useDeviceDetection();

  const dispatch = useDispatch();
  const { itemId, tool } = Route.useParams();
  const [error, setError] = useState<string | null>(null);
  const [localProcoreData, setLocalProcoreData] = useState<ProcoreToolData>([]);

  const projectData = useSelector((state: RootState) => state.project);
  const { data: qrProjectCompany, isLoading: isQrDataLoading } =
    useQrCompanyProjectAggregation(qrCodeId);
  // fetchedKeyRef: key (tool:itemId) we've started fetching for
  const fetchedKeyRef = useRef<string>("");
  // mirroredKeyRef: key whose Redux toolData has been mirrored into local state
  const mirroredKeyRef = useRef<string>("");
  // retryCountRef: per-key retry attempts (max 3) for backoff scheduling
  const retryCountRef = useRef<Record<string, number>>({});

  const rawToolData = useSelector((state: RootState) => {
    const selectedToolData =
      tool === "document"
        ? state.folderFile[tool as keyof RootState["folderFile"]]
        : state.procore[tool as keyof RootState["procore"]];
    return Array.isArray(selectedToolData) ? selectedToolData : [];
  });

  const toolData = useMemo(
    () =>
      (rawToolData as ProcoreToolData).filter(
        (toolItem) => String(toolItem.procoreItemID ?? "") === String(itemId),
      ),
    [rawToolData, itemId],
  );

  const fetchAndSetToolData = useCallback(async () => {
    // runs only on refresh
    try {
      if (!qrCodeId) {
        setError("Missing QR code ID");
        return;
      }
      if (!qrProjectCompany?.company?._id || !qrProjectCompany?.project?._id) {
        setError("Missing company or project data");
        return;
      }

      const response = await toolsMap[tool as keyof typeof toolsMap].fetch(
        qrCodeId,
        qrProjectCompany.company._id,
        qrProjectCompany.project._id,
        itemId,
      );

      dispatch(updateProject(qrProjectCompany.project));
      const companyData = {
        ...qrProjectCompany.company,
        procoreAccess: Object.fromEntries(
          Object.entries(qrProjectCompany.company.procoreAccess).map(
            ([key, value]) => [key, String(value)],
          ),
        ),
        procoreCompanyID: Number(qrProjectCompany.company.procoreCompanyID),
      };
      dispatch(updateCompany(companyData));
      dispatch(setSelectedTool(tool));

      const filteredResponse = (response as ProcoreToolData).filter(
        (item) => String(item.procoreItemID ?? "") === String(itemId),
      );

      setLocalProcoreData(filteredResponse);
      if (filteredResponse.length > 0) {
        setError(null);
      }
    } catch (err) {
      logProcoreError(err, "tool-data-fetch-failed", { tool, itemId });
      if (import.meta.env.DEV) {
        console.error("Error fetching tool data:", err);
      }
      setError("An error occurred while fetching tool data");
    }
  }, [qrProjectCompany, qrCodeId, itemId, tool, dispatch]);

  // Avoid accumulating retry counts across tool/item navigations.
  useEffect(() => {
    const key = `${tool}:${itemId}`;
    const retryCounts = retryCountRef.current;

    const prevFetchedKey = fetchedKeyRef.current;
    const prevMirroredKey = mirroredKeyRef.current;

    if (prevFetchedKey && prevFetchedKey !== key) {
      delete retryCounts[prevFetchedKey];
    }
    if (prevMirroredKey && prevMirroredKey !== key) {
      delete retryCounts[prevMirroredKey];
    }

    return () => {
      delete retryCounts[key];
    };
  }, [tool, itemId]);

  useEffect(() => {
    const key = `${tool}:${itemId}`;
    let activeTimer: number | undefined;
    const shouldFetch =
      !isQrDataLoading && qrProjectCompany && toolData.length === 0;
    if (shouldFetch) {
      if (fetchedKeyRef.current !== key) {
        // First time seeing this key: start fetch and reset retry count.
        fetchedKeyRef.current = key;
        retryCountRef.current[key] = 0;
        fetchAndSetToolData();
      } else {
        const attempts = retryCountRef.current[key] || 0;
        if (attempts < 3) {
          retryCountRef.current[key] = attempts + 1;
          // Retry backoff schedule per key:
          // attempt 0 -> 800ms, attempt 1 -> 1500ms, attempt 2 -> 3000ms (max 3 total)
          const delay = attempts === 0 ? 800 : attempts === 1 ? 1500 : 3000;
          activeTimer = window.setTimeout(() => {
            // Retry fetch for the same key.
            fetchAndSetToolData();
          }, delay);
        }
      }
    } else if (toolData.length > 0) {
      // Mirror Redux toolData into local state whenever it changes.
      mirroredKeyRef.current = key;
      setLocalProcoreData(toolData);
      setError(null);
    }
    return () => {
      if (activeTimer) {
        window.clearTimeout(activeTimer);
      }
    };
  }, [
    isQrDataLoading,
    qrProjectCompany,
    itemId,
    toolData,
    tool,
    fetchAndSetToolData,
  ]);

  // Show success toast after data is available and only once when navigated from creation
  useEffect(() => {
    if (created && localProcoreData && localProcoreData.length > 0) {
      try {
        window.dispatchEvent(
          new CustomEvent("taliho:created", { detail: { kind: created } }),
        );
      } catch {
        // ignore
      }
    }
  }, [created, localProcoreData]);

  // Listen for explicit refresh requests from child components (e.g., forms) to refetch tool/item
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const detail = (
          e as CustomEvent<{ tool?: string; itemId?: string | number }>
        ).detail;
        // Only refresh if event matches current tool/item (or if no filter provided)
        if (
          !detail ||
          (!detail.tool && !detail.itemId) ||
          (detail.tool === tool &&
            String(detail.itemId ?? "") === String(itemId))
        ) {
          void fetchAndSetToolData();
        }
      } catch {
        void fetchAndSetToolData();
      }
    };
    window.addEventListener("taliho:refreshToolData", handler as EventListener);
    return () =>
      window.removeEventListener(
        "taliho:refreshToolData",
        handler as EventListener,
      );
  }, [tool, itemId, fetchAndSetToolData]);

  // Show inline error if qrCodeId is missing (instead of throwing in validateSearch)
  if (!qrCodeId) {
    return (
      <MobileInlineError
        title="Invalid Tool Link"
        message="The QR code ID is missing from the URL. Please scan a valid QR code to access this tool."
      />
    );
  }

  if (error) {
    return (
      <MobileInlineError
        title="Unable to Load Tool"
        message={error}
        onRetry={() => {
          setError(null);
          void fetchAndSetToolData();
        }}
      />
    );
  }

  if (isQrDataLoading || !localProcoreData || localProcoreData.length === 0) {
    return <TalihoSplashScreen />;
  }

  if (device === "Desktop" || device === "") {
    return (
      <div className="flex flex-col  items-center place-self-center text-gray-500  absolute top-1/2 bottom-1/2  left-2 right-2   gap-6">
        <p className="text-6xl text-yellow-400 font-bold ">Oops...</p>
        <div className="flex flex-col items-center text-center">
          <p>It seems that you are not using a mobile device.</p>
          <p>
            This experience is for mobile users only. Please use a mobile device
          </p>
        </div>
      </div>
    );
  }
  const renderToolComponent = () => {
    switch (tool) {
      case "coordination-issue":
        return (
          <CoordinationIssuesPageComponent
            procoreData={localProcoreData}
            projectData={projectData}
            qrCodeId={qrCodeId}
            itemId={itemId}
          />
        );
      case "document":
        return (
          <DocumentsPageComponent
            procoreData={localProcoreData}
            projectData={projectData}
          />
        );
      case "drawing":
        return (
          <DrawingsPageComponent
            procoreData={localProcoreData}
            projectData={projectData}
          />
        );
      case "incident":
        return (
          <IncidentsPageComponent
            procoreData={localProcoreData}
            projectData={projectData}
            qrCodeId={qrCodeId}
            itemId={itemId}
          />
        );
      case "inspection":
        return (
          <InspectionsPageComponent
            procoreData={localProcoreData}
            projectData={projectData}
            qrCodeId={qrCodeId}
            itemId={itemId}
            openEditDefault={openEdit === "true"}
          />
        );
      case "instruction":
        return (
          <InstructionsPageComponent
            procoreData={localProcoreData}
            projectData={projectData}
            qrCodeId={qrCodeId}
          />
        );
      case "observation":
        return (
          <ObservationsPageComponent
            procoreData={localProcoreData}
            projectData={projectData}
            qrCodeId={qrCodeId}
            itemId={itemId}
          />
        );
      case "photo":
        return (
          <PhotosPageComponent
            procoreData={localProcoreData}
            projectData={projectData}
          />
        );
      case "punch-list":
        return (
          <PunchListsPageComponent
            procoreData={localProcoreData}
            projectData={projectData}
            qrCodeId={qrCodeId}
            itemId={itemId}
            openEditDefault={openEdit === "true"}
          />
        );
      case "rfi":
        return (
          <RfisPageComponent
            procoreData={localProcoreData}
            projectData={projectData}
            qrCodeId={qrCodeId}
            itemId={itemId}
          />
        );
      case "specification":
        return (
          <SpecificationsPageComponent
            procoreData={localProcoreData}
            projectData={projectData}
            qrCodeId={qrCodeId}
          />
        );
      case "submittal":
        return (
          <SubmittalsPageComponent
            procoreData={localProcoreData}
            projectData={projectData}
            qrCodeId={qrCodeId}
          />
        );
      case "task":
        return (
          <TasksPageComponent
            procoreData={localProcoreData}
            projectData={projectData}
            qrCodeId={qrCodeId}
          />
        );
      case "directory":
        return (
          <DirectoryPageComponent
            procoreData={localProcoreData}
            projectData={projectData}
          />
        );
      case "form":
        return (
          <FormsPageComponent
            procoreData={localProcoreData}
            projectData={projectData}
            qrCodeId={qrCodeId}
            itemId={itemId}
            openEditDefault={openEdit === "true"}
          />
        );
      default:
        return <div>Unsupported tool type: {tool}</div>;
    }
  };

  return <div>{renderToolComponent()}</div>;
}
