import Modal from "@/components/modal/Modal";
import { useGetWorkflow } from "@api/endpoints/ball-in-court";
import { formatDate } from "@lib/format";
import type { BallInCourtTask } from "@/types";

type BicTradeDetailModalProps = {
  open: boolean;
  onClose: () => void;
  workflowId: string | null;
  tradeIndex: number | null; // 0-based
};

const TASK_SIGNOFF_BRONZE_SOLID = "#EAB308";
const TASK_SIGNOFF_SUCCESS_SOLID = "#1F7A4D";
const TASK_SIGNOFF_NEUTRAL_SOLID = "#94A3B8";

function parseTaskDate(value?: string) {
  if (!value) return null;
  const parsed =
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(
          Number(value.slice(0, 4)),
          Number(value.slice(5, 7)) - 1,
          Number(value.slice(8, 10)),
        )
      : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function getTaskDeadline(task: BallInCourtTask) {
  return task.endDate || task.foremanEndDate || undefined;
}

function isTaskLate(task: BallInCourtTask) {
  if (task.status === "complete") return false;
  const deadline = parseTaskDate(getTaskDeadline(task));
  if (!deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return deadline < today;
}

function getTaskDateChip(task: BallInCourtTask) {
  if (task.datesAssignedByPm) {
    if (task.startDate && task.endDate) {
      return `${formatDate(task.startDate)} to ${formatDate(task.endDate)}`;
    }
    if (task.endDate) {
      return `Complete by: ${formatDate(task.endDate)}`;
    }
  }

  if (task.foremanStartDate && task.foremanEndDate) {
    return `${formatDate(task.foremanStartDate)} to ${formatDate(task.foremanEndDate)}`;
  }

  if (task.foremanEndDate) {
    return `Complete by: ${formatDate(task.foremanEndDate)}`;
  }

  return null;
}

export default function BicTradeDetailModal({
  open,
  onClose,
  workflowId,
  tradeIndex,
}: BicTradeDetailModalProps) {
  const { data, isLoading } = useGetWorkflow(workflowId ?? undefined);

  const trade =
    data?.workflow.trades.find((t) => t.order - 1 === tradeIndex) ?? null;
  const tasks = (data?.tasks ?? [])
    .filter((t: BallInCourtTask) => t.tradeIndex === tradeIndex)
    .sort((a: BallInCourtTask, b: BallInCourtTask) => a.order - b.order);

  const completedCount = tasks.filter((t: BallInCourtTask) => t.status === "complete").length;

  const titleNode = trade ? (
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background:
            trade.status === "complete"
              ? TASK_SIGNOFF_SUCCESS_SOLID
              : trade.status === "active"
                ? TASK_SIGNOFF_BRONZE_SOLID
                : TASK_SIGNOFF_NEUTRAL_SOLID,
        }}
      >
        <span className="text-white text-sm font-bold">{trade.order}</span>
      </div>
      <div>
        <div className="text-[17px] font-bold text-gray-900 leading-tight">{trade.foremanName}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {trade.tradeName}
          {trade.foremanCompany ? ` · ${trade.foremanCompany}` : ""}
        </div>
      </div>
    </div>
  ) : (
    "Trade Details"
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={titleNode}
      scrollable
      headerClassName="items-start pr-8"
      closeButtonClassName=" -mr-[24px] -mt-1 self-start"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <i className="bx bx-loader-alt animate-spin text-yellow-500 text-2xl" />
        </div>
      ) : !trade ? null : (
        <div className="flex flex-col gap-4">

          {/* Summary banner */}
          {tasks.length > 0 && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl border"
              style={
                completedCount === tasks.length
                  ? { background: "#f0fdf4", borderColor: "#bbf7d0" }
                  : { background: "#fffbeb", borderColor: "#fde68a" }
              }
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: completedCount === tasks.length
                    ? TASK_SIGNOFF_SUCCESS_SOLID
                    : TASK_SIGNOFF_BRONZE_SOLID,
                }}
              >
                {completedCount === tasks.length ? (
                  <i className="bx bx-check text-white text-base" />
                ) : (
                  <i className="bx bx-list-check text-white text-base" />
                )}
              </div>
              <div>
                <p className={`text-sm font-semibold ${completedCount === tasks.length ? "text-green-800" : "text-yellow-800"}`}>
                  {completedCount === tasks.length ? "All tasks complete" : `${completedCount} of ${tasks.length} tasks complete`}
                </p>
                {trade.completedAt && (
                  <p className="text-xs text-green-600 mt-0.5">
                    Completed {formatDate(trade.completedAt)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Trade metadata */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Trade Info</p>
            </div>
            <div className="divide-y divide-gray-100 px-4">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-xs text-gray-500">Status</span>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    trade.status === "complete"
                      ? "bg-green-100 text-green-700"
                      : trade.status === "active"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {trade.status === "complete" ? "Complete" : trade.status === "active" ? "In Progress" : "Pending"}
                </span>
              </div>
              {trade.foremanEmail && (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs text-gray-500">Email</span>
                  <span className="text-xs text-gray-700">{trade.foremanEmail}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tasks */}
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 mb-3">
              Tasks ({tasks.length})
            </p>
            {tasks.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-2">No tasks for this trade.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {tasks.map((task: BallInCourtTask) => {
                  const isDone = task.status === "complete";
                  const isLate = isTaskLate(task);
                  const taskDateChip = getTaskDateChip(task);
                  return (
                    <div
                      key={task._id}
                      className={`rounded-xl border p-3.5 transition-colors ${
                        isDone
                          ? "border-gray-200 bg-gray-50"
                          : isLate
                            ? "border-red-200 bg-red-50"
                            : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Status indicator */}
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isDone ? "bg-green-500" : "border-2 border-gray-300"
                          }`}
                        >
                          {isDone && <i className="bx bx-check text-white text-xs" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium leading-snug ${
                              isDone ? "text-gray-400 line-through" : "text-gray-800"
                            }`}
                          >
                            {task.description}
                          </p>

                          {/* Requirement / date chips */}
                          {(task.requirePicture || task.requireNotes || taskDateChip || isLate) && (
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {task.requirePicture && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
                                  <i className="bx bx-camera text-xs" /> Photo
                                </span>
                              )}
                              {task.requireNotes && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
                                  <i className="bx bx-note text-xs" /> Notes
                                </span>
                              )}
                              {taskDateChip && (
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded-md ${
                                    isLate
                                      ? "bg-red-100 text-red-700"
                                      : "bg-gray-100 text-gray-400"
                                  }`}
                                >
                                  <i className="bx bx-calendar text-xs" />
                                  {taskDateChip}
                                </span>
                              )}
                              {isLate && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">
                                  <i className="bx bx-error-circle text-xs" />
                                  Late
                                </span>
                              )}
                            </div>
                          )}

                          {/* Foreman completion data */}
                          {isDone && (task.notes || task.photoUrl || task.foremanStartDate) && (
                            <div className="mt-2.5 pt-2 border-t border-gray-200 space-y-1.5">
                              {task.foremanStartDate && (
                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                  <i className="bx bx-time-five text-xs" />
                                  Actual: {formatDate(task.foremanStartDate)}
                                  {task.foremanEndDate ? ` → ${formatDate(task.foremanEndDate)}` : ""}
                                </p>
                              )}
                              {task.notes && (
                                <p className="text-xs text-gray-500 italic">
                                  &ldquo;{task.notes}&rdquo;
                                </p>
                              )}
                              {task.photoUrl && (
                                <a
                                  href={task.photoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium"
                                >
                                  <i className="bx bx-image text-sm" /> View photo
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        <span className="text-[11px] text-gray-300 flex-shrink-0 mt-0.5 font-medium">
                          #{task.order}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </Modal>
  );
}
