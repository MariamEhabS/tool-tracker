import { ImageLinkIcon } from "../assets/icons/ImageLinkIcon";
import { PDFDocIcon } from "../assets/icons/PDFDocIcon";
import { WordDocIcon } from "../assets/icons/WordDocIcon";
import { ExcelSheetIcon } from "../assets/icons/ExcelSheetIcon";
import { GenericDocIcon } from "../assets/icons/GenericDocIcon";
import toast from "react-hot-toast";
import { useId, useState } from "react";
import { PdfOpener } from "./pdf-opener";

const FileIcon = ({ type }: { type: string }) => {
  if (
    type?.includes("image/") ||
    type.includes("png") ||
    type.includes("jpeg") ||
    type.includes("jpg")
  ) {
    return <ImageLinkIcon />;
  } else if (type?.includes(".pdf") || type === "application/pdf") {
    return <PDFDocIcon />;
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
  return <GenericDocIcon />;
};
interface Attachment {
  url: string;
  content_type: string;
  name: string;
  filename?: string;
}

interface AttachmentsSectionProps {
  attachments: Attachment[];
  index?: number;
  qrCodeId: string;
}

export const VerticalAttachmentSection = ({
  attachments,
}: AttachmentsSectionProps) => {
  const [fileUrl, setFileUrl] = useState("");
  const pdfFormId = `pdf-form-submit-${useId().replace(/:/g, "")}`;
  return (
    <div className="relative">
      <PdfOpener procoreUrl={fileUrl} formId={pdfFormId} />
      {attachments?.map((attachment, i) => (
        <button
          type="submit"
          form={pdfFormId}
          onClick={() => {
            toast.loading("Loading document...");
            setFileUrl(attachment.url);
            toast.dismiss();
          }}
          className="flex items-center mt-2 gap-4  bg-gray-100 border-2 border-yellow-400 px-4 py-2 shadow-sm rounded-md"
          key={i}
        >
          <div className="text-gray-500 col-span-1 group-hover:text-gray-700 transition-colors">
            <FileIcon
              type={
                attachment.content_type ||
                attachment?.name ||
                attachment?.filename ||
                "file"
              }
            />
          </div>
          <div className="flex flex-col  items-start col-span-4 line-clamp-1 break-words truncate ">
            <span className="text-base text-center mt-1 ">
              {attachment?.name || attachment?.filename || "file"}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
};
