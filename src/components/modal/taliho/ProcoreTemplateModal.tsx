import { useMemo, useState } from "react";
import Modal from "../Modal";
import Button from "../../ui/Button";
import { useProcoreInspectionTemplates } from "@/api/endpoints/procore";

type ProcoreTemplateModalProps = {
  open: boolean;
  companyId: string;
  projectId: string;
  onClose: () => void;
  onConfirm: (templateId: string) => void;
  loading?: boolean;
};

export default function ProcoreTemplateModal(props: ProcoreTemplateModalProps) {
  const {
    open,
    companyId,
    projectId,
    onClose,
    onConfirm,
    loading = false,
  } = props;
  const { data, isLoading, isError } = useProcoreInspectionTemplates(
    companyId,
    projectId,
    open,
  );
  const [selected, setSelected] = useState<string>("");

  const templates = useMemo(
    () =>
      (Array.isArray(data) ? data : []).map((t) => ({
        id: String(t.id),
        name: t.name,
      })),
    [data],
  );

  const canConfirm = Boolean(selected);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Procore Inspections"
      subtitle={
        <span>
          Select an inspection template to create inspections from QR names.
        </span>
      }
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            leftIconClass={loading ? undefined : "bx bx-check"}
            onClick={() => {
              if (!canConfirm || loading) return;
              onConfirm(selected);
            }}
            disabled={!canConfirm || loading}
          >
            {loading ? "Creating..." : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-sm text-gray-600">Loading templates…</div>
        ) : isError ? (
          <div className="text-sm text-red-600">
            Failed to load Procore templates. Ensure the project is connected.
          </div>
        ) : templates.length === 0 ? (
          <div className="text-sm text-gray-600">No templates found.</div>
        ) : (
          <label className="block text-sm">
            <span className="text-gray-700">Inspection Template</span>
            <select
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Select a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </Modal>
  );
}
