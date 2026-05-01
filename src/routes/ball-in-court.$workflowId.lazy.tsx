import { createLazyFileRoute, useParams } from "@tanstack/react-router";
import { useState, useEffect, useMemo, type ReactNode } from "react";
import {
  useGetWorkflow,
  updateTask,
  completeTrade,
  uploadTaskPhoto,
  sendTradeRecordEmail,
  BicKeys,
  buildBicActorContext,
} from "@/api/endpoints/ball-in-court";
import { useQueryClient } from "@tanstack/react-query";
import type {
  BicDateMode,
  BicWorkflowWithTasks,
  BicTrade,
  BallInCourtTask,
} from "@/types";
import toast from "react-hot-toast";

type BicTaskDraftCache = Record<
  string,
  Pick<BallInCourtTask, "notes" | "foremanStartDate" | "foremanEndDate">
>;

const TASK_SIGNOFF_BRONZE = "#B98133";
const TASK_SIGNOFF_BRONZE_SOLID = "#EAB308";

export const Route = createLazyFileRoute("/ball-in-court/$workflowId")({
  component: BallInCourtPage,
});

type Screen =
  | "loading"
  | "identifying"
  | "waiting"
  | "active"
  | "complete"
  | "done";

function formatShortDate(iso?: string) {
  if (!iso) return "";
  const d =
    /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
      : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${String(d.getFullYear()).slice(2)}`;
}

function formatLongDateTimeParts(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const date = d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return { date, time };
}

function getTaskDateMode(
  task: Pick<BallInCourtTask, "dateMode" | "datesAssignedByPm">,
): BicDateMode {
  if (task.dateMode) return task.dateMode;
  return task.datesAssignedByPm ? "pm" : "foreman";
}

function BallInCourtShell({
  children,
  accent = "amber",
}: {
  children: ReactNode;
  accent?: "amber" | "green";
}) {
  const accentGlow =
    accent === "green" ? "bg-[#f4f7f2]" : "bg-[#f5f5f5]";

  return (
    <div className={`min-h-screen text-gray-900 ${accentGlow}`}>
      <div className="relative flex min-h-screen flex-col">{children}</div>
    </div>
  );
}

function MobileSubHeader({
  title,
  showBack = false,
  onBack,
}: {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
}) {
  return (
    <div className="border-b border-[#eee] bg-white px-5 py-3.5">
      <div className="relative mx-auto flex w-full max-w-md items-center justify-center">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className="absolute right-0 inline-flex items-center gap-1 text-[13px] font-medium text-[#9ca3af]"
          >
            <i className="bx bx-chevron-left text-base" />
            Back
          </button>
        ) : null}
        <p className="truncate px-16 text-center text-[18px] font-bold text-[#92400e]">
          {title}
        </p>
      </div>
    </div>
  );
}

function MobileScreenHeader({
  title,
  showBack = false,
  onBack,
}: {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
}) {
  return (
    <MobileSubHeader title={title} showBack={showBack} onBack={onBack} />
  );
}
function MobileCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] ${className}`}
    >
      {children}
    </div>
  );
}

