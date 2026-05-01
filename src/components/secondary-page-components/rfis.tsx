import { useEffect, useState, useCallback } from "react";
import { TilesIcon } from "../../assets/icons/TilesIcon";
// import { ToolsIcon } from "../../assets/icons/ToolsIcon";
import { ProcoreToolData, Project } from "../../types";
import { formatProcoreTime } from "../../utils/dateFormatter";
// import { getStatusColor } from "../../utils/getStatusColor";
import { getRFIResponses } from "../../api/endpoints/tools";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import { QuestionAnswerComponent } from "../questions-and-answers";
import { Answer } from "../../types";
import { clearSelectedTool } from "../../store/slices/appSlice";
import { useDispatch } from "react-redux";
import { TalihoSplashScreen } from "../taliho-splash-screen";
import { getStatusColor } from "../../utils/getStatusColor";
import { ChevLeftIcon } from "../../assets/icons/ChevLeftIcon";
import { ChevRightIcon } from "../../assets/icons/ChevRightIcon";
import { getPriorityColor } from "../../utils/getPriorityColor";
import { VerticalAttachmentSection } from "../vertical-attachment-section";
import { OpenOutsideIcon } from "../../assets/icons/OpenOutsideIcon";
interface RfisPageComponentProps {
  procoreData: ProcoreToolData;
  projectData: Project;
  qrCodeId: string;
  itemId: string;
}
export const RfisPageComponent = ({
  procoreData,
  projectData,
  qrCodeId,
  itemId,
}: RfisPageComponentProps) => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("documents");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const companyData = useSelector((state: RootState) => state.company);

  const clearAndGoBack = () => {
    dispatch(clearSelectedTool());
    window.history.go(-1);
  };

  const rfiResponseCallback = useCallback(async () => {
    try {
      const ids = procoreData.map((data) => data.procoreItemID);
      const response = await getRFIResponses(
        companyData._id,
        projectData._id,
        String(ids),
      );
      setAnswers(response as Answer[]);
    } catch (_error) {
      // Error handled silently in production
    }
  }, [companyData._id, projectData._id, procoreData]);

  useEffect(() => {
    rfiResponseCallback();
  }, [rfiResponseCallback]);

  if (!answers || !procoreData || !companyData) {
    return <TalihoSplashScreen />;
  }
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="bg-white rounded-lg px-2 pb-2">
        <div className="flex justify-between mt-2">
          <button
            onClick={() => window.history.go(-1)}
            className=" flex !px-3 gap-4 items-center menu-button-shadow font-semibold !border !border-yellow-400 !bg-gray-100 !text-black"
          >
            <div className="flex items-center">
              <ChevLeftIcon />
              <span className="text-xs">RFI's</span>
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
        <div key={index} className="bg-gray-100 rounded-lg shadow-md">
          <div className="border-b border-gray-100">
            <div className="flex flex-col pl-4 py-2">
              <div className="flex items-start gap-3 pb-4">
                <div className="flex flex-col items-start pt-[10px]">
                  <p className="text-xs text-left -mt-[5px]  text-yellow-900">
                    Title
                  </p>
                  <h2 className="text-2xl font-bold text-gray-900 -mt-1 ">
                    {data.subject}
                  </h2>
                </div>
              </div>

              <div className="  grid grid-cols-3 gap-2 ">
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
                <div className="flex flex-col items-start justify-self-start col-span-2">
                  <span className="text-xs text-yellow-900 font-[300]">
                    Location
                  </span>
                  <span
                    className={`inline-flex items-center -mt-[3px] rounded-full text-lg`}
                  >
                    {data?.location?.node_name || "-"}
                  </span>
                </div>
                <div className="flex flex-col items-start justify-self-start  col-span-1">
                  <span className="text-xs text-yellow-900 font-[300]">
                    Priority
                  </span>
                  <span
                    className={`inline-flex items-center px-4 py-0.5 rounded-full text-sm font-medium capitalize ${getPriorityColor(`${(data?.priority as { name?: string })?.name}`)}`}
                  >
                    {(data?.priority as { name?: string })?.name === "true"
                      ? "yes"
                      : "No"}
                  </span>
                </div>
                <div className="flex flex-col items-start justify-self-start col-span-2">
                  <span className="text-xs text-yellow-900 font-[300]">
                    Specification ID
                  </span>
                  <span
                    className={`inline-flex items-center -mt-[3px] rounded-full text-lg`}
                  >
                    {data.specification_section_id || "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-100  px-1">
            <div className="bg-white rounded-t-lg">
              <h3 className="font-semibold text-gray-700 p-3">Questions</h3>
              {data?.questions?.map((question, index) => (
                <QuestionAnswerComponent
                  key={index}
                  qrCodeId={qrCodeId}
                  question={{
                    created_by: question.created_by || "",
                    question_date: question.question_date || "",
                    initiated_at: data.initiated_at || "",
                    body: question.body || "",
                    attachments: [],
                  }}
                  initiated_at={data.initiated_at || ""}
                  official={false}
                  answers={answers}
                />
              ))}
            </div>
            <div className="p-4 pt-0 space-y-4 bg-white">
              <div className="-mx-4" />
              <div className="w-full overflow-hidden">
                <div className="flex justify-evenly space-x-1 border-b mt-2 border-gray-300">
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

                <div className=" mt-4">
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
                          Attachments located above.
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
                      <div className="flex flex-col justify-start items-start mt-1">
                        <span className="text-sm text-gray-500  col-span-1">
                          Updated Date
                        </span>
                        <p className="font-medium text-gray-900  col-span-1 ">
                          {!data.updated_at
                            ? "-"
                            : formatProcoreTime(data.updated_at || "")}
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
                  {activeTab === "links" && (
                    <div className="flex justify-center mt-4">
                      <a
                        href={`${import.meta.env.VITE_PROCORE_BASE_URL}/${projectData?.procoreProjectID}/project/rfi/show/{${itemId}`}
                        className="flex items-center gap-4 bg-yellow-400 px-2 py-2 rounded-md text-gray-700 w-max"
                      >
                        <span>Go To Procore App</span>
                        <OpenOutsideIcon />
                      </a>
                    </div>
                  )}
                  {activeTab === "more" && (
                    <div className="text-sm text-gray-500">
                      Nothing available for this RFI.
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
