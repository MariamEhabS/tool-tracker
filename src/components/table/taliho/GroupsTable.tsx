import Badge from "@components/ui/Badge";
import type { BadgeVariant } from "@/types/Badge.types";
import Icon, { type RowType } from "@components/ui/Icon";
import type { Column } from "@components/table/DataTable";
import { formatCount } from "@lib/format";

export type GroupTableRow = {
  id: string;
  name: string;
  groupType: "arrangement" | "equipment";
  /** For arrangements: 'Taliho' | 'Procore Drawings' */
  arrangementType?: string;
  /** For equipment: equipment ID */
  equipmentId?: string;
  project?: string;
  projectId?: string;
  projectStatus?: "active" | "on-hold" | "completed" | "archived" | "none";
  qrCodes: number;
  date: string;
  scans: number;
  subtitle?: string;
};

type GroupsTableConfig = {
  /** Whether to show the Project column */
  showProjectColumn?: boolean;
  /** Whether to show the Type column (arrangement type or equipment ID) */
  showTypeColumn?: boolean;
  /** Badge variant function for group types */
  getGroupTypeBadgeVariant?: (
    groupType: GroupTableRow["groupType"],
  ) => BadgeVariant;
  /** Badge variant function for arrangement types */
  getArrangementTypeBadgeVariant?: (type: string) => BadgeVariant;
  /** Badge variant function for project status */
  getProjectBadgeVariant?: (
    status: NonNullable<GroupTableRow["projectStatus"]>,
  ) => BadgeVariant;
  /** Optional handler for when a project badge is clicked */
  onProjectClick?: (row: GroupTableRow) => void;
  /** Optional handler for when a row is clicked */
  onRowClick?: (row: GroupTableRow) => void;
  /** Optional function to provide URL for right-click to open in new tab */
  getRowUrl?: (row: GroupTableRow) => string | undefined;
};

export function getGroupsTable(config: GroupsTableConfig): {
  columns: Column<GroupTableRow>[];
  getRowId: (row: GroupTableRow) => string;
} {
  const {
    showProjectColumn = true,
    showTypeColumn = true,
    getGroupTypeBadgeVariant,
    getArrangementTypeBadgeVariant,
    getProjectBadgeVariant,
    onProjectClick,
    onRowClick,
    getRowUrl,
  } = config;

  const columns: Column<GroupTableRow>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      columnType: "primary",
      className: "",
      render: (row: GroupTableRow) => {
        // Use Procore icon for Procore Drawings groups, otherwise use group type icon
        const isProcoreDrawings = row.arrangementType === "Procore Drawings";
        const iconType: RowType = isProcoreDrawings
          ? "procore-drawing-code"
          : row.groupType === "arrangement"
            ? "arrangement"
            : "equipment";

        return (
          <div className="flex items-center">
            <a
              href={getRowUrl?.(row)}
              // className="absolute inset-0 z-0 top-0 left-0"
              onClick={(e) => {
                e.preventDefault();
                if (onRowClick) onRowClick(row);
              }}
              aria-label={`View ${row.name}`}
            />
            <Icon variant="rowType" type={iconType} className="mr-3" />
            <span className="font-medium text-indigo-700">{row.name}</span>
          </div>
        );
      },
    },
  ];

  // Conditionally add Type column
  if (showTypeColumn) {
    // If we have a unified view (Groups page), show group type
    if (!getArrangementTypeBadgeVariant) {
      columns.push({
        key: "groupType",
        header: "Group Type",
        sortable: true,
        columnType: "status",
        render: (r: GroupTableRow) => {
          // For Procore Drawings arrangements, show a distinct badge
          const isProcoreDrawings = r.arrangementType === "Procore Drawings";
          let variant: BadgeVariant;
          let label: string;

          if (isProcoreDrawings) {
            variant = "orange"; // Distinct color for Procore Drawings
            label = "Procore Drawings";
          } else if (r.groupType === "arrangement") {
            variant = getGroupTypeBadgeVariant
              ? getGroupTypeBadgeVariant(r.groupType)
              : "indigo";
            label = "Arrangement";
          } else {
            variant = getGroupTypeBadgeVariant
              ? getGroupTypeBadgeVariant(r.groupType)
              : "red";
            label = "Equipment";
          }

          return (
            <Badge variant={variant} shape="md">
              {label}
            </Badge>
          );
        },
      });
    } else {
      // If we're in a mixed view (ProjectDetail groups tab), show arrangement type OR equipment ID
      columns.push({
        key: "typeOrId",
        header: "Type",
        sortable: true,
        columnType: "status",
        render: (r: GroupTableRow) => {
          if (r.groupType === "arrangement" && r.arrangementType) {
            return (
              <Badge
                variant={getArrangementTypeBadgeVariant(r.arrangementType)}
                shape="md"
              >
                {r.arrangementType}
              </Badge>
            );
          }
          if (r.groupType === "equipment" && r.equipmentId) {
            return (
              <span className="font-mono text-sm text-gray-700">
                {r.equipmentId}
              </span>
            );
          }
          return <span className="text-gray-400">-</span>;
        },
      });
    }
  }

  // Conditionally add Project column
  if (showProjectColumn && getProjectBadgeVariant) {
    columns.push({
      key: "project",
      header: "Project",
      sortable: true,
      columnType: "project",
      render: (r: GroupTableRow) => {
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
      key: "qrCodes",
      header: "QR Codes",
      sortable: true,
      className: "text-gray-500",
      columnType: "short",
      render: (r: GroupTableRow) =>
        `${formatCount(r.qrCodes)} QR Code${r.qrCodes === 1 ? "" : "s"}`,
    },
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
      render: (r: GroupTableRow) => formatCount(r.scans),
    },
  );

  return {
    columns,
    getRowId: (row: GroupTableRow) => row.id,
  };
}
