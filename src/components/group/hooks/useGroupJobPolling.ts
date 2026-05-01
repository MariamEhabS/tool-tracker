import { useState, useEffect, useRef, useCallback } from "react";
import { getActiveJobs, type StoredJob } from "@/utils/localStorage-jobs";
import { QrKeys } from "@/api/endpoints/qr-codes";
import { groupsKeys } from "@/api/endpoints/groups";
import { queryClient } from "@/api";
import toast from "react-hot-toast";

/**
 * Polls for active QR creation jobs belonging to a specific group
 * and auto-refreshes the QR list when jobs complete.
 */
export function useGroupJobPolling(groupId: string, refetchQrList: () => void) {
  const [activeGroupJobs, setActiveGroupJobs] = useState<StoredJob[]>([]);

  // Track which jobs have been processed to avoid duplicate refetches (persists across re-renders)
  const processedJobIdsRef = useRef<Set<string>>(new Set());

  // Read active group jobs from localStorage.
  // The GlobalJobTracker already owns backend polling/SSE and updates localStorage.
  useEffect(() => {
    const checkForActiveJobs = () => {
      const jobs = getActiveJobs().filter(
        (job) =>
          job.groupId === groupId &&
          (job.status === "pending" ||
            job.status === "processing" ||
            job.status === "paused"),
      );
      setActiveGroupJobs(jobs);
    };

    checkForActiveJobs();
    const interval = setInterval(checkForActiveJobs, 2000);

    return () => clearInterval(interval);
  }, [groupId]);

  // Auto-refresh QR codes when jobs complete
  const stableRefetch = useCallback(refetchQrList, [refetchQrList]);

  useEffect(() => {
    const checkForCompletedJobs = () => {
      const allJobs = getActiveJobs().filter((job) => job.groupId === groupId);

      allJobs.forEach((job) => {
        if (
          job.status === "completed" &&
          !processedJobIdsRef.current.has(job.jobId)
        ) {
          processedJobIdsRef.current.add(job.jobId);
          // Invalidate query cache to ensure fresh data is fetched
          void queryClient.invalidateQueries({ queryKey: QrKeys.all });
          void queryClient.invalidateQueries({ queryKey: groupsKeys.all });
          // Refetch QR codes list when job completes
          stableRefetch();
          // Show success toast
          const count = job.result?.count ?? job.total;
          toast.success(
            `Successfully created ${count} QR code${count === 1 ? "" : "s"}!`,
            { duration: 4000 },
          );
        }
      });
    };

    checkForCompletedJobs();
    const interval = setInterval(checkForCompletedJobs, 1000); // Check more frequently (1s instead of 2s)

    return () => clearInterval(interval);
  }, [groupId, stableRefetch]); // stableRefetch included for refetch - processedJobIdsRef prevents duplicate processing

  const hasActiveCreationJob = activeGroupJobs.length > 0;

  return { activeGroupJobs, hasActiveCreationJob };
}
