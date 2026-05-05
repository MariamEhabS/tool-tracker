import { useEffect, useState } from "react";
import Modal from "@/components/modal/Modal";
import Button from "@/components/ui/Button";
import type {
  ToolRetirement,
  ToolRetirementReason,
} from "@/components/create-qr/toolTracker/types";

const REASON_OPTIONS: { value: ToolRetirementReason; label: string }[] = [
  { value: "broken", label: "Broken / no longer functional" },
  { value: "lost", label: "Lost or stolen" },
  { value: "sold", label: "Sold or transferred" },
  { value: "scrapped", label: "Scrapped / disposed" },
  { value: "other", label: "Other" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface RetireToolModalProps {
  open: boolean;
  toolName: string;
  onClose: () => void;
  onConfirm: (retirement: ToolRetirement) => void;
}

export default function RetireToolModal(props: RetireToolModalProps) {
  const { open, toolName, onClose, onConfirm } = props;
  const [reason, setReason] = useState<ToolRetirementReason>("broken");
  const [retiredAt, setRetiredAt] = useState<string>(todayIso());
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (open) {
      setReason("broken");
      setRetiredAt(todayIso());
      setNotes("");
    }
  }, [open]);

  const handleConfirm = () => {
    onConfirm({
      reason,
      retiredAt,
      notes: notes.trim() ? notes.trim() : undefined,
    });
  };

  const displayName = toolName.trim() || "this tool";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Retire tool"
      subtitle={`Mark "${displayName}" as decommissioned. The tool stays in records so you keep its scan and check-out history — it's just hidden from the active list.`}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            data-testid="retire-tool-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirm}
            data-testid="retire-tool-confirm"
            leftIconClass="bx bx-archive-in"
          >
            Retire tool
          </Button>
        </div>
      }
    >
      <div className="space-y-4" data-testid="retire-tool-modal">
        <div>
          <label
            htmlFor="retire-reason"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Reason
          </label>
          <select
            id="retire-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as ToolRetirementReason)}
            data-testid="retire-tool-reason"
            className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-brand-400 focus:ring-brand-400 bg-white"
          >
            {REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="retire-date"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Retirement date
          </label>
          <input
            id="retire-date"
            type="date"
            value={retiredAt}
            max={todayIso()}
            onChange={(e) => setRetiredAt(e.target.value)}
            data-testid="retire-tool-date"
            className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-brand-400 focus:ring-brand-400"
          />
        </div>

        <div>
          <label
            htmlFor="retire-notes"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Notes <span className="text-xs font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            id="retire-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g., Motor burned out, replaced by DCF887 (s/n 4821-A9C)."
            data-testid="retire-tool-notes"
            className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <p className="mt-1 text-xs text-gray-500">
            Anything that helps the next person understand what happened.
          </p>
        </div>
      </div>
    </Modal>
  );
}
