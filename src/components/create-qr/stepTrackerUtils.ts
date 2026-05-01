import type { StepState } from "./types";

export function getStepState(
  stepNumber: number,
  currentStep: number,
): StepState {
  if (stepNumber < currentStep) return "completed";
  if (stepNumber === currentStep) return "current";
  return "upcoming";
}

export function badgeClasses(state: StepState): string {
  return state === "completed"
    ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-medium"
    : state === "current"
      ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white text-xs font-medium"
      : "inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-500 text-xs font-medium";
}

export function labelClasses(state: StepState): string {
  return state === "upcoming" ? "text-gray-400" : "text-gray-900";
}
