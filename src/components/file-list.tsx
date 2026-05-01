import { useState } from "react";
import { EmailIcon } from "../assets/icons/EmailIcon";
import { MoreDataIcon } from "../assets/icons/MoreDataIcon";
import { PhoneIcon } from "../assets/icons/PhoneIcon";
import { Link } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { SpecificationsPrimary } from "./primary-page-components/specifications-primary";
import { DrawingsPrimary } from "./primary-page-components/drawings-primary";
import { PhotoGallery } from "./primary-page-components/photo-gallery";
import { PaperClipIcon } from "../assets/icons/PaperClipIcon";
import { InfoIcon } from "../assets/icons/InfoIcon";
import { asString, asRecord, asDateLike, getArray } from "@/lib/coerce";

export const FileList = ({
  files,
  category,
}: {
  files?: Record<string, unknown>[];
  category: string;
}) => {
  const router = useRouter();

  const [openDetail, setOpenDetail] = useState<string | null>(null);

  const qrCodeIdInURL = router.parseLocation().search.qrcodeId;

  if (!files || files.length === 0) {
    return (
      <div className="flex justify-center items-center h-96">
        <p className="text-xl text-gray-400">No data available</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4">
        {category === "drawing" && (
          <DrawingsPrimary
            files={files}
            category={category}
            qrCodeIdInURL={`${qrCodeIdInURL}`}
          />
        )}
        {category === "coordination-issue" &&
          files?.map((tool, i) => {
            const attachments = getArray(tool, "attachments");
            return (
              <Link
                to={`/tools/${asString(tool.procoreToolName, "")}/${asString(tool.procoreItemID, "")}?qrCodeId=${qrCodeIdInURL}`}
                className="relative w-full max-w-md rounded-lg border-2 border-gray-200 bg-white shadow-sm col-span-3 p-4 flex justify-between items-center cursor-pointer"
                key={i}
              >
                <div className="flex flex-col items-start ">
                  <p className="text-left font-semibold px-1 line-clamp-2 ">
                    {asString(tool.title, "")}
                  </p>
                  <p className="text-sm text-gray-400  whitespace-nowrap absolute -top-3 bg-white px-1">
                    {asString(tool.issue_number, "")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {attachments.length > 0 && (
                    <PaperClipIcon className="bg-[#FFB310] block size-6 p-1 rounded-full text-white -rotate-[45deg] shadow-sm" />
                  )}
                  <InfoIcon className="bg-[#FFB310] p-1 size-6 rounded-full block !text-white shadow-sm" />
                </div>
              </Link>
            );
          })}
        {category === "incident" &&
          files
            ?.slice()
            .sort((a, b) => {
              const aDate = asDateLike(a.event_date);
              const bDate = asDateLike(b.event_date);
              return (
                new Date(bDate ?? 0).getTime() - new Date(aDate ?? 0).getTime()
              );
            })
            .map((tool, i) => {
              const attachments = getArray(tool, "attachments");
              const eventDate = asDateLike(tool.event_date);
              return (
                <Link
                  to={`/tools/${asString(tool.procoreToolName, "")}/${asString(tool.procoreItemID, "")}?qrCodeId=${qrCodeIdInURL}`}
                  className=" relative w-full max-w-md rounded-lg border-2 border-gray-200 bg-white shadow-sm col-span-3 p-3 flex justify-between items-center cursor-pointer"
                  key={i}
                >
                  <div className="flex flex-col items-start ">
                    <p className="text-left font-semibold px-1 line-clamp-2 ">
                      {asString(tool.title, "")}
                    </p>
                    <p className="text-sm text-gray-400  whitespace-nowrap absolute -top-3 bg-white px-1">
                      {eventDate
                        ? new Date(eventDate).toLocaleDateString("en-US")
                        : "N/A"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {attachments.length > 0 && (
                      <PaperClipIcon className="bg-[#FFB310] block size-7 p-1 rounded-full text-white -rotate-[45deg] shadow-sm" />
                    )}
                    <InfoIcon className="bg-[#FFB310] p-1 size-7 rounded-full block !text-white shadow-sm" />
                  </div>
                </Link>
              );
            })}
        {category === "inspection" &&
          files?.reduce(
            (d, tool) => {
              const inspTypeRec = asRecord(tool.inspection_type);
              const inspectionType = asString(inspTypeRec?.name, "Other");
              if (!d[inspectionType]) {
                d[inspectionType] = [];
              }
              (d[inspectionType] as Record<string, unknown>[]).push(tool);
              return d;
            },
            {} as Record<string, Record<string, unknown>[]>,
          ) &&
          Object.entries(
            files.reduce(
              (d, tool) => {
                const inspTypeRec = asRecord(tool.inspection_type);
                const inspectionType = asString(inspTypeRec?.name, "Other");
                if (!d[inspectionType]) {
                  d[inspectionType] = [];
                }
                (d[inspectionType] as Record<string, unknown>[]).push(tool);
                return d;
              },
              {} as Record<string, Record<string, unknown>[]>,
            ),
          ).map(([inspectionType, tools], i) => (
            <div
              key={i}
              className="flex flex-col gap-2 col-span-2 overflow-hidden"
            >
              <details
                open={openDetail === inspectionType}
                className={`group w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-sm  ${openDetail === inspectionType ? "border-[2px] border-yellow-300" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  setOpenDetail(
                    openDetail === inspectionType ? null : inspectionType,
                  );
                }}
              >
                <summary
                  className={`flex cursor-pointer items-center justify-between p-4 text-lg rounded-lg font-medium hover:bg-gray-50 !list-none ${openDetail === inspectionType ? " bg-yellow-100/50" : ""}`}
                >
                  <span>{inspectionType}</span>
                  <MoreDataIcon />
                </summary>
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-scroll overflow-x-hidden">
                  {(tools as Record<string, unknown>[]).map((tool, j) => (
                    <div
                      key={j}
                      className="flex flex-col gap-2 border border-gray-200  rounded-lg  bg-white  col-span-1 p-2 shadow-lg"
                    >
                      <div className="flex justify-between items-center gap-8">
                        <div className="flex items-center gap-4">
                          <p className="text-xs whitespace-nowrap">
                            {asString(tool.identifier, "")}
                          </p>
                        </div>
                        <div className="flex justify-between w-full">
                          <Link
                            to={`/tools/${asString(tool.procoreToolName, "")}/${asString(tool.procoreItemID, "")}?qrCodeId=${qrCodeIdInURL}`}
                          >
                            <p className="text-left flex-1 underline text-base">
                              {asString(tool?.name, "")}
                            </p>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ))}
        {category === "observation" &&
          files?.map((tool, i) => {
            const attachments = getArray(tool, "attachments");
            return (
              <Link
                to={`/tools/${asString(tool.procoreToolName, "")}/${asString(tool.procoreItemID, "")}?qrCodeId=${qrCodeIdInURL}`}
                className="relative w-full max-w-md rounded-lg border-2 border-gray-200 bg-white shadow-sm col-span-3 p-4 flex justify-between items-center cursor-pointer"
                key={i}
              >
                <div className="flex flex-col items-start ">
                  <p className="text-left font-semibold ">
                    {asString(tool.name, "")}
                  </p>
                  <p className="text-sm text-gray-400  whitespace-nowrap absolute -top-3 bg-white px-1">
                    {asString(tool.number, "")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {attachments.length > 0 && (
                    <PaperClipIcon className="bg-[#FFB310] block size-7 p-1 rounded-full text-white -rotate-[45deg] shadow-sm" />
                  )}
                  <InfoIcon className="bg-[#FFB310] p-1 size-7 rounded-full block !text-white shadow-sm" />
                </div>
              </Link>
            );
          })}
        {category === "photo" && (
          <PhotoGallery
            files={files}
            category={category}
            qrCodeIdInURL={`${qrCodeIdInURL}`}
          />
        )}
        {category === "punch-list" &&
          files
            ?.slice()
            .sort((a, b) => {
              const statusOrder = ["overdue", "open", "closed"];
              const statusA = statusOrder.indexOf(
                asString(a.status, "").toLowerCase(),
              );
              const statusB = statusOrder.indexOf(
                asString(b.status, "").toLowerCase(),
              );
              return (
                (statusA === -1 ? statusOrder.length : statusA) -
                (statusB === -1 ? statusOrder.length : statusB)
              );
            })
            .map((tool, i) => {
              const status = asString(tool.status, "");
              const tradeRec = asRecord(tool.trade);
              return (
                <Link
                  to={`/tools/${asString(tool.procoreToolName, "")}/${asString(tool.procoreItemID, "")}?qrCodeId=${qrCodeIdInURL}`}
                  className="relative w-full max-w-md rounded-lg border-2 border-gray-200 bg-white shadow-sm col-span-3 p-4 flex justify-between items-center cursor-pointer"
                  key={i}
                >
                  <div className="flex flex-col items-start ">
                    <p className="text-left font-semibold px-1 line-clamp-2 ">
                      {asString(tool.name, "")}
                    </p>
                    <p
                      className={`text-sm text-gray-400  whitespace-nowrap absolute -top-3 bg-white px-1 ${status.toLowerCase() === "overdue" ? "text-red-500" : ""}`}
                    >
                      {status}
                    </p>
                    <p className="text-sm text-gray-400  whitespace-nowrap bg-white px-1">
                      {asString(tradeRec?.name, "")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="bg-[#FFB310] px-2 rounded-md py-1 !text-white shadow-sm">
                      View
                    </button>
                  </div>
                </Link>
              );
            })}
        {category === "rfi" &&
          files
            ?.slice()
            .sort((a, b) => {
              const aDate = asDateLike(b.created_at);
              const bDate = asDateLike(a.created_at);
              return (
                new Date(aDate ?? 0).getTime() - new Date(bDate ?? 0).getTime()
              );
            })
            ?.map((tool, i) => {
              const status = asString(tool.status, "");
              return (
                <Link
                  to={`/tools/${asString(tool.procoreToolName, "")}/${asString(tool.procoreItemID, "")}?qrCodeId=${qrCodeIdInURL}`}
                  className="relative w-full max-w-md rounded-lg border-2 border-gray-200 bg-white shadow-sm col-span-3 p-4 flex justify-between items-center cursor-pointer"
                  key={i}
                >
                  <div className="flex flex-col items-start ">
                    <div className="flex flex-col gap-1">
                      <p className="text-left font-semibold px-1 line-clamp-2 ">
                        {asString(tool.subject, "")}
                      </p>
                      <span
                        className={`text-left text-sm  line-clamp-2 w-max rounded-xl px-2  ${status === "open" ? "bg-green-200 text-green-700" : "bg-gray-400 text-white "}`}
                      >
                        {status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400  whitespace-nowrap absolute -top-3 bg-white px-1">
                      {asString(tool.number, "")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="bg-[#FFB310] px-2 rounded-md py-1 !text-white shadow-sm">
                      View
                    </button>
                  </div>
                </Link>
              );
            })}
        {category === "specification" && (
          <SpecificationsPrimary
            qrCodeIdInURL={`${qrCodeIdInURL}`}
            files={files}
            category={category}
          />
        )}
        {category === "submittal" &&
          files
            ?.slice()
            .sort((a, b) => {
              const aSpec = asRecord(a?.specification_section);
              const bSpec = asRecord(b?.specification_section);
              const aNum = aSpec?.number as number | undefined;
              const bNum = bSpec?.number as number | undefined;
              return aNum && bNum ? aNum - bNum : -1;
            })
            .map((tool, i) => {
              const specSection = asRecord(tool.specification_section);
              const attachments = getArray(tool, "attachments");
              const assocAttachments = getArray(tool, "associated_attachments");
              return (
                <Link
                  to={`/tools/${asString(tool.procoreToolName, "")}/${asString(tool.procoreItemID, "")}?qrCodeId=${qrCodeIdInURL}`}
                  className="relative w-full max-w-md rounded-lg border-2 border-gray-200 bg-white shadow-sm col-span-3 p-4 flex justify-between items-center cursor-pointer"
                  key={i}
                >
                  <div className="flex flex-col items-start ">
                    <p className="text-left font-semibold px-1 line-clamp-2 ">
                      {asString(tool.title, "")}
                    </p>
                    <p className="text-sm text-gray-400  whitespace-nowrap absolute -top-3 bg-white px-1">
                      {asString(specSection?.number, "")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(attachments.length > 0 ||
                      assocAttachments.length > 0) && (
                      <PaperClipIcon className="bg-[#FFB310] block size-6 p-1 rounded-full text-white -rotate-[45deg] shadow-sm" />
                    )}
                    <InfoIcon className="bg-[#FFB310] p-1 size-6 rounded-full block !text-white shadow-sm" />
                  </div>
                </Link>
              );
            })}
        {category === "instruction" &&
          files
            ?.slice()
            .sort((a, b) => {
              const aDate = asDateLike(b.created_at);
              const bDate = asDateLike(a.created_at);
              return (
                new Date(aDate ?? 0).getTime() - new Date(bDate ?? 0).getTime()
              );
            })
            ?.map((tool, i) => {
              const attachments = getArray(tool, "attachments");
              return (
                <Link
                  to={`/tools/${asString(tool.procoreToolName, "")}/${asString(tool.procoreItemID, "")}?qrCodeId=${qrCodeIdInURL}`}
                  className="relative w-full max-w-md rounded-lg border-2 border-gray-200 bg-white shadow-sm col-span-3 p-4 flex justify-between items-center cursor-pointer"
                  key={i}
                >
                  <div className="flex flex-col items-start ">
                    <p className="text-left font-semibold px-1 line-clamp-2 ">
                      {asString(tool.title, "")}
                    </p>
                    <p className="text-sm text-gray-400  whitespace-nowrap absolute -top-3 bg-white px-1">
                      {asString(tool.number, "")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {attachments.length > 0 && (
                      <PaperClipIcon className="bg-[#FFB310] block size-7 p-1 rounded-full text-white -rotate-[45deg] shadow-sm" />
                    )}
                    <InfoIcon className="bg-[#FFB310] p-1 size-7 rounded-full block !text-white shadow-sm" />
                  </div>
                </Link>
              );
            })}
        {category === "directory" &&
          files
            ?.slice()
            .sort((a, b) =>
              asString(a.first_name, "").localeCompare(
                asString(b.first_name, ""),
              ),
            )
            ?.map((tool, i) => {
              const mobilePhone = asString(tool?.mobile_phone, "");
              const emailAddress = asString(tool?.email_address, "");
              return (
                <div
                  key={i}
                  className="p-4 col-span-2 gap-y-8 rounded-lg text-black space-y-2 border border-gray-300 shadow-xl gap overflow-hidden"
                >
                  <Link
                    to={`/tools/${asString(tool.procoreToolName, "")}/${asString(tool.procoreItemID, "")}?qrCodeId=${qrCodeIdInURL}`}
                    className="block"
                  >
                    <div className="flex justify-between">
                      <h1 className="text-2xl font-bold">
                        {asString(tool.name, "")}
                      </h1>
                      <InfoIcon className="bg-[#FFB310] p-1 size-6 rounded-full block !text-white shadow-sm" />
                    </div>
                  </Link>
                  <div className="flex gap-2 items-center w-max">
                    <PhoneIcon />
                    <a
                      href={mobilePhone ? `tel:${mobilePhone}` : ""}
                      className={`text-sm text-blue-500 ${mobilePhone ? "underline" : ""}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {mobilePhone || "-"}
                    </a>
                  </div>
                  <div className="flex gap-2 items-center w-max break-words">
                    <EmailIcon />
                    <a
                      href={emailAddress ? `mailto:${emailAddress}` : ""}
                      className={`text-sm text-blue-500 ${emailAddress ? "underline" : ""}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {emailAddress || "-"}
                    </a>
                  </div>
                </div>
              );
            })}
        {category === "form" &&
          files?.map((tool, i) => {
            const attachments = getArray(tool, "attachments");
            return (
              <Link
                to={`/tools/${asString(tool.procoreToolName, "")}/${asString(tool.procoreItemID, "")}?qrCodeId=${qrCodeIdInURL}`}
                className=" w-full max-w-md rounded-lg border-2 border-gray-200 bg-white shadow-sm col-span-3 p-4 flex justify-between items-center cursor-pointer"
                key={i}
              >
                <div className="flex flex-col items-start ">
                  <p className="text-left font-semibold ">
                    {asString(tool.name, "")}
                  </p>
                  <p className="text-xs whitespace-nowrap ">
                    {asString(tool.number, "")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {attachments.length > 0 ? (
                    <PaperClipIcon className="bg-[#FFB310] block size-7 p-1 rounded-full text-white -rotate-[45deg] shadow-sm" />
                  ) : tool?.attachment ? (
                    <PaperClipIcon className="bg-[#FFB310] block size-7 p-1 rounded-full text-white -rotate-[45deg] shadow-sm" />
                  ) : null}

                  <InfoIcon className="bg-[#FFB310] p-1 size-7 rounded-full block !text-white shadow-sm" />
                </div>
              </Link>
            );
          })}
        {category === "task" &&
          files?.map((tool, i) => (
            <Link
              to={`/tools/${asString(tool.procoreToolName, "")}/${asString(tool.procoreItemID, "")}?qrCodeId=${qrCodeIdInURL}`}
              className="relative w-full max-w-md rounded-lg border-2 border-gray-200 bg-white shadow-sm col-span-3 p-4 flex justify-between items-center cursor-pointer"
              key={i}
            >
              <div className="flex flex-col items-start ">
                <p className="text-left font-semibold px-1 line-clamp-2 ">
                  {asString(tool.title, "")}
                </p>
                <p className="text-sm text-gray-400  whitespace-nowrap absolute -top-3 bg-white px-1">
                  {asString(tool.number, "")}
                </p>
              </div>
              <button className="bg-[#FFB310] px-2 rounded-md py-1 !text-white shadow-sm">
                View
              </button>
            </Link>
          ))}
      </div>
    </div>
  );
};
