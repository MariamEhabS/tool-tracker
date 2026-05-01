import Badge from "@components/ui/Badge";
import type { BadgeVariant } from "@/types/Badge.types";
import RowTypeIcon from "@components/ui/Icon";
import type { Column } from "@components/table/DataTable";
import { computeTypeBadge } from "@/lib/badges";
import { formatCount } from "@lib/format";

export type QRCodeTableRow = {
  id: string;
  name: string;
  type:
    | "file"
    | "folder"
    | "url"
    | "procore-tool"
    | "procore-location"
    | "procore-drawing-code"
    | "static";
  group: string;
  groupType: "arrangement" | "equipment" | "none";
  groupArrangementType?:
    | "Procore Drawings"
    | "Taliho"
    | "Procore Drawings Codes";
  project?: string;
  projectStatus?: "active" | "on-hold" | "completed" | "archived" | "none";
  projectId?: string;
  groupId?: string;
  date: string;
  scans: number;
};

type QRCodesTableConfig = {
  /** Whether to show the Project column */
  showProjectColumn?: boolean;
  /** Badge variant function for group types */
  getGroupBadgeVariant: (
    groupType: QRCodeTableRow["groupType"],
    arrangementType?: QRCodeTableRow["groupArrangementType"],
  ) => BadgeVariant;
  /** Badge variant function for project status */
  getProjectBadgeVariant?: (
    status: NonNullable<QRCodeTableRow["projectStatus"]>,
  ) => BadgeVariant;
  /** Optional handler for when a group badge is clicked */
  onGroupClick?: (row: QRCodeTableRow) => void;
  /** Optional handler for when a project badge is clicked */
  onProjectClick?: (row: QRCodeTableRow) => void;
  /** Optional function to provide URL for right-click to open in new tab */
  getRowUrl?: (row: QRCodeTableRow) => string | undefined;
  /** Optional handler for when a row is clicked */
  onRowClick?: (row: QRCodeTableRow) => void;
};

export function getQRCodesTable(config: QRCodesTableConfig): {
  columns: Column<QRCodeTableRow>[];
  getRowId: (row: QRCodeTableRow) => string;
} {
  const {
    showProjectColumn = true,
    getGroupBadgeVariant,
    getProjectBadgeVariant,
    onGroupClick,
    onProjectClick,
    getRowUrl,
    onRowClick,
  } = config;

  const columns: Column<QRCodeTableRow>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      columnType: "primary",
      render: (r: QRCodeTableRow) => (
        <div className="flex items-center">
          <a
            href={getRowUrl?.(r)}
            className="absolute inset-0 z-0 top-0 left-0"
            onClick={(e) => {
              e.preventDefault();
              if (onRowClick) onRowClick(r);
            }}
            aria-label={`View ${r.name}`}
          />
          <RowTypeIcon type={r.type} className="mr-3" />
          <span className="font-medium text-indigo-700">{r.name}</span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      columnType: "status",
      render: (r: QRCodeTableRow) => {
        const typeBadge = computeTypeBadge(r.type);
        return (
          <Badge variant={typeBadge?.variant} shape="md">
            {typeBadge?.label ?? "None"}
          </Badge>
        );
      },
    },
    {
      key: "group",
      header: "Group",
      sortable: true,
      columnType: "group",
      render: (r: QRCodeTableRow) => {
        const badge = (
          <Badge
            variant={getGroupBadgeVariant(r.groupType, r.groupArrangementType)}
            shape="md"
          >
            {r.group}
          </Badge>
        );

        if (onGroupClick && r.groupType !== "none") {
          return (
            <button
              type="button"
              className="transition-all duration-150 hover:scale-105 hover:brightness-95 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onGroupClick(r);
              }}
            >
              {badge}
            </button>
          );
        }

        return badge;
      },
    },
  ];

  // Conditionally add Project column
  if (showProjectColumn && getProjectBadgeVariant) {
    columns.push({
      key: "project",
      header: "Project",
      sortable: true,
      columnType: "project",
      render: (r: QRCodeTableRow) => {
        const badge = (
          <Badge
            variant={getProjectBadgeVariant(r.projectStatus ?? "none")}
            shape="md"
          >
            {r.project ?? "[UNASSIGNED]"}
          </Badge>
        );

        if (onProjectClick && r.projectId) {
          return (
            <button
              type="button"
              className="transition-all duration-150 hover:scale-105 hover:brightness-95 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onProjectClick(r);
              }}
            >
              {badge}
            </button>
          );
        }

        return badge;
      },
    });
  }

  columns.push(
    {
      key: "date",
      header: "Date Created",
      sortable: true,
      className: "text-gray-500",
      columnType: "date",
    },
    {
      key: "scans",
      header: "Scans",
      sortable: true,
      className: "text-gray-500",
      columnType: "number",
      render: (r: QRCodeTableRow) => formatCount(r.scans),
    },
  );

  return {
    columns,
    getRowId: (row: QRCodeTableRow) => row.id,
  };
}
