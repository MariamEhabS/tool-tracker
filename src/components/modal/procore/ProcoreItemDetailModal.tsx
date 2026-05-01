import Modal from "@components/modal/Modal";
import Button from "@components/ui/Button";
import { asString } from "@lib/coerce";
import { toolsMap } from "@/utils/toolMap";
import { contentRegistry } from "./detail";

type ProcorePreview = {
  toolType: string;
  rawItem: Record<string, unknown>;
};

type Props = {
  preview: ProcorePreview | null;
  onClose: () => void;
  qrCodeId?: string;
};

const TOOL_ICONS: Record<string, string> = {
  "coordination-issue": "bx-intersect",
  document: "bx-file",
  drawing: "bx-palette",
  form: "bx-list-check",
  incident: "bx-error-circle",
  inspection: "bx-search-alt",
  instruction: "bx-message-alt-detail",
  observation: "bx-show",
  photo: "bx-camera",
  "punch-list": "bx-check-circle",
  rfi: "bx-help-circle",
  submittal: "bx-upload",
  specification: "bx-book",
  task: "bx-task",
  directory: "bx-group",
};

function getModalTitle(item: Record<string, unknown>): string {
  return (
    asString(item.title) ||
    asString(item.name) ||
    asString(item.subject) ||
    asString(item.number) ||
    "Item Detail"
  );
}

function getToolDisplayName(toolType: string): string {
  const entry = toolsMap[toolType as keyof typeof toolsMap];
  return entry?.title ?? toolType;
}

export default function ProcoreItemDetailModal({
  preview,
  onClose,
  qrCodeId,
}: Props) {
  if (!preview) return null;

  const { toolType, rawItem } = preview;
  const ContentComponent = contentRegistry[toolType];
  const toolIcon = TOOL_ICONS[toolType] ?? "bx-data";

  return (
    <Modal
      open={!!preview}
      onClose={onClose}
      title={getModalTitle(rawItem)}
      subtitle={
        <span className="flex items-center gap-1.5">
          <i className={`bx ${toolIcon} text-base`} />
          {getToolDisplayName(toolType)}
        </span>
      }
      size="lg"
      scrollable
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {ContentComponent ? (
        <ContentComponent item={rawItem} qrCodeId={qrCodeId} />
      ) : (
        <p className="text-sm text-gray-500">
          No detail view available for this tool type.
        </p>
      )}
    </Modal>
  );
}
