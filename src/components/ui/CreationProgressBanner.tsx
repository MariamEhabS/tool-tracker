import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getJob, type StoredJob } from "@/utils/localStorage-jobs";

/** Props for CreationProgressBanner -- an animated banner that tracks the progress of bulk QR code creation jobs. */
interface CreationProgressBannerProps {
  /** Unique identifier of the localStorage-persisted job to track */
  jobId: string;
  /** Callback fired when the banner is dismissed (manually or auto-hidden after completion) */
  onDismiss?: () => void;
}

export function CreationProgressBanner({
  jobId,
  onDismiss,
}: CreationProgressBannerProps) {
  const [job, setJob] = useState<StoredJob | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Initial fetch
    const fetchJob = () => {
      const storedJob = getJob(jobId);
      setJob(storedJob);

      // Auto-hide after completion with delay
      if (storedJob?.status === "completed" || storedJob?.status === "failed") {
        setTimeout(() => {
          setIsDismissed(true);
          onDismiss?.();
        }, 3000);
      }
    };

    fetchJob();

    // Poll every 2 seconds for updates
    const interval = setInterval(fetchJob, 2000);

    return () => clearInterval(interval);
  }, [jobId, onDismiss]);

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  // Don't render if dismissed or job not found
  if (isDismissed || !job) {
    return null;
  }

  const percentage =
    job.total > 0 ? Math.round((job.progress / job.total) * 100) : 0;

  const getStatusConfig = () => {
    switch (job.status) {
      case "completed":
        return {
          bgGradient: "bg-gradient-to-r from-green-50 to-emerald-50",
          borderColor: "border-green-300",
          accentBg: "bg-green-100",
          textColor: "text-green-900",
          iconClass: "bx bx-check-circle text-green-600",
          iconBg: "bg-green-100",
          progressColor: "bg-gradient-to-r from-green-500 to-emerald-500",
          badgeBg: "bg-green-500",
          badgeText: "text-white",
          message: `Successfully created ${job.total} QR code${job.total === 1 ? "" : "s"}!`,
        };
      case "failed":
        return {
          bgGradient: "bg-gradient-to-r from-red-50 to-rose-50",
          borderColor: "border-red-300",
          accentBg: "bg-red-100",
          textColor: "text-red-900",
          iconClass: "bx bx-error-circle text-red-600",
          iconBg: "bg-red-100",
          progressColor: "bg-gradient-to-r from-red-500 to-rose-500",
          badgeBg: "bg-red-500",
          badgeText: "text-white",
          message: job.error || "Failed to create QR codes",
        };
      case "processing":
        return {
          bgGradient: "bg-gradient-to-r from-yellow-50 to-amber-50",
          borderColor: "border-yellow-400",
          accentBg: "bg-yellow-100",
          textColor: "text-gray-900",
          iconClass: "bx bx-qr text-yellow-600",
          iconBg: "bg-yellow-100",
          progressColor: "bg-gradient-to-r from-yellow-400 to-amber-500",
          badgeBg: "bg-yellow-500",
          badgeText: "text-black",
          message: `Creating ${job.progress} of ${job.total} QR codes...`,
        };
      default: // pending
        return {
          bgGradient: "bg-gradient-to-r from-gray-50 to-slate-50",
          borderColor: "border-gray-300",
          accentBg: "bg-gray-100",
          textColor: "text-gray-900",
          iconClass: "bx bx-loader-alt bx-spin text-gray-600",
          iconBg: "bg-gray-100",
          progressColor: "bg-gradient-to-r from-gray-400 to-slate-400",
          badgeBg: "bg-gray-500",
          badgeText: "text-white",
          message: "Starting QR code creation...",
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={`mb-6 rounded-xl border-2 ${statusConfig.borderColor} ${statusConfig.bgGradient} shadow-lg overflow-hidden`}
      >
        <div className="p-5">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div
              className={`flex-shrink-0 w-11 h-11 rounded-lg ${statusConfig.iconBg} flex items-center justify-center shadow-sm`}
            >
              <i className={`${statusConfig.iconClass} text-2xl`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Header Row */}
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-3">
                  <h3
                    className={`text-base font-semibold ${statusConfig.textColor}`}
                  >
                    {statusConfig.message}
                  </h3>
                  {(job.status === "processing" ||
                    job.status === "pending") && (
                    <span
                      className={`inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 text-xs font-bold ${statusConfig.badgeBg} ${statusConfig.badgeText} rounded-md shadow-sm`}
                    >
                      {percentage}%
                    </span>
                  )}
                </div>

                {/* Dismiss Button */}
                <button
                  onClick={handleDismiss}
                  className="text-gray-400 hover:text-gray-700 hover:bg-white/50 rounded-lg p-1.5 transition-colors"
                  aria-label="Dismiss"
                  title="Dismiss notification"
                >
                  <i className="bx bx-x text-xl" />
                </button>
              </div>

              {/* Group Name */}
              {job.groupName && (
                <div className="flex items-center gap-2 mb-3">
                  <i className="bx bx-folder text-gray-500 text-sm" />
                  <p className="text-sm text-gray-700">
                    Group:{" "}
                    <span className="font-medium text-gray-900">
                      {job.groupName}
                    </span>
                  </p>
                </div>
              )}

              {/* Progress Bar */}
              {(job.status === "processing" || job.status === "pending") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="font-medium">
                      {job.progress} of {job.total} completed
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                      Processing
                    </span>
                  </div>
                  <div className="relative w-full h-2.5 bg-white/80 rounded-full overflow-hidden shadow-inner">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className={`h-2.5 rounded-full ${statusConfig.progressColor} shadow-sm`}
                    />
                  </div>
                </div>
              )}

              {/* Success/Error Details */}
              {job.status === "completed" && (
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <i className="bx bx-check text-base" />
                  <span>All QR codes have been created successfully</span>
                </div>
              )}
              {job.status === "failed" && job.error && (
                <div className="mt-2 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  <i className="bx bx-info-circle text-base mt-0.5" />
                  <span>{job.error}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
