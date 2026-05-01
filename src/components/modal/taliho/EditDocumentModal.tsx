import { useState, useEffect } from "react";
import Modal from "@components/modal/Modal";
import Button from "@components/ui/Button";
import { handleModalError } from "@/utils/modalErrorHandler";

type EditDocumentModalProps = {
  open: boolean;
  onClose: () => void;
  document: {
    _id: string;
    documentName: string;
    openToPage?: number;
  };
  onSave: (updates: {
    documentName?: string;
    openToPage?: number;
  }) => Promise<void>;
};

export const EditDocumentModal = ({
  open,
  onClose,
  document,
  onSave,
}: EditDocumentModalProps) => {
  const [documentName, setDocumentName] = useState(document.documentName);
  const [openToPage, setOpenToPage] = useState<string>(
    document.openToPage?.toString() ?? "",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when document changes or modal opens
  useEffect(() => {
    if (open) {
      setDocumentName(document.documentName);
      setOpenToPage(document.openToPage?.toString() ?? "");
      setError(null);
    }
  }, [open, document.documentName, document.openToPage]);

  const isPdf = document.documentName.toLowerCase().endsWith(".pdf");

  const handleSave = async () => {
    if (!documentName.trim()) {
      setError("Document name is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const updates: { documentName?: string; openToPage?: number } = {};

      if (documentName !== document.documentName) {
        updates.documentName = documentName.trim();
      }

      const pageNum = openToPage ? parseInt(openToPage, 10) : undefined;
      if (pageNum !== document.openToPage) {
        updates.openToPage = pageNum;
      }

      await onSave(updates);
      onClose();
    } catch (err) {
      handleModalError(err, { action: "edit-document-failed" });
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenToPageChange = (value: string) => {
    // Only allow positive integers
    if (value === "" || /^[1-9]\d*$/.test(value)) {
      setOpenToPage(value);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Document"
      size="md"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            leftIconClass="bx bx-save"
            onClick={handleSave}
            disabled={isLoading || !documentName.trim()}
          >
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="edit-doc-name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Document Name
          </label>
          <input
            id="edit-doc-name"
            type="text"
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
            placeholder="Enter document name"
            disabled={isLoading}
          />
        </div>

        {isPdf && (
          <div>
            <label
              htmlFor="edit-doc-page"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Open to Page
            </label>
            <input
              id="edit-doc-page"
              type="number"
              min={1}
              value={openToPage}
              onChange={(e) => handleOpenToPageChange(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
              placeholder="1"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              The page number the PDF will open to when viewed
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default EditDocumentModal;
