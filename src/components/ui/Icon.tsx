import procoreIcon from "../../assets/images/procore-icon.png";
import talihoIcon from "../../assets/images/logo.png";

/** Semantic content type used to determine icon appearance and background color. */
export type RowType =
  | "file"
  | "folder"
  | "url"
  | "static"
  | "procore"
  | "procore-tool"
  | "procore-location"
  | "procore-drawing-code"
  | "active"
  | "completed"
  | "on-hold"
  | "archived"
  | "arrangement"
  | "equipment";

/** Color tone for the "rounded" icon variant. */
type IconTone =
  | "gray"
  | "blue"
  | "indigo"
  | "purple"
  | "pink"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal";

/** Props for the row-type icon variant -- renders an icon based on content type (file, folder, procore, etc.). */
type RowTypeProps = {
  /** Content type that determines the icon and background color */
  type: RowType;
  className?: string;
  /** Discriminant for the row-type variant (optional; defaults to "rowType" when "variant" key is absent) */
  variant?: "rowType";
  /** Icon container size. Defaults to "md". */
  size?: "sm" | "md" | "lg";
};

/** Props for the rounded icon variant -- renders a custom Boxicons icon with a color tone. */
type RoundedProps = {
  /** Boxicons class name, e.g., "bx bx-building-house" */
  name: string;
  className?: string;
  /** Discriminant: must be "rounded" to use this variant */
  variant: "rounded";
  /** Color tone for the icon text. Defaults to "gray". */
  tone?: IconTone;
};

/**
 * Props for the Icon component -- a polymorphic icon that renders either a content-type icon
 * (row-type variant) or a custom Boxicons icon (rounded variant) based on the `variant` prop.
 */
type IconProps = RowTypeProps | RoundedProps;

const textByTone: Record<IconTone, string> = {
  gray: "text-gray-600",
  blue: "text-blue-600",
  indigo: "text-indigo-600",
  purple: "text-purple-600",
  pink: "text-pink-600",
  red: "text-red-600",
  orange: "text-orange-600",
  yellow: "text-yellow-600",
  green: "text-green-600",
  teal: "text-teal-600",
};

export default function Icon(props: IconProps) {
  if ("variant" in props && props.variant === "rounded") {
    const { name, className = "", tone = "gray" } = props;
    const textColor = textByTone[tone];
    return <i className={`${name} ${textColor} text-2xl ${className}`}></i>;
  }

  const { type, className = "" } = props as RowTypeProps;
  const size = (props as RowTypeProps).size ?? "md";
  const isProcore =
    type === "procore" ||
    type === "procore-tool" ||
    type === "procore-location" ||
    type === "procore-drawing-code";

  const containerBg = isProcore
    ? "bg-orange-50"
    : type === "file"
      ? "bg-blue-100"
      : type === "folder"
        ? "bg-slate-300/60"
        : type === "url"
          ? "bg-green-100"
          : type === "static"
            ? "bg-gray-100"
            : type === "arrangement"
              ? "bg-indigo-100"
              : type === "equipment"
                ? "bg-red-100"
                : type === "active"
                  ? "bg-green-100"
                  : type === "completed"
                    ? "bg-blue-100"
                    : type === "on-hold"
                      ? "bg-yellow-100"
                      : type === "archived"
                        ? "bg-gray-100"
                        : "bg-gray-100";

  const iconClass =
    type === "file"
      ? "bx bx-file text-blue-600"
      : type === "folder"
        ? "bx bx-folder text-yellow-600"
        : type === "url"
          ? "bx bx-link text-green-600"
          : type === "static"
            ? "bx bx-link text-gray-600"
            : type === "arrangement"
              ? "bx bx-layer text-indigo-600"
              : type === "equipment"
                ? "bx bx-wrench text-red-600"
                : type === "active"
                  ? "bx bx-building-house text-green-600"
                  : type === "completed"
                    ? "bx bx-badge-check text-blue-600"
                    : type === "on-hold"
                      ? "bx bx-pause-circle text-yellow-600"
                      : type === "archived"
                        ? "bx bx-archive text-gray-600"
                        : "bx bx-circle text-gray-600";

  const containerSize =
    size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10";
  const imageSize =
    size === "sm" ? "h-5 w-5" : size === "lg" ? "h-7 w-7" : "h-6 w-6";
  const textSize =
    size === "sm" ? "text-lg" : size === "lg" ? "text-2xl" : "text-xl";

  return (
    <div
      className={`flex-shrink-0 ${containerSize} ${containerBg} rounded-md flex items-center justify-center ${className}`}
    >
      {isProcore ? (
        <img src={procoreIcon} alt="Procore" className={imageSize} />
      ) : type === "folder" ? (
        <img src={talihoIcon} alt="Taliho" className={imageSize} />
      ) : (
        <i className={`${iconClass} ${textSize}`}></i>
      )}
    </div>
  );
}
