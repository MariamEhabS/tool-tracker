import type { HTMLAttributes } from "react";

/** Props for the ResultsSummary component -- displays "Showing X to Y of Z results" text. */
type ResultsSummaryProps = {
  /** First item number on the current page (1-based) */
  start: number;
  /** Last item number on the current page */
  end: number;
  /** Total number of items across all pages */
  total: number;
} & HTMLAttributes<HTMLParagraphElement>;

export default function ResultsSummary(props: ResultsSummaryProps) {
  const { start, end, total, className = "", ...rest } = props;
  return (
    <p className={`text-sm text-gray-700 ${className}`} {...rest}>
      Showing <span className="font-medium">{start}</span> to{" "}
      <span className="font-medium">{end}</span> of{" "}
      <span className="font-medium">{total}</span> results
    </p>
  );
}
