import { useState, useEffect, type ReactNode } from "react";
import Modal from "@components/modal/Modal";
import {
  createWorkflow,
  BicKeys,
  notifyAllWorkflowParticipants,
  notifyFirstWorkflowParticipant,
} from "@/api/endpoints/ball-in-court";
import { getDirectory } from "@/api/endpoints/tools";
import { queryClient } from "@/api";
import type { BallInCourtWorkflow, BicWorkflowSummary } from "@/types";
import procoreIcon from "@/assets/images/procore-icon.png";
import toast from "react-hot-toast";

// ── Icons ─────────────────────────────────────────────────────────────────────

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5l3 3 6-6.5" />
    </svg>
  );
}

function PlusIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3.5h10M5 3.5V2a1 1 0 011-1h2a1 1 0 011 1v1.5M5.5 6v4M8.5 6v4M3 3.5l.5 8a1 1 0 001 1h5a1 1 0 001-1l.5-8" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" />
      <path d="M4.5 1v2.5M9.5 1v2.5M1.5 5.5h11" />
    </svg>
  );
}

function CameraIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 5a1.5 1.5 0 011.5-1.5h1.3a.8.8 0 00.67-.36l.56-.78A.8.8 0 016.2 2h3.6a.8.8 0 01.67.36l.56.78a.8.8 0 00.67.36H13A1.5 1.5 0 0114.5 5v7A1.5 1.5 0 0113 13.5H3A1.5 1.5 0 011.5 12z" />
      <circle cx="8" cy="8.5" r="2.2" />
    </svg>
  );
}

function NoteIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="2" width="11" height="12" rx="1.5" />
      <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
    </svg>
  );
}

function CopyIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="4.5" width="8" height="8" rx="1" />
      <path d="M1.5 9.5v-7a1 1 0 011-1h7" />
    </svg>
  );
}

function MailIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4a1.5 1.5 0 011.5-1.5h9A1.5 1.5 0 0114 4v8a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12z" />
      <path d="M2 4l6 4.5L14 4" />
    </svg>
  );
}

function MailAllIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 5.5A1.5 1.5 0 012.5 4h8A1.5 1.5 0 0112 5.5v6a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 011 11.5z" />
      <path d="M1 5.5l5.5 4 5.5-4" />
      <path d="M13 3.5h1.5a1 1 0 011 1v6" opacity="0.45" />
      <path d="M14.5 4L12.5 5.5" opacity="0.45" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ProcoreForeman = {
  procoreItemID: string | number;
  name?: string;
  login_information?: { name?: string };
  email_address?: string;
  email?: string;
  vendor?: { name?: string };
  [key: string]: unknown;
};

type FormanOption = {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
};

type TaskDraft = {
  localId: number;
  description: string;
  requirePicture: boolean;
  requireNotes: boolean;
  dateMode: "none" | "pm" | "foreman";
  startDate: string;
  endDate: string;
};

type CompletedTrade = {
  order: number;
  foremanId: string;
  foremanName: string;
  foremanCompany: string;
  foremanEmail: string;
  tradeName: string;
  tasks: TaskDraft[];
};

type ResumeTradeDraft = {
  stepNumber: number;
  foremanId: string;
  tasks: TaskDraft[];
};

type EditingTradeDraftMap = Record<
  number,
  {
    foremanId: string;
    tasks: TaskDraft[];
  }
>;

type BallInCourtModalProps = {
  open: boolean;
  onClose: () => void;
  qrCodeId: string;
  companyId: string;
  projectId?: string;
  procoreProjectId?: string;
};

const TASK_SIGNOFF_BRONZE = "#EAB308";
const TASK_SIGNOFF_BRONZE_TEXT = "#92400E";
const TASK_SIGNOFF_BRONZE_BG = "#FEF3C7";
const TASK_SIGNOFF_BRONZE_BORDER = "#FDE68A";
const TASK_SIGNOFF_BRONZE_SOLID = "#EAB308";
const TASK_SIGNOFF_SUCCESS_SOLID = "#1F7A4D";

function toWorkflowSummary(
  workflow: Pick<BallInCourtWorkflow, "_id" | "name" | "status" | "currentTradeIndex" | "trades">,
): BicWorkflowSummary {
  const completedStepCount =
    workflow.status === "complete"
      ? workflow.trades.length
      : Math.max(0, Math.min(workflow.currentTradeIndex, workflow.trades.length));
  const progressPercent =
    workflow.trades.length > 0
      ? Math.round((completedStepCount / workflow.trades.length) * 100)
      : 0;
  const currentTrade =
    workflow.status === "complete"
      ? undefined
      : workflow.trades[workflow.currentTradeIndex]
        ? {
            foremanName: workflow.trades[workflow.currentTradeIndex].foremanName,
            foremanCompany:
              workflow.trades[workflow.currentTradeIndex].foremanCompany,
            tradeName: workflow.trades[workflow.currentTradeIndex].tradeName,
          }
        : undefined;
  const onDeckTrade =
    workflow.status === "complete"
      ? undefined
      : workflow.trades[workflow.currentTradeIndex + 1]
        ? {
            foremanName: workflow.trades[workflow.currentTradeIndex + 1].foremanName,
            foremanCompany:
              workflow.trades[workflow.currentTradeIndex + 1].foremanCompany,
            tradeName: workflow.trades[workflow.currentTradeIndex + 1].tradeName,
          }
        : undefined;

  return {
    _id: workflow._id,
    name: workflow.name,
    status: workflow.status,
    currentTradeIndex: workflow.currentTradeIndex,
    tradeCount: workflow.trades.length,
    completedStepCount,
    progressPercent,
    currentTrade,
    onDeckTrade,
  };
}

