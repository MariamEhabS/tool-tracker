import { useEffect, useMemo, useState, type ReactNode } from "react";
import Button from "../../ui/Button";
import Modal from "../Modal";
import SearchComboBox from "../../combobox/detail/SearchComboBox";

type Mode = "existing" | "new";

export type AssignOption = { id: string; name: string };

type AssignToModalProps = {
  open: boolean;
  selectedCount: number;
  onClose: () => void;
  /** onConfirm returns the chosen assignment info */
  onConfirm: (result: {
    mode: Mode;
    existingId?: string;
    newName?: string;
  }) => void;
  /** Title (e.g., "Assign to Project") */
  title?: string;
  /** Subtitle; if omitted, a default sentence will be composed */
  subtitle?: ReactNode;
  /** What is being assigned (for default subtitle), e.g., 'QR code', 'arrangement', 'equipment group' */
  selectedSubjectLabel?: string;
  /** Target label (for field labels), e.g., 'Project', 'Arrangement', 'Equipment' */
  targetLabel: string;
  /** Options for existing targets */
  options: AssignOption[];
  /** Initial selected existing target id (resets on modal open) */
  initialExistingId?: string;
  /** Initial mode when opening modal (resets on modal open) */
  initialMode?: Mode;
  /** Allow creating a new target */
  allowNew?: boolean;
  /** Labels and placeholders */
  chooseMethodLabel?: string;
  existingLabel?: string;
  newLabel?: string;
  selectLabel?: string;
  newNameLabel?: string;
  newNamePlaceholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Loading label shown on confirm button while processing */
  loadingLabel?: string;
  /** Whether the modal is in a loading/processing state */
  isLoading?: boolean;
  /** Modal size */
  size?: "sm" | "md" | "lg" | "xl";
};

function pluralize(base: string, count: number): string {
  return count === 1 ? base : `${base}s`;
}

export default function AssignToModal(props: AssignToModalProps) {
  const {
    open,
    selectedCount,
    onClose,
    onConfirm,
    title = "Assign",
    subtitle,
    selectedSubjectLabel = "item",
    targetLabel,
    options,
    initialExistingId,
    initialMode,
    allowNew = true,
    chooseMethodLabel = "Choose method",
    existingLabel = "Assign to existing",
    newLabel = "Create new",
    selectLabel,
    newNameLabel,
    newNamePlaceholder = "Enter a name",
    confirmLabel = "Assign",
    cancelLabel = "Cancel",
    loadingLabel = "Assigning…",
    isLoading = false,
    size = "lg",
  } = props;

  const [mode, setMode] = useState<Mode>("existing");
  const [selectedId, setSelectedId] = useState<string>(initialExistingId ?? "");
  const [newName, setNewName] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setSelectedId(initialExistingId ?? "");
    setMode(initialMode === "new" && allowNew ? "new" : "existing");
  }, [open, initialExistingId, initialMode, allowNew]);

  const canSubmit = useMemo(() => {
    return mode === "existing"
      ? Boolean(selectedId)
      : allowNew
        ? newName.trim().length > 0
        : false;
  }, [mode, selectedId, newName, allowNew]);

  const computedSubtitle: ReactNode = subtitle ?? (
    <span>
      Assign {selectedCount} selected{" "}
      {pluralize(selectedSubjectLabel, selectedCount)} to a{" "}
      {targetLabel.toLowerCase()}.
    </span>
  );

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
            leftIconClass={isLoading ? "bx bx-loader-alt bx-spin" : undefined}
            onClick={() =>
              onConfirm({
                mode,
                existingId: selectedId || undefined,
                newName: newName.trim() || undefined,
              })
            }
            disabled={!canSubmit || isLoading}
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
            {chooseMethodLabel}
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center p-3 border rounded-md shadow-sm bg-white cursor-pointer has-[:checked]:border-yellow-500 has-[:checked]:bg-yellow-50 has-[:checked]:ring-1 has-[:checked]:ring-yellow-500">
              <input
                type="radio"
                name="assign-method"
                className="hidden"
                checked={mode === "existing"}
                onChange={() => setMode("existing")}
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                {existingLabel}
              </span>
            </label>
            {allowNew ? (
              <label className="flex items-center p-3 border rounded-md shadow-sm bg-white cursor-pointer has-[:checked]:border-yellow-500 has-[:checked]:bg-yellow-50 has-[:checked]:ring-1 has-[:checked]:ring-yellow-500">
                <input
                  type="radio"
                  name="assign-method"
                  className="hidden"
                  checked={mode === "new"}
                  onChange={() => setMode("new")}
                />
                <span className="ml-2 text-sm font-medium text-gray-700">
                  {newLabel}
                </span>
              </label>
            ) : null}
          </div>
        </fieldset>
        {mode === "existing" ? (
          <div>
            <label
              htmlFor="assign-select"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {selectLabel ?? targetLabel}
            </label>
            <SearchComboBox
              id="assign-select"
              placeholder={`Search for a ${targetLabel.toLowerCase()}...`}
              options={options.map((o) => ({ label: o.name, value: o.id }))}
              value={selectedId || undefined}
              onChange={(next) =>
                setSelectedId(typeof next === "string" ? next : "")
              }
              usePortal={true}
            />
          </div>
        ) : allowNew ? (
          <div>
            <label
              htmlFor="assign-new-input"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {newNameLabel ?? `New ${targetLabel.toLowerCase()} name`}
            </label>
            <input
              id="assign-new-input"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
              placeholder={newNamePlaceholder}
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
