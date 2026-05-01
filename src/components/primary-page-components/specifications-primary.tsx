import { useId, useRef, useState } from "react";
import { ChevRightIcon } from "../../assets/icons/ChevRightIcon";
import { GoBackIcon } from "../../assets/icons/GoBackIcon";
import { PdfOpener } from "../pdf-opener";
import { asString, asRecord } from "@/lib/coerce";

interface SpecificationTool {
  number?: string;
  description?: string;
  url?: string;
  issued_date?: string;
  updated_at?: string;
  revision?: string;
  [key: string]: unknown;
}

interface DivisionGroup {
  number: string;
  description: string;
  tools: SpecificationTool[];
}

export const SpecificationsPrimary = ({
  files,
}: {
  files?: Record<string, unknown>[];
  category: string;
  qrCodeIdInURL: string;
}) => {
  const [selectedDivision, setSelectedDivision] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const pdfFormId = `pdf-form-submit-${useId().replace(/:/g, "")}`;

  const [, setIsAnimating] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);

  if (!files) return null;
  const groupedByDivision = files.reduce(
    (data, tool) => {
      const divisionData = asRecord(tool.divisionData);
      const divisionId = asString(divisionData?.id, "Other");
      if (!data[divisionId]) {
        data[divisionId] = {
          number: asString(divisionData?.number, "Other"),
          description: asString(divisionData?.description, "Other"),
          tools: [],
        };
      }
      (data[divisionId] as DivisionGroup).tools.push(tool);
      return data;
    },
    {} as Record<string, DivisionGroup>,
  );

  const handleDivisionClick = (divisionId: string) => {
    setIsAnimating(true);
    setSelectedDivision(divisionId);
  };

  const handleBackClick = () => {
    setIsAnimating(true);
    setSelectedDivision("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="relative overflow-x-hidden min-h-[80vh] col-span-2">
      <PdfOpener procoreUrl={fileUrl} formId={pdfFormId} />
      <a
        href=""
        className="hidden"
        ref={linkRef}
        target="_self"
        rel="noopener noreferrer"
      >
        link
      </a>
      <div
        className={`flex flex-col gap-2 transition-transform duration-500  ease-in-out ${selectedDivision ? "-translate-x-[110%]" : "translate-x-0"}`}
      >
        {(Object.entries(groupedByDivision) as [string, DivisionGroup][])
          .sort(([, a], [, b]) =>
            a.number.localeCompare(b.number, undefined, { numeric: true }),
          )
          .map(([divisionId, { description, number, tools }]) => (
            <div key={divisionId} className="flex flex-col gap-2 col-span-2">
              <div
                onClick={() => handleDivisionClick(divisionId)}
                className="group w-full max-w-md rounded-lg border border-gray-200 bg-white cursor-pointer"
              >
                <div className="flex items-center justify-between p-4 text-base font-medium text-gray-900 hover:bg-gray-50 rounded-lg shadow-md w-full ">
                  <span className=" truncate  overflow-ellipsis max-w-[83%] ">
                    {number} - {description}
                  </span>
                  <div className="flex items-center gap-4">
                    <p className="px-1"> ({tools.length}) </p>
                    <div className="">
                      <ChevRightIcon />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>

      <div
        className={`absolute top-0 left-0 w-full transition-transform duration-500 ease-in-out ${selectedDivision ? "translate-x-0" : "translate-x-full"}`}
      >
        {(Object.entries(groupedByDivision) as [string, DivisionGroup][]).map(
          ([divisionId, { description, tools }]) =>
            selectedDivision == divisionId && (
              <div key={divisionId} className="flex flex-col gap-2">
                <div
                  onClick={handleBackClick}
                  className="flex  break-all flex-wrap !px-3 gap-3 mb-4 items-center max-w-[85%] w-max justify-between  menu-button-shadow  !border !border-yellow-400 !bg-gray-100 !text-black"
                >
                  <GoBackIcon />
                  <span className="text-sm truncate  overflow-ellipsis max-w-[75%]  ">
                    {description}
                  </span>
                  <img
                    src="../../../images/procore-icon.png"
                    alt="Procore Icon"
                    className="w-[20px]"
                  />
                </div>
                <div className="flex flex-col gap-4">
                  {tools.map((tool: SpecificationTool, i: number) => (
                    <div
                      key={i}
                      className="relative flex flex-col gap-2 border border-gray-200 rounded-lg bg-white col-span-1 shadow-md p-3 px-4"
                    >
                      <button
                        type="submit"
                        form={pdfFormId}
                        onClick={() => setFileUrl(tool.url ?? "")}
                      >
                        <div className="flex items-center gap-4">
                          <p className=" whitespace-nowrap absolute -top-3 bg-white  text-sm text-gray-400 ">
                            {tool.number}
                          </p>
                        </div>
                        <div className="my-2 font-semibold">
                          <span className="text-base ">{tool.description}</span>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex flex-col text-xs ">
                            <span className="">Issue Date:</span>
                            <span className="">Last Updated:</span>
                            <span className="">Revision:</span>
                          </div>
                          <div className="flex flex-col text-xs ">
                            <span className=" font-bold">
                              {tool?.issued_date
                                ? new Date(
                                    tool?.issued_date,
                                  ).toLocaleDateString("en-US")
                                : "N/A"}
                            </span>
                            <span className=" font-bold">
                              {tool?.updated_at
                                ? new Date(tool?.updated_at).toLocaleDateString(
                                    "en-US",
                                  )
                                : "N/A"}
                            </span>
                            <span className=" font-bold">{tool.revision}</span>
                          </div>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ),
        )}
      </div>
    </div>
  );
};
