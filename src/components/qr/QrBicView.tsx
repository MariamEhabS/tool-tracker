import { useGetWorkflow } from "@api/endpoints/ball-in-court";
import DataTable, { type Column } from "@/components/table/DataTable";
import { col, secondaryCell, statusBadgeCell } from "@lib/columns";
import { formatDate } from "@lib/format";
import type { BicWorkflowSummary, BallInCourtTask, BicTrade } from "@/types";
import type { BadgeVariant } from "@/types/Badge.types";

// ── Row types ─────────────────────────────────────────────────────────────────

type WorkflowRow = {
  id: string;
  name: string;
  status: "active" | "complete";
  progress: string;
  createdAt: string;
};

type TradeRow = {
  id: string;
  order: number;
  foremanName: string;
  tradeInfo: string;
  status: "pending" | "active" | "complete";
  tasks: string;
};

// ── Column definitions ────────────────────────────────────────────────────────

const workflowColumns: Column<WorkflowRow>[] = [
  col<WorkflowRow>({
    key: "name",
    header: "Workflow",
    sortable: true,
    columnType: "secondary",
    ...secondaryCell<WorkflowRow>((r) => (
      <div className="flex items-center">
        <div className="flex-shrink-0 h-10 w-10 rounded-md flex items-center justify-center mr-3 bg-yellow-100">
          <i className={`bx ${r.status === "complete" ? "bx-check" : "bx-shuffle"} text-yellow-600 text-xl`} />
        </div>
        <span className="font-medium text-gray-900">{r.name}</span>
      </div>
    )),
  }),
  col<WorkflowRow>({
    key: "status",
    header: "Status",
    sortable: true,
    ...statusBadgeCell<WorkflowRow>((r) => ({
      label: r.status === "complete" ? "Complete" : "Active",
      variant: (r.status === "complete" ? "green" : "yellow") as BadgeVariant,
    })),
  }),
  col<WorkflowRow>({
    key: "progress",
    header: "Progress",
    sortable: false,
    columnType: "status",
    render: (r) => (
      <span className="text-sm text-gray-500">{r.progress}</span>
    ),
  }),
  col<WorkflowRow>({
    key: "createdAt",
    header: "Created",
    sortable: true,
    columnType: "date",
    className: "text-gray-500",
    render: (r) => formatDate(r.createdAt),
  }),
];

function tradeStatusVariant(status: TradeRow["status"]): BadgeVariant {
  if (status === "complete") return "green";
  if (status === "active") return "yellow";
  return "gray";
}

function tradeStatusLabel(status: TradeRow["status"]) {
  if (status === "complete") return "Complete";
  if (status === "active") return "Active";
  return "Pending";
}

const tradeColumns: Column<TradeRow>[] = [
  col<TradeRow>({
    key: "foremanName",
    header: "Foreman",
    sortable: true,
    columnType: "secondary",
    ...secondaryCell<TradeRow>((r) => (
      <div className="flex items-center">
        <div
          className={`flex-shrink-0 h-10 w-10 rounded-md flex items-center justify-center mr-3 text-sm font-bold text-white ${
            r.status === "complete"
              ? "bg-green-500"
              : r.status === "active"
                ? "bg-yellow-400"
                : "bg-gray-300"
          }`}
        >
          {r.status === "complete" ? <i className="bx bx-check text-lg" /> : r.order}
        </div>
        <span className="font-medium text-gray-900">{r.foremanName}</span>
      </div>
    )),
  }),
  col<TradeRow>({
    key: "tradeInfo",
    header: "Trade / Company",
    sortable: true,
    columnType: "text",
    render: (r) => <span className="text-sm text-gray-500">{r.tradeInfo || "—"}</span>,
  }),
  col<TradeRow>({
    key: "status",
    header: "Status",
    sortable: true,
    ...statusBadgeCell<TradeRow>((r) => ({
      label: tradeStatusLabel(r.status),
      variant: tradeStatusVariant(r.status),
    })),
  }),
  col<TradeRow>({
    key: "tasks",
    header: "Tasks",
    sortable: false,
    columnType: "short",
    render: (r) => <span className="text-sm text-gray-500">{r.tasks}</span>,
  }),
];

// ── Component ─────────────────────────────────────────────────────────────────

type QrBicViewProps = {
  workflows: BicWorkflowSummary[];
  selectedWorkflowId: string | null;
  onSelectWorkflow: (id: string) => void;
  onSelectTrade: (workflowId: string, tradeIndex: number) => void;
};

export default function QrBicView({
  workflows,
  selectedWorkflowId,
  onSelectWorkflow,
  onSelectTrade,
}: QrBicViewProps) {
  const { data: workflowData, isLoading } = useGetWorkflow(
    selectedWorkflowId ?? undefined,
  );

  // ── Workflow list ─────────────────────────────────────────────────────────
  if (selectedWorkflowId === null) {
    const workflowRows: WorkflowRow[] = workflows.map((wf) => {
      const wfAny = wf as unknown as Record<string, unknown>;
      const tradeCount = wf.tradeCount || (Array.isArray(wfAny.trades) ? (wfAny.trades as unknown[]).length : 0);
      const currentIndex = wf.currentTradeIndex ?? 0;
      const display = tradeCount > 0
        ? `Trade ${Math.min(currentIndex + 1, tradeCount)} of ${tradeCount}`
        : "—";
      return {
        id: wf._id,
        name: wf.name,
        status: wf.status,
        progress: display,
        createdAt: (wfAny.createdAt as string) ?? "",
      };
    });

    return (
      <DataTable
        columns={workflowColumns}
        rows={workflowRows}
        getRowId={(r) => r.id}
        onRowClick={(r) => onSelectWorkflow(r.id)}
      />
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading || !workflowData) {
    return (
      <div className="flex items-center justify-center py-16">
        <i className="bx bx-loader-alt animate-spin text-yellow-500 text-2xl" />
      </div>
    );
  }

  // ── Trade list ────────────────────────────────────────────────────────────
  const { workflow, tasks } = workflowData;
  const sortedTrades = [...workflow.trades].sort((a, b) => a.order - b.order);

  function tradeTaskStats(tradeIndex: number) {
    const tradeTasks = (tasks as BallInCourtTask[]).filter((t) => t.tradeIndex === tradeIndex);
    const done = tradeTasks.filter((t) => t.status === "complete").length;
    return `${done}/${tradeTasks.length}`;
  }

  const tradeRows: TradeRow[] = sortedTrades.map((trade: BicTrade) => ({
    id: trade._id,
    order: trade.order,
    foremanName: trade.foremanName,
    tradeInfo: [trade.tradeName, trade.foremanCompany].filter(Boolean).join(" · "),
    status: trade.status,
    tasks: tradeTaskStats(trade.order - 1),
  }));

  return (
    <DataTable
      columns={tradeColumns}
      rows={tradeRows}
      getRowId={(r) => r.id}
      onRowClick={(r) => onSelectTrade(selectedWorkflowId, r.order - 1)}
    />
  );
}
