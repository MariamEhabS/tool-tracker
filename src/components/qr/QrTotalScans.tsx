import type { ReactNode } from "react";

type TotalScansProps = {
  title?: string;
  total: number | string;
  subtitle?: string;
  chartData: number[];
  leftLabel?: ReactNode;
  rightLabel?: ReactNode;
  className?: string;
  /** Optional placeholder to overlay the chart area */
  placeholderText?: string;
};

export default function TotalScans(props: TotalScansProps) {
  const {
    title = "Total Scans",
    total,
    subtitle = "Scan Activity (Last 30 Days)",
    chartData,
    leftLabel = "30 Days Ago",
    rightLabel = "Today",
    className = "",
    placeholderText,
  } = props;

  return (
    <div className={`bg-white p-6 rounded-lg shadow ${className}`}>
      <div className="mb-4">
        <h3 className="text-base font-semibold leading-6 text-gray-900">
          {title}
        </h3>
        <p className="text-3xl font-semibold text-gray-900 mt-1">{total}</p>
        <p className="text-sm text-gray-500 mt-2">{subtitle}</p>
      </div>
      <div className="h-20 bg-gray-50 rounded flex items-end justify-between px-1 py-1 border border-gray-200 relative">
        {placeholderText ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-gray-400">{placeholderText}</span>
          </div>
        ) : (
          chartData.map((h, i) => (
            <div
              key={i}
              className="w-4 bg-green-500 rounded-t"
              style={{ height: `${h}%` }}
            />
          ))
        )}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}
