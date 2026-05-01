import { useState, useEffect, useRef, useCallback } from "react";
import { ProcoreToolData, Project } from "../../types";
import { formatProcoreTime } from "../../utils/dateFormatter";
import { getPriorityColor } from "../../utils/getPriorityColor";
import { getStatusColor } from "../../utils/getStatusColor";
import { useDispatch, useSelector } from "react-redux";
import { clearSelectedTool } from "../../store/slices/appSlice";
import { TilesIcon } from "../../assets/icons/TilesIcon";
import { ChevLeftIcon } from "../../assets/icons/ChevLeftIcon";
import { ChevRightIcon } from "../../assets/icons/ChevRightIcon";
import { VerticalAttachmentSection } from "../vertical-attachment-section";
import { OpenOutsideIcon } from "../../assets/icons/OpenOutsideIcon";
import { RootState } from "@/store";
import { CloseIcon } from "../../assets/icons/CloseIcon";
import {
  getPunchLists,
  updatePunchListAssignmentStatus,
  updatePunchListItem,
  type PunchListStatus,
} from "../../api/endpoints/tools";
import { ChevDownIcon } from "@/assets/icons/ChevDownIcon";
import { UserInfoModal } from "@/components/modal/procore/UserInfoModal";
import {
  getCreatorInfoFromStorage,
  saveCreatorInfoToStorage,
} from "@/utils/creatorInfo";

interface PunchListsPageComponentProps {
  procoreData: ProcoreToolData;
  projectData: Project;
  qrCodeId: string;
  itemId: string;
  openEditDefault?: boolean;
}

