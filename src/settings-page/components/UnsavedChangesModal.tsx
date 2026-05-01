import Modal from "@/components/modal/Modal";
import Button from "@/components/ui/Button";

interface UnsavedSection {
  id: string;
  label: string;
}

interface UnsavedChangesModalProps {
  open: boolean;
  sections: UnsavedSection[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function UnsavedChangesModal({
  open,
  sections,
  onConfirm,
  onCancel,
}: UnsavedChangesModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Unsaved Changes"
      size="sm"
      overlayClosable={false}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onCancel}
            data-testid="cancel-leave"
          >
            Stay on Page
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            data-testid="confirm-leave"
          >
            Leave Without Saving
          </Button>
        </>
      }
    >
      <div className="space-y-4" data-testid="unsaved-changes-modal">
        <p className="text-sm text-gray-600">
          You have unsaved changes that will be lost if you leave this page.
        </p>
        {sections.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Unsaved sections:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              {sections.map((section) => (
                <li key={section.id}>{section.label}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-sm text-gray-500">Are you sure you want to leave?</p>
      </div>
    </Modal>
  );
}

export default UnsavedChangesModal;
