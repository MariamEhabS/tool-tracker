import { ProcoreToolData, Project } from "../../types";
import { ChevRightIcon } from "../../assets/icons/ChevRightIcon";
import { ChevLeftIcon } from "../../assets/icons/ChevLeftIcon";
import { useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { clearSelectedTool } from "../../store/slices/appSlice";
import { TilesIcon } from "../../assets/icons/TilesIcon";
import { getSignedProcoreUrl } from "../../api/endpoints/tools";
import toast from "react-hot-toast";
interface SpecificationsPageComponentProps {
  procoreData: ProcoreToolData;
  projectData: Project;
  qrCodeId: string;
}

export const SpecificationsPageComponent = ({
  procoreData,
  qrCodeId,
}: SpecificationsPageComponentProps) => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("documents");
  const [, setIsLoading] = useState(false);

  const linkRef = useRef<HTMLAnchorElement>(null);

  const clearAndGoBack = () => {
    dispatch(clearSelectedTool());
    window.history.go(-1);
  };
  const handleDocumentOpen = async (fileUrl: string) => {
    setIsLoading(true);
    try {
      let filetype = "application/octet-stream";
      if (fileUrl.includes(".pdf")) {
        filetype = "application/pdf";
      } else if (fileUrl.includes(".jpeg") || fileUrl.includes(".jpg")) {
        filetype = "image/jpeg";
      } else if (fileUrl.includes(".png")) {
        filetype = "image/png";
      } else if (fileUrl.includes(".docx")) {
        filetype =
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else if (fileUrl.includes(".doc")) {
        filetype = "application/msword";
      } else if (fileUrl.includes(".xlsx")) {
        filetype =
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      } else if (fileUrl.includes(".xls")) {
        filetype = "application/vnd.ms-excel";
      } else if (fileUrl.includes(".csv")) {
        filetype = "text/csv";
      }

      const response = await getSignedProcoreUrl({
        qrCodeId,
        fileUrl,
        urlOnly: false,
        sendBuffer: true,
      });
      if (linkRef.current) {
        linkRef.current.href = String(response);
        linkRef.current.setAttribute("type", filetype);
        linkRef.current.setAttribute("target", "_self");
        linkRef.current.click();
      }
    } catch (error) {
      toast.error("Something went wrong.");
      if (import.meta.env.DEV) {
        console.error("Error opening document:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

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
              <span className="text-xs">Specifications</span>
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
        <div key={index} className="bg-white rounded-lg shadow-md">
          <a href="" className="hidden" ref={linkRef} rel="noopener noreferrer">
            link
          </a>

          <div className=" grid grid-cols-3 m-0 mx-auto gap-2 mb-2 px-4 rounded-lg shadow-md bg-gray-100 pb-4">
            <div className="py-2 pt-4 col-span-3">
              <div className="flex items-center justify-between ">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-start gap-3">
                    <p className="text-xs text-left leading-0 text-yellow-900 font-[300] ">
                      Title
                    </p>
                    <h2 className="text-2xl font-bold text-gray-900 -mt-1 ">
                      {data.divisionData?.description}
                    </h2>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start col-span-2">
              <span className="text-xs text-yellow-900 font-light">
                Division
              </span>
              <span className="text-lg font-bold">
                {data?.divisionData?.number || "-"}
              </span>
            </div>
            <div className="flex flex-col items-start col-span-2">
              <span className="text-xs text-yellow-900 font-light">
                Revision
              </span>
              <span className="text-lg font-bold">{data.revision || "-"}</span>
            </div>

            <div className="col-span-3">
              <span className="text-xs text-yellow-900 font-light">
                Description
              </span>
              <div className="bg-white rounded-lg p-4 min-h-[100px] max-h-[200px] overflow-auto mt-2">
                {data.description || (
                  <p className="italic">No description provided.</p>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex justify-evenly space-x-1 border-b border-gray-300">
              {["documents", "dates", "people", "more"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                    activeTab === tab ? "bg-yellow-100" : "hover:bg-gray-50"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="mt-4 px-2">
              {activeTab === "more" && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <span className="text-sm text-gray-500">
                        Specification ID
                      </span>
                      <p className="font-medium text-gray-900 mt-1">
                        {data.specification_section_id}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Set</span>
                      <p className="font-medium text-gray-900 mt-1">
                        {data.specification_set?.name ||
                          (data.specification_set_id
                            ? `Set ${data.specification_set_id}`
                            : "-")}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="text-sm text-gray-500">
                        Division Description
                      </span>
                      <p className="font-medium text-gray-900 mt-1">
                        {data?.divisionData?.description || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === "dates" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <span className="text-sm text-gray-500">Issued Date</span>
                      <p className="font-medium text-gray-900 mt-1">
                        {data.issued_date || "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">
                        Received Date
                      </span>
                      <p className="font-medium text-gray-900 mt-1">
                        {data.received_date || "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">
                        Last Updated
                      </span>
                      <p className="font-medium text-gray-900 mt-1">
                        {data.updated_at || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "documents" && (
                <div className="flex justify-center">
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      handleDocumentOpen(`${data.url}`);
                    }}
                    className="inline-flex items-center px-4 py-2 rounded-md shadow-sm text-sm font-medium border border-yellow-400 text-yellow-900 bg-yellow-300 hover:bg-yellow-400"
                  >
                    View Specification Document
                  </div>
                </div>
              )}

              {activeTab === "related" && (
                <div className="text-sm text-gray-500">
                  No related items available
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
