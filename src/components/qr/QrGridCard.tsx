import type { ReactNode } from "react";
import Badge from "@components/ui/Badge";
import QrCode from "@components/qr/QrCodeImage";
import Button from "@components/ui/Button";
import { formatDate } from "@/lib/format";
import { useQRImageSignedUrl } from "@/api/endpoints/qr-codes";

export type QrType =
  | "File"
  | "Taliho"
  | "URL"
  | "Static"
  | "Procore Tool"
  | "Procore Location"
  | "Procore Drawing"
  | "Unknown";

type QrGridCardProps = {
  qrImageSrc?: string;
  /** Optional: when provided, component will fetch a signed URL for S3 images */
  qrCodeId?: string;
  /** Optional: indicates that the QR has an S3 image to sign */
  hasS3Image?: boolean;
  title: string;
  type: QrType;
  created: string;
  scans: number;
  onClick?: () => void;
  showCheckbox?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  actions?: ReactNode;
  className?: string;
};

function typeToBadgeVariant(type: QrType) {
  switch (type) {
    case "File":
      return "blue" as const;
    case "Taliho":
      return "slate" as const;
    case "URL":
      return "green" as const;
    case "Static":
      return "gray" as const;
    case "Procore Tool":
      return "orange" as const;
    case "Procore Location":
      return "orange" as const;
    case "Procore Drawing":
      return "orange" as const;
    default:
      return "gray" as const;
  }
}

export default function QrGridCard(props: QrGridCardProps) {
  const {
    qrImageSrc,
    qrCodeId,
    hasS3Image,
    title,
    type,
    created,
    scans,
    onClick,
    showCheckbox,
    selected,
    onToggleSelect,
    actions,
    className = "",
  } = props;

  const enableSigned = Boolean(qrCodeId && hasS3Image);
  const {
    data: signedImageUrl,
    isLoading: isLoadingImage,
    isError: isImageError,
  } = useQRImageSignedUrl(qrCodeId || "", enableSigned);
  const effectiveSrc = signedImageUrl || qrImageSrc || "";
  // Show loading spinner only when fetching signed URL and no fallback image exists
  const showImageLoading = enableSigned && isLoadingImage && !effectiveSrc;

  return (
    <div
      className={`h-full bg-white rounded-lg ring-1 ring-gray-200 shadow-[0_-1px_4px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.06)] hover:shadow-[0_-2px_6px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col relative hover:bg-gray-50 cursor-pointer ${className}`}
      onClick={onClick}
    >
      {showCheckbox ? (
        <div className="absolute top-2 left-2">
          <input
            aria-label={`Select ${title}`}
            type="checkbox"
            checked={Boolean(selected)}
            onClick={(e) => e.stopPropagation()}
            onChange={() => {
              if (onToggleSelect) onToggleSelect();
            }}
            className="h-5 w-5 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500 accent-yellow-600"
          />
        </div>
      ) : null}

      <div className="aspect-square bg-white flex items-center justify-center border-b border-gray-200 p-4">
        {showImageLoading ? (
          <div className="flex items-center justify-center w-full h-full">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
          </div>
        ) : (
          <QrCode
            src={effectiveSrc}
            alt={`QR Code for ${title}`}
            variant="responsive"
            showPlaceholder={!effectiveSrc || isImageError}
          />
        )}
      </div>
      <div className="p-4 flex-grow flex flex-col justify-between">
        <h3
          className="grow font-medium text-gray-900 text-sm line-clamp-2"
          title={title}
        >
          {title}
        </h3>
        <div>
          <div className="mt-1">
            <Badge variant={typeToBadgeVariant(type)}>{type}</Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Created: {formatDate(created)}
          </p>
          <p className="text-xs text-gray-500">Scans: {scans}</p>
        </div>
      </div>
      <div className="border-t border-gray-200 bg-gray-50 px-3 py-1 flex justify-end">
        {actions ?? (
          <>
            <Button
              type="button"
              variant="iconGhost"
              leftIconClass="bx bx-download"
              aria-label="Download"
            />
            <Button
              type="button"
              variant="iconGhost"
              leftIconClass="bx bx-pencil"
              aria-label="Edit"
            />
            <Button
              type="button"
              variant="iconDangerGhost"
              leftIconClass="bx bx-trash"
              aria-label="Delete"
            />
          </>
        )}
      </div>
    </div>
  );
}
