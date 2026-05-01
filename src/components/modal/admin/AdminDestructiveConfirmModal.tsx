import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/modal/Modal";

type DestructiveAction = "deactivate" | "delete";

type AdminDestructiveConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  companyName: string;
  action: DestructiveAction;
  isLoading?: boolean;
};

const ACTION_CONFIG: Record<
  DestructiveAction,
  {
    title: string;
    subtitle: string;
    warning: string;
    consequences: string[];
    confirmLabel: string;
    loadingLabel: string;
    iconClass: string;
    buttonVariant: "danger" | "primary";
  }
> = {
  deactivate: {
    title: "Deactivate Company",
    subtitle: "This will temporarily disable access for all users",
    warning:
      "Deactivating this company will prevent all users from accessing their account. This action can be reversed by reactivating the company.",
    consequences: [
      "All users will be unable to log in",
      "QR codes will show a deactivated message",
      "API access will be blocked",
      "Data will be preserved",
    ],
    confirmLabel: "Deactivate Company",
    loadingLabel: "Deactivating...",
    iconClass: "bx bx-block",
    buttonVariant: "danger",
  },
  delete: {
    title: "Delete Company",
    subtitle: "This action is permanent and cannot be undone",
    warning:
      "Deleting this company will permanently remove all associated data. This action cannot be reversed.",
    consequences: [
      "All users will be deleted",
      "All projects will be deleted",
      "All QR codes will be deleted",
      "All documents will be deleted",
      "Subscription will be cancelled",
    ],
    confirmLabel: "Delete Company",
    loadingLabel: "Deleting...",
    iconClass: "bx bx-trash",
    buttonVariant: "danger",
  },
};

export default function AdminDestructiveConfirmModal({
  open,
  onClose,
  onConfirm,
  companyName,
  action,
  isLoading = false,
}: AdminDestructiveConfirmModalProps) {
  const [confirmInput, setConfirmInput] = useState("");

  const config = ACTION_CONFIG[action];

  // Reset input when modal opens/closes
  useEffect(() => {
    if (open) {
      setConfirmInput("");
    }
  }, [open]);

  const isConfirmValid =
    confirmInput.trim().toLowerCase() === companyName.trim().toLowerCase();

  const handleConfirm = () => {
    if (!isConfirmValid || isLoading) return;
    onConfirm();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={config.title}
      subtitle={config.subtitle}
      size="lg"
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
            variant={config.buttonVariant}
            leftIconClass={
              isLoading ? "bx bx-loader-alt bx-spin" : config.iconClass
            }
            disabled={!isConfirmValid || isLoading}
            onClick={handleConfirm}
          >
            {isLoading ? config.loadingLabel : config.confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Warning Box */}
        <div
          className={`rounded-md p-4 ${action === "delete" ? "bg-red-50 border border-red-200" : "bg-yellow-50 border border-yellow-200"}`}
        >
          <div className="flex">
            <i
              className={`bx ${action === "delete" ? "bxs-error-circle text-red-500" : "bxs-error text-yellow-500"} text-xl mr-3 flex-shrink-0`}
            ></i>
            <div>
              <h4
                className={`text-sm font-medium ${action === "delete" ? "text-red-800" : "text-yellow-800"}`}
              >
                Warning
              </h4>
              <p
                className={`mt-1 text-sm ${action === "delete" ? "text-red-700" : "text-yellow-700"}`}
              >
                {config.warning}
              </p>
            </div>
          </div>
        </div>

        {/* Consequences List */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            This will result in:
          </h4>
          <ul className="space-y-1">
            {config.consequences.map((consequence, index) => (
              <li
                key={index}
                className="flex items-start text-sm text-gray-600"
              >
                <i
                  className={`bx bx-x ${action === "delete" ? "text-red-500" : "text-yellow-500"} mr-2 mt-0.5`}
                ></i>
                {consequence}
              </li>
            ))}
          </ul>
        </div>

        {/* Confirmation Input */}
        <div className="pt-2">
          <label
            htmlFor="confirm-company-name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            To confirm, type{" "}
            <span className="font-bold text-gray-900">{companyName}</span>{" "}
            below:
          </label>
          <input
            type="text"
            id="confirm-company-name"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={`Type "${companyName}" to confirm`}
            autoComplete="off"
            className={`block w-full rounded-md shadow-sm sm:text-sm ${
              confirmInput && !isConfirmValid
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
            }`}
          />
          {confirmInput && !isConfirmValid && (
            <p className="mt-1 text-xs text-red-600">
              Company name does not match
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
