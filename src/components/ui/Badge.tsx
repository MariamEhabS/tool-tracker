import type { HTMLAttributes } from "react";

/** Available color variants for the Badge component. */
export type BadgeVariant =
  | "gray"
  | "slate"
  | "blue"
  | "indigo"
  | "purple"
  | "pink"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "cyan";

/** Border radius shape for the Badge: "md" for rounded-md, "full" for pill shape. */
export type BadgeShape = "md" | "full";

/** Props for the Badge component -- a colored label used for status indicators, tags, and categories. */
type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  /** Color theme of the badge. Defaults to "gray". */
  variant?: BadgeVariant;
  /** Border radius shape. "md" for rounded corners, "full" for pill shape. Defaults to "md". */
  shape?: BadgeShape;
};

const base =
  "inline-flex items-center px-2 py-0.5 text-xs font-medium text-center";

const colorByVariant: Record<BadgeVariant, string> = {
  gray: "bg-gray-100 text-gray-700",
  slate: "bg-slate-200 text-slate-700",
  blue: "bg-blue-100 text-blue-700",
  indigo: "bg-indigo-100 text-indigo-700",
  purple: "bg-purple-100 text-purple-700",
  pink: "bg-pink-100 text-pink-700",
  red: "bg-red-100 text-red-700",
  orange: "bg-orange-100 text-orange-700",
  yellow: "bg-yellow-100 text-yellow-700",
  green: "bg-green-100 text-green-700",
  teal: "bg-teal-100 text-teal-700",
  cyan: "bg-cyan-100 text-cyan-700",
};

export default function Badge(props: BadgeProps) {
  const {
    variant = "gray",
    shape = "md",
    className = "",
    children,
    ...rest
  } = props;
  const radius = shape === "full" ? "rounded-full" : "rounded-md";
  const color = colorByVariant[variant];
  return (
    <span className={`${base} ${radius} ${color} ${className}`} {...rest}>
      {children}
    </span>
  );
}
