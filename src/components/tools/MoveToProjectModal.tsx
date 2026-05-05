import { useEffect, useState } from "react";
import Modal from "@/components/modal/Modal";
import Button from "@/components/ui/Button";
import SearchComboBox from "@/components/combobox/detail/SearchComboBox";
import { SAMPLE_PROJECTS } from "@/data/seed/toolTrackerSeed";

interface MoveToProjectModalProps {
  open: boolean;
  /** Number of tools being moved (used in copy). */
  count: number;
  /** Optional: prefill with a current project to disable as a target. */
  currentProjectId?: string;
  onClose: () => void;
  onConfirm: (projectId: string) => void;
}

export default function MoveToProjectModal(props: MoveToProjectModalProps) {
  const { open, count, currentProjectId, onClose, onConfirm } = props;
  const [projectId, setProjectId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (open) setProjectId(undefined);
  }, [open]);

  const options = SAMPLE_PROJECTS.map((p) => ({
    value: p.id,
    label: p.name,
    disabled: p.id === currentProjectId,
  }));

  const subjectLabel = count === 1 ? "this tool" : `these ${count} tools`;

  const handleConfirm = () => {
    if (!projectId) return;
    onConfirm(projectId);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Move to project"
      subtitle={`Pick the project ${subjectLabel} should belong to. The tool's history travels with it.`}
      size="md"
      allowOverflow
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            data-testid="move-to-project-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleConfirm}
            disabled={!projectId}
            data-testid="move-to-project-confirm"
          >
            Move {count > 1 ? `${count} tools` : "tool"}
          </Button>
        </div>
      }
    >
      <div className="space-y-2" data-testid="move-to-project-modal">
        <label className="block text-sm font-medium text-gray-700">
          Project
        </label>
        <SearchComboBox
          options={options}
          value={projectId}
          onChange={(next) =>
            setProjectId(typeof next === "string" ? next : undefined)
          }
          placeholder="Search projects…"
          allowCustomValue={false}
          usePortal
        />
        <p className="text-xs text-gray-500">
          Tools currently in the selected project are disabled.
        </p>
      </div>
    </Modal>
  );
}
