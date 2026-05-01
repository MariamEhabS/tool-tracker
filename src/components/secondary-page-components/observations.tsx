import { useState } from "react";
import { ProcoreToolData, Project } from "../../types";
import { formatProcoreTime } from "../../utils/dateFormatter";
import { getStatusColor } from "../../utils/getStatusColor";
import { useDispatch } from "react-redux";
import { clearSelectedTool } from "../../store/slices/appSlice";
import { TilesIcon } from "../../assets/icons/TilesIcon";
import { getPriorityColor } from "../../utils/getPriorityColor";
import { ChevLeftIcon } from "../../assets/icons/ChevLeftIcon";
import { ChevRightIcon } from "../../assets/icons/ChevRightIcon";
import { VerticalAttachmentSection } from "../vertical-attachment-section";
import { OpenOutsideIcon } from "../../assets/icons/OpenOutsideIcon";

interface ObservationsPageComponentProps {
  procoreData: ProcoreToolData;
  projectData: Project;
  qrCodeId: string;
  itemId: string;
}

export const ObservationsPageComponent = ({
  procoreData,
  qrCodeId,
  projectData,
  itemId,
}: ObservationsPageComponentProps) => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("documents");

  const clearAndGoBack = () => {
    dispatch(clearSelectedTool());
    window.history.go(-1);
  };

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
              <span className="text-xs">Observations</span>
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
          <div className="bg-white rounded-lg">
            <div className="grid grid-cols-3 m-0 mx-auto gap-2 mb-2 px-4 pr-2 rounded-lg shadow-md bg-gray-100 pb-4 border border-gray-300 overflow-hidden">
              <div className="py-2 pt-4 col-span-3">
                <div className="flex items-center justify-between">
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
                  Number
                </span>
                <span className="inline-flex items-center -mt-[3px] rounded-full text-lg">
                  {data.number}
                </span>
              </div>
              <div className="flex flex-col items-start justify-self-start col-span-1 ">
                <span className="text-xs text-yellow-900 font-[300]">
                  Status
                </span>
                <span
                  className={`inline-flex items-center ${data?.status && data.status.length > 11 ? "px-2 text-xs" : " px-4 text-sm"} py-0.5 rounded-full text-sm font-medium  capitalize ${getStatusColor(data.status || "-")}`}
                >
                  {data.status?.split("_").join(" ") || "-"}
                </span>
              </div>
              <div className="flex flex-col items-start justify-self-start col-span-2">
                <span className="text-xs text-yellow-900 font-[300]">
                  Location
                </span>
                <span className="inline-flex items-center -mt-[3px] rounded-full text-lg">
                  {data?.location?.node_name || "-"}
                </span>
              </div>
              <div className="flex flex-col items-start justify-self-start  col-span-1">
                <span className="text-xs text-yellow-900 font-[300]">
                  Priority
                </span>
                <span
                  className={`inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium capitalize ${getPriorityColor(data.priority?.toString() || "")}`}
                >
                  {data.priority || "-"}
                </span>
              </div>
              <div className="flex flex-col items-start justify-self-start mr-10 col-span-2">
                <span className="text-xs text-yellow-900 font-[300]">
                  Trade
                </span>
                <span
                  className={`inline-flex items-center -mt-[3px] rounded-full text-lg`}
                >
                  {data.trade?.name || "-"}
                </span>
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
                          No attachments available for this observation
                        </p>
                      )}
                    </div>
                  )}
                  {activeTab === "dates" && (
                    <div className="space-y-2">
                      <div className="flex flex-col justify-start items-start mt-1">
                        <span className="text-sm text-gray-500 col-span-1">
                          Date Created
                        </span>
                        <p className="font-medium text-gray-900 col-span-1">
                          {formatProcoreTime(`${data.created_at}`)}
                        </p>
                      </div>
                      <div className="flex flex-col justify-start items-start mt-1">
                        <span className="text-sm text-gray-500 col-span-1">
                          Due Date
                        </span>
                        <p className="font-medium text-gray-900 col-span-1">
                          {!data.due_date
                            ? "-"
                            : formatProcoreTime(data.due_date)}
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
                        <p className="font-medium text-gray-900  col-span-1">
                          {data.assignee?.name || "-"}
                        </p>
                      </div>
                      <div className="flex flex-col justify-start items-start mt-1">
                        <span className="text-sm text-gray-500 col-span-1">
                          Assigneed Company
                        </span>
                        <p className="font-medium text-gray-900  col-span-1">
                          {data.assignee?.company_name || "-"}
                        </p>
                      </div>
                    </div>
                  )}
                  {activeTab === "more" && (
                    <div className="space-y-2">
                      <div className="flex flex-col justify-start items-start mt-1">
                        <span className="text-sm text-gray-500 col-span-1">
                          Type
                        </span>
                        <p className="font-medium text-gray-900  col-span-1">
                          {data?.type?.name || "-"}
                        </p>
                      </div>
                      <div className="flex flex-col justify-start items-start mt-1">
                        <span className="text-sm text-gray-500 col-span-1">
                          Category
                        </span>
                        <p className="font-medium text-gray-900  col-span-1">
                          {data?.type?.category || "-"}
                        </p>
                      </div>
                      <div className="flex flex-col justify-start items-start mt-1">
                        <span className="text-sm text-gray-500 col-span-1">
                          Spec Section
                        </span>
                        <p className="font-medium text-gray-900  col-span-1">
                          {(
                            data?.specification_section as {
                              description?: string;
                            }
                          )?.description || "-"}
                        </p>
                      </div>
                    </div>
                  )}
                  {activeTab === "links" && (
                    <div className="flex justify-center mt-4">
                      <a
                        href={`${import.meta.env.VITE_PROCORE_BASE_URL}/${projectData.procoreProjectID}/project/observations/items/${itemId}`}
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