function WaitingScreen({
  workflow,
  selectedTradeIndex,
  onSignOut,
}: {
  workflow: BicWorkflowWithTasks["workflow"];
  selectedTradeIndex: number;
  onSignOut: () => void;
}) {
  const selectedTrade = workflow.trades[selectedTradeIndex];
  const activeTrade = workflow.trades[workflow.currentTradeIndex];
  const tradesBeforeMe = selectedTradeIndex - workflow.currentTradeIndex;
  const scheduleTier =
    selectedTrade?.scheduleTier ??
    (selectedTrade?.plannedStart ? "planned" : "none");
  const scheduleLabel =
    scheduleTier === "anticipated" ? "Anticipated Start" : "Planned Start";
  const scheduleValue =
    scheduleTier === "anticipated"
      ? selectedTrade?.projectedStart
      : selectedTrade?.plannedStart;

  return (
    <BallInCourtShell>
      <MobileScreenHeader title={workflow.name} showBack onBack={onSignOut} />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-6">
        <MobileCard className="px-6 py-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-500">
            <i className="bx bx-time-five text-[26px]" />
          </div>
          <h1 className="text-[22px] font-bold text-gray-900">Not Your Turn Yet</h1>
          <p className="mx-auto mt-2 max-w-[260px] text-sm leading-6 text-gray-500">
            <span className="block">
              {tradesBeforeMe} step{tradesBeforeMe !== 1 ? "s" : ""} need
              {tradesBeforeMe === 1 ? "s" : ""} to be completed
            </span>
            <span className="block">before your work begins.</span>
          </p>

          {scheduleTier !== "none" && scheduleValue ? (
            <div className="mt-6 inline-flex flex-col items-center rounded-xl border border-gray-200 bg-[#f8f9fa] px-6 py-3.5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400">
                {scheduleLabel}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <i className="bx bx-calendar text-sm text-gray-500" />
                <p className="text-[15px] font-bold text-gray-800">
                  {formatShortDate(scheduleValue)}
                </p>
              </div>
            </div>
          ) : null}

          {activeTrade ? (
            <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3.5 text-center">
              <p className="text-[12px] font-medium text-green-800">Current task</p>
              <div className="mx-auto mt-2 flex max-w-[240px] items-center justify-center gap-2 text-left">
                <span
                  className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: TASK_SIGNOFF_BRONZE }}
                >
                  {workflow.currentTradeIndex + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] leading-[1.35] text-green-800">
                    {activeTrade.foremanName}
                  </p>
                  <p className="text-[13px] leading-[1.35] text-green-800 italic">
                    {activeTrade.foremanCompany || activeTrade.tradeName}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {scheduleTier === "anticipated" && selectedTrade?.plannedStart ? (
            <p className="mt-3 text-xs leading-5 text-gray-400">
              Adjusted from original {formatShortDate(selectedTrade.plannedStart)}.
            </p>
          ) : null}
        </MobileCard>

        <p className="mx-auto mt-5 max-w-[260px] text-center text-xs leading-5 text-gray-400">
          We&apos;ll send you an email as soon as it&apos;s your turn.
        </p>
      </div>
    </BallInCourtShell>
  );
}

