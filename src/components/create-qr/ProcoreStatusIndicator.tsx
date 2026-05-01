import Button from "@/components/ui/Button";
import InfoComboBox from "@/components/combobox/detail/InfoComboBox";
import procoreIcon from "@/assets/images/procore-icon.png";

export interface ProcoreStatusIndicatorProps {
  selectedProjectId?: string;
  projectIsConnected: boolean;
  projectName?: string;
  buildProjectEditHref: (id?: string) => string;
  onConnectClick?: () => void;
}

/**
 * Modern Procore connection status indicator with enhanced styling.
 * Shows connection status as a pill/badge with a hover popover for details.
 */
export default function ProcoreStatusIndicator({
  selectedProjectId,
  projectIsConnected,
  projectName,
  buildProjectEditHref,
  onConnectClick,
}: ProcoreStatusIndicatorProps) {
  const status = !selectedProjectId
    ? "noProject"
    : projectIsConnected
      ? "connected"
      : "notConnected";

  const statusConfig = {
    connected: {
      label: "Connected",
      statusType: "success" as const,
      bgClass: "bg-gradient-to-r from-green-50 to-emerald-50",
      textClass: "text-green-700",
      borderClass: "border-green-200",
      iconClass: "bx bx-check-circle",
      dotClass: "bg-green-500",
      hoverBg: "hover:from-green-100 hover:to-emerald-100",
    },
    notConnected: {
      label: "Not Connected",
      statusType: "error" as const,
      bgClass: "bg-gradient-to-r from-red-50 to-rose-50",
      textClass: "text-red-700",
      borderClass: "border-red-200",
      iconClass: "bx bx-x-circle",
      dotClass: "bg-red-500",
      hoverBg: "hover:from-red-100 hover:to-rose-100",
    },
    noProject: {
      label: "Select Project",
      statusType: "warning" as const,
      bgClass: "bg-gradient-to-r from-amber-50 to-yellow-50",
      textClass: "text-amber-700",
      borderClass: "border-amber-200",
      iconClass: "bx bx-info-circle",
      dotClass: "bg-amber-500",
      hoverBg: "hover:from-amber-100 hover:to-yellow-100",
    },
  };

  const config = statusConfig[status];

  const items =
    status === "connected"
      ? [`Procore connected for "${projectName || "this project"}".`]
      : status === "notConnected"
        ? ["This project is not connected to Procore."]
        : ["Select a project to enable Procore linking."];

  const content =
    status === "notConnected" && selectedProjectId ? (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-gray-600">
          Connect this project to Procore to access locations, tools, and
          drawings.
        </p>
        <Button
          href={
            onConnectClick ? undefined : buildProjectEditHref(selectedProjectId)
          }
          onClick={onConnectClick}
          variant="secondary"
          className="w-full justify-center"
          leftIconClass={onConnectClick ? "bx bx-link" : "bx bx-link-external"}
        >
          Connect Procore
        </Button>
      </div>
    ) : undefined;

  const trigger = (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border ${config.bgClass} ${config.borderClass} ${config.hoverBg} transition-all duration-200 cursor-pointer group`}
    >
      <span
        className={`h-2 min-w-2 rounded-full ${config.dotClass} group-hover:scale-110 transition-transform`}
      />
      <img
        src={procoreIcon}
        alt="Procore status"
        className="h-4 w-4 group-hover:scale-105 transition-transform"
      />
    </div>
  );

  return (
    <InfoComboBox
      title="Procore Status"
      items={items}
      content={content}
      variant="status"
      statusType={config.statusType}
      trigger={trigger}
      align="right"
      menuWidthClassName="w-72"
    />
  );
}
