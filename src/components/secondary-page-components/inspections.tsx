import { useEffect, useId, useRef, useState, useCallback } from "react";
import { UserInfoModal } from "@/components/modal/procore/UserInfoModal";
import {
  getCreatorInfoFromStorage,
  saveCreatorInfoToStorage,
} from "@/utils/creatorInfo";
import { ProcoreToolData, Project } from "../../types";
import { formatProcoreTime, formatTime } from "../../utils/dateFormatter";
import { getStatusColor } from "../../utils/getStatusColor";
import { useDispatch, useSelector } from "react-redux";
import { clearSelectedTool } from "../../store/slices/appSlice";
import { TilesIcon } from "../../assets/icons/TilesIcon";
import { ChevLeftIcon } from "../../assets/icons/ChevLeftIcon";
import { ChevRightIcon } from "../../assets/icons/ChevRightIcon";
import { VerticalAttachmentSection } from "../vertical-attachment-section";
import {
  getInspectionItems,
  postInspectionItemResponse,
} from "../../api/endpoints/tools";
import { RootState } from "../../store";
import { CloseIcon } from "../../assets/icons/CloseIcon";
import { FileTypeIcon } from "../../utils/fileTypeIcon";
import toast from "react-hot-toast";
import { PdfOpener } from "../pdf-opener";

interface InspectionsPageComponentProps {
  procoreData: ProcoreToolData;
  projectData: Project;
  qrCodeId: string;
  itemId: string;
  openEditDefault?: boolean;
}
type InspectionState = {
  sections?: {
    name: string;
    id: string;
  }[];
  items?: {
    id: string;
    responded_with: string;
    type?: {
      category?: string;
      name?: string;
    };
    response_set?: {
      responses?: {
        id?: string | number;
        name?: string;
        corresponding_status?: string;
      }[];
    };
    item_response: {
      responded_at: string;
      status: string;
      responder: {
        name: string;
      };
      payload?: {
        response_option?: {
          name?: string;
        };
      };
    };
    name: string;
    section_id: string;
    position: number;
    response?: string;
  }[];
  comments?: {
    item_id: string;
    created_at: string;
    created_by: {
      name: string;
    };
    body: string;
  }[];
  attachments?: {
    attachment: {
      id?: string | number;
      name?: string;
      url?: string;
      filename?: string;
      content_type?: string;
      [key: string]: unknown;
    };
    item_id?: string;
  }[];
};

