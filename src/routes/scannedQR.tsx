import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { QRCodeAggregate, SelectedCategory } from "../types";
import {
  QrKeys,
  useScannedQR,
  verifyQrPassword,
} from "../api/endpoints/scanned-qr";
import { toolsMap, toolsMapTitles } from "../utils/toolMap";
import { Categories } from "../components/categories";
import { DisplayCategoryData } from "../components/display-category-data";
import { TalihoSplashScreen } from "../components/taliho-splash-screen";
import { ToolsIcon } from "../assets/icons/ToolsIcon";
import { useDispatch, useSelector } from "react-redux";
import { updateProject } from "../store/slices/projectSlice";
import {
  updateLocalFolders,
  updateLocalFiles,
} from "../store/slices/folderFileSlice";
import { updateCompany } from "../store/slices/companySlice";
import {
  selectSelectedTool,
  setSelectedTool,
  clearSelectedTool,
} from "../store/slices/appSlice";
import { resetRecurse } from "../store/slices/folderRecurseSlice";
import { motion, AnimatePresence } from "framer-motion";
import { ChevRightIcon } from "../assets/icons/ChevRightIcon";
import useDeviceDetection from "../utils/hooks/deviceDetect";
import toast from "react-hot-toast";
import { RootState } from "../store";
import { getPunchAssigneeOptions } from "@/api/endpoints/tools";
import { CreateFormModal } from "@/components/modal/procore/CreateFormModal";
import { CreateInspectionModal } from "@/components/modal/procore/CreateInspectionModal";
import { CreatePhotoModal } from "@/components/modal/procore/CreatePhotoModal";
import { CreatePunchListModal } from "@/components/modal/procore/CreatePunchListModal";
import { UserInfoModal } from "@/components/modal/procore/UserInfoModal";
import { refreshProcoreAccessToken } from "@/api/endpoints/authentication";
import {
  getCreatorInfoFromStorage,
  saveCreatorInfoToStorage,
} from "@/utils/creatorInfo";
import { MobileInlineError } from "@/components/error";
import { parseHttpError } from "@/utils/httpErrors";
import { logQRError, logProcoreError } from "@/utils/rollbar";
import {
  trackScannedQrCode,
  setAnonymousEntryPoint,
} from "@/utils/anonymous-session";
import { useQueryClient } from "@tanstack/react-query";
import { BallInCourtPrimary } from "@/components/primary-page-components/ball-in-court-primary";

export const Route = createFileRoute("/scannedQR")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    qrcodeId: typeof search.qrcodeId === "string" ? search.qrcodeId : undefined,
  }),
});

function getPreferredArray<T>(primary?: T[], fallback?: T[]) {
  if (Array.isArray(primary) && primary.length > 0) return primary;
  if (Array.isArray(fallback) && fallback.length > 0) return fallback;
  if (Array.isArray(primary)) return primary;
  if (Array.isArray(fallback)) return fallback;
  return [];
}

function getSelectedToolTitle(selectedTool: string): string {
  if (selectedTool === "ball-in-court") return "Task Signoff";
  if (selectedTool === "taliho-local") return "Taliho Files";
  return toolsMap[selectedTool as keyof typeof toolsMap]?.title || "Taliho Files";
}

