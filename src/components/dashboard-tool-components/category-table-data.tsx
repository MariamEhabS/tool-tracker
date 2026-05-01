import { deleteManyGroups } from "../../api/endpoints/groups";
import { logProcoreError } from "@/utils/rollbar";
import { ArchiveIcon } from "../../assets/icons/ArchiveIcon";
// import { BriefcaseIcon } from "../../assets/icons/BriefcaseIcon";
import { DownloadIcon } from "../../assets/icons/DownloadIcon";
import { EditIcon } from "../../assets/icons/EditIcon";
import { TrashCanIcon } from "../../assets/icons/TrashCanIcon";
import { Column, DataItem, DataTableProps } from "../../types";
import { formatProcoreTime } from "../../utils/dateFormatter";
import { getStoredUser } from "@/utils/getStoredUser";

export type CategoryMetaCallbacks = {
  onDeleteRequest?: (groupIds: string[]) => void;
};

export const executeBulkGroupDelete = async (
  companyId: string,
  groupIds: string[],
) => {
  try {
    const response = await deleteManyGroups(companyId, groupIds);
    return response;
  } catch (error) {
    logProcoreError(error, "category-delete", {
      companyId,
      groupCount: groupIds.length,
    });
    throw error;
  }
};

export const getCategoryMeta = (
  toolType: string,
  callbacks?: CategoryMetaCallbacks,
): DataTableProps | undefined => {
  const user = getStoredUser();

  switch (toolType) {
    case "equipment":
      return {
        columns: [
          {
            key: "name",
            label: "NAME",
            sortable: true,
            render: (
              value: string,
              item: { iconBg: string; icon: string; iconColor: string },
            ) => (
              <div className="flex items-center">
                <div
                  className={`flex-shrink-0 h-10 w-10 ${item.iconBg} rounded-md flex items-center justify-center mr-3`}
                >
                  {item.icon}
                </div>
                <span className="font-medium text-indigo-700">{value}</span>
              </div>
            ),
          },
          {
            key: "type",
            label: "TYPE",
            render: (value: string) => (
              <span className="text-gray-500">{value}</span>
            ),
          },
          {
            key: "project",
            label: "PROJECT NAME",
            sortable: true,
            render: (value: number) => (
              <span className="text-gray-500">{value}</span>
            ),
          },
          {
            key: "qrCodes",
            label: "QR CODES",
            sortable: true,
            render: (value: string) => (
              <span className={` text-gray-500`}>{value} QR Codes</span>
            ),
          },
          {
            key: "createdAt",
            label: "DATE CREATED",
            sortable: true,

            render: (value: string) => (
              <span className="text-gray-500">{formatProcoreTime(value)}</span>
            ),
          },
          {
            key: "scans",
            label: "SCANS",
            sortable: true,
            render: (value: number) => (
              <span className="text-gray-500">{value}</span>
            ),
          },
        ] as Column<DataItem>[],
        actions: [
          {
            label: "Edit",
            icon: <EditIcon className="!size-4" />,
            onClick: (item: DataItem) =>
              alert(`Edit ${item.name || "unknown"}`),
            className: "text-gray-700 hover:text-gray-900",
          },
          {
            label: "Download",
            icon: <DownloadIcon className=" !size-4" />,
            onClick: (item: DataItem) =>
              alert(`Download QR codes for ${item.name}`),
            className: "text-gray-700 hover:text-gray-900",
          },
          {
            label: "Delete",
            icon: <TrashCanIcon className=" !size-4" />,
            onClick: (item: DataItem) => alert(`Delete ${item.name}`),
            className: "text-red-600 hover:bg-red-50 hover:text-red-700",
          },
        ],
        // filters: [
        // 	{
        // 		key: 'status',
        // 		label: 'Status',
        // 		options: [
        // 			{ value: 'Active', label: 'Active' },
        // 			{ value: 'Completed', label: 'Completed' },
        // 			{ value: 'On Hold', label: 'On Hold' },
        // 			{ value: 'Archived', label: 'Archived' }
        // 		]
        // 	}
        // ],
        groupActions: [
          {
            label: "Download",
            icon: <DownloadIcon className=" !size-4" />,
            onClick: (selectedIds: string | unknown[]) =>
              alert(`Download ${selectedIds.length} items`),
            className: "bg-white text-gray-700 ring-gray-300 hover:bg-gray-50",
          },
          {
            label: "Delete",
            icon: <TrashCanIcon className=" !size-4" />,
            onClick: (selectedIds: string | unknown[]) => {
              const ids = selectedIds as string[];
              if (callbacks?.onDeleteRequest) {
                callbacks.onDeleteRequest(ids);
                return;
              }
              const count = ids.length;
              if (
                !window.confirm(
                  `Are you sure you want to delete ${count} group${count !== 1 ? "s" : ""}? Associated QR codes, documents, and folders will also be deleted. This action cannot be undone.`,
                )
              ) {
                return;
              }
              executeBulkGroupDelete(user?.companyId ?? "", ids);
            },
            className: "bg-red-50 text-red-600 ring-red-200 hover:bg-red-100",
          },
        ],
      };
    case "arrangement":
      return {
        columns: [
          {
            key: "name",
            label: "NAME",
            render: (
              value: string,
              item: { iconBg: string; icon: string; iconColor: string },
            ) => (
              <div className="flex items-center">
                <div
                  className={`flex-shrink-0 h-10 w-10 ${item.iconBg} rounded-md flex items-center justify-center mr-3`}
                >
                  {item.icon}
                </div>
                <span className="font-medium text-indigo-700">{value}</span>
              </div>
            ),
          },
          {
            key: "type",
            label: "TYPE",
            render: (value: string) => (
              <span className="text-gray-500">{value}</span>
            ),
          },

          {
            key: "project",
            label: "PROJECT",
            render: (value: number) => (
              <span className="text-gray-500">{value}</span>
            ),
          },
          {
            key: "qrCodes",
            label: "QR CODES",
            render: (value: number) => (
              <span className="text-gray-500">{value}</span>
            ),
          },
          {
            key: "createdAt",
            label: "DATE CREATED",
            render: (value: string) => (
              <span className="text-gray-500">{formatProcoreTime(value)}</span>
            ),
          },
          {
            key: "scans",
            label: "SCANS",
            render: (value: number) => (
              <span className="text-gray-500">{value}</span>
            ),
          },
        ] as Column<DataItem>[],
        actions: [
          {
            label: "Edit Project",
            icon: <ArchiveIcon className="!size-4" />,
            onClick: (item: DataItem) => alert(`Edit ${item.name}`),
            className: "text-gray-700 hover:text-gray-900",
          },
          {
            label: "Download",
            icon: <DownloadIcon className=" !size-4" />,
            onClick: (item: DataItem) =>
              alert(`Download QR codes for ${item.name}`),
            className: "text-gray-700 hover:text-gray-900",
          },
          {
            label: "Delete Project",
            icon: <TrashCanIcon className=" !size-4" />,
            onClick: (item: DataItem) => alert(`Delete ${item.name}`),
            className: "text-red-600 hover:bg-red-50 hover:text-red-700",
          },
        ],
        // filters: [
        // 	{
        // 		key: 'status',
        // 		label: 'Status',
        // 		options: [
        // 			{ value: 'Active', label: 'Active' },
        // 			{ value: 'Completed', label: 'Completed' },
        // 			{ value: 'On Hold', label: 'On Hold' },
        // 			{ value: 'Archived', label: 'Archived' }
        // 		]
        // 	}
        // ],
        groupActions: [
          // {
          // 	label: 'Archive',
          // 	icon: <ArchiveIcon className='!size-4' />,
          // 	onClick: (selectedIds: string | unknown[]) => alert(`Archive ${selectedIds.length} items`),
          // 	className: 'bg-white text-gray-700 ring-gray-300 hover:bg-gray-50'
          // },
          {
            label: "Download",
            icon: <DownloadIcon className=" !size-4" />,
            onClick: (selectedIds: string | unknown[]) =>
              alert(`Download ${selectedIds.length} items`),
            className: "bg-white text-gray-700 ring-gray-300 hover:bg-gray-50",
          },
          {
            label: "Delete",
            icon: <TrashCanIcon className=" !size-4" />,
            onClick: (selectedIds: string | unknown[]) =>
              alert(`Delete ${selectedIds.length} items`),
            className: "bg-red-50 text-red-600 ring-red-200 hover:bg-red-100",
          },
        ],
      };
    case "quick-code":
      return {
        columns: [
          {
            key: "name",
            label: "NAME",
            render: (
              value: string,
              item: { iconBg: string; icon: string; iconColor: string },
            ) => (
              <div className="flex items-center">
                <div
                  className={`flex-shrink-0 h-10 w-10 ${item.iconBg} rounded-md flex items-center justify-center mr-3`}
                >
                  {item.icon}
                </div>
                <span className="font-medium text-indigo-700">{value}</span>
              </div>
            ),
          },
          {
            key: "type",
            label: "TYPE",
            render: (value: string) => (
              <span className="text-gray-500">{value}</span>
            ),
          },
          {
            key: "createdAt",
            label: "DATE CREATED",
            render: (value: string) => (
              <span className="text-gray-500">{formatProcoreTime(value)}</span>
            ),
          },
          {
            key: "scans",
            label: "SCANS",
            render: (value: number) => (
              <span className="text-gray-500">{value}</span>
            ),
          },
        ] as Column<DataItem>[],
        actions: [
          {
            label: "Edit Project",
            icon: <ArchiveIcon className="!size-4" />,
            onClick: (item: DataItem) => alert(`Edit ${item.name}`),
            className: "text-gray-700 hover:text-gray-900",
          },
          {
            label: "Download",
            icon: <DownloadIcon className=" !size-4" />,
            onClick: (item: DataItem) =>
              alert(`Download QR codes for ${item.name}`),
            className: "text-gray-700 hover:text-gray-900",
          },
          {
            label: "Delete Project",
            icon: <TrashCanIcon className=" !size-4" />,
            onClick: (item: DataItem) => alert(`Delete ${item.name}`),
            className: "text-red-600 hover:bg-red-50 hover:text-red-700",
          },
        ],
        filters: [
          {
            key: "status",
            label: "Status",
            options: [
              { value: "Active", label: "Active" },
              { value: "Completed", label: "Completed" },
              { value: "On Hold", label: "On Hold" },
              { value: "Archived", label: "Archived" },
            ],
          },
        ],
        groupActions: [
          {
            label: "Archive",
            icon: <ArchiveIcon className="!size-4" />,
            onClick: (selectedIds: string | unknown[]) =>
              alert(`Archive ${selectedIds.length} items`),
            className: "bg-white text-gray-700 ring-gray-300 hover:bg-gray-50",
          },
          {
            label: "Download",
            icon: <DownloadIcon className=" !size-4" />,
            onClick: (selectedIds: string | unknown[]) =>
              alert(`Download ${selectedIds.length} items`),
            className: "bg-white text-gray-700 ring-gray-300 hover:bg-gray-50",
          },
          {
            label: "Delete",
            icon: <TrashCanIcon className=" !size-4" />,
            onClick: (selectedIds: string | unknown[]) =>
              alert(`Delete ${selectedIds.length} items`),
            className: "bg-red-50 text-red-600 ring-red-200 hover:bg-red-100",
          },
        ],
      };

    default: {
      return undefined;
    }
  }
};
