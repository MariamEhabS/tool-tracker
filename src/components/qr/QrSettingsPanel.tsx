import Button from "../ui/Button";

type ToggleProps = {
  id: string;
  label: string;
  description?: string;
  checked?: boolean;
};

type SettingsPanelProps = {
  title?: string;
  requirePassword?: ToggleProps;
  timezone?: string;
  onSave?: () => void;
  className?: string;
  /** Optional: show a button to set password via modal */
  onOpenSetPassword?: () => void;
  /** Optional: label for the set password button */
  setPasswordButtonLabel?: string;
  /** Optional: open delete confirmation */
  onOpenDelete?: () => void;
};

export default function SettingsPanel(props: SettingsPanelProps) {
  const {
    title = "Settings",
    requirePassword = {
      id: "password-toggle",
      label: "Require Password",
      description: "Enable time-based password protection for this QR code.",
      checked: false,
    },
    className = "",
    onOpenSetPassword,
    setPasswordButtonLabel = "Set Password",
    onOpenDelete,
  } = props;

  return (
    <div className={`bg-white p-6 rounded-lg shadow ${className}`}>
      <h3 className="text-base font-semibold leading-6 text-gray-900 mb-4">
        {title}
      </h3>
      <div className="flex items-center justify-between mb-4">
        <span className="flex flex-grow flex-col">
          <span
            id={`${requirePassword.id}-label`}
            className="block text-sm font-medium text-gray-700"
          >
            {requirePassword.label}
          </span>
          {requirePassword.description ? (
            <span
              id={`${requirePassword.id}-description`}
              className="text-sm text-gray-500"
            >
              {requirePassword.description}
            </span>
          ) : null}
        </span>
        <div className="flex items-center gap-2 ml-4">
          {onOpenSetPassword ? (
            <Button
              type="button"
              variant="secondary"
              leftIconClass="bx bx-lock-alt"
              onClick={onOpenSetPassword}
            >
              {setPasswordButtonLabel}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-5 mt-5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex flex-col">
            <h4 className="text-sm font-medium text-red-600 mb-1">
              Danger Zone
            </h4>
            <p className="text-sm text-gray-500">
              Deleting this QR code is permanent and cannot be undone.
            </p>
          </span>
          <Button
            type="button"
            variant="danger"
            leftIconClass="bx bx-trash"
            onClick={onOpenDelete}
          >
            Delete QR Code
          </Button>
        </div>
      </div>
    </div>
  );
}
