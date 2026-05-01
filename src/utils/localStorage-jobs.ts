/**
 * localStorage Job Tracker
 * Persists active background jobs across navigation and page refreshes
 */

import { logJobError } from "@/utils/rollbar";

const STORAGE_KEY = "taliho_active_jobs";
const MAX_JOB_AGE_MS = 30 * 60 * 1000; // 30 minutes

export interface StoredJob {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed" | "paused";
  progress: number;
  total: number;
  groupId?: string;
  groupName?: string;
  currentOperation?: string;
  groupingType?: string; // e.g. 'equipment', 'arrangement' — used as fallback for qrListParams
  type: string; // 'bulk-qr-creation', etc.
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  result?: {
    qrCodes?: Array<{ id: string; name: string; url: string }>;
    groupId?: string;
    count?: number;
    failedCount?: number;
    totalRequested?: number;
  };
  error?: string;
  estimatedRemainingMs?: number;
  deadLetterCount?: number;
}

/**
 * Get all active jobs from localStorage
 */
export const getActiveJobs = (): StoredJob[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const jobs: StoredJob[] = JSON.parse(stored);

    // Filter out stale jobs (older than MAX_JOB_AGE_MS)
    const now = Date.now();
    const activeJobs = jobs.filter((job) => {
      const createdAt = new Date(job.createdAt).getTime();
      return now - createdAt < MAX_JOB_AGE_MS;
    });

    // If we filtered any jobs, update localStorage
    if (activeJobs.length !== jobs.length) {
      saveJobs(activeJobs);
    }

    return activeJobs;
  } catch (error) {
    logJobError(error, "jobs-localstorage-read-failed");
    console.error("Error reading active jobs from localStorage:", error);
    return [];
  }
};

/**
 * Save jobs array to localStorage
 */
const saveJobs = (jobs: StoredJob[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch (error) {
    logJobError(error, "jobs-localstorage-save-failed");
    console.error("Error saving jobs to localStorage:", error);
  }
};

/**
 * Add a new job to localStorage
 */
export const addJob = (
  job: Omit<StoredJob, "createdAt" | "updatedAt">,
): void => {
  const jobs = getActiveJobs();
  const now = new Date().toISOString();

  const newJob: StoredJob = {
    ...job,
    createdAt: now,
    updatedAt: now,
  };

  jobs.push(newJob);
  saveJobs(jobs);
};

/**
 * Update an existing job in localStorage
 */
export const updateJob = (
  jobId: string,
  updates: Partial<Omit<StoredJob, "jobId" | "createdAt" | "updatedAt">>,
): void => {
  const jobs = getActiveJobs();
  const index = jobs.findIndex((j) => j.jobId === jobId);

  if (index === -1) {
    console.warn(`Job ${jobId} not found in localStorage`);
    return;
  }

  jobs[index] = {
    ...jobs[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveJobs(jobs);
};

/**
 * Remove a job from localStorage
 */
export const removeJob = (jobId: string): void => {
  const jobs = getActiveJobs();
  const filtered = jobs.filter((j) => j.jobId !== jobId);
  saveJobs(filtered);
};

/**
 * Get a specific job by ID
 */
export const getJob = (jobId: string): StoredJob | null => {
  const jobs = getActiveJobs();
  return jobs.find((j) => j.jobId === jobId) || null;
};

/**
 * Remove all completed or failed jobs
 */
export const cleanupCompletedJobs = (): void => {
  const jobs = getActiveJobs();
  const activeJobs = jobs.filter(
    (j) =>
      j.status === "pending" ||
      j.status === "processing" ||
      j.status === "paused",
  );
  saveJobs(activeJobs);
};

/**
 * Get count of active (pending/processing/paused) jobs
 */
export const getActiveJobCount = (): number => {
  const jobs = getActiveJobs();
  return jobs.filter(
    (j) =>
      j.status === "pending" ||
      j.status === "processing" ||
      j.status === "paused",
  ).length;
};

/**
 * Clear all jobs from localStorage (useful for debugging)
 */
export const clearAllJobs = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    logJobError(error, "jobs-localstorage-clear-failed");
    console.error("Error clearing jobs from localStorage:", error);
  }
};

/**
 * Check if a job exists in localStorage
 */
export const hasJob = (jobId: string): boolean => {
  return getJob(jobId) !== null;
};

/**
 * Wait while a client-side job is paused.
 * Polls localStorage every 500ms.
 * @returns true when the job resumes (loop should continue),
 *          false if the job was cancelled/removed (loop should break).
 */
export const waitWhilePaused = (jobId: string): Promise<boolean> => {
  const job = getJob(jobId);
  if (!job || job.status === "failed") return Promise.resolve(false);
  if (job.status !== "paused") return Promise.resolve(true);

  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const current = getJob(jobId);
      if (!current || current.status === "failed") {
        clearInterval(interval);
        resolve(false);
      } else if (current.status !== "paused") {
        clearInterval(interval);
        resolve(true);
      }
    }, 500);
  });
};
