/**
 * @fileoverview Renders an icon matching the given MIME type or link status.
 */

import { ExcelSheetIcon } from "../assets/icons/ExcelSheetIcon";
import { GenericDocIcon } from "../assets/icons/GenericDocIcon";
import { ExternalLinkIcon } from "../assets/icons/ExternalLinkIcon";
import { ImageLinkIcon } from "../assets/icons/ImageLinkIcon";
import { PDFDocIcon } from "../assets/icons/PDFDocIcon";
import { WordDocIcon } from "../assets/icons/WordDocIcon";

/**
 * Returns the appropriate file-type icon based on MIME type or link status.
 * @param type - MIME type string (e.g., "application/pdf", "image/png")
 * @param isLink - When true, renders the external link icon regardless of type
 * @param className - Optional additional CSS class names
 */
export const FileTypeIcon = ({
  type,
  isLink,
  className,
}: {
  type: string;
  isLink?: boolean;
  className?: string;
}) => {
  if (isLink) {
    return <ExternalLinkIcon className={`!w-6 !h-6 ${className} `} />;
  } else if (
    type?.includes("image/") ||
    type?.includes("png") ||
    type?.includes("jpeg") ||
    type?.includes("jpg")
  ) {
    return <ImageLinkIcon className={`!w-6 !h-6 ${className} `} />;
  } else if (type === "application/pdf" || type?.includes(".pdf")) {
    return <PDFDocIcon className={`!w-6 !h-6 ${className}`} />;
  } else if (
    type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return <WordDocIcon className="!w-6 h-6" />;
  } else if (
    type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return <ExcelSheetIcon className={`!w-6 !h-6 ${className}`} />;
  }
  return <GenericDocIcon className="!w-6 h-6" />;
};
