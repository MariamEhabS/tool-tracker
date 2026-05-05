import BulkActionsBar from "@/components/table/BulkActionsBar";
import Button from "@/components/ui/Button";

interface ToolsBulkBarProps {
  selectedCount: number;
  onMoveToProject: () => void;
  onRetireSelected: () => void;
  onGangSelected: () => void;
  /** When false, the Gang button is hidden (e.g. only 1 tool selected, or
   * any selected tool is already in a gang). */
  canGang: boolean;
  onClear: () => void;
}

export default function ToolsBulkBar(props: ToolsBulkBarProps) {
  const {
    selectedCount,
    onMoveToProject,
    onRetireSelected,
    onGangSelected,
    canGang,
    onClear,
  } = props;

  if (selectedCount === 0) return null;

  // Sticky-bottom container so the bar stays visible while the user
  // scrolls a long list — the Gang/Move/Retire actions are otherwise
  // easy to miss below the fold.
  return (
    <div className="sticky bottom-4 z-30 mt-4">
      <BulkActionsBar
      selectedCount={selectedCount}
      label={selectedCount === 1 ? "tool selected" : "tools selected"}
      onClearSelection={onClear}
      clearSelectionLabel="Clear"
      actions={
        <>
          {canGang && (
            <Button
              type="button"
              variant="secondary"
              leftIconClass="bx bx-collection"
              onClick={onGangSelected}
              data-testid="tools-bulk-gang"
            >
              Gang tools…
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            leftIconClass="bx bx-folder-open"
            onClick={onMoveToProject}
            data-testid="tools-bulk-move"
          >
            Move to project…
          </Button>
          <Button
            type="button"
            variant="danger"
            leftIconClass="bx bx-archive-in"
            onClick={onRetireSelected}
            data-testid="tools-bulk-retire"
          >
            Retire selected
          </Button>
        </>
      }
      moreOptions={[
        ...(canGang
          ? [
              {
                label: "Gang tools…",
                value: "gang",
                iconClass: "bx bx-collection",
                onSelect: onGangSelected,
              },
            ]
          : []),
        {
          label: "Move to project…",
          value: "move",
          iconClass: "bx bx-folder-open",
          onSelect: onMoveToProject,
        },
        {
          label: "Retire selected",
          value: "retire",
          iconClass: "bx bx-archive-in",
          onSelect: onRetireSelected,
        },
      ]}
      className="rounded-xl border border-gray-200 bg-white shadow-lg backdrop-blur"
    />
    </div>
  );
}
