import { useState, type ReactNode } from "react";
import Button from "@components/ui/Button";
import Modal from "@components/modal/Modal";

type DeleteModalProps = {
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** Optional explicit title. If omitted, falls back to `Delete {subjectLabel}(s)` */
  title?: string;
  /** Base singular label used to compose title/subtitle when `title`/`subtitle` not provided */
  subjectLabel?: string;
  /** Optional count to drive pluralization in default title/subtitle */
  selectedCount?: number;
  /** Optional explicit subtitle node. If omitted and subjectLabel is provided, a default is composed. */
  subtitle?: ReactNode;
  /** Body message shown in the content area. Defaults to a generic warning. */
  bodyMessage?: string;
  /** Optional icon class shown before the body message */
  iconClassName?: string;
  /** Modal size; defaults to lg */
  size?: "sm" | "md" | "lg" | "xl";
  /** Labels for buttons */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Loading label shown on confirm button while processing */
  loadingLabel?: string;
  /** Whether the modal is in a loading/processing state */
  isLoading?: boolean;
  /** If provided, automatically calls onClose after onConfirm and this delay (ms) */
  autoCloseAfterConfirmMs?: number;
};

function pluralize(base: string, count?: number): string {
  if (typeof count !== "number") return base;
  return count === 1 ? base : `${base}s`;
}

function capitalize(s?: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function DeleteModal(props: DeleteModalProps) {
  const {
    open,
    onConfirm,
    onClose,
    title,
    subjectLabel,
    selectedCount,
    subtitle,
    bodyMessage = "This action cannot be undone.",
    iconClassName = "bx bxs-error-circle text-red-500 text-xl mr-2 mt-0.5",
    size = "lg",
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    loadingLabel = "Deleting…",
    isLoading = false,
    autoCloseAfterConfirmMs,
  } = props;

  const [internalLoading, setInternalLoading] = useState(false);
  const effectiveLoading = isLoading || internalLoading;

  const computedTitle =
    title ??
    (subjectLabel
      ? `Delete ${pluralize(capitalize(subjectLabel), selectedCount)}`
      : "Delete");

  const computedSubtitle: ReactNode =
    subtitle ??
    (subjectLabel && typeof selectedCount === "number" ? (
      <span>
        You are about to delete {selectedCount}{" "}
        {pluralize(subjectLabel, selectedCount)}.
      </span>
    ) : (
      <span>{bodyMessage}</span>
    ));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={computedTitle}
      subtitle={computedSubtitle}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={effectiveLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="danger"
            leftIconClass={
              effectiveLoading ? "bx bx-loader-alt bx-spin" : "bx bx-trash"
            }
            disabled={effectiveLoading}
            onClick={async () => {
              if (effectiveLoading) return;
              setInternalLoading(true);
              try {
                await onConfirm();
              } catch {
                // Errors are handled by the caller; we just reset state
              } finally {
                setInternalLoading(false);
              }
              if (typeof autoCloseAfterConfirmMs === "number") {
                window.setTimeout(
                  () => onClose(),
                  Math.max(0, autoCloseAfterConfirmMs),
                );
              }
            }}
          >
            {effectiveLoading ? loadingLabel : confirmLabel}
          </Button>
        </>
      }
      size={size}
    >
      <div className="space-y-3">
        <div className="flex items-start">
          {iconClassName ? <i className={`${iconClassName}`} /> : null}
          <p className="text-sm text-gray-700">{bodyMessage}</p>
        </div>
      </div>
    </Modal>
  );
}
