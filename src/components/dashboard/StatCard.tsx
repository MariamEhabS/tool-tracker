import type { ReactNode } from "react";

type StatCardProps = {
  icon: ReactNode;
  iconBgClass?: string;
  title: string;
  value: string | number;
  subtext?: string;
  subtextClass?: string;
  className?: string;
};

export default function StatCard(props: StatCardProps) {
  const {
    icon,
    iconBgClass = "bg-gray-100",
    title,
    value,
    subtext,
    subtextClass = "text-green-600",
    className = "",
  } = props;
  return (
    <div
      className={`bg-white p-6 rounded-lg shadow flex items-center ${className}`}
    >
      <div className={`mr-4 py-3.5 pb-2.5 ${iconBgClass} rounded-md px-3`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-500 mb-1 truncate">
          {title}
        </p>
        <p className="text-3xl font-semibold text-gray-900 truncate">{value}</p>
        {subtext ? (
          <p className={`text-xs mt-1 ${subtextClass}`}>{subtext}</p>
        ) : null}
      </div>
    </div>
  );
}
