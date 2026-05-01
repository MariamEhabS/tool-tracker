import type { ReactNode } from "react";

/** Semantic severity level controlling the Notice color scheme. */
export type NoticeVariant = "info" | "success" | "warning" | "error";

/** Props for the Notice component -- a colored banner for displaying informational, success, warning, or error messages. */
export type NoticeProps = {
  /** Severity level that determines border/background colors and default icon. Defaults to "info". */
  variant?: NoticeVariant;
  children: ReactNode;
  /** Optional content rendered on the right side of the notice (e.g., action buttons) */
  right?: ReactNode;
  className?: string;
  /** Override the default icon class for custom iconography */
  iconClassName?: string;
};

export default function Notice(props: NoticeProps) {
  const {
    variant = "info",
    children,
    right,
    className = "",
    iconClassName,
  } = props;

  const styles = (() => {
    switch (variant) {
      case "success":
        return {
          container:
            "rounded-md border border-green-600 bg-green-50 p-4 flex items-center justify-between",
          text: "text-sm text-green-800",
          icon: iconClassName ?? "bx bx-check-circle text-green-600 mr-2",
        };
      case "warning":
        return {
          container:
            "rounded-md border border-yellow-600 bg-yellow-50 p-4 flex items-center justify-between",
          text: "text-sm text-yellow-800",
          icon: iconClassName ?? "bx bx-error-circle text-yellow-600 mr-2",
        };
      case "error":
        return {
          container:
            "rounded-md border border-red-600 bg-red-50 p-4 flex items-center justify-between",
          text: "text-sm text-red-800",
          icon: iconClassName ?? "bx bx-x-circle text-red-600 mr-2",
        };
      case "info":
      default:
        return {
          container:
            "rounded-md border border-blue-600 bg-blue-50 p-4 flex items-center justify-between",
          text: "text-sm text-blue-800",
          icon: iconClassName ?? "bx bx-info-circle text-blue-600 mr-2",
        };
    }
  })();

  return (
    <div className={`${styles.container} ${className}`}>
      <div className="flex items-center">
        <i className={styles.icon}></i>
        <p className={styles.text}>{children}</p>
      </div>
      {right ? <div className="ml-3">{right}</div> : null}
    </div>
  );
}
