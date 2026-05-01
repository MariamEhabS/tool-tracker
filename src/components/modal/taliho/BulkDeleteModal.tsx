import type { ReactNode } from "react";
import DeleteModal from "@components/modal/taliho/DeleteModal";

function capitalize(s?: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pluralize(base: string, count?: number): string {
  if (typeof count !== "number") return base;
  return count === 1 ? base : `${base}s`;
}

type BulkDeleteModalProps = {
  open: boolean;
  selectedCount: number;
  onConfirm: () => void;
  onClose: () => void;
  /** Base subject to compose defaults, e.g. 'document', 'QR code' */
  subjectLabel: string;
  /** Optional overrides */
  title?: string;
  subtitle?: ReactNode;
  bodyMessage?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  iconClassName?: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** Whether the modal is in a loading/processing state */
  isLoading?: boolean;
  /** Loading label shown on confirm button while processing */
  loadingLabel?: string;
};

export default function BulkDeleteModal(props: BulkDeleteModalProps) {
  const {
    open,
    selectedCount,
    onConfirm,
    onClose,
    subjectLabel,
    title,
    subtitle,
    bodyMessage,
    confirmLabel,
    cancelLabel,
    iconClassName,
    size = "lg",
    isLoading,
    loadingLabel,
  } = props;

  const computedTitle =
    title ??
    `Bulk Delete ${pluralize(capitalize(subjectLabel), selectedCount)}`;
  const defaultBody = `This action cannot be undone. The selected ${pluralize(subjectLabel, selectedCount)} and associated data will be removed.`;

  return (
    <DeleteModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={computedTitle}
      subjectLabel={subjectLabel}
      selectedCount={selectedCount}
      subtitle={subtitle}
      bodyMessage={bodyMessage ?? defaultBody}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      iconClassName={iconClassName}
      size={size}
      isLoading={isLoading}
      loadingLabel={loadingLabel}
    />
  );
}
