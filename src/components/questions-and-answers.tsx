import { useId, useRef, useState } from "react";
import { ExcelSheetIcon } from "../assets/icons/ExcelSheetIcon";
import { GenericDocIcon } from "../assets/icons/GenericDocIcon";
import { ImageLinkIcon } from "../assets/icons/ImageLinkIcon";
import { PDFDocIcon } from "../assets/icons/PDFDocIcon";
import { WordDocIcon } from "../assets/icons/WordDocIcon";
import { CheckBadgeIcon } from "../assets/icons/CheckBadgeIcon";
import { PdfOpener } from "./pdf-opener";
import { createSafeHtml } from "@/utils/sanitize";

const FileIcon = ({ type }: { type: string }) => {
  if (
    type?.startsWith("image/") ||
    ["image", "jpeg", "png", "jpg"].some((ext) => type.includes(ext))
  ) {
    return <ImageLinkIcon className=" text-gray-700 " />;
  } else if (type === "application/pdf") {
    return <PDFDocIcon className=" w-[10px]" />;
  } else if (
    type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return <WordDocIcon />;
  } else if (
    type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return <ExcelSheetIcon />;
  }
  return <GenericDocIcon className="!w-10 !h-10" />;
};

interface Attachment {
  url: string;
  content_type: string;
  name: string;
  filename?: string;
}

interface Question {
  created_by: string;
  question_date: string;
  initiated_at: string;
  attachments: Attachment[];
  body?: string;
  plain_text_body?: string;
}

interface Answer {
  created_by: string;
  answer_date: string | number | Date;
  rich_text_body: string;
  plain_text_body: string;
  official?: boolean;
  attachments: Attachment[];
}

interface QuestionAnswerProps {
  question: Question;
  initiated_at: string;
  answers: Answer[];
  qrCodeId: string;
  official: boolean;
}

export const QuestionAnswerComponent = ({
  question,
  answers,
}: QuestionAnswerProps) => {
  const [fileUrl, setFileUrl] = useState("");
  const pdfFormId = `pdf-form-submit-${useId().replace(/:/g, "")}`;
  const linkRef = useRef<HTMLAnchorElement>(null);

  return (
    <div className="flex flex-col gap-2 rounded-lg shadow-md">
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
      <div className=" flex flex-col place-self-start min-w-[80%]  ">
        <div className="relative flex flex-col ml-[20px]  max-w-[80%] rounded-lg bg-yellow-100 p-4 text-white shadow-sm">
          <p className="text-gray-500 text-xs">
            {`Request by ${question?.created_by || "unknown"}`}
          </p>
          <span className="text-gray-500 text-xs">
            {` ${new Date(question.question_date).toLocaleString()}`}
          </span>
          <span className="text-black mt-2 break-words">
            {`${(question.body || question.plain_text_body)?.replace(/<\/?p>/g, "")}`}
          </span>
          <div className="flex flex-wrap items-center gap-y-2  gap-x-2 pt-4 justify-start">
            {question?.attachments?.map((attachment, i) => (
              <div className=" flex flex-shrink-0" key={i}>
                <button
                  type="submit"
                  form={pdfFormId}
                  onClick={() => setFileUrl(attachment.url)}
                  className="flex flex-col items-center group min-w-[80px] hover:opacity-80 transition-opacity"
                >
                  <div className="text-gray-500 group-hover:text-gray-700 transition-colors">
                    <FileIcon type={attachment?.name} />
                  </div>
                  <span className="text-xs text-center truncate w-20 mt-1 text-black">
                    {attachment?.name}
                  </span>
                </button>
              </div>
            ))}
          </div>
          <div className="absolute z-5">
            <div className="rounded-sm before:absolute before:!-bottom-2.5 before:-left-5 before:h-4 before:w-4 before:-rotate-45 before:transform before:border-l-2 before:border-t-2 before:border-yellow-100 before:bg-yellow-100">
              {" "}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2  rounded-b-lg py-3 ">
        {answers.map(
          (
            answer: {
              created_by: string;
              answer_date: string | number | Date;
              rich_text_body: string;
              plain_text_body: string;
              attachments: Attachment[];
              official?: boolean;
            },
            index: number,
          ) => (
            <div
              key={index}
              className=" mr-[20px] relative max-w-[80%] min-w-[80%]  rounded-lg bg-green-100 p-4 text-white shadow-sm flex flex-col place-self-end"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="">
                  <p className="text-gray-500 text-xs">
                    {`Answer ${index + 1} by ${answer.created_by}`}
                  </p>
                  <span className="text-gray-500 text-xs">
                    {`${new Date(answer.answer_date).toLocaleString()}`}
                  </span>
                </div>

                <div className=" flex justify-end  !w-[25%]">
                  {answer?.official && (
                    <div className=" flex flex-row items-start pb-2 gap-2 text-blue-500  ">
                      <CheckBadgeIcon />
                      <p className="text-xs">OFFICIAL RESPONSE</p>
                    </div>
                  )}
                </div>
              </div>

              <div
                className="prose text-gray-700 text-base mt-2"
                dangerouslySetInnerHTML={createSafeHtml(
                  answer.rich_text_body || answer.plain_text_body,
                )}
              />
              {answer.attachments.length > 0 && (
                <div className="flex  gap-4 mt-2">
                  {answer.attachments.map((attachment, i) => (
                    <div className=" flex flex-shrink-0" key={i}>
                      <button
                        type="submit"
                        form={pdfFormId}
                        onClick={() => setFileUrl(attachment.url)}
                        className="flex flex-col items-center group min-w-[80px] hover:opacity-80 transition-opacity"
                      >
                        <div className="text-gray-500 group-hover:text-gray-700 transition-colors">
                          <FileIcon type={attachment?.name} />
                        </div>
                        <span className="text-xs text-center truncate w-20 mt-1 text-black">
                          {attachment?.name}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-sm before:absolute before:bottom-2.5 before:-right-[5px] before:h-4 before:w-4 before:-rotate-45 before:transform before:border-l-2 before:border-t-2 before:border-green-100 before:bg-green-100 shadow-sm">
                {" "}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
};
