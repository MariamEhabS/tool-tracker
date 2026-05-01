import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

type ProjectCardProps = {
  to: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  pill?: string;
  iconWrapClass?: string;
};

export default function ProjectCard(props: ProjectCardProps) {
  const {
    to,
    icon,
    title,
    subtitle,
    pill,
    iconWrapClass = "bg-blue-100",
  } = props;
  return (
    <Link
      to={to}
      className="bg-gray-white rounded-lg shadow-sm hover:bg-gray-100 hover:shadow transition duration-150 ease-in-out overflow-hidden cursor-pointer"
    >
      <div className={`${iconWrapClass} p-3 flex justify-center`}>
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white text-blue-600">
          {icon}
        </div>
      </div>
      <div className="p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-1 truncate">
          {title}
        </h4>
        {subtitle ? (
          <p className="text-xs text-gray-500 mb-3 truncate">{subtitle}</p>
        ) : null}
        <div className="flex items-center justify-between">
          {pill ? (
            <span className="text-xs font-medium text-gray-700 bg-gray-200 px-2 py-0.5 rounded-full truncate">
              {pill}
            </span>
          ) : (
            <span />
          )}
          <i className="bx bx-chevron-right text-gray-400"></i>
        </div>
      </div>
    </Link>
  );
}
