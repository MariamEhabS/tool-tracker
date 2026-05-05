import { useCallback, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import toast from "react-hot-toast";
import Modal from "@/components/modal/Modal";

/**
 * Receipt upload for tool records — used in the Create flow (optional
 * field) and in the Tool Detail modal (also optional, shown after a
 * tool already exists). Accepts PNG, JPG, and PDF up to 10 MB. Drag-
 * and-drop and click-to-browse both work; thumbnails open a larger
 * viewer modal.
 */

const VALID_TYPES = ["image/png", "image/jpeg", "application/pdf"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPT_ATTR = ".png,.jpg,.jpeg,.pdf,application/pdf,image/png,image/jpeg";

export type ReceiptKind = "image" | "pdf";

export interface ReceiptFile {
  /** Original filename (e.g. "home-depot-2024-08-12.pdf"). */
  name: string;
  /** MIME type — used to render the right preview affordance. */
  mimeType: string;
  /** Discriminator computed from mimeType. */
  kind: ReceiptKind;
  /** Object URL (blob:…) or remote URL. */
  url: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export function validateReceiptFile(file: File): void {
  if (!VALID_TYPES.includes(file.type)) {
    throw new Error("Receipts must be PNG, JPG, or PDF.");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("Receipts must be 10 MB or smaller.");
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function fileToReceipt(file: File): ReceiptFile {
  return {
    name: file.name,
    mimeType: file.type,
    kind: file.type === "application/pdf" ? "pdf" : "image",
    url: URL.createObjectURL(file),
  };
}

interface ReceiptUploadProps {
  receipt: ReceiptFile | null;
  onSelect: (receipt: ReceiptFile) => void;
  onRemove: () => void;
  disabled?: boolean;
  /** Compact (default false): smaller tile + label, suitable for inline form rows.
   * When false, renders the larger drop-zone style for empty state. */
  compact?: boolean;
  testIdPrefix?: string;
}

export default function ReceiptUpload(props: ReceiptUploadProps) {
  const {
    receipt,
    onSelect,
    onRemove,
    disabled = false,
    compact = false,
    testIdPrefix = "receipt",
  } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      try {
        validateReceiptFile(file);
        onSelect(fileToReceipt(file));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Invalid receipt file.",
        );
      }
    },
    [onSelect],
  );

  const openPicker = useCallback(() => {
    if (disabled) return;
    fileInputRef.current?.click();
  }, [disabled]);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [handleFile],
  );

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragging(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragging(true);
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (disabled) return;
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    },
    [disabled, handleFile],
  );

  // Empty state — full drop zone
  if (!receipt) {
    return (
      <>
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`rounded-lg border-2 border-dashed transition ${
            isDragging && !disabled
              ? "border-brand-500 bg-brand-50"
              : disabled
                ? "border-gray-200 bg-gray-50"
                : "border-gray-300 bg-gray-50 hover:border-brand-400 hover:bg-brand-50/40"
          } ${compact ? "px-4 py-3" : "px-5 py-6"}`}
          data-testid={`${testIdPrefix}-empty`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_ATTR}
            onChange={handleFileChange}
            className="hidden"
            disabled={disabled}
            data-testid={`${testIdPrefix}-file-input`}
          />
          <div className="flex items-center gap-3">
            <i
              className={`bx bx-receipt ${
                compact ? "text-2xl" : "text-3xl"
              } text-gray-400`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={openPicker}
                disabled={disabled}
                className="text-sm font-medium text-gray-700 hover:text-gray-900 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid={`${testIdPrefix}-upload-button`}
              >
                <i className="bx bx-upload text-sm" />
                Upload receipt
              </button>
              <span className="text-xs text-gray-500 ml-2">
                or drag &amp; drop
              </span>
              <p className="text-xs text-gray-500 mt-0.5">
                PNG, JPG, or PDF. Up to 10 MB. Optional.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Filled state — thumbnail + filename + view/remove
  return (
    <>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`flex items-center gap-3 rounded-lg border ${
          isDragging && !disabled
            ? "border-brand-500 bg-brand-50"
            : "border-gray-200 bg-white"
        } px-3 py-2.5`}
        data-testid={`${testIdPrefix}-filled`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTR}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
          data-testid={`${testIdPrefix}-file-input`}
        />
        <button
          type="button"
          onClick={() => setViewerOpen(true)}
          aria-label="View receipt"
          title="Click to view larger"
          className="shrink-0 h-12 w-12 rounded-md ring-1 ring-gray-200 overflow-hidden bg-gray-50 hover:ring-brand-300 hover:ring-2 transition cursor-zoom-in flex items-center justify-center"
          data-testid={`${testIdPrefix}-thumbnail`}
        >
          {receipt.kind === "image" ? (
            <img
              src={receipt.url}
              alt={receipt.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-red-600">
              <i className="bx bxs-file-pdf text-2xl" aria-hidden />
              <span className="text-[9px] font-semibold tracking-wider">
                PDF
              </span>
            </div>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div
            className="text-sm text-gray-900 font-medium truncate"
            title={receipt.name}
          >
            {receipt.name}
          </div>
          <div className="text-xs text-gray-500">
            {receipt.kind === "pdf" ? "PDF document" : "Image"} · click
            thumbnail to view
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openPicker}
            disabled={disabled}
            className="text-xs text-gray-600 hover:text-gray-900 underline underline-offset-2"
            data-testid={`${testIdPrefix}-replace`}
          >
            Replace
          </button>
          <button
            type="button"
            onClick={() => {
              onRemove();
            }}
            className="text-xs text-gray-500 hover:text-red-600"
            data-testid={`${testIdPrefix}-remove`}
          >
            Remove
          </button>
        </div>
      </div>

      <Modal
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        title={receipt.name}
        size="2xl"
        scrollable
        withoutPadding
      >
        <div className="bg-gray-900 flex items-center justify-center min-h-[60vh]">
          {receipt.kind === "image" ? (
            <img
              src={receipt.url}
              alt={receipt.name}
              className="max-h-[80vh] max-w-full object-contain"
              data-testid={`${testIdPrefix}-viewer-image`}
            />
          ) : (
            <iframe
              src={receipt.url}
              title={receipt.name}
              className="w-full h-[80vh] bg-white"
              data-testid={`${testIdPrefix}-viewer-pdf`}
            />
          )}
        </div>
      </Modal>
    </>
  );
}
