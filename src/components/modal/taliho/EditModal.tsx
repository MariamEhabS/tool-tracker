import { useEffect, useMemo, useState, type ReactNode } from "react";
import Button from "@components/ui/Button";
import Modal from "@components/modal/Modal";
import { logApiError } from "@/utils/rollbar";

type EditFieldOption = { label: string; value: string };
type EditFieldType = "text" | "select" | "textarea" | "row";

export type EditField = {
  key: string;
  label: string;
  type: EditFieldType;
  placeholder?: string;
  options?: EditFieldOption[];
  required?: boolean;
  initialValue?: string;
  // For type: "row", provide child fields to render inline
  children?: EditField[];
};

type EditModalProps = {
  open: boolean;
  fields: EditField[];
  onConfirm: (values: Record<string, string>) => void;
  onClose: () => void;
  /** Optional explicit title/subtitle */
  title?: string;
  subtitle?: ReactNode;
  /** Button labels */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Loading label shown on confirm button while processing */
  loadingLabel?: string;
  /** Whether the modal is in a loading/processing state */
  isLoading?: boolean;
  /** Modal size; defaults to lg */
  size?: "sm" | "md" | "lg" | "xl";
};

export default function EditModal(props: EditModalProps) {
  const {
    open,
    fields,
    onConfirm,
    onClose,
    title = "Edit",
    subtitle,
    confirmLabel = "Save",
    cancelLabel = "Cancel",
    loadingLabel = "Saving…",
    isLoading = false,
    size = "lg",
  } = props;

  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const init: Record<string, string> = {};
    const initField = (f: EditField) => {
      if (f.type === "row" && Array.isArray(f.children)) {
        for (const c of f.children) {
          init[c.key] = c.initialValue ?? "";
        }
      } else {
        init[f.key] = f.initialValue ?? "";
      }
    };
    for (const f of fields) initField(f);
    setValues(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fields.map((f) => `${f.key}:${f.initialValue ?? ""}`).join("|")]);

  const canSubmit = useMemo(() => {
    const flat: EditField[] = [];
    const flatten = (f: EditField) => {
      if (f.type === "row" && Array.isArray(f.children)) {
        f.children.forEach((c) => flat.push(c));
      } else {
        flat.push(f);
      }
    };
    fields.forEach(flatten);
    return flat.every((f) => {
      if (!f.required) return true;
      const v = values[f.key] ?? "";
      return f.type === "select" ? v !== "" : v.trim().length > 0;
    });
  }, [fields, values]);

  function handleConfirm() {
    if (!canSubmit) return;
    onConfirm(values);
    try {
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("returnTo");
      const returnQuery = params.get("returnQuery");
      if (returnTo) {
        const decoded = returnQuery ? decodeURIComponent(returnQuery) : "";
        const dest = returnTo.startsWith("/") ? returnTo : `/${returnTo}`;
        const url = decoded ? `${dest}?${decoded}` : dest;
        window.location.assign(url);
      }
    } catch (e) {
      // Navigation errors are non-critical, log as warning
      logApiError(e, "edit-modal-navigation-failed");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
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
              isLoading ? "bx bx-loader-alt bx-spin" : "bx bx-save"
            }
            onClick={handleConfirm}
            disabled={!canSubmit || isLoading}
          >
            {isLoading ? loadingLabel : confirmLabel}
          </Button>
        </>
      }
      size={size}
    >
      <div className="space-y-4">
        {fields.map((f) => {
          const id = `edit-field-${f.key}`;
          const val = values[f.key] ?? "";

          if (f.type === "row" && Array.isArray(f.children)) {
            return (
              <div key={f.key}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {f.children.map((c) => {
                    const cid = `edit-field-${c.key}`;
                    const cval = values[c.key] ?? "";
                    return (
                      <div key={c.key}>
                        <label
                          htmlFor={cid}
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          {c.label}
                        </label>
                        {c.type === "text" ? (
                          <input
                            id={cid}
                            type="text"
                            value={cval}
                            onChange={(e) =>
                              setValues((prev) => ({
                                ...prev,
                                [c.key]: e.target.value,
                              }))
                            }
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
                            placeholder={c.placeholder}
                          />
                        ) : c.type === "textarea" ? (
                          <textarea
                            id={cid}
                            value={cval}
                            onChange={(e) =>
                              setValues((prev) => ({
                                ...prev,
                                [c.key]: e.target.value,
                              }))
                            }
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
                            placeholder={c.placeholder}
                            rows={4}
                          />
                        ) : (
                          <select
                            id={cid}
                            value={cval}
                            onChange={(e) =>
                              setValues((prev) => ({
                                ...prev,
                                [c.key]: e.target.value,
                              }))
                            }
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
                          >
                            <option value="">Select...</option>
                            {(c.options ?? []).map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          return (
            <div key={f.key}>
              <label
                htmlFor={id}
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {f.label}
              </label>
              {f.type === "text" ? (
                <input
                  id={id}
                  type="text"
                  value={val}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
                  placeholder={f.placeholder}
                />
              ) : f.type === "textarea" ? (
                <textarea
                  id={id}
                  value={val}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
                  placeholder={f.placeholder}
                  rows={4}
                />
              ) : (
                <select
                  id={id}
                  value={val}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
                >
                  <option value="">Select...</option>
                  {(f.options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
