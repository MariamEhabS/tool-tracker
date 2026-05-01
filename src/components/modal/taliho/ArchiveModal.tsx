import type { ReactNode } from "react";
import Button from "@components/ui/Button";
import Modal from "@components/modal/Modal";

type ArchiveModalProps = {
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** Optional explicit title. If omitted, falls back to `Archive {subjectLabel}(s)` */
  title?: string;
  /** Base singular label used to compose title/subtitle when `title`/`subtitle` not provided */
  subjectLabel?: string;
  /** Optional count to drive pluralization in default title/subtitle */
  selectedCount?: number;
  /** Optional explicit subtitle node. If omitted and subjectLabel is provided, a default is composed. */
  subtitle?: ReactNode;
  /** Body message shown in the content area. Defaults to a helpful archive note */
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
};

function pluralize(base: string, count?: number): string {
  if (typeof count !== "number") return base;
  return count === 1 ? base : `${base}s`;
}

function capitalize(s?: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ArchiveModal(props: ArchiveModalProps) {
  const {
    open,
    onConfirm,
    onClose,
    title,
    subjectLabel,
    selectedCount,
    subtitle,
    bodyMessage,
    iconClassName = "bx bxs-info-circle text-yellow-500 text-xl mr-2 mt-0.5",
    size = "lg",
    confirmLabel = "Archive",
    cancelLabel = "Cancel",
    loadingLabel = "Archiving…",
    isLoading = false,
  } = props;

  const computedTitle =
    title ??
    (subjectLabel
      ? `Archive ${pluralize(capitalize(subjectLabel), selectedCount)}`
      : "Archive");

  const computedSubtitle: ReactNode =
    subtitle ??
    (subjectLabel && typeof selectedCount === "number" ? (
      <span>
        You are about to archive {selectedCount}{" "}
        {pluralize(subjectLabel, selectedCount)}.
      </span>
    ) : undefined);

  const defaultBody =
    bodyMessage ??
    "Archived items will be hidden from your active list. You can unarchive them later from settings.";

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
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="primary"
            leftIconClass={
              isLoading ? "bx bx-loader-alt bx-spin" : "bx bxs-briefcase"
            }
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? loadingLabel : confirmLabel}
          </Button>
        </>
      }
      size={size}
    >
      <div className="space-y-3">
        <div className="flex items-start">
          {iconClassName ? <i className={iconClassName} /> : null}
          <p className="text-sm text-gray-700">{defaultBody}</p>
        </div>
      </div>
    </Modal>
  );
}
