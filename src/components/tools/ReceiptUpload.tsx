import { useCallback, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import toast from "react-hot-toast";

const VALID_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export interface ReceiptFile {
  file?: File;
  name: string;
  size: number;
  type: string;
  url: string;
}

interface ReceiptUploadProps {
  receipt: ReceiptFile | null;
  onSelect: (receipt: ReceiptFile) => void;
  onRemove: () => void;
  disabled?: boolean;
  testIdPrefix?: string;
}

function validateReceiptFile(file: File): void {
  if (!VALID_TYPES.includes(file.type)) {
    throw new Error("Only PDF, PNG, and JPG files are allowed");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("Receipt must be smaller than 10MB");
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageReceipt(receipt: ReceiptFile | null): boolean {
  return Boolean(receipt && receipt.type.startsWith("image/"));
}

export default function ReceiptUpload({
  receipt,
  onSelect,
  onRemove,
  disabled = false,
  testIdPrefix = "receipt-upload",
}: ReceiptUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      try {
        validateReceiptFile(file);
        onSelect({
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          url: URL.createObjectURL(file),
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Invalid receipt selected",
        );
      }
    },
    [onSelect],
  );

  const openPicker = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      event.target.value = "";
    },
    [handleFile],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!disabled) setIsDragging(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      if (disabled) return;
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [disabled, handleFile],
  );

  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/70 p-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
        data-testid={`${testIdPrefix}-input`}
      />
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={openPicker}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          disabled={disabled}
          data-testid={`${testIdPrefix}-trigger`}
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border-2 border-dashed transition ${
            isDragging && !disabled
              ? "border-brand-500 bg-brand-50"
              : receipt
                ? "border-gray-200 bg-white"
                : "border-gray-300 bg-white hover:border-brand-400 hover:bg-brand-50/40"
          } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        >
          {isImageReceipt(receipt) ? (
            <img
              src={receipt?.url}
              alt="Receipt preview"
              className="h-full w-full rounded-md object-cover"
            />
          ) : (
            <i
              className={`text-2xl ${
                receipt ? "bx bxs-file-pdf text-red-500" : "bx bx-receipt text-gray-400"
              }`}
              aria-hidden="true"
            />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid={`${testIdPrefix}-browse`}
            >
              <i className="bx bx-upload text-sm" aria-hidden="true" />
              {receipt ? "Replace receipt" : "Upload receipt"}
            </button>
            <span className="text-xs text-gray-500">or drag &amp; drop</span>
            {receipt ? (
              <button
                type="button"
                onClick={onRemove}
                className="text-xs text-gray-500 transition hover:text-red-600"
                data-testid={`${testIdPrefix}-remove`}
              >
                Remove
              </button>
            ) : null}
          </div>
          {receipt ? (
            <div className="mt-1 min-w-0">
              <p
                className="truncate text-sm font-medium text-gray-800"
                data-testid={`${testIdPrefix}-name`}
              >
                {receipt.name}
              </p>
              <p className="text-xs text-gray-500">
                {formatSize(receipt.size)}
                {receipt.type === "application/pdf" ? " - PDF" : " - Image"}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-xs text-gray-500">
              PDF, PNG, or JPG up to 10MB.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