export const PunchListsPageComponent = ({
  procoreData,
  qrCodeId,
  projectData,
  itemId,
  openEditDefault = false,
}: PunchListsPageComponentProps) => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("documents");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(openEditDefault);
  const [contentsUpdated] = useState(false);
  const [punchListItems, setPunchListItems] = useState<ProcoreToolData>([]);
  const companyData = useSelector((state: RootState) => state.company);
  const canEditInTaliho = Boolean(companyData?.editProcoreItemsAllowed);
  const [showUserInfoModal, setShowUserInfoModal] = useState(false);
  const [creatorName, setCreatorName] = useState("");
  const [creatorCompany, setCreatorCompany] = useState("");

  const [openStatusKey, setOpenStatusKey] = useState<string | null>(null);
  const statusOptions: { label: string; value: PunchListStatus }[] = [
    { label: "Work Required", value: "unresolved" },
    { label: "Work Not Accepted", value: "work_not_accepted" },
    { label: "Ready for Review", value: "ready_for_review" },
    { label: "Resolved", value: "resolved" },
  ];
  const [assignmentStatusMap, setAssignmentStatusMap] = useState<
    Record<string, PunchListStatus>
  >({});
  const statusLabelMap: Record<PunchListStatus, string> = {
    unresolved: "Work Required",
    work_not_accepted: "Work Not Accepted",
    ready_for_review: "Ready for Review",
    resolved: "Resolved",
  };
  // Track closed/open state of each punch item locally for optimistic UI
  const [itemClosedMap, setItemClosedMap] = useState<Record<string, boolean>>(
    {},
  );
  // Track status dropdown containers for outside-click detection
  const dropdownRefs = useRef<Record<string, HTMLElement | null>>({});
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // Local typing for punch list assignments to eliminate 'any'
  type PunchListAssignment = {
    id?: string | number;
    assignment_id?: string | number;
    login_information?: { id?: string | number; name?: string };
    vendor?: { name?: string };
    name?: string;
    assignee_name?: string;
    company_name?: string;
    role?: string;
    updated_at?: string;
    formatted_status?: string;
    status?: PunchListStatus | string;
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!openStatusKey) return;
      const container = dropdownRefs.current[openStatusKey];
      const menuEl = menuRef.current;
      const target = event.target as Node;
      if (container && container.contains(target)) return;
      if (menuEl && menuEl.contains(target)) return;
      setOpenStatusKey(null);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [openStatusKey]);

  const handleStatusChange = async (
    assignment: PunchListAssignment,
    newStatus: PunchListStatus,
    key: string,
  ) => {
    const assignmentId =
      assignment?.id ??
      assignment?.assignment_id ??
      assignment?.login_information?.id ??
      key;
    try {
      // Optimistic UI update
      setAssignmentStatusMap((prev) => ({ ...prev, [key]: newStatus }));
      await updatePunchListAssignmentStatus(
        companyData?._id,
        projectData?._id,
        itemId,
        { assignmentId, status: newStatus },
      );
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error updating assignment status", error);
      }
    } finally {
      setOpenStatusKey(null);
    }
  };

  const handleCloseItem = async (k: string) => {
    const nextClosed = !itemClosedMap[k];
    setItemClosedMap((prev) => ({ ...prev, [k]: nextClosed }));
    try {
      await updatePunchListItem(companyData?._id, projectData?._id, itemId, {
        name: procoreData[Number(k)]?.name ?? "",
        closed: nextClosed,
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error closing/reopening punch list item", error);
      }
    }
  };

  const getPunchListItemsCallback = async () => {
    try {
      const response = await getPunchLists(
        qrCodeId,
        companyData._id,
        projectData._id,
        itemId,
      );
      setPunchListItems(response as ProcoreToolData);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching punch list items", error);
      }
    }
  };

  const clearAndGoBack = () => {
    dispatch(clearSelectedTool());
    window.history.go(-1);
  };

  // If openEdit is requested via prop but creator info is missing, collect it first
  useEffect(() => {
    if (!openEditDefault) return;
    const stored = getCreatorInfoFromStorage();
    const hasInfo = Boolean(
      stored &&
        typeof stored.name === "string" &&
        stored.name.trim() &&
        typeof stored.company === "string" &&
        stored.company.trim(),
    );
    if (hasInfo) {
      setIsEditModalOpen(true);
      return;
    }
    setIsEditModalOpen(false);
    setCreatorName(stored?.name || "");
    setCreatorCompany(stored?.company || "");
    setShowUserInfoModal(true);
  }, [openEditDefault]);

  const handleOpenEditInTaliho = useCallback(() => {
    const stored = getCreatorInfoFromStorage();
    const hasInfo = Boolean(
      stored &&
        typeof stored.name === "string" &&
        stored.name.trim() &&
        typeof stored.company === "string" &&
        stored.company.trim(),
    );
    if (hasInfo) {
      setIsEditModalOpen(true);
      return;
    }
    setCreatorName(stored?.name || "");
    setCreatorCompany(stored?.company || "");
    setShowUserInfoModal(true);
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="bg-white rounded-lg p-2 pt-0">
        <div className="flex justify-between mt-2">
          <button
            onClick={() => window.history.go(-1)}
            className="flex !px-3 gap-4 items-center menu-button-shadow font-semibold !border !border-yellow-400 !bg-gray-100 !text-black"
          >
            <div className="flex items-center">
              <ChevLeftIcon />
              <span className="text-xs">Punch Lists</span>
            </div>
            <img
              src="../../../images/procore-icon.png"
              alt="Procore Icon"
              className="w-[15px]"
            />
          </button>
          <button
            onClick={clearAndGoBack}
            className={`flex items-center gap-3 font-semibold !border !border-yellow-400 menu-button-shadow !bg-gray-100 !text-black text-xs ${procoreData.map((data) => (data.procoreConnect === true ? "hidden" : ""))}`}
          >
            <TilesIcon />
            <div className="flex items-center">
              <span className="text-xs">Menu</span>
              <ChevRightIcon />
            </div>
          </button>
        </div>
      </div>

      {procoreData.map((data, index) => (
        <div key={index} className="bg-white rounded-lg">
          <div className="grid grid-cols-3 m-0 mx-auto gap-2 mb-2 px-4 rounded-lg shadow-md bg-gray-100 pb-4 border border-gray-300">
            <div className="py-2 pt-4 col-span-3">
              <div className="flex items-center justify-between col-span-3">
                <div className="flex flex-col items-start gap-3">
                  <p className="text-xs text-left leading-0 text-yellow-900 font-[300]">
                    Title
                  </p>
                  <h2 className="text-2xl font-bold text-gray-900 -mt-1">
                    {data.name}
                  </h2>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start justify-self-start col-span-2">
              <span className="text-xs text-yellow-900 font-[300]">
                Location
              </span>
              <span className="inline-flex items-center -mt-[3px] rounded-full text-lg">
                {data.location?.node_name || "-"}
              </span>
            </div>

            <div className="flex flex-col items-start justify-self-start col-span-1">
              <span className="text-xs text-yellow-900 font-[300]">Status</span>
              {(() => {
                const k = String(data.id ?? index);
                const isClosed =
                  itemClosedMap[k] !== undefined
                    ? Boolean(itemClosedMap[k])
                    : data.workflow_status?.toLowerCase() === "closed";
                const badgeStatus = isClosed
                  ? "closed"
                  : data.status || data.workflow_status || "";
                const label = isClosed
                  ? "Closed"
                  : data.workflow_status?.split("_").join(" ") || "-";
                return (
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(badgeStatus)}`}
                  >
                    {label}
                  </span>
                );
              })()}
            </div>

            <div className="flex flex-col items-start justify-self-start col-span-2">
              <span className="text-xs text-yellow-900 font-[300]">Trade</span>
              <span className="inline-flex items-center -mt-[3px] rounded-full text-lg">
                {data?.trade?.name || "-"}
              </span>
            </div>
            <div className="flex flex-col items-start justify-self-start col-span-1">
              <span className="text-xs text-yellow-900 font-[300]">
                Priority
              </span>
              <span
                className={`inline-flex items-center px-4 py-0.5 rounded-full text-sm font-medium ${getPriorityColor(data.priority || "")}`}
              >
                {data.priority || "-"}
              </span>
            </div>
            <div className="flex flex-col items-start justify-self-start col-span-2">
              <span className="text-xs text-yellow-900 font-[300]">
                Due Date
              </span>
              <p
                className={`font-medium text-gray-900 mt-1 ${data.overdue == true && "text-red-600"}`}
              >
                {!data.due_date ? "-" : formatProcoreTime(data.due_date)}
              </p>
            </div>
            <div className="col-span-3 overflow-hidden">
              <h3 className="text-yellow-900 font-[300] mb-[5px] text-xs">
                Description
              </h3>
              <div className="bg-white rounded-lg p-4 min-h-[100px] max-h-[200px] overflow-scroll">
                {!data.description ? (
                  <p className="italic">No description provided.</p>
                ) : (
                  data.description
                )}
              </div>
            </div>
            <div className="flex !w-full justify-center gap-2 col-span-3 pt-3">
              <button
                onClick={async () => {
                  setIsModalOpen(!isModalOpen);
                  if (contentsUpdated) {
                    await getPunchListItemsCallback();
                  }
                }}
                className="flex justify-center w-max bg-yellow-400 px-3 py-2 rounded-md font-semibold text-gray-700"
              >
                View Assignments
              </button>
              {canEditInTaliho ? (
                <button
                  onClick={handleOpenEditInTaliho}
                  className="flex justify-center w-max bg-yellow-100 px-3 py-2 rounded-md font-semibold text-gray-700 border border-yellow-400"
                >
                  Edit in Taliho
                </button>
              ) : null}
            </div>
            {isModalOpen ? (
              <div className="fixed inset-0 z-50 bg-gray-900/70 flex items-center justify-center overflow-hidden">
                <div className="w-[95%] max-w-3xl min-h-[300px] h-[80vh] m-0 mx-auto bg-white rounded-lg shadow-lg shadow-gray-500 overflow-y-auto">
                  <div className="flex flex-col gap-2 p-4 sticky top-0 bg-white z-50 border-b border-gray-200 shadow">
                    <div className="flex justify-between items-center">
                      <h2 className="text-xl font-semibold">
                        Punch List Assignments
                      </h2>
                      <button
                        onClick={() => setIsModalOpen(false)}
                        className="text-xl font-semibold"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                    <a
                      href={`${import.meta.env.VITE_PROCORE_BASE_URL}/${projectData.procoreProjectID}/project/punch_list/${itemId}`}
                      className="flex items-center gap-2 border-2 w-max px-2 py-1 rounded-md border-yellow-400 shadow-md "
                    >
                      <img
                        src="../../../images/procore-icon.png"
                        alt="Procore Icon"
                        className="w-[20px] h-[20px]"
                      />
                      <span className="text-sm font-semibold">
                        Edit in Procore
                      </span>
                    </a>
                  </div>
                  <div className="px-4 py-4">
                    {(punchListItems.length ? punchListItems : procoreData)
                      .length > 0 ? (
                      <div className="flex flex-col gap-3">
                        {(punchListItems.length
                          ? punchListItems
                          : procoreData
                        ).map((item, i) => (
                          <div key={i + `-${item.name}`}>
                            {((
                              item as Partial<{
                                assignments?: PunchListAssignment[];
                              }>
                            ).assignments?.length ?? 0) > 0 ? (
                              <ul className="space-y-3">
                                {(
                                  (
                                    item as Partial<{
                                      assignments?: PunchListAssignment[];
                                    }>
                                  ).assignments ?? []
                                ).map(
                                  (asgn: PunchListAssignment, j: number) => (
                                    <li
                                      key={
                                        j +
                                        `-${asgn.login_information?.name}-${item.name}`
                                      }
                                      className="text-sm text-gray-700 bg-gray-50 px-4 py-3 rounded-xl border"
                                    >
                                      <span className="font-medium">
                                        {asgn?.login_information?.name ||
                                          "Assignee"}
                                      </span>
                                      {asgn?.vendor?.name ? (
                                        <span className="text-gray-500">
                                          {" "}
                                          — {asgn.vendor.name}
                                        </span>
                                      ) : null}
                                      <div className="flex justify-between items-end gap-3">
                                        {asgn?.updated_at ? (
                                          <p className="text-xs text-gray-500">
                                            Last Updated:{" "}
                                            {formatProcoreTime(asgn.updated_at)}
                                          </p>
                                        ) : null}
                                        {(() => {
                                          const k = `${j}-${asgn?.login_information?.name || asgn?.name || "assignee"}`;
                                          const sel = assignmentStatusMap[k] as
                                            | PunchListStatus
                                            | undefined;
                                          const label = sel
                                            ? statusLabelMap[sel]
                                            : asgn?.formatted_status ||
                                              asgn?.status;
                                          const cls =
                                            getStatusColor(
                                              (sel ||
                                                asgn?.status ||
                                                "") as string,
                                            ) +
                                            " w-fit flex items-center text-center mt-2 px-2 py-0.5 rounded-full text-sm font-medium";
                                          return (
                                            <p className={cls}>
                                              {" "}
                                              {String(label)
                                                .toString()
                                                .split("_")
                                                .join(" ")}{" "}
                                            </p>
                                          );
                                        })()}
                                      </div>
                                    </li>
                                  ),
                                )}
                              </ul>
                            ) : (
                              <span className="text-sm text-gray-500">
                                No assignments
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        No items available.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
            {/* Creator Info Modal - required before editing in Taliho */}
            <UserInfoModal
              isOpen={showUserInfoModal}
              onClose={() => setShowUserInfoModal(false)}
              onSave={(info) => {
                saveCreatorInfoToStorage(info);
                setCreatorName(info.name);
                setCreatorCompany(info.company);
                setShowUserInfoModal(false);
                setIsEditModalOpen(true);
              }}
              initialName={creatorName}
              initialCompany={creatorCompany}
            />
            {canEditInTaliho && isEditModalOpen ? (
              <div className="fixed inset-0 z-50 bg-gray-900/70 flex items-center justify-center overflow-hidden">
                <div className="relative flex flex-col z-50 w-[95%] max-w-3xl min-h-[300px] h-[80vh] m-0 mx-auto bg-white rounded-lg shadow-lg shadow-gray-500 overflow-y-auto">
                  <div className="flex flex-col gap-2 p-4 pb-2 sticky top-0 bg-white z-10 border-b border-gray-200 shadow">
                    <div className="flex justify-between items-center">
                      <h2 className="text-xl font-semibold">
                        Edit Punch List Assignments
                      </h2>
                      <div className="flex items-center gap-2">
                        {/* <button disabled className='px-3 py-1 rounded-md bg-yellow-400/60 text-gray-700 font-semibold cursor-not-allowed'>Save</button> */}
                        <button
                          onClick={() => setIsEditModalOpen(false)}
                          className="text-xl font-semibold"
                        >
                          <CloseIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grow relative z-50 px-4 py-4 flex flex-col">
                    {((data as Partial<{ assignments?: PunchListAssignment[] }>)
                      .assignments?.length ?? 0) > 0 ? (
                      <ul className="grow space-y-3 overflow-y-auto">
                        {(
                          (
                            data as Partial<{
                              assignments?: PunchListAssignment[];
                            }>
                          ).assignments ?? []
                        ).map((asgn: PunchListAssignment, j: number) => {
                          const key = `${j}-${asgn?.login_information?.name || asgn?.name || "assignee"}`;
                          return (
                            <li
                              key={key}
                              className="text-sm text-gray-700 bg-white px-4 py-3 rounded-xl border"
                            >
                              <div className="flex flex-col gap-3 flex-wrap">
                                <div>
                                  <span className="font-medium">
                                    {asgn?.login_information?.name ||
                                      asgn?.name ||
                                      asgn?.assignee_name ||
                                      "Assignee"}
                                  </span>
                                  {asgn?.vendor?.name || asgn?.company_name ? (
                                    <span className="text-gray-500">
                                      {" "}
                                      —{" "}
                                      {asgn?.vendor?.name || asgn?.company_name}
                                    </span>
                                  ) : null}
                                  {asgn?.role ? (
                                    <span className="text-gray-500">
                                      {" "}
                                      ({asgn.role})
                                    </span>
                                  ) : null}
                                </div>
                                <div
                                  className="relative flex justify-between items-end gap-2"
                                  ref={(el) => {
                                    dropdownRefs.current[key] = el;
                                  }}
                                >
                                  {asgn?.updated_at ? (
                                    <p className="text-xs text-gray-500">
                                      Last Updated:{" "}
                                      {formatProcoreTime(asgn.updated_at)}
                                    </p>
                                  ) : null}
                                  <button
                                    onClick={(e) => {
                                      const rect = (
                                        e.currentTarget as HTMLElement
                                      ).getBoundingClientRect();
                                      setMenuPosition({
                                        top: rect.bottom + 8,
                                        left: Math.max(8, rect.right - 192),
                                      });
                                      setOpenStatusKey(
                                        openStatusKey === key ? null : key,
                                      );
                                    }}
                                    className={`${getStatusColor((assignmentStatusMap[key] ?? asgn?.status) || "")} w-fit flex items-center text-center px-2 py-0.5 rounded-full text-sm font-medium capitalize`}
                                  >
                                    {statusLabelMap[
                                      (assignmentStatusMap[key] ??
                                        (asgn?.status as PunchListStatus)) as PunchListStatus
                                    ] ||
                                      (
                                        asgn?.formatted_status ||
                                        asgn?.status ||
                                        "status"
                                      )
                                        .toString()
                                        .split("_")
                                        .join(" ")}{" "}
                                    <ChevDownIcon className="ml-1 w-3 h-3" />
                                  </button>
                                  {openStatusKey === key ? (
                                    <div
                                      ref={menuRef}
                                      className="fixed z-[100] w-48 bg-white border border-gray-200 rounded-md shadow-lg"
                                      style={{
                                        top: (menuPosition?.top ?? 0) + "px",
                                        left: (menuPosition?.left ?? 0) + "px",
                                      }}
                                    >
                                      {statusOptions.map((opt) => (
                                        <button
                                          key={opt.value}
                                          onClick={() =>
                                            handleStatusChange(
                                              asgn,
                                              opt.value,
                                              key,
                                            )
                                          }
                                          className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                        >
                                          {opt.label}
                                        </button>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <span className="grow block text-sm text-gray-500">
                        No assignments
                      </span>
                    )}

                    <div className="col-span-3 flex">
                      {(() => {
                        const k = String(data.id ?? index);
                        const isClosed =
                          itemClosedMap[k] !== undefined
                            ? Boolean(itemClosedMap[k])
                            : data.workflow_status?.toLowerCase() === "closed";
                        return (
                          <button
                            onClick={() => handleCloseItem(k)}
                            className="grow mt-3 px-3 py-2 rounded-md bg-gray-900 text-white font-semibold"
                          >
                            {isClosed ? "Reopen Item" : "Close Item"}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className="p-4 pt-0 space-y-4">
            <div className="-mx-4" />
            <div className="w-full overflow-hidden">
              <div className="flex justify-evenly space-x-1 border-b border-gray-300">
                {["documents", "dates", "people", "links", "more"].map(
                  (tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-2 py-2 text-sm font-medium rounded-t-lg ${activeTab === tab ? "bg-yellow-100" : "hover:bg-gray-50"}`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ),
                )}
              </div>
              <div className="mt-4">
                {activeTab === "documents" && (
                  <div className=" space-y-2">
                    {data.attachments ? (
                      <div
                        key={index}
                        className="flex flex-col gap-2 px-2 pb-4"
                      >
                        <VerticalAttachmentSection
                          attachments={data.attachments!}
                          qrCodeId={qrCodeId}
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        No attachments available for this issue
                      </p>
                    )}
                  </div>
                )}
                {activeTab === "dates" && (
                  <div className="space-y-2">
                    {[
                      { label: "Date Created", value: data.created_at },
                      {
                        label: "Date Notified",
                        value: data.manager_notified_at,
                      },
                      { label: "Date Resolved", value: data.created_at },
                      { label: "Date Closed", value: data.closed_at },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="flex flex-col justify-start items-start mt-1"
                      >
                        <span className="text-sm text-gray-500 col-span-1">
                          {label}
                        </span>
                        <p className="font-medium text-gray-900 col-span-1">
                          {!value ? "-" : formatProcoreTime(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === "people" && (
                  <div className="space-y-2">
                    {[
                      {
                        label: "Punch Item Manager",
                        value: data.punch_item_manager?.name,
                      },
                      { label: "Assignee", value: data.assignee?.name },
                      {
                        label: "Ball in Court",
                        value: Array.isArray(data?.ball_in_court)
                          ? data.ball_in_court[0]?.name
                          : "-",
                      },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="flex flex-col justify-start items-start mt-1"
                      >
                        <span className="text-sm text-gray-500 col-span-1">
                          {label}
                        </span>
                        <p className="font-medium text-gray-900 col-span-1">
                          {value || "-"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === "more" && (
                  <div className="space-y-2">
                    {[
                      { label: "Type", value: data?.punch_item_type?.name },
                      { label: "Reference", value: data.reference },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="flex flex-col justify-start items-start mt-1"
                      >
                        <span className="text-sm text-gray-500 col-span-1">
                          {label}
                        </span>
                        <p className="font-medium text-gray-900 col-span-1">
                          {value || "-"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === "links" && (
                  <div className="flex justify-center mt-4">
                    <a
                      href={`${import.meta.env.VITE_PROCORE_BASE_URL}/${projectData?.procoreProjectID}/project/punch_list/${itemId}`}
                      className="flex items-center gap-4 bg-yellow-400 px-2 py-2 rounded-md text-gray-700 w-max"
                    >
                      <span>Go To Procore App</span>
                      <OpenOutsideIcon />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
