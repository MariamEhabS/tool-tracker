import { useCallback, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import toast from "react-hot-toast";

/**
 * Thin local photo upload for the Tool Tracker single form.
 *
 * Reuses the validation + click-to-browse patterns from
 * `src/settings-page/components/CompanyLogo/LogoUpload.tsx`, but trimmed to
 * a compact 64px tile + Upload/Replace text-button layout per PRD §4 Stage 2
 * and the JSX mockup's `PhotoAnchor` (not the giant logo dropzone).
 *
 * Validation per PRD §5: PNG/JPG only, max 5MB. SVG is excluded — it's
 * appropriate for logos but not for tool photos where the field tech needs a
 * literal photograph for confirmation.
 */

const VALID_TYPES = ["image/png", "image/jpeg"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB per PRD §5

// eslint-disable-next-line react-refresh/only-export-components
export function validateToolPhotoFile(file: File): void {
  if (!VALID_TYPES.includes(file.type)) {
    throw new Error("Only PNG and JPG files are allowed");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("File size must be less than 5MB");
  }
}

interface ToolPhotoUploadProps {
  /** A preview URL (object URL or remote URL) when a photo is selected. */
  previewUrl: string | null;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export default function ToolPhotoUpload(props: ToolPhotoUploadProps) {
  const { previewUrl, onFileSelect, onRemove, disabled = false } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasError, setHasError] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      try {
        validateToolPhotoFile(file);
        onFileSelect(file);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Invalid file selected",
        );
      }
    },
    [onFileSelect],
  );

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // Reset so the same file can be picked again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFile],
  );

  const tileLabel = previewUrl ? "Replace photo" : "Add photo";
  const buttonLabel = previewUrl ? "Replace photo" : "Upload photo";

  return (
    <div className="flex items-center gap-3" data-testid="tool-photo-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg"
        onChange={handleFileChange}
        className="hidden"
        data-testid="tool-photo-file-input"
        disabled={disabled}
      />
      <button
        type="button"
        onClick={handleClick}
        aria-label={tileLabel}
        disabled={disabled}
        className={`group shrink-0 h-16 w-16 rounded-lg border-2 border-dashed transition overflow-hidden flex items-center justify-center ${
          previewUrl
            ? "border-transparent"
            : disabled
              ? "border-gray-200 bg-gray-50 cursor-not-allowed"
              : "border-gray-300 bg-gray-50 hover:border-brand-400 hover:bg-brand-50/40 cursor-pointer"
        }`}
      >
        {previewUrl && !hasError ? (
          <img
            src={previewUrl}
            alt="Tool photo preview"
            className="h-full w-full object-cover"
            onError={() => setHasError(true)}
          />
        ) : (
          <i className="bx bx-camera text-2xl text-gray-400 group-hover:text-brand-600 transition" />
        )}
      </button>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClick}
            disabled={disabled}
            className="text-sm font-medium text-gray-700 hover:text-gray-900 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="tool-photo-upload-button"
          >
            <i className="bx bx-upload text-sm" />
            {buttonLabel}
          </button>
          {previewUrl && (
            <button
              type="button"
              onClick={() => {
                setHasError(false);
                onRemove();
              }}
              className="text-xs text-gray-500 hover:text-red-600 transition"
              data-testid="tool-photo-remove"
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          Helps techs confirm they&apos;re scanning the right tool.
        </p>
      </div>
    </div>
  );
}
