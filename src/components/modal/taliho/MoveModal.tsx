import { useEffect, useState, type ReactNode } from "react";
import Button from "@components/ui/Button";
import Modal from "@components/modal/Modal";
import FolderTreePicker from "@components/modal/taliho/FolderTreePicker";
import toast from "react-hot-toast";
import { handleModalError } from "@/utils/modalErrorHandler";

export type FolderOption = {
  value: string;
  label: string;
  deleted?: boolean;
  status?: string;
  canWrite?: boolean;
  permissions?: { write?: boolean };
  /** Parent folder ID (null or undefined = root-level) */
  parentId?: string | null;
  /** Depth in folder hierarchy (0 = root) */
  depth?: number;
  /** Whether this folder has child folders */
  hasChildren?: boolean;
};

type MoveModalProps = {
  open: boolean;
  onConfirm: (destinationFolderId: string) => void;
  onClose: () => void;
  /** Optional explicit title. If omitted, defaults to "Move {subjectLabel}" */
  title?: string;
  /** Base singular label used to compose title/subtitle when not provided */
  subjectLabel?: string;
  /** Optional explicit subtitle node. */
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
  /** Modal size; defaults to lg */
  size?: "sm" | "md" | "lg" | "xl";
  /** Labels for buttons */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Optional helper text shown under the folder selector */
  helperText?: ReactNode;
  /** Optional validation function to check if folder is valid */
  validateFolder?: (
    folderId: string,
  ) => Promise<{ exists: boolean; accessible: boolean; message?: string }>;
};

function capitalize(s?: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function MoveModal(props: MoveModalProps) {
  const {
    open,
    onConfirm,
    onClose,
    title,
    subjectLabel,
    subtitle,
    folderOptions = [
      { value: "", label: "Root" },
      { value: "folder-1", label: "Folder 1" },
      { value: "folder-2", label: "Folder 2" },
    ],
    initialFolder = "",
    currentFolderId,
    folderLabel = "Destination Folder",
    size = "lg",
    confirmLabel = "Move",
    cancelLabel = "Cancel",
    helperText,
    validateFolder,
  } = props;

  const computedTitle =
    title ?? (subjectLabel ? `Move ${capitalize(subjectLabel)}` : "Move Item");

  const computedSubtitle: ReactNode =
    subtitle ??
    (subjectLabel ? (
      <span>Select the destination folder for this {subjectLabel}.</span>
    ) : (
      <span>Select destination folder</span>
    ));

  const [selectedFolder, setSelectedFolder] = useState<string>(initialFolder);
  const [isValidating, setIsValidating] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter out invalid folders from options
  // Note: currentFolderId is NOT excluded -- the FolderTreePicker shows it
  // as disabled with a "(current)" badge so users understand why it's unselectable.
  const validFolders = folderOptions.filter((folder) => {
    // Filter out deleted folders
    if (folder.deleted || folder.status === "deleted") return false;

    // Filter out folders user can't write to (but keep current folder visible)
    if (folder.canWrite === false || folder.permissions?.write === false) {
      // Still show current folder even if not writable (for context)
      if (!(currentFolderId && folder.value === currentFolderId)) return false;
    }

    return true;
  });

  useEffect(() => {
    if (open) {
      setSelectedFolder(initialFolder);
      setError(null);
      setIsValidating(false);
      setIsMoving(false);
    }
  }, [open, initialFolder]);

  async function handleConfirm() {
    // Basic validation
    if (!selectedFolder || selectedFolder.trim() === "") {
      setError("Please select a destination folder");
      toast.error("Please select a destination folder");
      return;
    }

    // Prevent moving to same folder
    if (currentFolderId && selectedFolder === currentFolderId) {
      setError("Items are already in this folder");
      toast.error("Items are already in this folder");
      return;
    }

    // If custom validation is provided, use it
    if (validateFolder) {
      try {
        setIsValidating(true);
        setError(null);

        const folderCheck = await validateFolder(selectedFolder);

        if (!folderCheck.exists) {
          setError("The selected folder no longer exists");
          toast.error("The selected folder no longer exists");
          return;
        }

        if (!folderCheck.accessible) {
          setError("You don't have permission to move items to this folder");
          toast.error("You don't have permission to move items to this folder");
          return;
        }
      } catch (error) {
        handleModalError(error, { action: "validate-move-destination-failed" });
        setError("Could not validate destination folder");
        return;
      } finally {
        setIsValidating(false);
      }
    }

    // Proceed with move
    try {
      setIsMoving(true);
      setError(null);
      onConfirm(selectedFolder);
    } catch (error) {
      handleModalError(error, { action: "move-items-failed" });
      setError("An error occurred while moving items");
    } finally {
      setIsMoving(false);
    }
  }

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
            disabled={isValidating || isMoving}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="primary"
            leftIconClass={
              isValidating || isMoving
                ? "bx bx-loader-alt animate-spin"
                : "bx bx-folder"
            }
            onClick={handleConfirm}
            disabled={isValidating || isMoving || validFolders.length === 0}
          >
            {isValidating
              ? "Validating..."
              : isMoving
                ? "Moving..."
                : confirmLabel}
          </Button>
        </>
      }
      size={size}
    >
      <div className="space-y-3">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <i className="bx bx-error-circle text-xl text-red-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700"
              >
                <i className="bx bx-x text-xl" />
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {folderLabel}
          </label>
          <FolderTreePicker
            folders={validFolders}
            selectedFolderId={selectedFolder}
            currentFolderId={currentFolderId}
            onSelect={(id) => {
              setSelectedFolder(id);
              setError(null);
            }}
            disabled={isValidating || isMoving || validFolders.length === 0}
          />
          {helperText ? (
            <p className="mt-1 text-sm text-gray-500">{helperText}</p>
          ) : null}
          {validFolders.length === 0 && (
            <p className="mt-1 text-sm text-yellow-600">
              No available folders. Create a folder first.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
