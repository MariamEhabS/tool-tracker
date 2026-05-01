/* eslint-disable @typescript-eslint/no-explicit-any --
   Tool table rows are dynamically shaped based on Procore tool type.
   Each of the 15+ tool types returns different data structures.
   Type safety is maintained at render time through defensive checks. */
import { Column } from "../../types";
import { formatProcoreTime } from "../../utils/dateFormatter";

const renderValue = (value: any): string | number => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") {
    if (value.name) return value.name;
    if (value.id) return String(value.id);
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value;
};

export const getToolColumns = (toolType: string): Column<any>[] => {
  const defaultColumns: Column<any>[] = [
    {
      key: "title",
      label: "Name",
      sortable: true,
      render: (_, item) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center mr-3">
            <i className="bx bx-cube text-gray-600 text-xl" />
          </div>
          {renderValue(item.title || item.name)}
        </div>
      ),
    },
    {
      key: "updated_at",
      label: "Date Modified",
      sortable: true,
      render: (_, item) =>
        formatProcoreTime(
          String(renderValue(item.updated_at || item.created_at)),
        ),
    },
  ];
  switch (toolType) {
    case "coordination-issue":
      return [
        {
          key: "title",
          label: "Name",
          sortable: true,
          render: (_, item: any) => (
            <div className="flex items-center">
              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                <i className="bx bx-git-compare text-gray-600 text-xl" />
              </div>
              {renderValue(item.title)}
            </div>
          ),
        },
        {
          key: "number",
          label: "#",
          sortable: true,
          render: (_, item) => renderValue(item?.issue_number) || "-",
        },
        {
          key: "status",
          label: "Status",
          sortable: false,
          render: (_, item) => (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                item?.status === "Open"
                  ? "bg-red-100 text-red-700"
                  : item?.status === "Closed"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {renderValue(item?.status) || "-"}
            </span>
          ),
        },
        {
          key: "updated_at",
          label: "Date Modified",
          sortable: true,
          render: (_, item) =>
            formatProcoreTime(
              item?.updated_at || item?.issue?.updated_at || item?.created_at,
            ),
        },
      ];

    case "submittal":
      return [
        {
          key: "title",
          label: "Name",
          sortable: true,
          render: (_, item: any) => (
            <div className="flex items-center">
              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                <i className="bx bx-git-compare text-gray-600 text-xl" />
              </div>
              {renderValue(item.title)}
            </div>
          ),
        },
        {
          key: "number",
          label: "#",
          sortable: true,
          render: (_, item) =>
            renderValue(item?.specification_section?.number) || "-",
        },
        {
          key: "status",
          label: "Status",
          sortable: false,
          render: (_, item) => (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                item?.status === "Open"
                  ? "bg-red-100 text-red-700"
                  : item?.status === "Closed"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {renderValue(item?.status?.name) || "-"}
            </span>
          ),
        },
        {
          key: "ball_in_court",
          label: "Ball in Court",
          sortable: false,
          render: (_, item: any) => (
            <div className="flex items-center">
              {renderValue(
                Array.isArray(item?.ball_in_court)
                  ? item.ball_in_court
                      .map((ball: { name?: string }) => ball?.name)
                      .join("")
                  : "",
              )}
            </div>
          ),
        },
        {
          key: "type",
          label: "Type",
          sortable: false,
          render: (_, item: any) => (
            <div className="flex items-center">
              {renderValue(item.type || "-")}
            </div>
          ),
        },
        {
          key: "date_received",
          label: "Date Received",
          sortable: true,
          render: (_, item) => formatProcoreTime(item?.received_date || "-"),
        },
        {
          key: "due_date",
          label: "Due Date",
          sortable: true,
          render: (_, item) => formatProcoreTime(item?.submit_by || "-"),
        },
      ];

    // case 'document':
    // 	return [
    // 		{
    // 			key: 'title',
    // 			label: 'Name',
    // 			sortable: true,
    // 			render: (_, item: any) => (
    // 				<div className="flex items-center">
    // 					<div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center mr-3">
    // 						<i className="bx bx-git-compare text-gray-600 text-xl" />
    // 					</div>
    // 					{renderValue(item.title || item.issue?.title)}
    // 				</div>
    // 			)
    // 		},
    // 		{
    // 			key: 'number',
    // 			label: '#',
    // 			sortable: true,
    // 			render: (_, item) => renderValue(item?.issue_number) || '-'
    // 		},
    // 		{
    // 			key: 'status',
    // 			label: 'Status',
    // 			render: (_, item) => (
    // 				<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
    // 					item?.status === 'Open' ? 'bg-red-100 text-red-700' :
    // 						item?.status === 'Closed' ? 'bg-green-100 text-green-700' :
    // 							'bg-gray-100 text-gray-700'
    // 				}`}>
    // 					{renderValue(item?.status) || '-'}
    // 				</span>
    // 			)
    // 		},
    // 		{
    // 			key: 'updated_at',
    // 			label: 'Date Modified',
    // 			sortable: true,
    // 			render: (_, item) => formatProcoreTime(item?.updated_at || item?.issue?.updated_at || item?.created_at)
    // 		}
    // 	];
    case "drawing":
      return [
        {
          key: "title",
          label: "Name",
          sortable: true,
          render: (_, item: any) => (
            <div className="flex items-center">
              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                <i className="bx bx-git-compare text-gray-600 text-xl" />
              </div>
              {renderValue(item?.title || item?.issue?.title)}
            </div>
          ),
        },
        {
          key: "revision",
          label: "Revision",
          sortable: true,
          render: (_, item) =>
            renderValue(item?.current_revision?.revision_number) || "-",
        },
        {
          key: "area",
          label: "area",
          sortable: false,
          render: (_, item) => renderValue(item?.areaId) || "-",
        },
        {
          key: "discipline",
          label: "discipline",
          sortable: true,
          render: (_, item) => renderValue(item?.discipline) || "-",
        },
        {
          key: "updated_at",
          label: "Date Modified",
          sortable: true,
          render: (_, item) =>
            formatProcoreTime(item?.current_revision?.updated_at) || "-",
        },
      ];
    case "form":
      return [
        {
          key: "title",
          label: "Name",
          sortable: true,
          render: (_, item: any) => (
            <div className="flex items-center">
              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                <i className="bx bx-git-compare text-gray-600 text-xl" />
              </div>
              {renderValue(item?.name)}
            </div>
          ),
        },
        {
          key: "form_template",
          label: "form template",
          sortable: true,
          render: (_, item) => renderValue(item?.form_template_name) || "-",
        },
        // {
        // 	key: 'status',
        // 	label: 'Status',
        // 	render: (_, item) => (
        // 		<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        // 			item?.status === 'Open' ? 'bg-red-100 text-red-700' :
        // 				item?.status === 'Closed' ? 'bg-green-100 text-green-700' :
        // 					'bg-gray-100 text-gray-700'
        // 		}`}>
        // 			{renderValue(item?.status) || '-'}
        // 		</span>
        // 	)
        // },
        {
          key: "updated_at",
          label: "Date Modified",
          sortable: true,
          render: (_, item) => formatProcoreTime(item?.updated_at || "-"),
        },
      ];
    case "incident":
      return [
        {
          key: "title",
          label: "Name",
          sortable: true,
          render: (_, item: any) => (
            <div className="flex items-center">
              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                <i className="bx bx-git-compare text-gray-600 text-xl" />
              </div>
              {renderValue(item.title)}
            </div>
          ),
        },
        {
          key: "recordable",
          label: "recordable",
          sortable: true,
          render: (_, item) =>
            renderValue(item?.recordable ? "Yes" : "No") || "-",
        },
        {
          key: "status",
          label: "Status",
          sortable: false,
          render: (_, item) => (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                item?.status === "Open"
                  ? "bg-red-100 text-red-700"
                  : item?.status === "Closed"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {renderValue(item?.status) || "-"}
            </span>
          ),
        },
        {
          key: "date_occured",
          label: "Date Occured",
          sortable: true,
          render: (_, item) => formatProcoreTime(item?.event_date || "-"),
        },
      ];
    case "inspection":
      return [
        {
          key: "title",
          label: "Name",
          sortable: true,
          render: (_, item: any) => (
            <div className="flex items-center">
              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                <i className="bx bx-git-compare text-gray-600 text-xl" />
              </div>
              {renderValue(item?.name || "-")}
            </div>
          ),
        },
        {
          key: "number",
          label: "#",
          sortable: true,
          render: (_, item) => renderValue(item?.number) || "-",
        },
        {
          key: "status",
          label: "Status",
          sortable: false,
          render: (_, item) => (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                item?.status === "Open"
                  ? "bg-red-100 text-red-700"
                  : item?.status === "Closed"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {renderValue(item?.status) || "-"}
            </span>
          ),
        },
        {
          key: "type",
          label: "type",
          sortable: false,
          render: (_, item) => renderValue(item?.inspection_type?.name) || "-",
        },
        {
          key: "location",
          label: "location",
          sortable: false,
          render: (_, item) => renderValue(item?.location?.name) || "-",
        },
        {
          key: "inspector",
          label: "inspector",
          sortable: false,
          render: (_, item) =>
            renderValue(
              item?.inspectors?.map((x: { name: string }) => x?.name).join(""),
            ) || "-",
        },
        {
          key: "inspection_date",
          label: "Inspection Date",
          sortable: true,
          render: (_, item) => formatProcoreTime(item?.inspection_date || "-"),
        },
      ];
    case "instruction":
      return [
        {
          key: "title",
          label: "Name",
          sortable: true,
          render: (_, item: any) => (
            <div className="flex items-center">
              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                <i className="bx bx-git-compare text-gray-600 text-xl" />
              </div>
              {renderValue(item?.title || "-")}
            </div>
          ),
        },
        {
          key: "number",
          label: "#",
          sortable: true,
          render: (_, item) => renderValue(item?.number) || "-",
        },
        {
          key: "status",
          label: "Status",
          sortable: false,
          render: (_, item) => (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                item?.status === "Open"
                  ? "bg-red-100 text-red-700"
                  : item?.status === "Closed"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {renderValue(item?.status) || "-"}
            </span>
          ),
        },
        {
          key: "assignee",
          label: "assignee",
          sortable: false,
          render: (_, item) =>
            renderValue(
              item?.attentions
                .map((attention: { name: string }) => attention.name || "-")
                .join(""),
            ) || "-",
        },
        // {
        // 	key: 'due_date',
        // 	label: 'Due Date',
        // 	sortable: true,
        // 	render: (_, item) => formatProcoreTime(item?.updated_at || item?.issue?.updated_at || item?.created_at)
        // }
      ];
    case "observation":
      return [
        {
          key: "title",
          label: "Name",
          sortable: true,
          render: (_, item: any) => (
            <div className="flex items-center">
              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                <i className="bx bx-git-compare text-gray-600 text-xl" />
              </div>
              {renderValue(item?.name || "-")}
            </div>
          ),
        },
        {
          key: "number",
          label: "#",
          sortable: true,
          render: (_, item) => renderValue(item?.number) || "-",
        },
        {
          key: "status",
          label: "Status",
          sortable: false,
          render: (_, item) => (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                item?.status === "Open"
                  ? "bg-red-100 text-red-700"
                  : item?.status === "Closed"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {renderValue(item?.status) || "-"}
            </span>
          ),
        },
        {
          key: "priority",
          label: "priority",
          sortable: false,
          render: (_, item) => (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                item?.status === "Open"
                  ? "bg-red-100 text-red-700"
                  : item?.status === "Closed"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {renderValue(item?.priority) || "-"}
            </span>
          ),
        },
        {
          key: "type",
          label: "type",
          sortable: false,
          render: (_, item) => renderValue(item?.type?.category) || "-",
        },
        {
          key: "due_date",
          label: "Due Date",
          sortable: true,
          render: (_, item) => formatProcoreTime(item?.due_date || "-"),
        },
      ];
    case "photo":
      return [
        {
          key: "title",
          label: "Name",
          sortable: true,
          render: (_, item: any) => (
            <div className="flex items-center">
              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                <i className="bx bx-git-compare text-gray-600 text-xl" />
              </div>
              {renderValue(item?.title || item?.issue?.title)}
            </div>
          ),
        },
        {
          key: "number",
          label: "#",
          sortable: true,
          render: (_, item) => renderValue(item?.issue_number) || "-",
        },
        {
          key: "status",
          label: "Status",
          sortable: false,
          render: (_, item) => (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                item?.status === "Open"
                  ? "bg-red-100 text-red-700"
                  : item?.status === "Closed"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {renderValue(item?.status) || "-"}
            </span>
          ),
        },
        {
          key: "updated_at",
          label: "Date Modified",
          sortable: true,
          render: (_, item) => formatProcoreTime(item?.updated_at || "-"),
        },
      ];
    case "punch-list":
      return [
        {
          key: "title",
          label: "Name",
          sortable: true,
          render: (_, item: any) => (
            <div className="flex items-center">
              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                <i className="bx bx-git-compare text-gray-600 text-xl" />
              </div>
              {renderValue(item?.name || "-")}
            </div>
          ),
        },
        {
          key: "number",
          label: "#",
          sortable: true,
          render: (_, item) => renderValue(item?.position) || "-",
        },
        {
          key: "status",
          label: "Status",
          render: (_, item) => (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                item?.status === "Open"
                  ? "bg-red-100 text-red-700"
                  : item?.status === "Closed"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {renderValue(item?.status) || "-"}
            </span>
          ),
        },
        {
          key: "location",
          label: "location",
          sortable: true,
          render: (_, item) => renderValue(item?.location?.name) || "-",
        },
        {
          key: "assignee",
          label: "assignee",
          sortable: true,
          render: (_, item) =>
            renderValue(
              item?.assignees
                ?.map((assignee: { name: string }) => assignee?.name)
                .join(""),
            ) || "-",
        },
        {
          key: "due_date",
          label: "Due Date",
          sortable: true,
          render: (_, item) => formatProcoreTime(item?.due_date || "-"),
        },
      ];
    case "rfi":
      return [
        {
          key: "subject",
          label: "subject",
          sortable: true,
          render: (_, item: any) => (
            <div className="flex items-center">
              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                <i className="bx bx-git-compare text-gray-600 text-xl" />
              </div>
              {renderValue(item?.subject || "-")}
            </div>
          ),
        },
        {
          key: "number",
          label: "#",
          sortable: true,
          render: (_, item) => renderValue(item?.number) || "-",
        },
        {
          key: "status",
          label: "Status",
          sortable: false,
          render: (_, item) => (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                item?.status === "Open"
                  ? "bg-red-100 text-red-700"
                  : item?.status === "Closed"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {renderValue(item?.status) || "-"}
            </span>
          ),
        },
        {
          key: "date_received",
          label: "Date Received",
          sortable: true,
          render: (_, item) => formatProcoreTime(item?.initiated_at || "-"),
        },
        {
          key: "due_date",
          label: "Due Date",
          sortable: true,
          render: (_, item) => formatProcoreTime(item?.due_date || "-"),
        },
      ];

    case "specification":
      return [
        {
          key: "title",
          label: "Name",
          sortable: true,
          render: (_, item: any) => (
            <div className="flex items-center">
              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                <i className="bx bx-git-compare text-gray-600 text-xl" />
              </div>
              {renderValue(item?.description || "-")}
            </div>
          ),
        },
        {
          key: "number",
          label: "#",
          sortable: true,
          render: (_, item) => renderValue(item?.number) || "-",
        },
        {
          key: "set",
          label: "set",
          sortable: false,
          render: (_, item) =>
            renderValue(item?.specification_set?.name) ||
            (item?.specification_set_id
              ? `Set ${item.specification_set_id}`
              : "-"),
        },
        {
          key: "issue_date",
          label: "Date Issued",
          sortable: true,
          render: (_, item) => formatProcoreTime(`${item?.issued_date || "-"}`),
        },
      ];
    case "task":
      return [
        {
          key: "title",
          label: "Name",
          sortable: true,
          render: (_, item: any) => (
            <div className="flex items-center">
              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                <i className="bx bx-git-compare text-gray-600 text-xl" />
              </div>
              {renderValue(item?.title || item?.issue?.title)}
            </div>
          ),
        },
        {
          key: "number",
          label: "#",
          sortable: true,
          render: (_, item) => renderValue(item?.issue_number) || "-",
        },
        {
          key: "status",
          label: "Status",
          sortable: false,
          render: (_, item) => (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                item?.status === "Open"
                  ? "bg-red-100 text-red-700"
                  : item?.status === "Closed"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {renderValue(item?.status) || "-"}
            </span>
          ),
        },
        {
          key: "updated_at",
          label: "Date Modified",
          sortable: true,
          render: (_, item) =>
            formatProcoreTime(
              item?.updated_at || item?.issue?.updated_at || item?.created_at,
            ),
        },
      ];
    case "directory":
      return [
        {
          key: "title",
          label: "Name",
          sortable: true,
          render: (_, item: any) => (
            <div className="flex items-center">
              <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                <i className="bx bx-git-compare text-gray-600 text-xl" />
              </div>
              {renderValue(item?.name || "-")}
            </div>
          ),
        },
        {
          key: "company",
          label: "company",
          sortable: false,
          render: (_, item) => renderValue(item?.vendor?.name || "-"),
        },
        {
          key: "trade",
          label: "trade",
          sortable: false,
          render: (_, item) => renderValue(item?.trade || "-"),
        },
        {
          key: "phone",
          label: "phone",
          sortable: false,
          render: (_, item) => renderValue(item?.business_phone || "-"),
        },
        {
          key: "email",
          label: "email",
          sortable: false,
          render: (_, item) => renderValue(item?.email_address || "-"),
        },
      ];

    default:
      return defaultColumns.map((col) => ({
        ...col,
        render: (_, item) => renderValue(item[col.key]),
      }));
  }
};