let _id = 1;
const nextId = () => _id++;
const emptyTask = (): TaskDraft => ({
  localId: nextId(),
  description: "",
  requirePicture: false,
  requireNotes: false,
  dateMode: "none",
  startDate: "",
  endDate: "",
});

function normalizeTaskDescription(description: string) {
  return description.trim();
}

function isTaskDraftValid(task: TaskDraft) {
  if (!normalizeTaskDescription(task.description)) return false;
  if (task.dateMode !== "pm") return true;
  if (!task.startDate && !task.endDate) return true;
  if (!task.endDate) return false;
  if (!task.startDate) return true;
  return task.endDate >= task.startDate;
}

function normalizeTaskDraftForSave(task: TaskDraft): TaskDraft {
  if (task.dateMode === "pm") {
    if (!task.startDate && !task.endDate) {
      return {
        ...task,
        dateMode: "none",
        startDate: "",
        endDate: "",
      };
    }

    return { ...task };
  }

  return {
    ...task,
    startDate: "",
    endDate: "",
  };
}

function hasMeaningfulTaskDraft(task: TaskDraft) {
  return Boolean(
    normalizeTaskDescription(task.description) ||
      task.requirePicture ||
      task.requireNotes ||
      task.dateMode !== "none" ||
      task.startDate ||
      task.endDate
  );
}

function getCurrentTradeValidationMessage(
  tasks: TaskDraft[],
  hasResponsiblePerson: boolean,
  action: "next" | "create",
) {
  const actionLabel =
    action === "next" ? "move to the next step" : "create the workflow";
  const hasStartedTask = tasks.some(hasMeaningfulTaskDraft);
  const hasAnyDescription = tasks.some((task) =>
    Boolean(normalizeTaskDescription(task.description)),
  );
  const hasBlankDescriptions = tasks.some(
    (task) => !normalizeTaskDescription(task.description),
  );

  if (!hasResponsiblePerson) {
    if (hasStartedTask) {
      return `Choose a responsible person before you ${actionLabel}.`;
    }
    return null;
  }

  const missingPmDates = tasks.find(
    (task) => task.dateMode === "pm" && Boolean(task.startDate) && !task.endDate,
  );
  if (missingPmDates) {
    return `Each PM-assigned task needs a completion date before you ${actionLabel}.`;
  }

  const invalidPmDateOrder = tasks.find(
    (task) =>
      task.dateMode === "pm" &&
      task.startDate &&
      task.endDate &&
      task.endDate < task.startDate,
  );
  if (invalidPmDateOrder) {
    return "A task start date can't be after its end date.";
  }

  if (!hasAnyDescription) {
    return action === "next"
      ? "Add at least one task description before moving to the next step."
      : "Add at least one task description before creating the workflow.";
  }

  if (hasBlankDescriptions) {
    return `Each task needs a description before you ${actionLabel}.`;
  }

  return null;
}

