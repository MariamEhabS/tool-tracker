import type { ReactNode } from "react";
// import Badge from '@/components/ui/Badge'
import type { BadgeVariant } from "@/types/Badge.types";
import { styles } from "@/lib/classnames";
import { BadgeShape } from "./Badge";

/** Props for the ItemCard component -- a clickable card for displaying an item with an icon, title, and optional metadata. */
type ItemCardProps = {
  /** Icon element displayed on the left side of the card */
  icon: ReactNode;
  /** Additional CSS classes for the icon container */
  iconContainerClassName?: string;
  /** Primary text label */
  title: string;
  /** Optional secondary text below the title */
  subtitle?: string;
  onClick?: () => void;
  className?: string;
  /** Layout variant: "list" for compact rows, "largeTile" for larger items, "selectionTile" for highlighted selectable cards. Defaults to "list". */
  variant?: "list" | "largeTile" | "selectionTile";
  /** Optional tag text (currently unused in render) */
  tag?: string;
  /** Custom ReactNode rendered on the right side; replaces the default chevron icon */
  rightIcon?: ReactNode;
  /** When true, hides the right-side icon/chevron entirely. Defaults to false. */
  suppressRightIcon?: boolean;
  /** Optional status badge label text (currently unused in render) */
  statusLabel?: string;
  /** Color variant for the status badge */
  statusVariant?: BadgeVariant;
  /** Shape variant for the status badge */
  statusShape?: BadgeShape;
};

// const backgroundByVariant: Record<BadgeVariant, string> = {
//   gray: 'bg-gray-200 text-gray-700',
// 	slate: 'bg-slate-200 text-slate-700',
//   blue: 'bg-blue-100 text-blue-700',
//   cyan: 'bg-cyan-100 text-cyan-700',
//   indigo: 'bg-indigo-100 text-indigo-700',
//   purple: 'bg-purple-100 text-purple-700',
//   pink: 'bg-pink-100 text-pink-700',
//   red: 'bg-red-100 text-red-700',
//   orange: 'bg-orange-100 text-orange-700',
//   yellow: 'bg-yellow-100 text-yellow-700',
//   green: 'bg-green-100 text-green-700',
//   teal: 'bg-teal-100 text-teal-700',
// }

export default function ItemCard(props: ItemCardProps) {
  const {
    icon,
    iconContainerClassName = "",
    title,
    subtitle,
    onClick,
    className = "",
    variant = "list",
    rightIcon,
    suppressRightIcon = false,
  } = props;

  if (variant === "selectionTile") {
    return (
      <div
        className={`text-left ${styles.tilePanel} bg-brand-50 ring-1 ring-brand-400 !border-brand-400 backdrop-blur-md shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer active:scale-99 ${className}`}
        onClick={onClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex-shrink-0 rounded-lg p-4 bg-brand-100 text-brand-700 flex items-center justify-center border border-brand-500 ring-1 ring-brand-500 ${iconContainerClassName}`}
            >
              {icon}
            </div>
            <div className="flex flex-col ">
              <h4 className="text-sm font-medium text-gray-900">{title}</h4>
              {subtitle && (
                <p className="mt-1 text-xs text-gray-600">{subtitle}</p>
              )}
            </div>
          </div>
          {!suppressRightIcon ? (
            <div className="ml-4">
              {rightIcon ? (
                rightIcon
              ) : (
                <i className="bx bx-chevron-right text-gray-400 text-2xl"></i>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (variant === "largeTile") {
    return (
      <div
        className={`flex items-center justify-between ${className} bg-gray-50 rounded-lg hover:bg-gray-100 transition duration-150 ease-in-out cursor-pointer`}
      >
        <div className="flex items-center min-w-0">
          <div
            className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-md ${iconContainerClassName}`}
          >
            {icon}
          </div>
          <div className="ml-4 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 truncate">
              {title}
            </h4>
            {subtitle ? (
              <p className="text-xs text-gray-500 truncate">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <i className="bx bx-chevron-right text-gray-400"></i>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition duration-150 ease-in-out cursor-pointer border border-gray-200 ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center min-w-0">
        <div
          className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-md ${iconContainerClassName}`}
        >
          {icon}
        </div>
        <div className="ml-4 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate">
            {title}
          </h4>
          {subtitle ? (
            <p className="text-xs text-gray-500 truncate">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {!suppressRightIcon ? (
        <div className="ml-4">
          {rightIcon ? (
            rightIcon
          ) : (
            <i className="bx bx-chevron-right text-gray-400"></i>
          )}
        </div>
      ) : null}
    </div>
  );
}
