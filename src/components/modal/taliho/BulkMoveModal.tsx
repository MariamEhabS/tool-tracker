import type { ReactNode } from "react";
import MoveModal, {
  type FolderOption,
} from "@components/modal/taliho/MoveModal";

function capitalize(s?: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pluralize(base: string, count?: number): string {
  if (typeof count !== "number") return base;
  return count === 1 ? base : `${base}s`;
}

type BulkMoveModalProps = {
  open: boolean;
  selectedCount: number;
  onConfirm: (destinationFolderId: string) => void;
  onClose: () => void;
  /** Base subject to compose defaults, e.g. 'document', 'QR code', 'item' */
  subjectLabel: string;
  /** Optional overrides */
  title?: string;
  subtitle?: ReactNode;
  /** Available folder options for the dropdown */
  folderOptions?: FolderOption[];
  /** Initial selected folder value */
  initialFolder?: string;
  /** Current folder ID to prevent moving to same folder */
  currentFolderId?: string;
  /** Label for the folder selector field */
  folderLabel?: string;
  /** Placeholder for empty folder selector */
  folderPlaceholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** Optional helper text shown under the folder selector */
  helperText?: ReactNode;
  /** Optional validation function to check if folder is valid */
  validateFolder?: (
    folderId: string,
  ) => Promise<{ exists: boolean; accessible: boolean; message?: string }>;
};

export default function BulkMoveModal(props: BulkMoveModalProps) {
  const {
    open,
    selectedCount,
    onConfirm,
    onClose,
    subjectLabel,
    title,
    subtitle,
    folderOptions,
    initialFolder,
    currentFolderId,
    folderLabel,
    folderPlaceholder,
    confirmLabel,
    cancelLabel,
    size = "lg",
    helperText,
    validateFolder,
  } = props;

  const computedTitle =
    title ??
    `Move ${selectedCount} ${pluralize(capitalize(subjectLabel), selectedCount)}`;
  const computedSubtitle: ReactNode = subtitle ?? (
    <span>
      Select the destination folder for the selected{" "}
      {pluralize(subjectLabel, selectedCount)}.
    </span>
  );

  return (
    <MoveModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={computedTitle}
      subtitle={computedSubtitle}
      folderOptions={folderOptions}
      initialFolder={initialFolder}
      currentFolderId={currentFolderId}
      folderLabel={folderLabel}
      folderPlaceholder={folderPlaceholder}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      size={size}
      helperText={helperText}
      validateFolder={validateFolder}
    />
  );
}
