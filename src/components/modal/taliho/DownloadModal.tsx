import { useState, type ReactNode } from "react";
import Button from "../../ui/Button";
import Modal from "../Modal";

export type DownloadFormat = "zip" | "csv" | "pdf";

type DownloadModalProps = {
  open: boolean;
  onConfirm: (settings: {
    format: DownloadFormat;
    includeAnalytics: boolean;
  }) => void;
  onClose: () => void;
  /** Optional explicit title; defaults to a generic title */
  title?: string;
  /** Optional explicit subtitle. If omitted, subjectLabel/selectedCount may auto-compose one */
  subtitle?: ReactNode;
  /** Base subject to compose default subtitle (e.g. 'arrangement', 'equipment group', 'QR code', 'item') */
  subjectLabel?: string;
  /** Optional count for subtitle pluralization */
  selectedCount?: number;
  /** Initial values */
  initialFormat?: DownloadFormat;
  initialIncludeAnalytics?: boolean;
  /** Option labels */
  zipLabel?: string;
  csvLabel?: string;
  pdfLabel?: string;
  /** Other labels */
  confirmLabel?: string;
  cancelLabel?: string;
  includeAnalyticsLabel?: string;
  /** Loading label shown on confirm button while processing */
  loadingLabel?: string;
  /** Whether the modal is in a loading/processing state */
  isLoading?: boolean;
  /** Modal size */
  size?: "sm" | "md" | "lg" | "xl";
};

function pluralize(base: string, count?: number): string {
  if (typeof count !== "number") return base;
  return count === 1 ? base : `${base}s`;
}

export default function DownloadModal(props: DownloadModalProps) {
  const {
    open,
    onConfirm,
    onClose,
    title = "Prepare Download",
    subtitle,
    subjectLabel,
    selectedCount,
    initialFormat = "zip",
    initialIncludeAnalytics = false,
    zipLabel = "ZIP (bundled export)",
    csvLabel = "CSV only",
    pdfLabel = "PDF summary",
    confirmLabel = "Download",
    cancelLabel = "Cancel",
    includeAnalyticsLabel = "Include analytics (last 30 days)",
    loadingLabel = "Downloading…",
    isLoading = false,
    size = "lg",
  } = props;

  const [format, setFormat] = useState<DownloadFormat>(initialFormat);
  const [includeAnalytics, setIncludeAnalytics] = useState<boolean>(
    initialIncludeAnalytics,
  );

  const computedSubtitle: ReactNode =
    subtitle ??
    (subjectLabel && typeof selectedCount === "number" ? (
      <span>
        Prepare download for {selectedCount}{" "}
        {pluralize(subjectLabel, selectedCount)}.
      </span>
    ) : (
      <span>
        Prepare download
        {typeof selectedCount === "number"
          ? ` for ${selectedCount} selected item${selectedCount === 1 ? "" : "s"}`
          : ""}
        .
      </span>
    ));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={computedSubtitle}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="primary"
            leftIconClass={
              isLoading ? "bx bx-loader-alt bx-spin" : "bx bx-download"
            }
            disabled={isLoading}
            onClick={() => onConfirm({ format, includeAnalytics })}
          >
            {isLoading ? loadingLabel : confirmLabel}
          </Button>
        </>
      }
      size={size}
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="block text-sm font-medium text-gray-700 mb-2">
            Format
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-center p-3 border rounded-md shadow-sm bg-white cursor-pointer has-[:checked]:border-yellow-500 has-[:checked]:bg-yellow-50 has-[:checked]:ring-1 has-[:checked]:ring-yellow-500">
              <input
                type="radio"
                name="download-format"
                className="hidden"
                checked={format === "zip"}
                onChange={() => setFormat("zip")}
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                {zipLabel}
              </span>
            </label>
            <label className="flex items-center p-3 border rounded-md shadow-sm bg-white cursor-pointer has-[:checked]:border-yellow-500 has-[:checked]:bg-yellow-50 has-[:checked]:ring-1 has-[:checked]:ring-yellow-500">
              <input
                type="radio"
                name="download-format"
                className="hidden"
                checked={format === "csv"}
                onChange={() => setFormat("csv")}
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                {csvLabel}
              </span>
            </label>
            <label className="flex items-center p-3 border rounded-md shadow-sm bg-white cursor-pointer has-[:checked]:border-yellow-500 has-[:checked]:bg-yellow-50 has-[:checked]:ring-1 has-[:checked]:ring-yellow-500">
              <input
                type="radio"
                name="download-format"
                className="hidden"
                checked={format === "pdf"}
                onChange={() => setFormat("pdf")}
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                {pdfLabel}
              </span>
            </label>
          </div>
        </fieldset>
        <label className="flex items-center text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
            checked={includeAnalytics}
            onChange={(e) => setIncludeAnalytics(e.target.checked)}
          />
          <span className="ml-2 text-gray-700">{includeAnalyticsLabel}</span>
        </label>
      </div>
    </Modal>
  );
}