function ActiveTasksScreen({
  workflowId,
  workflow,
  selectedTradeIndex,
  allTasks,
  onSignOut,
  onComplete,
}: {
  workflowId: string;
  workflow: BicWorkflowWithTasks["workflow"];
  selectedTradeIndex: number;
  allTasks: BallInCourtTask[];
  onSignOut: () => void;
  onComplete: (updatedWorkflow: BicWorkflowWithTasks["workflow"]) => void;
}) {
  const queryClient = useQueryClient();
  const [localTasks, setLocalTasks] = useState<BallInCourtTask[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  const restoreViewport = (blurActive = false) => {
    if (typeof window === "undefined") return;

    const resetView = () => {
      if (blurActive && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      window.scrollTo({ left: 0, top: window.scrollY, behavior: "auto" });
    };

    window.setTimeout(resetView, 60);
    window.setTimeout(resetView, 220);
  };

  const selectedTrade = workflow.trades[selectedTradeIndex];
  const actorContext = useMemo(
    () => buildBicActorContext(selectedTrade),
    [selectedTrade],
  );
  const tradeTasks = useMemo(
    () => allTasks.filter((t) => t.tradeIndex === selectedTradeIndex),
    [allTasks, selectedTradeIndex],
  );

  useEffect(() => {
    const cacheKey = `bic_${workflowId}_${selectedTradeIndex}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed: BicTaskDraftCache = JSON.parse(cached);
        const merged = tradeTasks.map((t) => {
          if (t.status === "complete") return t;
          const draft = parsed[t._id];
          if (!draft) return t;
          return {
            ...t,
            notes: t.notes ?? draft.notes,
            foremanStartDate: t.foremanStartDate ?? draft.foremanStartDate,
            foremanEndDate: t.foremanEndDate ?? draft.foremanEndDate,
          };
        });
        setLocalTasks(merged);
        return;
      }
    } catch {
      // ignore
    }
    setLocalTasks(tradeTasks);
  }, [tradeTasks, workflowId, selectedTradeIndex]);

  const persistCache = (tasks: BallInCourtTask[]) => {
    try {
      const draftCache = tasks.reduce<BicTaskDraftCache>((acc, task) => {
        if (task.status === "complete") return acc;
        if (
          task.notes === undefined &&
          task.foremanStartDate === undefined &&
          task.foremanEndDate === undefined
        ) {
          return acc;
        }
        acc[task._id] = {
          notes: task.notes,
          foremanStartDate: task.foremanStartDate,
          foremanEndDate: task.foremanEndDate,
        };
        return acc;
      }, {});
      localStorage.setItem(
        `bic_${workflowId}_${selectedTradeIndex}`,
        JSON.stringify(draftCache),
      );
    } catch {
      // ignore
    }
  };

  const updateLocal = (taskId: string, patch: Partial<BallInCourtTask>) => {
    setLocalTasks((prev) => {
      const updated = prev.map((t) =>
        t._id === taskId ? { ...t, ...patch } : t,
      );
      persistCache(updated);
      return updated;
    });
  };

  const allDone =
    localTasks.length > 0 && localTasks.every((t) => t.status === "complete");
  const completedCount = localTasks.filter((t) => t.status === "complete").length;

  const handleMarkDone = async (task: BallInCourtTask) => {
    const patch: Parameters<typeof updateTask>[1] = { status: "complete" };
    if (getTaskDateMode(task) === "foreman") {
      patch.foremanStartDate = task.foremanStartDate;
      patch.foremanEndDate = task.foremanEndDate;
    }
    if (task.notes) patch.notes = task.notes;
    if (task.photoUrl) patch.photoUrl = task.photoUrl;

    setExpandedTasks((prev) => ({ ...prev, [task._id]: false }));
    updateLocal(task._id, { status: "complete" });
    try {
      await updateTask(task._id, patch, actorContext);
    } catch {
      updateLocal(task._id, { status: "pending" });
      toast.error("Failed to mark task as done.");
    }
  };

  const handleUnmark = async (task: BallInCourtTask) => {
    setExpandedTasks((prev) => ({ ...prev, [task._id]: true }));
    updateLocal(task._id, { status: "pending" });
    try {
      await updateTask(task._id, { status: "pending" }, actorContext);
    } catch {
      updateLocal(task._id, { status: "complete" });
      toast.error("Failed to unmark task.");
    }
  };

  const handlePhotoUpload = async (task: BallInCourtTask, file: File) => {
    try {
      const { photoUrl } = await uploadTaskPhoto(task._id, file, actorContext);
      updateLocal(task._id, { photoUrl });
    } catch {
      toast.error("Photo upload failed. Please try again.");
    } finally {
      restoreViewport(true);
    }
  };

  const handlePhotoRemove = async (task: BallInCourtTask) => {
    const shouldResetStatus = task.status === "complete";
    updateLocal(task._id, {
      photoUrl: undefined,
      ...(shouldResetStatus ? { status: "pending" as const } : {}),
    });

    try {
      await updateTask(
        task._id,
        {
          clearPhoto: true,
          ...(shouldResetStatus ? { status: "pending" as const } : {}),
        },
        actorContext,
      );
    } catch {
      updateLocal(task._id, {
        photoUrl: task.photoUrl,
        ...(shouldResetStatus ? { status: "complete" as const } : {}),
      });
      toast.error("Failed to remove photo.");
    } finally {
      restoreViewport(true);
    }
  };

  const handleSubstantiallyComplete = async () => {
    setIsSubmitting(true);
    try {
      const updatedWorkflow = await completeTrade(
        workflowId,
        selectedTradeIndex,
        actorContext,
      );
      try {
        localStorage.removeItem(`bic_${workflowId}_${selectedTradeIndex}`);
      } catch {
        // ignore
      }
      void queryClient.invalidateQueries({ queryKey: BicKeys.single(workflowId) });
      onComplete(updatedWorkflow);
    } catch {
      toast.error("Failed to complete step. Please try again.");
      setIsSubmitting(false);
    }
  };

  const isTaskEnabled = (task: BallInCourtTask) => {
    const dateMode = getTaskDateMode(task);
    if (task.status === "complete") return true;
    if (task.requirePicture && !task.photoUrl) return false;
    if (task.requireNotes && !task.notes) return false;
    if (
      dateMode === "foreman" &&
      (!task.foremanStartDate || !task.foremanEndDate)
    ) {
      return false;
    }
    return true;
  };

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const getCollapsedDateDisplay = (task: BallInCourtTask) => {
    const dateMode = getTaskDateMode(task);
    if (dateMode === "pm") {
      if (task.startDate && task.endDate) {
        return {
          text: `${formatShortDate(task.startDate)} to ${formatShortDate(task.endDate)}`,
          textClass: "text-[#888]",
        };
      }
      if (task.endDate) {
        return {
          text: `Complete by: ${formatShortDate(task.endDate)}`,
          textClass: "text-[#888]",
        };
      }
      return {
        text: "No dates provided",
        textClass: "text-[#bbb]",
      };
    }
    if (dateMode === "foreman") {
      if (task.foremanStartDate && task.foremanEndDate) {
        return {
          text: `${formatShortDate(task.foremanStartDate)} to ${formatShortDate(task.foremanEndDate)}`,
          textClass: "text-[#888]",
        };
      }
      return {
        text: "Set your dates",
        textClass: "text-[#92400e]",
      };
    }
    return {
      text: "No dates provided",
      textClass: "text-[#bbb]",
    };
  };

  return (
    <BallInCourtShell>
      <div className="border-b border-[#eee] bg-white px-5 pb-4 pt-3.5">
        <div className="relative mx-auto w-full max-w-md text-center">
          <button
            type="button"
            onClick={onSignOut}
            className="absolute right-0 top-0.5 inline-flex items-center gap-1 text-[13px] font-medium text-[#9ca3af]"
          >
            Back
            <i className="bx bx-chevron-right text-base" />
          </button>
          <p className="truncate px-16 text-[18px] font-bold text-[#92400e]">
            {workflow.name}
          </p>
          <p className="mt-1 truncate px-8 text-[13px] leading-tight text-[#888]">
            {selectedTrade?.foremanName},{" "}
            <em>{selectedTrade?.foremanCompany || selectedTrade?.tradeName}</em>
          </p>
          <div className="mt-3.5 flex items-center gap-2">
            <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#f0f0f0]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width:
                    localTasks.length > 0
                      ? `${(completedCount / localTasks.length) * 100}%`
                      : "0%",
                  background: allDone ? "#22c55e" : TASK_SIGNOFF_BRONZE,
                }}
              />
            </div>
            <span
              className={`text-[11px] font-bold ${
                allDone ? "text-[#16a34a]" : "text-[#888]"
              }`}
            >
              {completedCount} / {localTasks.length}
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md px-5 py-5 pb-32">
        {allDone ? (
          <p className="mb-3.5 text-center text-[12px] font-medium text-[#16a34a]">
            Ready to sign off
          </p>
        ) : null}

        <div className="flex flex-col gap-3.5">
          {localTasks.map((task, i) => {
            const dateMode = getTaskDateMode(task);
            const isExpanded = Boolean(expandedTasks[task._id]) && task.status !== "complete";
            const collapsedDate = getCollapsedDateDisplay(task);
            const taskHeader = (
              <>
                <span
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    task.status === "complete"
                      ? "bg-green-500 text-white"
                      : "bg-yellow-400 text-gray-900"
                  }`}
                >
                  {task.status === "complete" ? (
                    <i className="bx bx-check text-base" />
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[14px] font-semibold leading-[1.45] text-gray-900 ${
                      task.status === "complete" ? "text-[#6b7280] line-through" : ""
                    }`}
                  >
                    {task.description}
                  </p>
                  {task.status === "complete" ? null : (
                    <div className="mt-2 flex items-center justify-between gap-3 pl-[1px]">
                      <div className={`inline-flex items-center gap-1.5 text-[12px] ${collapsedDate.textClass}`}>
                        <i className="bx bx-calendar text-[14px]" />
                        <span>{collapsedDate.text}</span>
                      </div>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f7f4ee] text-[#9a7b3d]">
                        <i
                          className={`bx bx-chevron-down text-[16px] transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </span>
                    </div>
                  )}
                </div>
              </>
            );

            return (
              <div
                key={task._id}
                className={`overflow-hidden rounded-[16px] border shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition-colors ${
                  task.status === "complete"
                    ? "border-emerald-200 bg-[#f7fcf7]"
                    : "border-[#eeeeee] bg-white"
                }`}
              >
                {task.status === "complete" ? (
                  <div className="flex items-start gap-3 px-4 py-3.5">
                    {taskHeader}
                    <button
                      type="button"
                      onClick={() => handleUnmark(task)}
                      className="ml-auto rounded-full border border-[#d1fae5] bg-white px-2.5 py-1 text-[11px] font-medium text-[#166534]"
                    >
                      Undo
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleTaskExpanded(task._id)}
                    className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? "Collapse task" : "Expand task"}
                  >
                    {taskHeader}
                  </button>
                )}

                {isExpanded ? (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3.5">
                    <div className="flex flex-col gap-3.5">
                      {dateMode === "foreman" ? (
                        <div className="rounded-[12px] border border-yellow-200 bg-yellow-50 p-3.5">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.06em] text-[#92400e]">
                                Start
                              </label>
                              <input
                                type="date"
                                className="w-full rounded-lg border-[1.5px] border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-2 text-[16px] text-gray-700 outline-none"
                                value={task.foremanStartDate ?? ""}
                                onChange={(e) =>
                                  {
                                    updateLocal(task._id, {
                                      foremanStartDate: e.target.value,
                                    });
                                    restoreViewport(true);
                                  }
                                }
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.06em] text-[#92400e]">
                                End
                              </label>
                              <input
                                type="date"
                                className="w-full rounded-lg border-[1.5px] border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-2 text-[16px] text-gray-700 outline-none"
                                value={task.foremanEndDate ?? ""}
                                onChange={(e) =>
                                  {
                                    updateLocal(task._id, {
                                      foremanEndDate: e.target.value,
                                    });
                                    restoreViewport(true);
                                  }
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-col gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6b7280]">
                          Notes
                        </p>
                        <div className="relative">
                          <textarea
                            className="min-h-[78px] w-full resize-none rounded-[10px] border-[1.5px] border-[#e0e0e0] bg-[#fafafa] px-3 py-3 text-[16px] leading-[1.5] text-[#222] outline-none"
                            rows={3}
                            placeholder="Add notes"
                            value={task.notes ?? ""}
                            onChange={(e) =>
                              updateLocal(task._id, { notes: e.target.value })
                            }
                            onBlur={(e) => {
                              updateTask(
                                task._id,
                                { notes: e.target.value },
                                actorContext,
                              ).catch(() => {});
                              restoreViewport(true);
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6b7280]">
                          Photo
                        </p>
                        <div className="relative">
                          {task.photoUrl ? (
                            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#bbf7d0] bg-green-50 px-3.5 py-2 text-[12px] font-medium text-green-700">
                              <i className="bx bx-check text-[14px]" />
                              <span>Photo submitted</span>
                              <button
                                type="button"
                                onClick={() => handlePhotoRemove(task)}
                                className="ml-1 text-[11px] text-[#888]"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-[#e0e0e0] bg-white px-4 py-2 text-[12px] font-medium text-[#555]">
                              <i className="bx bx-camera text-[14px]" />
                              <span>Submit Photo</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    void handlePhotoUpload(task, file);
                                  }
                                  e.currentTarget.value = "";
                                  if (!file) restoreViewport(true);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      <button
                        disabled={!isTaskEnabled(task)}
                        onClick={() => handleMarkDone(task)}
                        className={`w-full rounded-[10px] border-[1.5px] py-3 text-[13px] font-semibold transition-colors ${
                          isTaskEnabled(task)
                            ? "border-[#333] bg-white text-[#333]"
                            : "cursor-not-allowed border-[#e0e0e0] bg-white text-[#ccc]"
                        }`}
                      >
                        {isTaskEnabled(task)
                          ? "Mark as Done"
                          : "Complete required fields first"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-[#eee] bg-white/95 px-4 py-3.5 shadow-[0_-6px_20px_rgba(15,23,42,0.06)] backdrop-blur-sm">
        <div className="mx-auto w-full max-w-md">
          {!allDone ? (
            <p className="mb-2 text-center text-[12px] text-[#9ca3af]">
              Complete every task to enable sign-off.
            </p>
          ) : null}
          <button
            disabled={!allDone || isSubmitting}
            onClick={handleSubstantiallyComplete}
            className={`w-full rounded-[14px] py-4 text-[16px] font-bold ${
              allDone
                ? "text-white"
                : "cursor-not-allowed bg-[#e5e5e5] text-[#bbb]"
            }`}
            style={
              allDone
                ? {
                    background: TASK_SIGNOFF_BRONZE_SOLID,
                  }
                : undefined
            }
          >
            {isSubmitting ? "Submitting..." : "Substantially Complete"}
          </button>
        </div>
      </div>
    </BallInCourtShell>
  );
}

function AlreadyCompleteScreen({
  workflowName,
  trade,
  tasks,
  onBack,
}: {
  workflowName: string;
  trade: BicTrade | undefined;
  tasks: BallInCourtTask[];
  onBack: () => void;
}) {
  const completedTasks = tasks.filter((task) => task.status === "complete");
  const completedAt = formatLongDateTimeParts(trade?.completedAt);

  return (
    <BallInCourtShell accent="green">
      <MobileScreenHeader title={workflowName} />
      <div className="mx-auto w-full max-w-md px-5 py-6">
        <MobileCard className="p-6 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] border border-green-200 bg-green-50 text-green-500">
              <i className="bx bx-check text-[26px]" />
            </div>
          </div>
          <h1 className="text-[22px] font-bold text-gray-900">
            Substantially Complete
          </h1>
          <p className="mx-auto mt-3 max-w-[280px] text-sm leading-6 text-gray-500">
            {trade?.foremanName} signed off on{" "}
            {completedTasks.length === 1 ? "this task" : "these tasks"}
            {completedAt ? (
              <>
                <span className="block whitespace-nowrap">
                  on {completedAt.date} at {completedAt.time}
                </span>
              </>
            ) : (
              " during a previous submission"
            )}
            .
          </p>
          <p className="mt-2 text-[13px] text-gray-400">
            {completedTasks.length} task{completedTasks.length === 1 ? "" : "s"} completed
          </p>
        </MobileCard>

        <button
          onClick={onBack}
          className="mt-5 w-full rounded-xl bg-[#222] py-4 text-[15px] font-bold text-white"
        >
          Back
        </button>
      </div>
    </BallInCourtShell>
  );
}

function CompletionScreen({
  workflow,
  completedTradeIndex,
  onClose,
}: {
  workflow: BicWorkflowWithTasks["workflow"];
  completedTradeIndex: number;
  onClose: () => void;
}) {
  const [recordState, setRecordState] = useState<"idle" | "sending" | "sent">("idle");
  const completedTrade = workflow.trades[completedTradeIndex];
  const isFinalTrade = completedTradeIndex + 1 >= workflow.trades.length;
  const nextTrade =
    !isFinalTrade ? workflow.trades[completedTradeIndex + 1] : null;
  const completedAt =
    formatLongDateTimeParts(completedTrade?.completedAt) ??
    formatLongDateTimeParts(new Date().toISOString());
  const completedTradeActor = useMemo(
    () => buildBicActorContext(completedTrade),
    [completedTrade],
  );

  const handleEmailRecord = async () => {
    if (!completedTradeActor) {
      toast.error("Couldn't identify the completed step.");
      return;
    }

    setRecordState("sending");
    try {
      await sendTradeRecordEmail(
        workflow._id,
        completedTradeIndex,
        completedTradeActor,
        {
          clientTimeZone:
            Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
        },
      );
      setRecordState("sent");
      toast.success("Record sent to your email.");
    } catch {
      setRecordState("idle");
      toast.error("Failed to send your record.");
    }
  };

  return (
    <BallInCourtShell accent="green">
      <MobileScreenHeader title={workflow.name} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-6">
        <MobileCard className="p-6">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-500">
              <i className="bx bx-check-circle text-[28px]" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400">
                Sign-Off Complete
              </p>
              <h1 className="text-[22px] font-bold text-gray-900">All Done!</h1>
            </div>
          </div>
          <p className="text-sm leading-6 text-gray-500">
            You have marked your tasks as substantially complete on{" "}
            {completedAt ? (
              <>
                {completedAt.date} at{" "}
                <span className="whitespace-nowrap">{completedAt.time}</span>
              </>
            ) : (
              "this submission"
            )}
            .
          </p>
          <div className="mt-4">
            <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[10px] font-semibold text-green-700">
              Sign-off recorded
            </span>
          </div>
        </MobileCard>

        <MobileCard className="p-5">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400">
            Notifications Sent
          </p>

          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
              <i className="bx bx-envelope text-lg" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">PM notified</p>
              <p className="text-xs text-gray-400">
                <span className="block">A confirmation has been emailed</span>
                <span className="block">to the project manager.</span>
              </p>
            </div>
          </div>

          {isFinalTrade ? (
            <div className="flex items-center gap-3 pt-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-500">
                <i className="bx bx-trophy text-lg" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Workflow complete</p>
                <p className="text-xs text-gray-400">
                  All steps complete. Workflow closed.
                </p>
              </div>
            </div>
          ) : (
            <>
              {nextTrade ? (
                <div className="flex items-center gap-3 border-b border-gray-100 py-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-yellow-200 bg-yellow-50 text-sm font-bold text-amber-700">
                    {completedTradeIndex + 2}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Step {completedTradeIndex + 2} is now active
                    </p>
                    <p className="text-xs text-gray-400">
                      Please make sure the work area is clean, safe, and organized for the next person or crew.
                    </p>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </MobileCard>

        {recordState === "sent" ? (
          <div className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-green-200 bg-green-50 px-4 py-3 text-[13.5px] font-semibold text-green-700">
            <i className="bx bx-check text-base" />
            Record sent to your email
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void handleEmailRecord()}
            disabled={recordState === "sending"}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-green-500 bg-white px-4 py-3 text-[13.5px] font-semibold text-green-700 disabled:cursor-not-allowed disabled:border-green-200 disabled:text-green-300"
          >
            <i className="bx bx-envelope text-base" />
            {recordState === "sending"
              ? "Sending Your Record..."
              : "Email Yourself a Record"}
          </button>
        )}

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-[#222] py-4 text-[15px] font-bold text-white"
        >
          Close
        </button>
      </div>
    </BallInCourtShell>
  );
}

export function BallInCourtPage() {
  const { workflowId } = useParams({ strict: false });
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useGetWorkflow(workflowId);

  const [screen, setScreen] = useState<Screen>("loading");
  const [selectedTradeIndex, setSelectedTradeIndex] = useState<number | null>(
    null,
  );
  const [completedWorkflow, setCompletedWorkflow] = useState<
    BicWorkflowWithTasks["workflow"] | null
  >(null);
  const [completedTradeIndex, setCompletedTradeIndex] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (screen === "loading" && !isLoading && data) {
      setScreen("identifying");
    }
  }, [isLoading, data, screen]);

  const workflow = data?.workflow;
  const tasks = data?.tasks ?? [];

  const handleContinue = () => {
    if (selectedTradeIndex === null || !workflow) return;
    const trade = workflow.trades[selectedTradeIndex];
    if (!trade) return;

    if (trade.status === "active") {
      setScreen("active");
    } else if (trade.status === "pending") {
      setScreen("waiting");
    } else if (trade.status === "complete") {
      setScreen("complete");
    }
  };

  const handleSignOut = () => {
    if (workflow?.qrCodeId) {
      window.location.href = `/scannedQR?qrcodeId=${workflow.qrCodeId}`;
    } else {
      setSelectedTradeIndex(null);
      setScreen("identifying");
    }
  };

  const handleTradeComplete = (
    updatedWorkflow: BicWorkflowWithTasks["workflow"],
  ) => {
    setCompletedWorkflow(updatedWorkflow);
    setCompletedTradeIndex(selectedTradeIndex);
    setScreen("done");
  };

  const handleDoneClose = () => {
    if (workflowId) {
      void queryClient.invalidateQueries({ queryKey: BicKeys.single(workflowId) });
    }
    const qrId = completedWorkflow?.qrCodeId ?? workflow?.qrCodeId;
    if (qrId) {
      window.location.href = `/scannedQR?qrcodeId=${qrId}`;
      return;
    }
    setSelectedTradeIndex(null);
    setCompletedWorkflow(null);
    setCompletedTradeIndex(null);
    setScreen("identifying");
  };

  if (isLoading || screen === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="loader" />
      </div>
    );
  }

  if (isError || !workflow) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <i className="bx bx-error-circle text-4xl text-red-400" />
        <p className="font-medium text-gray-700">Workflow not found.</p>
        <p className="text-sm text-gray-400">
          This link may be invalid or the workflow may have been deleted.
        </p>
      </div>
    );
  }

  if (!workflowId) {
    return null;
  }

  if (screen === "identifying") {
    return (
      <BallInCourtShell>
        <MobileScreenHeader title={workflow.name} showBack onBack={handleSignOut} />

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-5">
          <MobileCard className="p-6">
            <div className="mb-4 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-500">
                <i className="bx bx-user text-2xl" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400">
                  Task Signoff
                </p>
                <h1 className="text-[22px] font-bold text-gray-900">
                  Identify Yourself
                </h1>
              </div>
            </div>
            <p className="max-w-[260px] text-sm leading-6 text-gray-500">
              Choose your name to see your tasks.
            </p>
          </MobileCard>

          <MobileCard className="p-5">
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400">
              Who are you?
            </label>
            <select
              className={`w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-[16px] outline-none focus:ring-2 focus:ring-yellow-400 ${
                selectedTradeIndex !== null &&
                workflow.trades[selectedTradeIndex]?.status === "complete"
                  ? "text-gray-400"
                  : "text-gray-900"
              }`}
              value={selectedTradeIndex ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedTradeIndex(val === "" ? null : Number(val));
              }}
            >
              <option value="">Select your name</option>
              {workflow.trades.map((trade: BicTrade, i: number) => (
                <option
                  key={i}
                  value={i}
                  style={
                    trade.status === "complete"
                      ? { color: "#9ca3af" }
                      : undefined
                  }
                >
                  {trade.foremanName}, {trade.foremanCompany}
                </option>
              ))}
            </select>
            <button
              disabled={selectedTradeIndex === null}
              onClick={handleContinue}
              className="mt-4 w-full rounded-xl py-3.5 text-[15px] font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
              style={
                selectedTradeIndex !== null
                  ? {
                      background: TASK_SIGNOFF_BRONZE,
                    }
                  : undefined
              }
            >
              Continue
            </button>
          </MobileCard>
        </div>
      </BallInCourtShell>
    );
  }

  if (screen === "waiting" && selectedTradeIndex !== null) {
    return (
      <WaitingScreen
        workflow={workflow}
        selectedTradeIndex={selectedTradeIndex}
        onSignOut={handleSignOut}
      />
    );
  }

  if (screen === "active" && selectedTradeIndex !== null) {
    return (
      <ActiveTasksScreen
        workflowId={workflowId}
        workflow={workflow}
        selectedTradeIndex={selectedTradeIndex}
        allTasks={tasks}
        onSignOut={handleSignOut}
        onComplete={handleTradeComplete}
      />
    );
  }

  if (screen === "complete" && selectedTradeIndex !== null) {
    const trade = workflow.trades[selectedTradeIndex];
    return (
      <AlreadyCompleteScreen
        workflowName={workflow.name}
        trade={trade}
        tasks={tasks.filter((task) => task.tradeIndex === selectedTradeIndex)}
        onBack={handleSignOut}
      />
    );
  }

  if (screen === "done" && completedWorkflow && completedTradeIndex !== null) {
    return (
      <CompletionScreen
        workflow={completedWorkflow}
        completedTradeIndex={completedTradeIndex}
        onClose={handleDoneClose}
      />
    );
  }

  return null;
}