function RouteComponent() {
  const search = Route.useSearch();
  const dispatch = useDispatch();
  const device = useDeviceDetection();
  const queryClient = useQueryClient();

  const [, setSelectedCategory] = useState<SelectedCategory>(null);

  const [isFetching, setIsFetching] = useState(false);
  const [expandTools, setExpandTools] = useState<boolean>(true); // length of folders + docs is more than zero, length of tools (procore) IS zero
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showUserInfoModal, setShowUserInfoModal] = useState(false);
  const [showCreateFullScreenModal, setShowCreateFullScreenModal] =
    useState(false);
  const [selectedCreateType, setSelectedCreateType] = useState<
    "Form" | "Inspection" | "Punch List" | "Photo" | ""
  >("");
  const [creatorName, setCreatorName] = useState("");
  const [creatorCompany, setCreatorCompany] = useState("");
  const selectedTool = useSelector(selectSelectedTool);
  const createMenuWrapperRef = useRef<HTMLDivElement | null>(null);
  const [showCreateFormModal, setShowCreateFormModal] = useState(false);
  const [punchAssigneesLoading, setPunchAssigneesLoading] = useState(false);
  const [punchAssignees, setPunchAssignees] = useState<
    Array<{
      id: string | number;
      name?: string;
      login_information?: { name?: string };
    }>
  >([]);

  const procoreRefreshAttemptedCompanyRef = useRef<string | null>(null);

  const [verifyToken, setVerifyToken] = useState<string | undefined>(() => {
    try {
      const stored = sessionStorage.getItem(`qr-token:${search?.qrcodeId}`);
      return stored || undefined;
    } catch {
      return undefined;
    }
  });
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [passwordAttempts, setPasswordAttempts] = useState<number>(0);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const MAX_PASSWORD_ATTEMPTS = 5;
  const {
    data: qrData,
    isLoading,
    isPending,
    isError,
    error,
    refetch,
  } = useScannedQR(search?.qrcodeId, verifyToken, {
    refetchOnMount: "always",
  });

  const normalizedSource = useMemo(
    () =>
      (qrData?.data || {}) as Partial<{
        procoreTools: QRCodeAggregate["procoreTools"];
        folders: QRCodeAggregate["folders"];
        documents: QRCodeAggregate["documents"];
      }>,
    [qrData?.data],
  );

  const procoreTools = useMemo(
    () =>
      getPreferredArray(qrData?.procoreTools, normalizedSource?.procoreTools),
    [qrData?.procoreTools, normalizedSource?.procoreTools],
  );
  const folders = useMemo(
    () => getPreferredArray(qrData?.folders, normalizedSource?.folders),
    [qrData?.folders, normalizedSource?.folders],
  );
  const documents = useMemo(
    () => getPreferredArray(qrData?.documents, normalizedSource?.documents),
    [qrData?.documents, normalizedSource?.documents],
  );
  const ballInCourtWorkflows = qrData?.ballInCourtWorkflows ?? [];
  const companyData = useSelector((state: RootState) => state.company);
  const canEditInTaliho = Boolean(companyData?.editProcoreItemsAllowed);

  const refreshScannedQrData = useCallback(() => {
    const qrCodeId = search?.qrcodeId;
    if (!qrCodeId) return;
    const queryKey = QrKeys.detail(qrCodeId);
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.refetchQueries({ queryKey, type: "active" });
  }, [queryClient, search?.qrcodeId]);

  const shouldHideButton =
    (procoreTools?.length === 1 && !folders?.length && !documents?.length) ||
    expandTools === true;

  // Clear selected tool when QR code ID changes to prevent stale state
  useEffect(() => {
    dispatch(clearSelectedTool());
    setExpandTools(true);
  }, [search?.qrcodeId, dispatch]);

  // Track QR code scan for anonymous session (error tracking context)
  useEffect(() => {
    if (search?.qrcodeId) {
      setAnonymousEntryPoint("qr-scan");
      trackScannedQrCode(search.qrcodeId);
    }
  }, [search?.qrcodeId]);

  const getAndSetTool = useCallback(
    async (tool: keyof typeof toolsMap) => {
      try {
        setIsFetching(true);
        setSelectedCategory(tool as keyof typeof toolsMap);
        dispatch(setSelectedTool(tool as keyof typeof toolsMap));
        dispatch(resetRecurse());

        if (qrData?.data?.project) {
          dispatch(updateProject(qrData.data.project));
        }
      } catch (error) {
        logQRError(error, "scanned-qr-get-tool-failed", search?.qrcodeId);
        if ((error as { statusCode?: number })?.statusCode === 401) {
          window.location.reload();
        }
        toast.error("Something went wrong. Please try again.");
      } finally {
        setIsFetching(false);
        setExpandTools(false);
      }
    },
    [dispatch, qrData, search?.qrcodeId],
  );

  const expandToolsHandler = () => {
    setExpandTools((prev) => !prev);
  };

  const handleCreateMenuOption = (
    option: "Form" | "Inspection" | "Punch List" | "Photo",
  ) => {
    setSelectedCreateType(option);
    setShowCreateMenu(false);
    const stored = getCreatorInfoFromStorage();
    if (!stored) {
      setShowUserInfoModal(true);
      return;
    }
    setCreatorName(stored.name);
    setCreatorCompany(stored.company);
    if (option === "Form") {
      setShowCreateFormModal(true);
    } else {
      setShowCreateFullScreenModal(true);
      if (
        option === "Punch List" &&
        punchAssignees.length === 0 &&
        !punchAssigneesLoading
      ) {
        void handleOpenPunchAssignees();
      }
    }
  };

  const handleOpenPunchAssignees = useCallback(async () => {
    if (punchAssigneesLoading || punchAssignees.length > 0) return;
    try {
      setPunchAssigneesLoading(true);
      const companyId = companyData?._id ? String(companyData._id) : undefined;
      const projectId = (qrData?.data?.project?._id || "").toString();
      if (!projectId) return;
      const list = await getPunchAssigneeOptions(companyId, projectId);
      setPunchAssignees(
        Array.isArray(list)
          ? list.sort((a, b) => a.name?.localeCompare(b.name || "") || 0)
          : [],
      );
    } catch (error) {
      logProcoreError(error, "scanned-qr-fetch-punch-assignees-failed", {
        projectId: (qrData?.data?.project?._id || "").toString(),
      });
      setPunchAssignees([]);
    } finally {
      setPunchAssigneesLoading(false);
    }
  }, [
    punchAssigneesLoading,
    punchAssignees.length,
    companyData?._id,
    qrData?.data?.project?._id,
  ]);

  const openProfileForView = useCallback(() => {
    const stored = getCreatorInfoFromStorage();
    if (stored) {
      setCreatorName(stored.name);
      setCreatorCompany(stored.company);
    } else {
      setCreatorName("");
      setCreatorCompany("");
    }
    setShowUserInfoModal(true);
  }, []);

  useEffect(() => {
    if (!showCreateMenu) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (
        createMenuWrapperRef.current &&
        target &&
        !createMenuWrapperRef.current.contains(target)
      ) {
        setShowCreateMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showCreateMenu]);

  // Ensure assignees are loaded whenever the Punch List modal is opened
  useEffect(() => {
    if (
      showCreateFullScreenModal &&
      selectedCreateType === "Punch List" &&
      punchAssignees.length === 0 &&
      !punchAssigneesLoading
    ) {
      void handleOpenPunchAssignees();
    }
  }, [
    showCreateFullScreenModal,
    selectedCreateType,
    punchAssignees.length,
    punchAssigneesLoading,
    handleOpenPunchAssignees,
  ]);

  // Listen for header-triggered open
  useEffect(() => {
    const handler = () => openProfileForView();
    window.addEventListener("taliho:openUserInfoModal", handler);
    return () =>
      window.removeEventListener("taliho:openUserInfoModal", handler);
  }, [openProfileForView]);

  useEffect(() => {
    if (!qrData) return;

    if (qrData.data && qrData.data.procoreConnect) {
      setSelectedCategory(
        toolsMapTitles[
          qrData.data.procoreCategory as keyof typeof toolsMapTitles
        ],
      );
    }
  }, [qrData]);

  // Procore auth check and token refresh: trigger once per company when connected
  useEffect(() => {
    const companyId = (companyData?._id || "").toString();
    const isProcoreConnected = Boolean(companyData?.procoreAccess);
    if (!companyId || !isProcoreConnected) return;
    if (procoreRefreshAttemptedCompanyRef.current === companyId) return;
    procoreRefreshAttemptedCompanyRef.current = companyId;
    (async () => {
      try {
        await refreshProcoreAccessToken(companyId);
      } catch (error) {
        // Log but silently continue; backend will enforce refresh on subsequent API calls if needed
        logProcoreError(error, "scanned-qr-procore-refresh-failed", {
          companyId,
        });
      }
    })();
  }, [companyData?._id, companyData?.procoreAccess]);

  useEffect(() => {
    if (folders?.length > 0) {
      dispatch(updateLocalFolders({ folders }));
    }
    if (documents?.length > 0) {
      dispatch(updateLocalFiles({ files: documents }));
    }
    if (procoreTools?.length === 1 && !folders?.length && !documents?.length) {
      getAndSetTool(procoreTools[0].tool as keyof typeof toolsMap);
    }
    if (qrData?.data?.project) {
      dispatch(updateProject(qrData.data.project));
    }
    if (qrData?.data?.company) {
      const companyData = {
        ...qrData.data.company,
        procoreAccess: qrData.data.company.procoreAccess
          ? Object.fromEntries(
              Object.entries(qrData.data.company.procoreAccess!).map(
                ([key, value]) => [key, String(value)],
              ),
            )
          : null,
        procoreCompanyID: Number(qrData.data.company.procoreCompanyID),
      };
      dispatch(updateCompany({ companyData }));
    }
  }, [procoreTools, folders, documents, dispatch, getAndSetTool, qrData]);

  // Show inline error if qrcodeId is missing (instead of throwing in validateSearch)
  if (!search.qrcodeId) {
    return (
      <MobileInlineError
        title="Invalid QR Code Link"
        message="The QR code ID is missing from the URL. Please scan a valid QR code to continue."
      />
    );
  }

  // Show error state if the query failed
  if (isError) {
    const errorInfo = parseHttpError(error);
    const isServerError =
      errorInfo.statusCode !== null && errorInfo.statusCode >= 500;

    // Use custom messages for QR-specific errors
    let title = errorInfo.title;
    let message = errorInfo.message;

    if (errorInfo.statusCode === 404) {
      title = "QR Code Not Found";
      message = "This QR code may have been deleted or does not exist.";
    } else if (errorInfo.statusCode === 403) {
      title = "Access Denied";
      message =
        "You don't have permission to access this QR code. Please contact the owner.";
    } else if (isServerError) {
      title = "Server Error";
      message =
        "We're experiencing technical difficulties. Please try again in a moment.";
    }

    return (
      <MobileInlineError
        title={title}
        message={message}
        onRetry={isServerError ? () => refetch() : undefined}
      />
    );
  }

  // Show loading state while fetching (isPending is more accurate in TanStack Query v5)
  if (isPending || isLoading || !qrData) {
    return <TalihoSplashScreen />;
  }

  // Password gate UI
  const qrGate = qrData as unknown as {
    requirePassword?: boolean;
    requiredBy?: string;
  };
  if (qrGate?.requirePassword) {
    return (
      <div className="p-6 min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="w-full max-w-sm rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="text-center mb-4">
            <p className="text-lg font-semibold text-gray-900">
              Enter Password
            </p>
            {qrGate?.requiredBy ? (
              <p className="text-sm text-gray-600">
                This QR code is protected by {qrGate.requiredBy}.
              </p>
            ) : null}
          </div>
          <div className="space-y-3">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Password"
              disabled={passwordAttempts >= MAX_PASSWORD_ATTEMPTS}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {verifyError ? (
              <p className="text-sm text-red-600">{verifyError}</p>
            ) : null}
            {passwordAttempts >= MAX_PASSWORD_ATTEMPTS ? (
              <p className="text-sm text-red-600 font-semibold">
                Too many failed attempts. Please try again later.
              </p>
            ) : passwordAttempts > 0 ? (
              <p className="text-sm text-gray-600">
                {MAX_PASSWORD_ATTEMPTS - passwordAttempts} attempt
                {MAX_PASSWORD_ATTEMPTS - passwordAttempts !== 1 ? "s" : ""}{" "}
                remaining
              </p>
            ) : null}
            <button
              disabled={
                passwordAttempts >= MAX_PASSWORD_ATTEMPTS || isVerifying
              }
              className="w-full rounded-md bg-yellow-500 hover:bg-yellow-600 text-white py-2 text-sm font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
              onClick={async () => {
                if (passwordAttempts >= MAX_PASSWORD_ATTEMPTS || isVerifying) {
                  return;
                }
                setIsVerifying(true);
                setVerifyError(null);
                try {
                  const res = await verifyQrPassword(
                    String(search?.qrcodeId),
                    passwordInput,
                  );
                  if (res?.valid && res?.verifyToken) {
                    try {
                      sessionStorage.setItem(
                        `qr-token:${search?.qrcodeId}`,
                        res.verifyToken,
                      );
                    } catch {
                      // ignore storage failures
                    }
                    setVerifyToken(res.verifyToken);
                    setPasswordInput("");
                    setPasswordAttempts(0);
                    await refetch();
                  } else {
                    const newAttempts = passwordAttempts + 1;
                    setPasswordAttempts(newAttempts);
                    if (newAttempts >= MAX_PASSWORD_ATTEMPTS) {
                      setVerifyError(
                        "Too many failed attempts. Please try again later.",
                      );
                    } else {
                      setVerifyError("Invalid password. Please try again.");
                    }
                  }
                } catch (error) {
                  logQRError(
                    error,
                    "scanned-qr-verify-password-failed",
                    search?.qrcodeId,
                  );
                  const newAttempts = passwordAttempts + 1;
                  setPasswordAttempts(newAttempts);
                  if (newAttempts >= MAX_PASSWORD_ATTEMPTS) {
                    setVerifyError(
                      "Too many failed attempts. Please try again later.",
                    );
                  } else {
                    setVerifyError(
                      "Failed to verify password. Please try again.",
                    );
                  }
                } finally {
                  setIsVerifying(false);
                }
              }}
            >
              Access
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (device === "Desktop" || device === "") {
    return (
      <div className="flex flex-col  items-center place-self-center text-gray-500  absolute top-1/2 bottom-1/2  left-2 right-2   gap-6">
        <p className="text-5xl text-yellow-400 font-bold ">Oops...</p>
        <div className="flex flex-col items-center text-center">
          <p>It seems that you are not using a mobile device.</p>
          <p>For the best experience, please use a mobile device.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 px-4">
      {/* Only show project dropdown if project has address data */}
      {qrData &&
        (qrData?.data?.project?.projectAddress ||
          qrData?.project?.projectAddress) && (
          <div className="relative">
            <details className="group w-full max-w-md rounded-lg border-b border-b-gray-400 bg-white shadow-sm">
              <summary className="flex cursor-pointer items-center justify-center gap-4 px-4 py-2 text-lg font-medium text-gray-900 hover:bg-gray-50 !list-none">
                <span className="transform transition-transform group-open:rotate-90">
                  <ChevRightIcon />
                </span>
                <span>{qrData.data?.project?.projectName}</span>
              </summary>
              <div className=" absolute bg-white shadow-md border-b border-yellow-300 border-l border-r w-[98%] left-[1%] z-50 rounded-b-md px-4 pt-2 pb-2 space-y-2 text-center">
                <div className="text-gray-500 font-[200] mb-[5px]">
                  <p>
                    {qrData?.data?.project?.projectAddress ||
                      qrData?.project?.projectAddress}
                  </p>
                  <p className="-mt-[5px]">
                    {qrData?.data?.project?.projectCity ||
                      qrData?.project?.projectCity}
                    ,{" "}
                    {qrData?.data?.project?.projectState ||
                      qrData?.project?.projectState}{" "}
                    {qrData?.data?.project?.projectZIP ||
                      qrData?.project?.projectZIP}
                  </p>
                </div>
              </div>
            </details>
          </div>
        )}
      <div className="py-2 text-2xl">
        <div className="flex flex-col gap-y-2 overflow-hidden">
          <div className="flex justify-between items-center ">
            {selectedTool == "" || expandTools == true ? (
              <div className="flex flex-col   tracking-wide p-2 px-4 m-0 mx-auto my-3 underline decoration-yellow-400 underline-offset-4">
                <span className="text-2xl font-bold">
                  {qrData.data?.qrcodeName}
                </span>
              </div>
            ) : (
              <div className="flex justify-between items-center w-full mt-4 mb-4 ">
                <div
                  className={`flex items-center gap-4  tracking-wide px-4 py-2 underline decoration-yellow-400 underline-offset-4  ${!selectedTool ? "hidden" : ""}`}
                >
                  <img
                    src="./images/procore-icon.png"
                    alt="Procore Icon"
                    className={`w-[25px] h-[25px] ${qrData?.data?.procoreConnect == false || selectedTool == "taliho-local" || selectedTool == "ball-in-court" ? "hidden" : ""}`}
                  />
                  <span className="text-2xl font-semibold">
                    {getSelectedToolTitle(selectedTool)}
                  </span>
                </div>
                <button
                  className={`lex items-center gap-3 font-semibold !border !border-yellow-400 menu-button-shadow !bg-gray-100 !text-black text-xs ${shouldHideButton ? "hidden" : ""}`}
                  onClick={expandToolsHandler}
                >
                  <div className="flex justify-center items-center gap-2 text-black ">
                    <span className="text-base text-black">Menu</span>
                    <ToolsIcon />
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {isFetching ? (
        <div className="absolute top-[50%] left-[50%]">
          <div className="loader" />
        </div>
      ) : (
        <>
        <AnimatePresence>
          {!folders?.length && !documents?.length && !procoreTools?.length && !ballInCourtWorkflows.length ? (
            <p
              className={`absolute text-xl  flex justify-center top-[50%] left-[25%] `}
            >
              Nothing to See Here Yet.
            </p>
          ) : (
            <div>
              {expandTools ? (
                <motion.div
                  className="bg-gray-100 rounded-lg flex flex-col gap-6"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{
                    opacity: 1,
                    height: "auto",
                    transition: {
                      type: "spring",
                      damping: 20,
                      stiffness: 180,
                    },
                  }}
                  exit={{
                    opacity: 0,
                    height: 0,
                    transition: {
                      type: "spring",
                      damping: 20,
                      stiffness: 180,
                    },
                  }}
                >
                  <div className="grid grid-cols-2 gap-4 overflow-x-scroll p-4 ">
                    {folders?.length || documents?.length ? (
                      <button
                        className={`category-button relative text-sm border border-gray-200 bg-white px-2 rounded-md min-w-[30%] box-shadow shadow-lg py-4 ${folders?.length + documents?.length == 0 ? "!hidden" : ""}`}
                        onClick={() => {
                          dispatch(setSelectedTool("taliho-local"));
                          dispatch(resetRecurse());

                          setExpandTools(false);
                        }}
                      >
                        <div className="flex flex-row justify-center items-center gap-2 ">
                          <img
                            className="max-w-[20px]"
                            src="../../../../logo.png"
                          />
                          <span className="text-gray-700 font-semibold">
                            Files and Folders
                          </span>
                        </div>
                        {folders?.length + documents?.length > 0 && (
                          <span
                            className={`absolute -right-3 -top-3 font-semibold bg-yellow-200 text-black shadow-md border border-yellow-400 px-2 py-[4px] text-xs rounded-full`}
                          >
                            {folders?.length + documents?.length}
                          </span>
                        )}
                      </button>
                    ) : null}
                    {procoreTools?.map(({ tool, count }, i) => (
                      <Categories
                        key={i}
                        category={
                          toolsMap[tool as keyof typeof toolsMap]?.title
                        }
                        count={count}
                        className={`box-shadow shadow-lg py-4`}
                        onClick={() =>
                          getAndSetTool(tool as keyof typeof toolsMap)
                        }
                      />
                    ))}
                    {ballInCourtWorkflows.length > 0 ? (
                      <button
                        type="button"
                        className="category-button relative min-w-[30%] rounded-md border border-gray-200 bg-white px-2 py-4 text-sm font-semibold text-gray-700 shadow-lg"
                        onClick={() => {
                          dispatch(setSelectedTool("ball-in-court"));
                          setExpandTools(false);
                        }}
                      >
                        <div className="flex flex-row items-center justify-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100">
                            <i className="bx bx-shuffle text-lg text-yellow-700" />
                          </span>
                          <span className="text-gray-700 font-semibold">
                            Task Signoff
                          </span>
                        </div>
                        <span className="absolute -right-3 -top-3 rounded-full border border-yellow-400 bg-yellow-200 px-2 py-[4px] text-xs font-semibold text-black shadow-md">
                          {ballInCourtWorkflows.length}
                        </span>
                      </button>
                    ) : null}
                  </div>
                </motion.div>
              ) : (
                selectedTool === "ball-in-court" ? (
                  <BallInCourtPrimary workflows={ballInCourtWorkflows} />
                ) : (
                  <DisplayCategoryData
                    category={selectedTool as SelectedCategory}
                  />
                )
              )}
            </div>
          )}
        </AnimatePresence>

        {/* Fixed Create Button - Always visible on scannedQR route when QR is tied to a Procore project */}
        {canEditInTaliho && qrData?.data?.project?.procoreProjectID && (
          <div
            ref={createMenuWrapperRef}
            className="fixed bottom-6 right-6 z-50"
          >
            <AnimatePresence>
              {showCreateMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-16 right-0 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden min-w-[200px]"
                >
                  <div className="px-4 py-2 bg-yellow-400 border-b border-gray-200">
                    <h3 className="text-sm font-bold text-gray-900">
                      Create Procore Item
                    </h3>
                  </div>
                  <div className="py-2">
                    <button
                      onClick={() => handleCreateMenuOption("Form")}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Form
                    </button>
                    <button
                      onClick={() => handleCreateMenuOption("Inspection")}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Inspection
                    </button>
                    <button
                      onClick={() => handleCreateMenuOption("Punch List")}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Punch List
                    </button>
                    <button
                      onClick={() => handleCreateMenuOption("Photo")}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Photo
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              className="flex items-center justify-center w-14 h-14 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-full shadow-lg transition-all duration-200 hover:shadow-xl active:scale-95"
              aria-label="Create new item"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          </div>
        )}

        <UserInfoModal
          isOpen={showUserInfoModal}
          onClose={() => setShowUserInfoModal(false)}
          onSave={(info) => {
            saveCreatorInfoToStorage(info);
            setCreatorName(info.name);
            setCreatorCompany(info.company);
            setShowUserInfoModal(false);
            if (selectedCreateType === "Form") {
              setShowCreateFormModal(true);
            } else {
              setShowCreateFullScreenModal(true);
              if (
                selectedCreateType === "Punch List" &&
                punchAssignees.length === 0 &&
                !punchAssigneesLoading
              ) {
                void handleOpenPunchAssignees();
              }
            }
          }}
          initialName={creatorName}
          initialCompany={creatorCompany}
        />

        <CreateFormModal
          isOpen={showCreateFormModal}
          onClose={() => setShowCreateFormModal(false)}
          companyId={String(companyData?._id || "")}
          projectId={String(qrData?.data?.project?._id || "")}
          qrCodeId={String(search?.qrcodeId)}
          onCreated={refreshScannedQrData}
        />

        <CreateInspectionModal
          isOpen={
            showCreateFullScreenModal &&
            selectedCreateType === "Inspection"
          }
          onClose={() => setShowCreateFullScreenModal(false)}
          companyId={String(companyData?._id || "")}
          projectId={String(qrData?.data?.project?._id || "")}
          qrCodeId={String(search?.qrcodeId)}
          onCreated={refreshScannedQrData}
        />

        <CreatePhotoModal
          isOpen={
            showCreateFullScreenModal &&
            selectedCreateType === "Photo"
          }
          onClose={() => setShowCreateFullScreenModal(false)}
          companyId={String(companyData?._id || "")}
          projectId={String(qrData?.data?.project?._id || "")}
          qrCodeId={String(search?.qrcodeId)}
          onCreated={refreshScannedQrData}
        />

        {/* Full-screen Create Modal (for Punch List) */}
        <AnimatePresence>
          {showCreateFullScreenModal &&
            selectedCreateType === "Punch List" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] bg-white"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-yellow-400">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">
                        Create {selectedCreateType}
                      </h2>
                      <p className="text-xs text-gray-900/80">
                        {creatorName} — {creatorCompany}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowCreateFullScreenModal(false)}
                      className="text-gray-900 bg-white/60 hover:bg-white px-3 py-1 rounded-md text-sm font-medium"
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto p-4 space-y-3">
                    <CreatePunchListModal
                      isOpen={
                        showCreateFullScreenModal &&
                        selectedCreateType === "Punch List"
                      }
                      onClose={() => setShowCreateFullScreenModal(false)}
                      companyId={String(companyData?._id || "")}
                      projectId={String(qrData?.data?.project?._id || "")}
                      qrCodeId={String(search?.qrcodeId)}
                      assignees={punchAssignees}
                      onCreated={refreshScannedQrData}
                    />
                  </div>
                </div>
              </motion.div>
            )}
        </AnimatePresence>
        </>
      )}
    </div>
  );
}
