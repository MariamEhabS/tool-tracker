/**
 * AnimatedProgressBar component for storage visualization
 * Displays dual-bar progress (documents + QR codes) with smooth Framer Motion animations
 */

import { motion } from "framer-motion";

export interface AnimatedProgressBarProps {
  /** Document storage percentage (0-100) */
  documentPercentage: number;
  /** QR code storage percentage (0-100) */
  qrPercentage: number;
  /** Document storage used in GB */
  documentUsedGB: number;
  /** QR code storage used in GB */
  qrUsedGB: number;
  /** Total storage capacity in GB */
  totalCapGB: number;
}

// Check if user prefers reduced motion
const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Get the appropriate color class based on the combined storage percentage
 * @param combinedPercentage - Total percentage of storage used (0-100)
 * @returns Tailwind CSS class for the bar color
 */
function getDocumentBarColor(combinedPercentage: number): string {
  if (combinedPercentage >= 100) {
    return "bg-red-500";
  }
  if (combinedPercentage >= 90) {
    return "bg-orange-500";
  }
  if (combinedPercentage >= 80) {
    return "bg-yellow-500";
  }
  return "bg-blue-600";
}

/**
 * Get the appropriate color class for QR bar based on the combined storage percentage
 * @param combinedPercentage - Total percentage of storage used (0-100)
 * @returns Tailwind CSS class for the QR bar color
 */
function getQrBarColor(combinedPercentage: number): string {
  if (combinedPercentage >= 100) {
    return "bg-red-400";
  }
  if (combinedPercentage >= 90) {
    return "bg-orange-400";
  }
  if (combinedPercentage >= 80) {
    return "bg-yellow-400";
  }
  return "bg-yellow-400";
}

/**
 * Get the legend square color for documents
 */
function getDocumentLegendColor(combinedPercentage: number): string {
  if (combinedPercentage >= 100) {
    return "bg-red-500";
  }
  if (combinedPercentage >= 90) {
    return "bg-orange-500";
  }
  if (combinedPercentage >= 80) {
    return "bg-yellow-500";
  }
  return "bg-blue-600";
}

/**
 * Get the legend square color for QR codes
 */
function getQrLegendColor(combinedPercentage: number): string {
  if (combinedPercentage >= 100) {
    return "bg-red-400";
  }
  if (combinedPercentage >= 90) {
    return "bg-orange-400";
  }
  if (combinedPercentage >= 80) {
    return "bg-yellow-400";
  }
  return "bg-yellow-400";
}

export function AnimatedProgressBar({
  documentPercentage,
  qrPercentage,
  documentUsedGB,
  qrUsedGB,
  totalCapGB,
}: AnimatedProgressBarProps) {
  // Calculate combined percentage for warning color states
  const combinedPercentage = documentPercentage + qrPercentage;

  // Animation duration (respect reduced motion preference)
  const animationDuration = prefersReducedMotion ? 0 : 0.8;

  // Get color classes based on combined percentage
  const documentBarColor = getDocumentBarColor(combinedPercentage);
  const qrBarColor = getQrBarColor(combinedPercentage);
  const documentLegendColor = getDocumentLegendColor(combinedPercentage);
  const qrLegendColor = getQrLegendColor(combinedPercentage);

  // Determine if document bar should have rounded-r (when QR percentage is 0)
  const documentRounding =
    qrPercentage === 0 ? "rounded-l rounded-r" : "rounded-l";

  return (
    <div className="w-full">
      {/* Progress bar container */}
      <div
        className="flex w-full bg-gray-200 rounded-full overflow-hidden h-4"
        role="progressbar"
        aria-valuenow={Math.round(combinedPercentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Storage usage: ${combinedPercentage.toFixed(1)}% used`}
      >
        {/* Document storage bar */}
        <motion.div
          className={`${documentBarColor} h-full ${documentRounding}`}
          initial={{ width: 0 }}
          animate={{ width: `${documentPercentage}%` }}
          transition={{
            duration: animationDuration,
            ease: "easeOut",
          }}
          title={`Documents & Files: ${documentUsedGB.toFixed(2)} GB (${documentPercentage.toFixed(1)}%)`}
          data-testid="document-bar"
        />

        {/* QR code storage bar */}
        {qrPercentage > 0 && (
          <motion.div
            className={`${qrBarColor} h-full`}
            initial={{ width: 0 }}
            animate={{ width: `${qrPercentage}%` }}
            transition={{
              duration: animationDuration,
              ease: "easeOut",
              delay: prefersReducedMotion ? 0 : 0.2,
            }}
            title={`QR Code Images: ${qrUsedGB.toFixed(2)} GB (${qrPercentage.toFixed(1)}%)`}
            data-testid="qr-bar"
          />
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-col gap-1.5 text-xs">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 ${documentLegendColor} rounded`}
            data-testid="document-legend-square"
          />
          <span className="text-gray-600">
            Documents & Files: {documentUsedGB.toFixed(2)} GB (
            {documentPercentage.toFixed(1)}%)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 ${qrLegendColor} rounded`}
            data-testid="qr-legend-square"
          />
          <span className="text-gray-600">
            QR Code Images: {qrUsedGB.toFixed(2)} GB ({qrPercentage.toFixed(1)}
            %)
          </span>
        </div>
      </div>

      {/* Total capacity info */}
      <div className="mt-2 text-xs text-gray-500">
        Total capacity: {totalCapGB.toFixed(2)} GB
      </div>
    </div>
  );
}

export default AnimatedProgressBar;