function formatShortDate(date?: string) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${String(parsed.getMonth() + 1).padStart(2, "0")}/${String(parsed.getDate()).padStart(2, "0")}`;
}

function getStepDateRange(tasks: TaskDraft[]) {
  let earliest: string | null = null;
  let latest: string | null = null;

  tasks.forEach((task) => {
    if (task.dateMode !== "pm" || !task.startDate || !task.endDate) return;
    if (!earliest || task.startDate < earliest) earliest = task.startDate;
    if (!latest || task.endDate > latest) latest = task.endDate;
  });

  return { start: earliest, end: latest };
}

function getStepDateSummary(tasks: TaskDraft[]) {
  const hasPmDates = tasks.some(
    (task) => task.dateMode === "pm" && task.startDate && task.endDate,
  );
  if (hasPmDates) {
    const { start, end } = getStepDateRange(tasks);
    if (start && end) {
      return `${formatShortDate(start)} to ${formatShortDate(end)}`;
    }
  }

  const pmCompletionDates = tasks
    .filter((task) => task.dateMode === "pm" && task.endDate)
    .map((task) => task.endDate as string)
    .sort();
  if (pmCompletionDates.length > 0) {
    return `Complete by: ${formatShortDate(pmCompletionDates[pmCompletionDates.length - 1])}`;
  }

  const hasFieldSetDates = tasks.some((task) => task.dateMode === "foreman");
  if (hasFieldSetDates) {
    return "Field will set dates";
  }

  return "No dates for this task";
}

function buildTaskSignoffShareUrl(workflowId: string) {
  const origin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://app.taliho.com";
  return `${origin}/task-signoff/${workflowId}`;
}

function notifiedAllLabel(count: number) {
  if (count === 1) return "1 participant emailed";
  return `${count} participants emailed`;
}

// ── Date Mode Control ────────────────────────────────────────────────────────

function TogglePill({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-all"
      style={{
        borderColor: active ? TASK_SIGNOFF_BRONZE_BORDER : "#e5e7eb",
        background: active ? TASK_SIGNOFF_BRONZE_BG : "#fff",
        color: active ? TASK_SIGNOFF_BRONZE_TEXT : "#8a8a8a",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function DateModePicker({
  value,
  onChange,
}: {
  value: TaskDraft["dateMode"];
  onChange: (value: TaskDraft["dateMode"]) => void;
}) {
  const options: Array<{ key: TaskDraft["dateMode"]; label: string }> = [
    { key: "none", label: "No Dates" },
    { key: "pm", label: "I'll Set" },
    { key: "foreman", label: "Foreman Sets" },
  ];

  return (
    <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
      {options.map((option, index) => {
        const selected = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className="px-2.5 py-1.5 text-[11px] font-semibold transition-colors"
            style={{
              background: selected ? (option.key === "none" ? "#fff" : TASK_SIGNOFF_BRONZE_BG) : "transparent",
              color: selected ? (option.key === "none" ? "#555" : TASK_SIGNOFF_BRONZE_TEXT) : "#9ca3af",
              borderLeft: index === 0 ? "none" : "1px solid #e5e7eb",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Task Item ─────────────────────────────────────────────────────────────────

function TaskItem({
  task, index, totalTasks, onUpdate, onDelete,
}: {
  task: TaskDraft;
  index: number;
  totalTasks: number;
  onUpdate: (id: number, field: keyof TaskDraft, value: unknown) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="mb-2.5 flex flex-col gap-3 rounded-xl border border-gray-200 bg-slate-50/70 p-3.5">
      {/* Row: number badge + description + delete */}
      <div className="flex items-start gap-2.5">
        <div
          className="flex-shrink-0 flex items-center justify-center text-white font-bold mt-0.5"
          style={{ width: 26, height: 26, borderRadius: 6, background: TASK_SIGNOFF_BRONZE, fontSize: 11 }}
        >
          {index + 1}
        </div>
        <input
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-transparent focus:ring-2 focus:ring-yellow-400"
          placeholder="Describe the task..."
          value={task.description}
          onChange={(e) => onUpdate(task.localId, "description", e.target.value)}
        />
        {totalTasks > 1 && (
          <button
            type="button"
            onClick={() => onDelete(task.localId)}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors mt-0.5"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {/* Task controls + Date Mode */}
      <div className="ml-[36px] flex flex-wrap items-center gap-2">
        <TogglePill
          icon={<CameraIcon />}
          label="Require Photo"
          active={task.requirePicture}
          onClick={() => onUpdate(task.localId, "requirePicture", !task.requirePicture)}
        />
        <TogglePill
          icon={<NoteIcon />}
          label="Require Notes"
          active={task.requireNotes}
          onClick={() => onUpdate(task.localId, "requireNotes", !task.requireNotes)}
        />
        <div className="flex-1" />
        <DateModePicker
          value={task.dateMode}
          onChange={(value) => onUpdate(task.localId, "dateMode", value)}
        />
      </div>

      {/* PM-set dates */}
      {task.dateMode === "pm" ? (
        <div className="ml-[36px] flex flex-wrap items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="pt-[18px] text-amber-700">
            <CalendarIcon />
          </div>
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
            <div className="min-w-0">
              <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Start</div>
              <input
                type="date"
                className="w-full min-w-0 cursor-pointer rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-yellow-400"
                value={task.startDate}
                onChange={(e) => onUpdate(task.localId, "startDate", e.target.value)}
              />
            </div>
            <div className="hidden items-center justify-center pb-2 text-xs text-amber-400 sm:flex">
              →
            </div>
            <div className="min-w-0">
              <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                <span>End</span>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
              </div>
              <input
                type="date"
                className="w-full min-w-0 cursor-pointer rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-yellow-400"
                value={task.endDate}
                onChange={(e) => onUpdate(task.localId, "endDate", e.target.value)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StepBreadcrumbTrail({
  steps,
  activeStepOrder,
  onSelectStep,
}: {
  steps: CompletedTrade[];
  activeStepOrder: number;
  onSelectStep: (step: CompletedTrade) => void;
}) {
  if (steps.length === 0) return null;

  const breadcrumbSteps = steps.filter((step) => step.order !== activeStepOrder);

  return (
    <div className="flex flex-wrap items-center gap-y-2 pb-1">
      {breadcrumbSteps.map((step, index) => (
        <div key={step.order} className="flex items-center">
          <button
            type="button"
            onClick={() => onSelectStep(step)}
            className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100"
          >
            <CheckIcon size={11} />
            Step {step.order}: {step.foremanName}
          </button>
          {index < breadcrumbSteps.length - 1 || activeStepOrder > 0 ? (
            <div className="mx-2 h-px w-5 bg-gray-300" />
          ) : null}
        </div>
      ))}

      <div className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">
        Step {activeStepOrder}
      </div>
    </div>
  );
}

function ConfirmationScreen({
  workflowName,
  workflowId,
  steps,
  onClose,
}: {
  workflowName: string;
  workflowId: string;
  steps: CompletedTrade[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [notifiedFirst, setNotifiedFirst] = useState(false);
  const [notifiedAll, setNotifiedAll] = useState(false);
  const [notifiedAllCount, setNotifiedAllCount] = useState(0);
  const [isSendingFirst, setIsSendingFirst] = useState(false);
  const [isSendingAll, setIsSendingAll] = useState(false);
  const totalTasks = steps.reduce((sum, step) => sum + step.tasks.length, 0);
  const firstStep = steps[0];
  const shareUrl = buildTaskSignoffShareUrl(workflowId);
  const showNotifyAll = steps.length > 1;

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const handleNotifyFirst = async () => {
    if (!workflowId || isSendingFirst) return;

    setIsSendingFirst(true);
    try {
      const result = await notifyFirstWorkflowParticipant(workflowId);
      if (result.sentCount > 0) {
        setNotifiedFirst(true);
        toast.success(`Email sent to ${firstStep?.foremanName ?? "first participant"}.`);
      } else {
        toast.error("No email address was available for the first participant.");
      }
    } catch {
      toast.error("Failed to send the first participant email.");
    } finally {
      setIsSendingFirst(false);
    }
  };

  const handleNotifyAll = async () => {
    if (!workflowId || isSendingAll) return;

    const includeFirst = !notifiedFirst;
    setIsSendingAll(true);
    try {
      const result = await notifyAllWorkflowParticipants(workflowId, {
        includeFirst,
      });
      if (result.sentCount > 0) {
        setNotifiedAll(true);
        setNotifiedAllCount(result.sentCount + (includeFirst ? 0 : 1));
        if (includeFirst && firstStep) {
          setNotifiedFirst(true);
        }
        toast.success(
          result.sentCount === 1
            ? "1 participant emailed."
            : `${result.sentCount} participants emailed.`,
        );
      } else {
        toast.error("No participant email addresses were available.");
      }
    } catch {
      toast.error("Failed to email participants.");
    } finally {
      setIsSendingAll(false);
    }
  };

  return (
    <div className="px-8 py-8">
      <div className="mx-auto flex max-w-[460px] flex-col gap-5">
        <div className="text-center">
          <h2 className="text-[20px] font-bold text-gray-900">{workflowName}</h2>
          <p className="mt-1 text-sm text-gray-400">
            Task Signoff created · {steps.length} step{steps.length !== 1 ? "s" : ""} · {totalTasks} task{totalTasks !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-4">
          <div className="flex flex-col gap-0">
            {steps.map((step, index) => (
              <div key={step.order} className="flex gap-3">
                <div className="flex w-7 flex-col items-center">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-white">
                    {step.order}
                  </div>
                  {index < steps.length - 1 && <div className="my-1 w-px flex-1 bg-gray-300" />}
                </div>
                <div className={`flex flex-1 items-start ${index < steps.length - 1 ? "pb-4" : ""}`}>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{step.foremanName}</div>
                    <div className="mt-0.5 text-xs text-gray-400">
                      {step.foremanCompany || step.tradeName} · {step.tasks.length} task{step.tasks.length !== 1 ? "s" : ""}
                    </div>
                    <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                      <CalendarIcon />
                      <span>{getStepDateSummary(step.tasks)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300"
          >
            {copied ? (
              <>
                <CheckIcon size={12} />
                Link copied
              </>
            ) : (
              <>
                <CopyIcon />
                Copy link
              </>
            )}
          </button>
        </div>

        {firstStep && (
          notifiedFirst ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
              <CheckIcon size={14} />
              Email sent to {firstStep.foremanName}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleNotifyFirst}
              disabled={isSendingFirst}
              className="flex items-center justify-center gap-2 rounded-xl border border-green-500 bg-white px-4 py-3 text-sm font-semibold text-green-700 transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MailIcon color="currentColor" />
              {isSendingFirst
                ? "Sending..."
                : `Email ${firstStep.foremanName}: Get Started`}
            </button>
          )
        )}

        {showNotifyAll ? (
          notifiedAll ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
              <CheckIcon size={14} />
              {notifiedAllLabel(notifiedAllCount || steps.length)}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleNotifyAll}
              disabled={isSendingAll}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MailAllIcon />
              {isSendingAll ? "Sending..." : "Email All Participants"}
            </button>
          )
        ) : null}

        <div className="flex justify-center border-t border-gray-100 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-8 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function BallInCourtModal({
  open,
  onClose,
  qrCodeId,
  companyId,
  projectId,
  procoreProjectId,
}: BallInCourtModalProps) {
  const [workflowName, setWorkflowName] = useState("");
  const [workflowNameError, setWorkflowNameError] = useState(false);
  const [completedTrades, setCompletedTrades] = useState<CompletedTrade[]>([]);
  const [selectedForemanId, setSelectedForemanId] = useState("");
  const [tasks, setTasks] = useState<TaskDraft[]>([emptyTask()]);
  const [editingTradeOrder, setEditingTradeOrder] = useState<number | null>(null);
  const [editForemanId, setEditForemanId] = useState("");
  const [editTasks, setEditTasks] = useState<TaskDraft[]>([]);
  const [editingTradeDrafts, setEditingTradeDrafts] = useState<EditingTradeDraftMap>({});
  const [resumeTradeDraft, setResumeTradeDraft] = useState<ResumeTradeDraft | null>(null);
  const [showNewTradeForm, setShowNewTradeForm] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdWorkflowId, setCreatedWorkflowId] = useState<string | null>(null);
  const [foremenOptions, setForemenOptions] = useState<FormanOption[]>([]);

  const currentTradeNum = completedTrades.length + 1;
  const activeStepOrder = editingTradeOrder ?? currentTradeNum;

  // Fetch Procore directory on open
  useEffect(() => {
    if (!open || !qrCodeId || !companyId || !projectId) return;
    getDirectory(qrCodeId, companyId, projectId, "", true)
      .then((res) => {
        const r = res as { data?: unknown } | unknown[] | unknown;
        const raw: ProcoreForeman[] = Array.isArray((r as { data?: unknown })?.data) ? (r as { data: unknown[] }).data as ProcoreForeman[] : Array.isArray(r) ? r as ProcoreForeman[] : [];
        const options: FormanOption[] = raw.map((p) => ({
          id: String(p.procoreItemID ?? p.id ?? Math.random()),
          name: (p.name ?? (p.login_information?.name) ?? "Unknown") as string,
          title: (p.job_title ?? p.title ?? "") as string,
          company: (p.vendor?.name ?? "") as string,
          email: (p.email_address ?? p.email ?? "") as string,
        }));
        setForemenOptions(options);
      })
      .catch(() => setForemenOptions([]));
  }, [open, qrCodeId, companyId, projectId]);

  function resetModal() {
    setWorkflowName("");
    setWorkflowNameError(false);
    setCompletedTrades([]);
    setSelectedForemanId("");
    setTasks([emptyTask()]);
    setEditingTradeOrder(null);
    setEditForemanId("");
    setEditTasks([]);
    setEditingTradeDrafts({});
    setResumeTradeDraft(null);
    setShowNewTradeForm(true);
    setIsFinished(false);
    setIsSubmitting(false);
    setCreatedWorkflowId(null);
  }

  function handleClose() {
    resetModal();
    onClose();
  }

  // ── Current trade task helpers ──
  function updateTask(id: number, field: keyof TaskDraft, value: unknown) {
    setTasks((prev) => prev.map((t) => (t.localId === id ? { ...t, [field]: value } : t)));
  }
  function deleteTask(id: number) {
    setTasks((prev) => prev.filter((t) => t.localId !== id));
  }
  function addTask() {
    setTasks((prev) => [...prev, emptyTask()]);
  }

  function restoreResumeTradeDraft() {
    if (!resumeTradeDraft) return;
    setSelectedForemanId(resumeTradeDraft.foremanId);
    setTasks(resumeTradeDraft.tasks.map((task) => ({ ...task })));
    setShowNewTradeForm(true);
    setResumeTradeDraft(null);
  }

  function startEditTrade(trade: CompletedTrade) {
    if (editingTradeOrder !== null && editingTradeOrder !== trade.order) {
      setEditingTradeDrafts((prev) => ({
        ...prev,
        [editingTradeOrder]: {
          foremanId: editForemanId,
          tasks: editTasks.map((task) => ({ ...task })),
        },
      }));
    }
    if (showNewTradeForm) {
      setResumeTradeDraft({
        stepNumber: currentTradeNum,
        foremanId: selectedForemanId,
        tasks: tasks.map((task) => ({ ...task })),
      });
    }
    const existingDraft = editingTradeDrafts[trade.order];
    setEditingTradeOrder(trade.order);
    setEditForemanId(existingDraft?.foremanId ?? trade.foremanId);
    setEditTasks((existingDraft?.tasks ?? trade.tasks).map((task) => ({ ...task })));
    setShowNewTradeForm(false);
  }

  function cancelEditTrade() {
    if (editingTradeOrder !== null) {
      setEditingTradeDrafts((prev) => {
        const next = { ...prev };
        delete next[editingTradeOrder];
        return next;
      });
    }
    setEditingTradeOrder(null);
    setEditForemanId("");
    setEditTasks([]);
    restoreResumeTradeDraft();
  }

  function saveEditTrade() {
    const foreman = foremenOptions.find((f) => f.id === editForemanId);
    if (!foreman || editingTradeOrder === null) return;
    if (!editTasks.every(isTaskDraftValid)) {
      toast.error(
        getCurrentTradeValidationMessage(
          editTasks,
          Boolean(editForemanId),
          "next",
        ) ?? "Finish the current step before saving it.",
      );
      return;
    }

    setCompletedTrades((prev) =>
      prev.map((trade) =>
        trade.order === editingTradeOrder
          ? {
              ...trade,
              foremanId: foreman.id,
              foremanName: foreman.name,
              foremanCompany: foreman.company,
              foremanEmail: foreman.email,
              tradeName: foreman.title || foreman.company || foreman.name,
              tasks: editTasks.map(normalizeTaskDraftForSave),
            }
          : trade
      )
    );
    setEditingTradeDrafts((prev) => {
      const next = { ...prev };
      delete next[editingTradeOrder];
      return next;
    });
    setEditingTradeOrder(null);
    setEditForemanId("");
    setEditTasks([]);
    restoreResumeTradeDraft();
  }

  function updateEditTask(id: number, field: keyof TaskDraft, value: unknown) {
    setEditTasks((prev) => prev.map((task) => (task.localId === id ? { ...task, [field]: value } : task)));
  }

  function deleteEditTask(id: number) {
    setEditTasks((prev) => prev.filter((task) => task.localId !== id));
  }

  function addEditTask() {
    setEditTasks((prev) => [...prev, emptyTask()]);
  }

  // Discard the in-progress current step and keep the completed sequence intact.
  function discardCurrentTrade() {
    setSelectedForemanId("");
    setTasks([emptyTask()]);
    setShowNewTradeForm(false);
  }

  const selectedForeman = foremenOptions.find((f) => f.id === selectedForemanId);
  const currentTradeIsValid = !!selectedForeman && tasks.every(isTaskDraftValid);
  const hasCurrentTradeDraft = Boolean(selectedForemanId) || tasks.some(hasMeaningfulTaskDraft);
  const canAttemptCreateWorkflow =
    Boolean(workflowName.trim()) ||
    completedTrades.length > 0 ||
    hasCurrentTradeDraft;
  const canAttemptNextStep = showNewTradeForm && hasCurrentTradeDraft;
  const availableForemen = foremenOptions;
  const editAvailableForemen = foremenOptions;
  const footerDotCount =
    editingTradeOrder !== null
      ? Math.max(completedTrades.length, 1)
      : showNewTradeForm
        ? Math.max(completedTrades.length + 1, 1)
        : Math.max(completedTrades.length, 1);

  function handleNextTrade() {
    if (completedTrades.length === 0 && !workflowName.trim()) {
      setWorkflowNameError(true);
      toast.error("Please name the workflow before moving to the next step.");
      return;
    }
    setWorkflowNameError(false);
    if (!selectedForeman || !currentTradeIsValid) {
      toast.error(
        getCurrentTradeValidationMessage(
          tasks,
          Boolean(selectedForemanId),
          "next",
        ) ?? "Finish the current step before moving to the next one.",
      );
      return;
    }
    setCompletedTrades((prev) => [
      ...prev,
      {
        order: currentTradeNum,
        foremanId: selectedForeman.id,
        foremanName: selectedForeman.name,
        foremanCompany: selectedForeman.company,
        foremanEmail: selectedForeman.email,
        tradeName: selectedForeman.title || selectedForeman.company || selectedForeman.name,
        tasks: tasks.map(normalizeTaskDraftForSave),
      },
    ]);
    setSelectedForemanId("");
    setTasks([emptyTask()]);
    setShowNewTradeForm(true);
  }

  async function handleFinish() {
    if (editingTradeOrder !== null) {
      toast.error("Save or cancel the step you're editing before creating the workflow.");
      return;
    }

    if (!workflowName.trim()) {
      setWorkflowNameError(true);
      toast.error("Please add a workflow name before creating it.");
      return;
    }
    setWorkflowNameError(false);

    if (hasCurrentTradeDraft && selectedForemanId && !currentTradeIsValid) {
      toast.error(
        getCurrentTradeValidationMessage(
          tasks,
          Boolean(selectedForemanId),
          "create",
        ) ?? "Finish the current step or clear it before creating the workflow.",
      );
      return;
    }

    const allTrades = currentTradeIsValid && selectedForeman
      ? [
          ...completedTrades,
          {
            order: currentTradeNum,
            foremanId: selectedForeman.id,
            foremanName: selectedForeman.name,
            foremanCompany: selectedForeman.company,
            foremanEmail: selectedForeman.email,
            tradeName: selectedForeman.title || selectedForeman.company || selectedForeman.name,
            tasks: tasks.map(normalizeTaskDraftForSave),
          },
        ]
      : [...completedTrades];

    if (allTrades.length === 0) {
      toast.error(
        getCurrentTradeValidationMessage(
          tasks,
          Boolean(selectedForemanId),
          "create",
        ) ?? "Add at least one complete step before creating the workflow.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Build flat tasks array with tradeIndex
      const flatTasks = allTrades.flatMap((trade, ti) =>
        trade.tasks.map((task, order) => {
          const normalizedTask = normalizeTaskDraftForSave(task);
          return {
            tradeIndex: ti,
            order: order + 1,
            description: normalizeTaskDescription(normalizedTask.description),
            requirePicture: normalizedTask.requirePicture,
            requireNotes: normalizedTask.requireNotes,
            datesAssignedByPm: normalizedTask.dateMode === "pm",
            dateMode: normalizedTask.dateMode,
            startDate:
              normalizedTask.dateMode === "pm" && normalizedTask.startDate
                ? normalizedTask.startDate
                : undefined,
            endDate:
              normalizedTask.dateMode === "pm" && normalizedTask.endDate
                ? normalizedTask.endDate
                : undefined,
          };
        })
      );

      const { workflow } = await createWorkflow({
        name: workflowName.trim(),
        qrCodeId,
        companyId,
        projectId,
        procoreProjectId,
        trades: allTrades.map((t) => ({
          order: t.order,
          foremanProcoreId: t.foremanId,
          foremanName: t.foremanName,
          foremanEmail: t.foremanEmail || undefined,
          foremanCompany: t.foremanCompany,
          tradeName: t.tradeName,
        })),
        tasks: flatTasks,
      });

      const createdWorkflowSummary = toWorkflowSummary(workflow);
      queryClient.setQueryData<BicWorkflowSummary[]>(
        BicKeys.byQrCode(qrCodeId),
        (current) => {
          const existing = current ?? [];
          const withoutDuplicate = existing.filter(
            (item) => item._id !== createdWorkflowSummary._id,
          );
          return [createdWorkflowSummary, ...withoutDuplicate];
        },
      );
      void queryClient.invalidateQueries({ queryKey: BicKeys.byQrCode(qrCodeId) });
      setCompletedTrades(allTrades);
      setSelectedForemanId("");
      setTasks([emptyTask()]);
      setCreatedWorkflowId(workflow._id);
      setIsFinished(true);
    } catch {
      toast.error("Failed to create workflow. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Confirmation Screen ──────────────────────────────────────────────────────
  if (isFinished) {
    const name = workflowName || "Untitled Workflow";
    return (
      <Modal open={open} onClose={handleClose} size="lg">
        <ConfirmationScreen
          workflowName={name}
          workflowId={createdWorkflowId ?? ""}
          steps={completedTrades}
          onClose={handleClose}
        />
      </Modal>
    );
  }

  // ── Main Form ────────────────────────────────────────────────────────────────
  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="xl"
      scrollable
      headerClassName="items-start pr-8"
      closeButtonClassName="-mr-1 -mt-1 self-start"
      title={
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0"
          >
            <img src={procoreIcon} alt="Procore" className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[17px] font-bold text-gray-900 tracking-tight leading-tight">Task Signoff</div>
            <div className="text-xs text-gray-400 mt-0.5">Create a sequential step workflow</div>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center gap-4 border-t border-gray-100 bg-gray-50 px-6 py-4 w-full">
          <div className="flex min-w-0 flex-1 items-center justify-start gap-1.5">
            {Array.from({ length: footerDotCount }).map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-colors"
                style={{ width: 8, height: 8, background: i < footerDotCount ? TASK_SIGNOFF_BRONZE : "#ddd" }}
              />
            ))}
          </div>
          <div className="flex flex-none items-center gap-3">

            <button
              type="button"
              onClick={
                editingTradeOrder !== null
                  ? saveEditTrade
                  : showNewTradeForm
                    ? handleNextTrade
                    : () => {
                        setShowNewTradeForm(true);
                      }
              }
              disabled={
                editingTradeOrder !== null
                  ? !editForemanId || !editTasks.every(isTaskDraftValid)
                  : !showNewTradeForm
                    ? false
                    : !canAttemptNextStep
              }
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
              style={{
                background:
                  editingTradeOrder !== null
                    ? TASK_SIGNOFF_BRONZE_SOLID
                    : showNewTradeForm
                      ? canAttemptNextStep
                        ? TASK_SIGNOFF_SUCCESS_SOLID
                        : "#d1d5db"
                      : TASK_SIGNOFF_SUCCESS_SOLID,
                boxShadow:
                  editingTradeOrder !== null || canAttemptNextStep || !showNewTradeForm
                    ? "0 2px 10px rgba(22,163,74,0.22)"
                    : "none",
              }}
            >
              {editingTradeOrder !== null
                ? "Save Step"
                : showNewTradeForm
                  ? "Next Step →"
                  : "Add Another Step"}
            </button>
                        <button
              type="button"
              onClick={handleFinish}
              disabled={!canAttemptCreateWorkflow || isSubmitting || editingTradeOrder !== null}
              className="rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                borderColor: canAttemptCreateWorkflow ? "#d1d5db" : "#e5e7eb",
                color: canAttemptCreateWorkflow ? "#4b5563" : "#9ca3af",
                background: "#fff",
              }}
            >
              {isSubmitting ? "Creating..." : "Create Workflow"}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">

        {/* Workflow Name */}
        {completedTrades.length === 0 && editingTradeOrder === null ? (
          <div>
            <input
              className={`w-full rounded-xl border px-4 py-3 text-center text-[20px] font-bold outline-none transition-colors ${
                workflowNameError
                  ? "border-red-300 bg-red-50 text-red-700"
                  : "border-gray-200 bg-gray-50 text-amber-800 focus:border-transparent focus:ring-2 focus:ring-yellow-400"
              }`}
              placeholder="Enter Workflow Name Here"
              value={workflowName}
              onChange={(e) => {
                setWorkflowName(e.target.value);
                if (e.target.value.trim()) setWorkflowNameError(false);
              }}
            />
            {workflowNameError ? (
              <p className="mt-2 text-center text-xs font-medium text-red-500">
                Please enter a name before continuing.
              </p>
            ) : null}
          </div>
        ) : null}

        <StepBreadcrumbTrail
          steps={completedTrades}
          activeStepOrder={activeStepOrder}
          onSelectStep={startEditTrade}
        />

        {editingTradeOrder !== null ? (
          <div className="overflow-hidden rounded-xl border border-amber-300 shadow-sm">
            <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3">
              <div className="min-w-[52px] text-sm font-semibold text-amber-700">Step {editingTradeOrder}</div>
              <div className="relative flex-1">
                <select
                  className="w-full appearance-none rounded-lg border border-amber-200 bg-white px-3 py-2.5 pr-9 text-sm text-gray-900 outline-none focus:border-transparent focus:ring-2 focus:ring-yellow-400"
                  style={{ appearance: "none", WebkitAppearance: "none", MozAppearance: "none", backgroundImage: "none" }}
                  value={editForemanId}
                  onChange={(e) => setEditForemanId(e.target.value)}
                >
                  <option value="">Responsible Person...</option>
                  {editAvailableForemen.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                      {f.title ? ` — ${f.title}` : f.company ? ` — ${f.company}` : ""}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5l3 3 3-3" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <button
                type="button"
                onClick={cancelEditTrade}
                className="rounded-md px-2 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-white hover:text-gray-600"
              >
                Cancel
              </button>
            </div>

            <div className="p-4">
              {editTasks.map((task, taskIndex) => (
                <TaskItem
                  key={task.localId}
                  task={task}
                  index={taskIndex}
                  totalTasks={editTasks.length}
                  onUpdate={updateEditTask}
                  onDelete={deleteEditTask}
                />
              ))}
              <button
                type="button"
                onClick={addEditTask}
                className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-transparent py-2 text-sm font-medium text-gray-400 transition-all hover:border-yellow-400 hover:text-yellow-500"
              >
                <PlusIcon size={14} />
                Add Task
              </button>
            </div>
          </div>
        ) : null}

        {showNewTradeForm && editingTradeOrder === null ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 border-b border-gray-200 bg-slate-50 px-4 py-3">
              <div className="min-w-[52px] text-sm font-semibold text-amber-700">Step {currentTradeNum}</div>
              <div className="relative flex-1">
                <select
                  className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 pr-9 text-sm text-gray-900 outline-none focus:border-transparent focus:ring-2 focus:ring-yellow-400"
                  style={{ appearance: "none", WebkitAppearance: "none", MozAppearance: "none", backgroundImage: "none" }}
                  value={selectedForemanId}
                  onChange={(e) => setSelectedForemanId(e.target.value)}
                >
                  <option value="">Responsible Person...</option>
                  {availableForemen.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                      {f.title ? ` — ${f.title}` : f.company ? ` — ${f.company}` : ""}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5l3 3 3-3" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              {completedTrades.length > 0 && (
                <button
                  type="button"
                  onClick={discardCurrentTrade}
                  className="rounded-md px-2 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="p-4">
              {tasks.map((task, i) => (
                <TaskItem
                  key={task.localId}
                  task={task}
                  index={i}
                  totalTasks={tasks.length}
                  onUpdate={updateTask}
                  onDelete={deleteTask}
                />
              ))}
              <button
                type="button"
                onClick={addTask}
                className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-transparent py-2 text-sm font-medium text-gray-400 transition-all hover:border-yellow-400 hover:text-yellow-500"
              >
                <PlusIcon size={14} />
                Add Task
              </button>
            </div>
          </div>
        ) : (
          editingTradeOrder === null && (
            <button
              type="button"
              onClick={() => setShowNewTradeForm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 py-3 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50"
            >
              <PlusIcon size={14} />
              Add Another Step
            </button>
          )
        )}

      </div>
    </Modal>
  );
}
