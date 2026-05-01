import Button from "@/components/ui/Button";

interface ProcoreToolEmptyStateProps {
  toolName: string;
  toolKey?: string;
  iconClass?: string;
  bgClass?: string;
  textClass?: string;
  onRefresh?: () => void;
}

const DEFAULT_ICONS: Record<string, string> = {
  inspections: "bx bx-check-shield",
  documents: "bx bx-file",
  rfis: "bx bx-question-mark",
  photos: "bx bx-image",
  forms: "bx bx-list-check",
  drawings: "bx bx-map",
  submittals: "bx bx-file-find",
  "punch-list": "bx bx-task",
  observations: "bx bx-search-alt",
  incidents: "bx bx-error-alt",
  tasks: "bx bx-check-square",
  specifications: "bx bx-detail",
  instructions: "bx bx-book-open",
  directory: "bx bx-user-circle",
  "coordination-issues": "bx bx-git-branch",
};

function getDefaultIcon(toolKey?: string): string {
  if (toolKey && DEFAULT_ICONS[toolKey]) {
    return DEFAULT_ICONS[toolKey];
  }
  return "bx bx-folder-open";
}

export default function ProcoreToolEmptyState({
  toolName,
  toolKey,
  iconClass,
  bgClass = "bg-gray-100",
  textClass = "text-gray-500",
  onRefresh,
}: ProcoreToolEmptyStateProps) {
  const resolvedIconClass = iconClass || getDefaultIcon(toolKey);

  return (
    <div className="flex flex-col items-center justify-center text-center py-12">
      <div
        className={`${bgClass} w-12 h-12 rounded-full flex items-center justify-center mb-4`}
      >
        <i className={`${resolvedIconClass} ${textClass} text-2xl`} />
      </div>
      <h4 className="text-base font-medium text-gray-700 mb-1">
        No {toolName} Found
      </h4>
      <p className="text-sm text-gray-500 max-w-xs mb-2">
        There are no {toolName.toLowerCase()} in the linked Procore project yet.
      </p>
      <p className="text-xs text-gray-400 max-w-xs">
        Items will appear here once they're created in Procore.
      </p>
      {onRefresh && (
        <Button
          variant="secondary"
          onClick={onRefresh}
          leftIconClass="bx bx-refresh"
          className="mt-4"
        >
          Refresh
        </Button>
      )}
    </div>
  );
}