export const InspectionsPageComponent = ({
  procoreData,
  qrCodeId,
  projectData,
  itemId,
  openEditDefault = false,
}: InspectionsPageComponentProps) => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("documents");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(openEditDefault);
  const [showUserInfoModal, setShowUserInfoModal] = useState(false);
  const [creatorName, setCreatorName] = useState("");
  const [creatorCompany, setCreatorCompany] = useState("");
  const [expandDesc, setExpandDesc] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const pdfFormId = `pdf-form-submit-${useId().replace(/:/g, "")}`;
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [inspectionItems, setInspectionItems] = useState<InspectionState>();
  const [inspectionItemsLoading, setInspectionItemsLoading] = useState(false);
  const [inspectionItemsRetryCount, setInspectionItemsRetryCount] = useState(0);
  const inspectionItemsInFlightRef = useRef(false);
  const companyData = useSelector((state: RootState) => state.company);
  const canEditInTaliho = Boolean(companyData?.editProcoreItemsAllowed);
  const [selectedItemStatus, setSelectedItemStatus] = useState<
    Record<string | number, string>
  >({});
  const [selectedOptionId, setSelectedOptionId] = useState<
    Record<string | number, string | number>
  >({});
  const [contentsUpdated, setContentsUpdated] = useState(false);

  useEffect(() => {
    if (inspectionItems?.items && inspectionItems.items.length > 0) {
      const initial: Record<string | number, string> = {};
      const initialOpt: Record<string | number, string | number> = {};
      inspectionItems.items.forEach((it) => {
        const s = it?.item_response?.status;
        if (s) initial[it.id] = s;
        const selectedName = it?.item_response?.payload?.response_option?.name;
        const responses = it?.response_set?.responses ?? [];
        if (selectedName && responses.length > 0) {
          const found = responses.find((r) => r?.name === selectedName);
          if (found && typeof found.id !== "undefined") {
            initialOpt[it.id] = found.id as string | number;
          }
        }
      });
      setSelectedItemStatus(initial);
      setSelectedOptionId(initialOpt);
    }
  }, [inspectionItems]);

  const getButtonClassForStatus = (status: string, isActive: boolean) => {
    const base = "px-3 py-1 rounded-md border text-sm shadow-sm";
    if (!isActive)
      return `${base} border-gray-300 bg-white hover:bg-gray-50 text-gray-700`;
    // Normalize synonyms between Procore statuses and custom response sets
    const normalized = (() => {
      switch ((status || "").toLowerCase()) {
        case "yes":
          return "conforming";
        case "no":
          return "non_conforming";
        case "n/a":
        case "na":
          return "not_applicable";
        default:
          return status;
      }
    })();

    switch (normalized) {
      case "conforming":
        return `${base} border-green-500 bg-green-100 text-green-700`;
      case "non_conforming":
        return `${base} border-red-500 bg-red-100 text-red-700`;
      case "not_applicable":
        return `${base} border-gray-400 bg-gray-100 text-gray-700`;
      default:
        return `${base} border-gray-300 bg-white text-gray-700`;
    }
  };

  const renderEditControl = (
    item: NonNullable<InspectionState["items"]>[number],
  ) => {
    const category = item?.type?.category;
    const name = item?.type?.name;
    if (category === "multiple_choice" && name === "default") {
      const options = [
        { label: "Pass", payload: { status: "conforming" } },
        { label: "Fail", payload: { status: "non_conforming" } },
        { label: "N/A", payload: { status: "not_applicable" } },
      ];
      return (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt.label}
              type="button"
              className={getButtonClassForStatus(
                opt.payload.status,
                selectedItemStatus[item.id] === opt.payload.status,
              )}
              onClick={async () => {
                try {
                  await postInspectionItemResponse(
                    companyData._id,
                    projectData._id,
                    item.id,
                    opt.payload,
                  );
                  setSelectedItemStatus((prev) => ({
                    ...prev,
                    [item.id]: opt.payload.status,
                  }));
                  toast.success("Saved");
                  setContentsUpdated(true);
                } catch {
                  toast.error("Failed to save");
                }
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      );
    }
    if (category === "multiple_choice" && name === "custom") {
      const options = item?.response_set?.responses ?? [];
      const startingSelection =
        item?.item_response?.payload?.response_option?.name;
      return (
        <div className="flex flex-wrap gap-2">
          {options.length > 0 ? (
            options.map((opt, i) => {
              const isActive =
                typeof selectedOptionId[item.id] !== "undefined"
                  ? selectedOptionId[item.id] === opt?.id
                  : startingSelection === opt?.name;
              return (
                <button
                  key={String(opt?.id ?? i)}
                  type="button"
                  className={getButtonClassForStatus(
                    String(opt?.corresponding_status ?? ""),
                    Boolean(isActive),
                  )}
                  onClick={async () => {
                    try {
                      await postInspectionItemResponse(
                        companyData._id,
                        projectData._id,
                        item.id,
                        { response_option_id: opt?.id },
                      );
                      if (opt?.corresponding_status) {
                        setSelectedItemStatus((prev) => ({
                          ...prev,
                          [item.id]: String(
                            (opt.corresponding_status || "").toLowerCase(),
                          ),
                        }));
                      }
                      if (typeof opt?.id !== "undefined") {
                        setSelectedOptionId((prev) => ({
                          ...prev,
                          [item.id]: opt.id as string | number,
                        }));
                      }
                      toast.success("Saved");
                      setContentsUpdated(true);
                    } catch {
                      toast.error("Failed to save");
                    }
                  }}
                >
                  {opt?.name ?? "Option"}
                </button>
              );
            })
          ) : (
            <span className="text-sm text-gray-500">No options available</span>
          )}
        </div>
      );
    }
    if (category === "open_ended" && name === "text") {
      const handleSubmit = async (value: string) => {
        try {
          await postInspectionItemResponse(
            companyData._id,
            projectData._id,
            item.id,
            { text_value: value },
          );
          toast.success("Saved");
          setContentsUpdated(true);
        } catch {
          toast.error("Failed to save");
        }
      };
      return (
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="border rounded-md px-2 py-1 w-full"
            defaultValue={item?.responded_with || ""}
            placeholder="Enter text"
            onBlur={(e) => handleSubmit(e.target.value)}
          />
        </div>
      );
    }
    if (category === "open_ended" && name === "number") {
      const handleSubmit = async (value: string) => {
        try {
          const num = value === "" ? undefined : Number(value);
          await postInspectionItemResponse(
            companyData._id,
            projectData._id,
            item.id,
            { number_value: num },
          );
          toast.success("Saved");
          setContentsUpdated(true);
        } catch {
          toast.error("Failed to save");
        }
      };
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            className="border rounded-md px-2 py-1 w-40"
            defaultValue={item?.responded_with || ""}
            placeholder="0"
            onBlur={(e) => handleSubmit(e.target.value)}
          />
        </div>
      );
    }
    if (category === "open_ended" && name === "date") {
      const handleSubmit = async (value: string) => {
        try {
          await postInspectionItemResponse(
            companyData._id,
            projectData._id,
            item.id,
            { date_value: value },
          );
          toast.success("Saved");
          setContentsUpdated(true);
        } catch {
          toast.error("Failed to save");
        }
      };
      return (
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="border rounded-md px-2 py-1 w-56"
            value={
              typeof item?.responded_with === "string" &&
              !Number.isNaN(Date.parse(item.responded_with))
                ? new Date(item.responded_with).toISOString().split("T")[0]
                : ""
            }
            onChange={(e) => handleSubmit(e.target.value)}
          />
        </div>
      );
    }
    return (
      <span className="text-sm text-gray-500">
        No editable input for this item type
      </span>
    );
  };

  const renderViewOnlyResponse = (
    item: NonNullable<InspectionState["items"]>[number],
  ) => {
    const category = item?.type?.category;
    const name = item?.type?.name;
    const status = item?.item_response?.status || "";
    if (category === "multiple_choice" && name === "default") {
      const label =
        status === "conforming"
          ? "Pass"
          : status === "non_conforming"
            ? "Fail"
            : "N/A";
      return (
        <span className={getButtonClassForStatus(status, true)}>{label}</span>
      );
    }
    if (category === "multiple_choice" && name === "custom") {
      const selectedName =
        item?.item_response?.payload?.response_option?.name ||
        item?.responded_with;
      const opt = (item?.response_set?.responses ?? []).find(
        (o) => o?.name === selectedName,
      );
      const s = String(opt?.corresponding_status ?? status);
      return (
        <span className={getButtonClassForStatus(s, true)}>
          {opt?.name ?? selectedName ?? "Option"}
        </span>
      );
    }
    if (category === "open_ended" && name === "text") {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-md bg-gray-50 border border-gray-200 text-gray-800">
          {item?.responded_with || "-"}
        </span>
      );
    }
    if (category === "open_ended" && name === "number") {
      const num = item?.responded_with as unknown as number | string;
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-md bg-gray-50 border border-gray-200 text-gray-800">
          {num ?? "-"}
        </span>
      );
    }
    if (category === "open_ended" && name === "date") {
      const dateStr = (item?.responded_with as unknown as string) || "";
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-md bg-gray-50 border border-gray-200 text-gray-800">
          {dateStr || "-"}
        </span>
      );
    }
    return <span className="text-sm text-gray-500">No Response</span>;
  };

  const clearAndGoBack = () => {
    dispatch(clearSelectedTool());
    window.history.go(-1);
  };

  // If openEdit is requested via query/prop, always open the edit modal.
  // This path is used by create flows and should not depend on localStorage.
  useEffect(() => {
    if (!openEditDefault) return;
    setIsEditModalOpen(true);
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

  const getInspectionItemsCallback = useCallback(async () => {
    try {
      if (!companyData?._id || !projectData?._id || !itemId) return;
      if (inspectionItemsInFlightRef.current) return;
      inspectionItemsInFlightRef.current = true;
      setInspectionItemsLoading(true);
      const response = await getInspectionItems(
        companyData._id,
        projectData._id,
        itemId,
      );
      setInspectionItems(response as InspectionState);
    } catch (_error) {
      toast.error("Something went wrong.");
    } finally {
      setInspectionItemsLoading(false);
      inspectionItemsInFlightRef.current = false;
    }
  }, [companyData._id, projectData._id, itemId]);

  useEffect(() => {
    getInspectionItemsCallback();
  }, [getInspectionItemsCallback]);

  const sectionsCount = inspectionItems?.sections?.length ?? 0;
  useEffect(() => {
    if (!isEditModalOpen) return;
    if (inspectionItemsLoading) return;
    if (sectionsCount > 0) return;
    // Avoid racing duplicate calls at mount
    if (inspectionItemsInFlightRef.current) return;
    void getInspectionItemsCallback();
  }, [
    isEditModalOpen,
    inspectionItemsLoading,
    sectionsCount,
    getInspectionItemsCallback,
  ]);

  // Gentle polling after creation/open to mitigate eventual consistency
  useEffect(() => {
    if (!isEditModalOpen) return;
    if (sectionsCount > 0) return;
    if (inspectionItemsLoading) return;
    if (inspectionItemsInFlightRef.current) return;
    if (inspectionItemsRetryCount >= 3) return;
    const params = new URLSearchParams(window.location.search);
    const createdFlag = params.get("created");
    // Only poll when navigated from creation or when auto-opened
    if (createdFlag === "inspection" || openEditDefault) {
      const delay =
        inspectionItemsRetryCount === 0
          ? 800
          : inspectionItemsRetryCount === 1
            ? 1500
            : 3000;
      const t = window.setTimeout(() => {
        setInspectionItemsRetryCount((c) => c + 1);
        void getInspectionItemsCallback();
      }, delay);
      return () => window.clearTimeout(t);
    }
  }, [
    isEditModalOpen,
    sectionsCount,
    inspectionItemsLoading,
    inspectionItemsRetryCount,
    openEditDefault,
    getInspectionItemsCallback,
  ]);

  // Reset retry counter when content arrives
  useEffect(() => {
    if (sectionsCount > 0) setInspectionItemsRetryCount(0);
  }, [sectionsCount]);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8 relative">
      <PdfOpener procoreUrl={fileUrl} formId={pdfFormId} />
      <div className="bg-white rounded-lg p-2 pt-0 mb-2 ">
        <div className="flex justify-between mt-2">
          <button
            onClick={() => window.history.go(-1)}
            className="flex !px-3 gap-4 items-center menu-button-shadow font-semibold !border !border-yellow-400 !bg-gray-100 !text-black"
          >
            <div className="flex items-center">
              <ChevLeftIcon />
              <span className="text-xs">Inspections</span>
            </div>
            <img
              src="../../../images/procore-icon.png"
              alt="Procore Icon"
              className="w-[15px]"
            />
          </button>
          <button
            onClick={clearAndGoBack}
            className={`flex items-center gap-3 font-semibold !border !border-yellow-400 menu-button-shadow !bg-gray-100 !text-black text-xs ${procoreData.some((d) => d.procoreConnect === true) ? "hidden" : ""}`}
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
        <div key={index} className="bg-white rounded-lg  ">
          <div className="bg-white rounded-lg ">
            <div className="  grid grid-cols-3 m-0 mx-auto gap-2 mb-2 px-4 rounded-lg shadow-md bg-gray-100 pb-4">
              <div className=" py-2 pt-4 col-span-3 ">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-start gap-3">
                    <p className="text-xs text-left leading-0 text-yellow-900 font-[300] ">
                      Title
                    </p>
                    <h2 className="text-2xl font-bold text-gray-900 -mt-1 ">
                      {data.name}
                    </h2>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-start justify-self-start col-span-2">
                <span className="text-xs text-yellow-900 font-[300]">
                  Number
                </span>
                <span
                  className={`inline-flex items-center -mt-[3px] rounded-full text-lg`}
                >
                  {data.number}
                </span>
              </div>
              <div className="flex flex-col items-start justify-self-start  col-span-1">
                <span className="text-xs text-yellow-900 font-[300]">
                  Status
                </span>
                <span
                  className={`inline-flex items-center px-4 py-0.5 rounded-full text-sm font-medium capitalize ${getStatusColor(data.status as string)}`}
                >
                  {data.status as string}
                </span>
              </div>
              <div
                className={`flex flex-col items-start justify-self-start col-span-2`}
              >
                <span className="text-xs text-yellow-900 font-[300]">
                  Inspection Type
                </span>
                <span
                  className={`inline-flex items-center -mt-[3px] rounded-full text-lg`}
                >
                  {data?.inspection_type?.name || "-"}
                </span>
              </div>
              {data?.closed_at ? (
                <div className="flex flex-col items-start justify-self-start  col-span-1">
                  <span className="text-xs text-yellow-900 font-[300]">
                    Closed On
                  </span>
                  <span
                    className={`inline-flex items-center -mt-[3px] rounded-full text-lg`}
                  >
                    {data?.closed_at as string}
                  </span>
                </div>
              ) : null}
              <div className="flex flex-col items-start justify-self-start col-span-3">
                <span className="text-xs text-yellow-900 font-[300]">
                  Identifier
                </span>
                <span
                  className={`inline-flex items-center -mt-[3px] rounded-full text-lg`}
                >
                  {data.identifier || "-"}
                </span>
              </div>
              {(data?.conforming_item_count !== undefined ||
                data?.deficient_item_count !== undefined) && (
                <>
                  <div className="flex flex-col items-start justify-self-start col-span-1">
                    <span className="text-xs text-yellow-900 font-[300]">
                      Conforming
                    </span>
                    <span className="inline-flex items-center -mt-[3px] rounded-full text-lg text-green-600">
                      {data?.conforming_item_count ?? "-"}
                    </span>
                  </div>
                  <div className="flex flex-col items-start justify-self-start col-span-1">
                    <span className="text-xs text-yellow-900 font-[300]">
                      Deficient
                    </span>
                    <span className="inline-flex items-center -mt-[3px] rounded-full text-lg text-red-600">
                      {data?.deficient_item_count ?? "-"}
                    </span>
                  </div>
                </>
              )}
              <div className="col-span-3 relative ">
                <div className={`overflow-hidden  `}>
                  <h3 className="text-yellow-900 font-[300] mb-[5px] text-xs">
                    Description
                  </h3>
                  <div
                    className={`bg-white rounded-lg p-4 min-h-[100px] ${expandDesc == false ? "max-h-[130px]" : "max-h-[200px]"}  overflow-scroll`}
                  >
                    {!data.description ? (
                      <p className=" italic">No description provided.</p>
                    ) : (
                      data.description
                    )}
                  </div>
                  <button
                    onClick={() => setExpandDesc(!expandDesc)}
                    className={`flex justify-self-end py-1 border-yellow-400 border mt-2 text-xs px-2 bg-white rounded-md shadow-md ${!data.description ? "hidden" : ""}`}
                  >
                    {expandDesc ? "...Read Less" : "...Read More"}
                  </button>
                </div>
              </div>
              <div className="flex !w-full justify-center gap-2 col-span-3 pt-3">
                <button
                  onClick={async () => {
                    setIsModalOpen(!isModalOpen);
                    if (contentsUpdated) {
                      await getInspectionItemsCallback();
                    }
                  }}
                  className="flex justify-center w-max bg-yellow-400 px-3 py-2 rounded-md font-semibold text-gray-700"
                >
                  View Inspection Items
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
            </div>
            <div className="p-4 pt-0 space-y-4">
              <div className="-mx-4" />
              <div className="w-full overflow-hidden">
                <div className="flex justify-evenly space-x-1 border-b border-gray-300">
                  <button
                    onClick={() => setActiveTab("documents")}
                    className={`px-2 py-2 text-sm font-medium rounded-t-lg ${activeTab === "documents" ? "bg-yellow-100" : "hover:bg-gray-50"}`}
                  >
                    Documents
                  </button>
                  <button
                    onClick={() => setActiveTab("dates")}
                    className={`px-2 py-2 text-sm font-medium rounded-t-lg ${activeTab === "dates" ? "bg-yellow-100" : "hover:bg-gray-50"}`}
                  >
                    Dates
                  </button>
                  <button
                    onClick={() => setActiveTab("people")}
                    className={`px-2 py-2 text-sm font-medium rounded-t-lg ${activeTab === "people" ? "bg-yellow-100" : "hover:bg-gray-50"}`}
                  >
                    People
                  </button>
                  <button
                    onClick={() => setActiveTab("links")}
                    className={`px-2 py-2 text-sm font-medium rounded-t-lg ${activeTab === "links" ? "bg-yellow-100" : "hover:bg-gray-50"}`}
                  >
                    Links
                  </button>
                  <button
                    onClick={() => setActiveTab("more")}
                    className={`px-2 py-2 text-sm font-medium rounded-t-lg ${activeTab === "more" ? "bg-yellow-100" : "hover:bg-gray-50"}`}
                  >
                    More
                  </button>
                </div>
                <div className=" mt-4">
                  {activeTab === "documents" && (
                    <div className=" space-y-2">
                      {data.attachments && data.attachments.length ? (
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
                    <div className=" space-y-2">
                      <div className="flex flex-col justify-start items-start mt-1">
                        <span className="text-sm text-gray-500  col-span-1">
                          Inspection Date
                        </span>
                        <p className="font-medium text-gray-900  col-span-1">
                          {" "}
                          {formatProcoreTime(data.inspection_date || "")}
                        </p>
                      </div>
                      <div className="flex flex-col justify-start items-start mt-1">
                        <span className="text-sm text-gray-500  col-span-1">
                          Created At
                        </span>
                        <p className="font-medium text-gray-900  col-span-1 ">
                          {!data?.created_at
                            ? "-"
                            : formatProcoreTime(data?.created_at || "")}
                        </p>
                      </div>
                      <div className="flex flex-col justify-start items-start mt-1">
                        <span className="text-sm text-gray-500  col-span-1">
                          Updated At
                        </span>
                        <p className="font-medium text-gray-900  col-span-1 ">
                          {!data?.updated_at
                            ? "-"
                            : formatProcoreTime(data?.updated_at || "")}
                        </p>
                      </div>
                    </div>
                  )}
                  {activeTab === "people" && (
                    <div className="space-y-2">
                      <div className="flex flex-col justify-start items-start mt-1">
                        <span className="text-sm text-gray-500 col-span-1">
                          Inspector Name
                        </span>
                        <div className="mt-1">
                          {data?.inspectors?.map((inspector, i) => (
                            <p key={i} className="font-medium text-gray-900">
                              {inspector.name}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {activeTab === "more" && (
                    <div className="space-y-4">
                      <div className="flex flex-col justify-start items-start mt-1">
                        <span className="text-sm text-gray-500">Location</span>
                        <p className="font-medium text-gray-900 mt-1 capitalize">
                          {data?.location?.node_name || "-"}
                        </p>
                      </div>
                    </div>
                  )}
                  {activeTab === "links" && (
                    <div className="text-sm text-gray-500">
                      No links available for this issue
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          {isModalOpen ? (
            <div className="fixed inset-0 z-50 bg-gray-900/70 flex items-center justify-center overflow-hidden">
              <a
                href=""
                className="hidden"
                ref={linkRef}
                target="_self"
                rel="noopener noreferrer"
              >
                link
              </a>

              <div className="w-[95%] max-w-3xl min-h-[500px] max-h-[75vh] m-0 mx-auto bg-white rounded-lg shadow-lg shadow-gray-500 overflow-y-auto pb-6">
                <div className="flex flex-col gap-2 p-4 pb-2 sticky top-0 bg-white z-50 border-b border-gray-200 shadow">
                  <div className="flex justify-between">
                    <h2 className="text-xl font-semibold">
                      List of Inspection Items
                    </h2>
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="text-xl font-semibold"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                  <a
                    href={`${import.meta.env.VITE_PROCORE_BASE_URL}/${projectData.procoreProjectID}/project/checklists/lists/${itemId}`}
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
                <div className="px-2 pt-2">
                  {Object.keys(inspectionItems || {}).length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {inspectionItems?.sections?.map((section, position) => (
                        <div
                          key={position}
                          className="flex flex-col border border-gray-300 rounded-md overflow-hidden"
                        >
                          <details className="group">
                            <summary className="flex justify-between items-center px-4 py-3 cursor-pointer font-bold">
                              {section.name}
                              <svg
                                className="w-5 h-5 transition-transform group-open:rotate-180"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </summary>
                            <div className="flex flex-col gap-2 px-4 pt-0 pb-4">
                              {(inspectionItems?.items ?? [])
                                .filter(
                                  (item) => item.section_id === section.id,
                                )
                                .map((filItem, index) => (
                                  <div
                                    key={index}
                                    className="flex flex-col border-b border-gray-300 pb-2"
                                  >
                                    <div className="flex gap-3">
                                      <span className="font-bold">
                                        {position + 1}.{filItem.position}
                                      </span>
                                      <span>{filItem.name}</span>
                                    </div>
                                    <div className="flex justify-around ml-8">
                                      {!filItem?.item_response ? (
                                        <div className="flex items-center w-full gap-4 py-2">
                                          <span className="border-2 border-black rounded-full p-1 px-[5px] bg-black text-white font-bold">
                                            NA
                                          </span>
                                          <span className="font-bold">
                                            No Response
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex flex-col w-full gap-4">
                                          <div className="flex items-center gap-4 pt-2">
                                            {renderViewOnlyResponse(filItem)}
                                          </div>
                                          <p className="text-sm">
                                            By{" "}
                                            {
                                              filItem?.item_response?.responder
                                                ?.name
                                            }{" "}
                                            on{" "}
                                            {formatProcoreTime(
                                              filItem?.item_response
                                                ?.responded_at,
                                            )}{" "}
                                            at{" "}
                                            {formatTime(
                                              filItem?.item_response
                                                ?.responded_at,
                                            )}
                                          </p>
                                          <div>
                                            <div>
                                              <p className="font-bold">
                                                Comments:
                                              </p>
                                              {(inspectionItems?.comments
                                                ?.length ?? 0) > 0 ? (
                                                inspectionItems.comments
                                                  ?.filter(
                                                    (comment) =>
                                                      comment?.item_id ===
                                                      filItem.id,
                                                  )
                                                  .map((comment, index) => (
                                                    <div
                                                      key={index}
                                                      className="flex flex-col gap-2"
                                                    >
                                                      <p className="text-sm text-gray-500">
                                                        {comment.body}
                                                      </p>
                                                      <p>
                                                        {
                                                          comment?.created_by
                                                            ?.name
                                                        }{" "}
                                                        on{" "}
                                                        {formatProcoreTime(
                                                          comment?.created_at ||
                                                            "-",
                                                        )}{" "}
                                                        at{" "}
                                                        {formatTime(
                                                          comment.created_at ||
                                                            "-",
                                                        )}
                                                      </p>
                                                    </div>
                                                  ))
                                              ) : (
                                                <span className="text-sm">
                                                  No Comments
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <div>
                                            <div className="">
                                              <p className="font-bold">
                                                Attachments:
                                              </p>
                                              <div className="flex justify-evenly">
                                                {(inspectionItems?.attachments
                                                  ?.length ?? 0) > 0 ? (
                                                  inspectionItems.attachments
                                                    ?.filter(
                                                      (attachment) =>
                                                        attachment?.item_id ===
                                                        filItem.id,
                                                    )
                                                    .map(
                                                      (attachment, index) => (
                                                        <div
                                                          className="flex flex-row flex-shrink-0"
                                                          key={index}
                                                        >
                                                          <button
                                                            className="flex flex-col items-center group min-w-[80px] hover:opacity-80 transition-opacity"
                                                            type="submit"
                                                            form={pdfFormId}
                                                            onClick={() =>
                                                              setFileUrl(
                                                                attachment
                                                                  .attachment
                                                                  ?.url ?? "",
                                                              )
                                                            }
                                                          >
                                                            <div className="text-gray-500 group-hover:text-gray-700 transition-colors">
                                                              <FileTypeIcon
                                                                type={
                                                                  attachment
                                                                    .attachment
                                                                    ?.content_type ??
                                                                  ""
                                                                }
                                                              />
                                                            </div>
                                                            <span className="text-xs text-center truncate w-20 mt-1">
                                                              {
                                                                attachment
                                                                  .attachment
                                                                  ?.name
                                                              }
                                                            </span>
                                                          </button>
                                                        </div>
                                                      ),
                                                    )
                                                ) : (
                                                  <span className="text-sm">
                                                    No Attachments
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </details>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-10 text-sm text-gray-500">
                      {inspectionItemsLoading
                        ? "Loading items…"
                        : "No items yet"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
          {canEditInTaliho && isEditModalOpen ? (
            <div className="fixed inset-0 z-50 bg-gray-900/70 flex items-center justify-center overflow-hidden">
              <div className="relative flex flex-col w-[95%] max-w-3xl min-h-[500px] h-[80vh] m-0 mx-auto bg-white rounded-lg shadow-lg shadow-gray-500">
                <div className="flex flex-col gap-2 p-4 pb-2 sticky top-0 bg-white z-50 border-b border-gray-200 shadow">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">
                      Edit Inspection Items
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsEditModalOpen(false)}
                        className="text-xl font-semibold"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grow px-2 py-2 overflow-y-auto">
                  {Object.keys(inspectionItems || {}).length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {(inspectionItems?.sections ?? []).map(
                        (section, position) => (
                          <div
                            key={position}
                            className="flex flex-col border border-gray-300 rounded-md overflow-hidden"
                          >
                            <details className="group" open>
                              <summary className="flex justify-between items-center px-4 py-3 cursor-pointer font-bold">
                                {section.name}
                                <svg
                                  className="w-5 h-5 transition-transform group-open:rotate-180"
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </summary>
                              <div className="flex flex-col gap-3 px-4 pt-0 pb-4">
                                {(inspectionItems?.items ?? [])
                                  .filter(
                                    (item) => item.section_id === section.id,
                                  )
                                  .map((filItem, index) => (
                                    <div
                                      key={index}
                                      className="flex flex-col gap-2 border-b border-gray-300 pb-3"
                                    >
                                      <div className="flex gap-3 items-center">
                                        <span className="font-bold">
                                          {position + 1}.{filItem.position}
                                        </span>
                                        <span className="font-medium">
                                          {filItem.name}
                                        </span>
                                      </div>
                                      <div className="flex flex-col gap-2 ml-8">
                                        {renderEditControl(filItem)}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </details>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-10 text-sm text-gray-500">
                      {inspectionItemsLoading
                        ? "Loading items…"
                        : "No items yet"}
                    </div>
                  )}
                </div>
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end sticky bottom-0 bg-white">
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="grow px-4 py-2 rounded-md bg-yellow-400/60 text-gray-700 font-semibold cursor-not-allowed"
                  >
                    Save
                  </button>
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
        </div>
      ))}
    </div>
  );
};
