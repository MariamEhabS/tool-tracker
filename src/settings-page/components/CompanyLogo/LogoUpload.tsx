import { useRef, useState, useCallback } from "react";
import type { DragEvent, ChangeEvent } from "react";
import toast from "react-hot-toast";

const VALID_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * Validates a logo file for type and size constraints.
 * @throws Error if validation fails
 */
// eslint-disable-next-line react-refresh/only-export-components
export function validateLogoFile(file: File): void {
  if (!VALID_TYPES.includes(file.type)) {
    throw new Error("Only PNG, JPG, and SVG files allowed");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("File size must be less than 2MB");
  }
}

type LogoUploadProps = {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
};

export default function LogoUpload(props: LogoUploadProps) {
  const { onFileSelect, disabled = false } = props;
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      try {
        validateLogoFile(file);
        onFileSelect(file);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Invalid file selected",
        );
      }
    },
    [onFileSelect],
  );

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
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
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled, handleFile],
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
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFile],
  );

  return (
    <div data-testid="logo-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.svg"
        onChange={handleFileChange}
        className="hidden"
        data-testid="logo-file-input"
        disabled={disabled}
      />
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center
          w-full min-h-[200px] p-6
          border-2 border-dashed rounded-lg
          transition-all duration-200 ease-in-out
          ${
            disabled
              ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-50"
              : isDragging
                ? "border-brand-500 bg-brand-50 scale-[1.02]"
                : "border-gray-300 bg-white hover:border-brand-400 hover:bg-gray-50 cursor-pointer"
          }
        `}
        data-testid="logo-dropzone"
      >
        <div className="flex flex-col items-center text-center">
          <div
            className={`
              w-12 h-12 mb-4 rounded-full flex items-center justify-center
              ${isDragging ? "bg-brand-100 text-brand-600" : "bg-gray-100 text-gray-400"}
            `}
          >
            <i className="bx bx-upload text-2xl" />
          </div>
          <p className="text-sm font-medium text-gray-700">
            {isDragging ? "Drop your logo here" : "Drag & drop your logo here"}
          </p>
          <p className="mt-1 text-xs text-gray-500">or click to browse</p>
          <p className="mt-3 text-xs text-gray-400">
            PNG, JPG, or SVG (max 2MB)
          </p>
        </div>
      </div>
    </div>
  );
}
