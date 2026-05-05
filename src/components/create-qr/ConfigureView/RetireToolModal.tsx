import { useEffect, useMemo, useState } from "react";
import type {
  ToolRetirement,
  ToolRetirementReason,
} from "@/components/create-qr/toolTracker/types";
import Modal from "@/components/modal/Modal";
import Button from "@/components/ui/Button";

const REASON_OPTIONS: Array<{
  value: ToolRetirementReason;
  label: string;
}> = [
  { value: "broken", label: "Broken / no longer functional" },
  { value: "lost", label: "Lost or stolen" },
  { value: "sold", label: "Sold or transferred" },
  { value: "scrapped", label: "Scrapped / disposed" },
  { value: "other", label: "Other" },
];

interface RetireToolModalProps {
  open: boolean;
  toolName?: string;
  onClose: () => void;
  onConfirm: (retirement: ToolRetirement) => void;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RetireToolModal({
  open,
  toolName,
  onClose,
  onConfirm,
}: RetireToolModalProps) {
  const [reason, setReason] = useState<ToolRetirementReason>("broken");
  const [retiredAt, setRetiredAt] = useState(todayIsoDate);
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("broken");
    setRetiredAt(todayIsoDate());
    setNotes("");
    setTouched(false);
  }, [open]);

  const trimmedNotes = useMemo(() => notes.trim(), [notes]);
  const dateError = touched && !retiredAt ? "Retirement date is required." : null;

  const handleConfirm = () => {
    setTouched(true);
    if (!retiredAt) return;
    onConfirm({
      reason,
      retiredAt,
      notes: trimmedNotes || undefined,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Retire tool"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirm}
            leftIconClass="bx bx-archive-in"
          >
            Retire tool
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {toolName?.trim()
            ? `"${toolName}" will be removed from the active list, but its history will stay searchable.`
            : "This tool will be removed from the active list, but its history will stay searchable."}
        </p>
        <div>
          <label
            htmlFor="retire-tool-reason"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Reason
          </label>
          <select
            id="retire-tool-reason"
            value={reason}
            onChange={(event) =>
              setReason(event.target.value as ToolRetirementReason)
            }
            className="block w-full rounded-md border-gray-300 bg-white text-sm shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            data-testid="retire-tool-reason"
          >
            {REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="retire-tool-date"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Retirement date
          </label>
          <input
            id="retire-tool-date"
            type="date"
            value={retiredAt}
            onChange={(event) => setRetiredAt(event.target.value)}
            className={`block w-full rounded-md text-sm shadow-sm focus:ring-2 ${
              dateError
                ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                : "border-gray-300 focus:border-brand-400 focus:ring-brand-100"
            }`}
            data-testid="retire-tool-date"
          />
          {dateError ? (
            <p className="mt-1 text-xs text-red-600">{dateError}</p>
          ) : null}
        </div>
        <div>
          <label
            htmlFor="retire-tool-notes"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Notes
            <span className="ml-1 text-xs font-normal text-gray-400">
              (optional)
            </span>
          </label>
          <textarea
            id="retire-tool-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Add context for the team."
            className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            data-testid="retire-tool-notes"
          />
        </div>
      </div>
    </Modal>
  );
}
