import { badgeClasses, getStepState, labelClasses } from "./stepTrackerUtils";

export interface CreateQRStepTrackerProps {
  currentStep: number;
  /**
   * New preferred prop: full array of step labels. When provided, the tracker
   * renders exactly `labels.length` steps. Enables the Type-first flow's
   * variable step count (2 steps for single-only types, 4 for Taliho Code Bulk).
   */
  labels?: string[];
  /** Legacy prop used by the pre-Type-first flow. Ignored when `labels` is set. */
  step1Label?: string;
  /** Legacy prop used by the pre-Type-first flow. Ignored when `labels` is set. */
  step2Label?: string;
  showLoading?: boolean;
}

export default function CreateQRStepTracker({
  currentStep,
  labels,
  step1Label,
  step2Label,
  showLoading,
}: CreateQRStepTrackerProps) {
  const effectiveLabels =
    labels && labels.length > 0
      ? labels
      : [step1Label ?? "Step 1", step2Label ?? "Step 2", "Name"];

  const stepCount = effectiveLabels.length;
  const lastStepIdx = stepCount - 1;

  const gridClass =
    stepCount === 2
      ? "grid-cols-2"
      : stepCount === 4
        ? "grid-cols-4"
        : "grid-cols-3";

  return (
    <div className="w-full mb-4 flex-shrink-0">
      <div className={`grid ${gridClass} gap-2 md:gap-3 text-sm`}>
        {effectiveLabels.map((label, idx) => {
          const stepNumber = idx + 1;
          const state = getStepState(stepNumber, currentStep);
          const isLast = idx === lastStepIdx;
          // Progress bar fills once the next step is active.
          const filled = isLast
            ? currentStep > stepNumber || showLoading
            : currentStep > stepNumber;
          return (
            <div key={`${idx}-${label}`} className="flex flex-col gap-2">
              <div
                className={`flex items-center gap-2 ${labelClasses(state)}`}
              >
                <span className={badgeClasses(state)}>{stepNumber}</span>
                <span className={idx === 0 ? "font-medium" : ""}>{label}</span>
              </div>
              <div className="relative h-1 flex-1 rounded bg-gray-200 overflow-hidden">
                <div
                  className="rounded-full h-1 bg-green-500 transition-all duration-500 ease-in-out"
                  style={{ width: filled ? "100%" : "0%" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
