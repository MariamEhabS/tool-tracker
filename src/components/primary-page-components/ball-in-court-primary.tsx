import { useNavigate } from "@tanstack/react-router";
import type { BicWorkflowSummary, BicWorkflowTradeSummary } from "@/types";
import EmptyState from "@/components/ui/EmptyState";
import { FolderOutlineIcon } from "@/assets/icons/FolderOutlineIcon";
import type { ReactNode } from "react";

function getProgressStyles(progressPercent: number) {
  if (progressPercent === 0) {
    return {
      badgeClass: "border border-[#fecdd3] bg-[#ffe4e6] text-[#9f1239]",
      barColor: "#FCA5A5",
    };
  }

  if (progressPercent >= 100) {
    return {
      badgeClass: "border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]",
      barColor: "#22c55e",
    };
  }

  if (progressPercent >= 66) {
    return {
      badgeClass: "border border-[#fde68a] bg-[#fef9c3] text-[#854d0e]",
      barColor: "#a3b836",
    };
  }

  if (progressPercent >= 36) {
    return {
      badgeClass: "border border-[#fde68a] bg-[#fef9c3] text-[#854d0e]",
      barColor: "#EAB308",
    };
  }

  return {
    badgeClass: "border border-[#fde68a] bg-[#fef3c7] text-[#92400e]",
    barColor: "#EAB308",
  };
}

function getTradeLabel(trade?: BicWorkflowTradeSummary | null): ReactNode {
  if (!trade) return "Not assigned yet";

  if (trade.tradeName) {
    return (
      <>
        {trade.foremanName}, {trade.tradeName}
      </>
    );
  }

  if (trade.foremanCompany) {
    return (
      <>
        {trade.foremanName}, <em>{trade.foremanCompany}</em>
      </>
    );
  }

  return trade.foremanName;
}

function WorkflowCard({ workflow }: { workflow: BicWorkflowSummary }) {
  const navigate = useNavigate();
  const completedSteps =
    workflow.completedStepCount ??
    (workflow.status === "complete"
      ? workflow.tradeCount
      : Math.max(0, Math.min(workflow.currentTradeIndex, workflow.tradeCount)));
  const progressPercent =
    workflow.progressPercent ??
    (workflow.tradeCount > 0
      ? Math.round((completedSteps / workflow.tradeCount) * 100)
      : 0);
  const progressStyles = getProgressStyles(progressPercent);
  const currentTrade = workflow.status === "complete" ? null : workflow.currentTrade ?? null;
  const onDeckTrade = workflow.status === "complete" ? null : workflow.onDeckTrade ?? null;

  return (
    <button
      type="button"
      onClick={() =>
        navigate({
          to: "/task-signoff/$workflowId",
          params: { workflowId: workflow._id },
        })
      }
      className="w-full rounded-[18px] border border-[#ece7df] bg-white px-4 py-[18px] text-left shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold leading-tight text-[#181818]">
            {workflow.name}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${progressStyles.badgeClass}`}
        >
          {progressPercent}%
        </span>
      </div>

      <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-[#f2efe9]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${
              workflow.status === "complete"
                ? 100
                : progressPercent > 0
                  ? Math.max(progressPercent, workflow.tradeCount > 0 ? 8 : 0)
                  : 0
            }%`,
            background: progressStyles.barColor,
          }}
        />
      </div>

      {workflow.status === "complete" ? (
        <div className="mt-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <i className="bx bx-check-circle text-[14px] text-[#22c55e]" />
            <p className="truncate text-[13px] font-medium text-[#166534]">
              All {workflow.tradeCount} step
              {workflow.tradeCount === 1 ? "" : "s"} complete
            </p>
          </div>
          <div className="mt-3 flex justify-end">
            <span className="flex-shrink-0 text-[12px] font-medium text-[#888]">
              View &rarr;
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-3.5 space-y-2.5">
          <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-2">
            <span className="pt-[1px] text-[12px] text-[#888]">Current task:</span>
            <span className="truncate text-[12px] font-medium leading-[1.35] text-[#111]">
              {getTradeLabel(currentTrade)}
            </span>
          </div>
          <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-2">
            <span className="pt-[1px] text-[12px] text-[#888]">On deck:</span>
            <span className="truncate text-[12px] font-medium leading-[1.35] text-[#6b7280]">
              {getTradeLabel(onDeckTrade)}
            </span>
          </div>
          <div className="flex justify-end pt-0.5">
            <span className="flex-shrink-0 text-[12px] font-medium text-[#888]">
              Open &rarr;
            </span>
          </div>
        </div>
      )}
    </button>
  );
}

export function BallInCourtPrimary({
  workflows,
}: {
  workflows: BicWorkflowSummary[];
}) {
  if (workflows.length === 0) {
    return (
      <div className="px-4 pb-6">
        <EmptyState
          icon={<FolderOutlineIcon className="h-6 w-6 text-gray-400" />}
          title="No workflows"
          description="This QR code doesn't have any Task Signoff workflows yet."
          compact
          className="mt-2"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {workflows.map((workflow) => (
        <WorkflowCard key={workflow._id} workflow={workflow} />
      ))}
    </div>
  );
}
