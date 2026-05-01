import { formatProcoreTime } from "../../utils/dateFormatter";
import { getPriorityColor } from "../../utils/getPriorityColor";
import { getStatusColor } from "../../utils/getStatusColor";
import { ProcoreToolData, Project } from "../../types";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { clearSelectedTool } from "../../store/slices/appSlice";
import { ChevRightIcon } from "../../assets/icons/ChevRightIcon";
import { ChevLeftIcon } from "../../assets/icons/ChevLeftIcon";
import { TilesIcon } from "../../assets/icons/TilesIcon";
import { VerticalAttachmentSection } from "../vertical-attachment-section";
import { TalihoSplashScreen } from "../taliho-splash-screen";
import { OpenOutsideIcon } from "../../assets/icons/OpenOutsideIcon";

interface CoordinationIssuesPageComponentProps {
  procoreData: ProcoreToolData;
  projectData: Project;
  qrCodeId: string;
  itemId: string;
}

export const CoordinationIssuesPageComponent = ({
  procoreData,
  qrCodeId,
  projectData,
  itemId,
}: CoordinationIssuesPageComponentProps) => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("documents");
  const [expandDesc, setExpandDesc] = useState(false);

  const clearAndGoBack = () => {
    dispatch(clearSelectedTool());
    window.history.go(-1);
  };

  if (!procoreData) {
    return <TalihoSplashScreen />;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="bg-white rounded-lg p-2 pt-0">
        <div className="flex justify-between mt-2">
          <button
            onClick={() => window.history.go(-1)}
            className=" flex !px-3 gap-4 items-center menu-button-shadow font-semibold !border !border-yellow-400 !bg-gray-100 !text-black"
          >
            <div className="flex items-center">
              <ChevLeftIcon />
              <span className="text-xs">Coordination Issues</span>
            </div>
            <img
              src="../../../images/procore-icon.png"
              alt="Procore Icon"
              className="w-[15px]"
            />
          </button>
          <button
            onClick={clearAndGoBack}
            className={` flex items-center gap-3 font-semibold !border !border-yellow-400 menu-button-shadow !bg-gray-100 !text-black text-xs ${!procoreData || procoreData.map((data) => (data.procoreConnect === true ? "hidden" : "flex"))}`}
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
        <div key={index} className="bg-white rounded-lg ">
          <div className="bg-white rounded-lg ">
            <div className="  grid grid-cols-3 m-0 mx-auto gap-2 mb-2 px-4 rounded-lg shadow-md bg-gray-100 pb-4">
              <div className=" py-2 pt-4 col-span-3 ">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-start gap-3">
                    <p className="text-xs text-left leading-0 text-yellow-900 font-[300] ">
                      Title
                    </p>
                    <h2 className="text-2xl font-bold text-gray-900 -mt-1 ">
                      {data.title}
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
                  {data.issue_number}
                </span>
              </div>
              <div className="flex flex-col items-start justify-self-start ml-6 col-span-1">
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
                  Trade
                </span>
                <span
                  className={`inline-flex items-center -mt-[3px] rounded-full text-lg`}
                >
                  {data?.trade?.name || "-"}
                </span>
              </div>
              <div
                className={`flex flex-col items-start justify-self-start ml-6 mt-2 col-span-1 ${!data.priority ? "mr-7" : ""}`}
              >
                <span className="text-xs text-yellow-900 font-[300]">
                  Priority
                </span>
                <span
                  className={`inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium capitalize ${data.priority && getPriorityColor(data.priority?.toString() || "")} `}
                >
                  {data.priority || (
                    <p className="text-lg font-bold -mt-[10px] text-left px-0">
                      -
                    </p>
                  )}
                </span>
              </div>
              <div className="flex flex-col items-start justify-self-start col-span-3">
                <span className="text-xs text-yellow-900 font-[300]">
                  Location
                </span>
                <span
                  className={`inline-flex items-center -mt-[3px] rounded-full text-lg`}
                >
                  {data?.location?.node_name || "-"}
                </span>
              </div>
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
                    className={`flex justify-self-end py-1 border-yellow-400 border mt-2 text-xs px-2 bg-white rounded-md ${!data.description ? "hidden" : ""}`}
                  >
                    {" "}
                    ...Read More
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4 pt-0 space-y-4 ">
              <div className="-mx-4" />
              <div className="w-full overflow-hidden">
                <div className="flex justify-evenly space-x-1 border-b border-gray-300 overflow-scroll">
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
                          Date Created
                        </span>
                        <p className="font-medium text-gray-900  col-span-1">
                          {" "}
                          {formatProcoreTime(`${data.created_at}`)}
                        </p>
                      </div>
                      <div className="flex flex-col justify-start items-start mt-1">
                        <span className="text-sm text-gray-500  col-span-1">
                          Due Date
                        </span>
                        <p className="font-medium text-gray-900  col-span-1 ">
                          {!data.due_date
                            ? "-"
                            : formatProcoreTime(data.due_date || "")}
                        </p>
                      </div>
                    </div>
                  )}
                  {activeTab === "people" && (
                    <div className="space-y-2">
                      <div className="flex flex-col justify-start items-start mt-1">
                        <span className="text-sm text-gray-500 col-span-1">
                          Assignee Name
                        </span>
                        <p className="font-medium text-gray-900 mt-1 col-span-1">
                          {data.assignee?.name || "-"}
                        </p>
                      </div>
                      <div className="flex flex-col justify-start items-start mt-1">
                        <span className="text-sm text-gray-500 col-span-1">
                          Assigneed Company
                        </span>
                        <p className="font-medium text-gray-900 mt-1 col-span-1">
                          {data.assignee?.company_name || "-"}
                        </p>
                      </div>
                    </div>
                  )}
                  {activeTab === "more" && (
                    <div className="space-y-4">
                      <div className="flex flex-col justify-start items-start mt-1">
                        <span className="text-sm text-gray-500">
                          Issue Type
                        </span>
                        <p className="font-medium text-gray-900 mt-1 capitalize">
                          {data?.issue_type || "-"}
                        </p>
                      </div>
                    </div>
                  )}
                  {activeTab === "links" && (
                    <div className="flex justify-center mt-4">
                      <a
                        href={`${import.meta.env.VITE_PROCORE_BASE_URL}/${projectData.procoreProjectID}/project/coordination_issues/${itemId}`}
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
        </div>
      ))}
    </div>
  );
};
