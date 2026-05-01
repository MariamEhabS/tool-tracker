import type {
  ButtonHTMLAttributes,
  AnchorHTMLAttributes,
  ReactNode,
} from "react";

/**
 * Shared props for the polymorphic Button component.
 * Button renders as either a `<button>` or `<a>` depending on whether `href` is provided.
 */
type CommonProps = {
  /** Visual style variant controlling colors, sizing, and layout. Defaults to "secondary". */
  variant?:
    | "primary"
    | "secondary"
    | "clear"
    | "danger"
    | "icon"
    | "iconGhost"
    | "iconDangerGhost"
    | "filter"
    | "tab"
    | "tabActive"
    | "procoreTool"
    | "sidebarPrimary"
    | "sidebarSecondary"
    | "sidebarGeneral"
    | "iconSquare";
  /** ReactNode rendered before the button label */
  leftIcon?: ReactNode;
  /** ReactNode rendered after the button label */
  rightIcon?: ReactNode;
  /** CSS class name for a left `<i>` icon element (used when leftIcon is not provided) */
  leftIconClass?: string;
  /** CSS class name for a right `<i>` icon element (used when rightIcon is not provided) */
  rightIconClass?: string;
  className?: string;
};

/** Button props when rendered as a native `<button>` element (no href). */
type ButtonProps = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
/** Button props when rendered as an `<a>` anchor element (href is required). */
type AnchorProps = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export default function Button(props: ButtonProps | AnchorProps) {
  const {
    variant = "secondary",
    leftIcon,
    rightIcon,
    leftIconClass,
    rightIconClass,
    className = "",
    children,
    ...rest
  } = props as ButtonProps | AnchorProps;

  // Base styles avoid padding so variants can control sizing precisely
  const base =
    "rounded-md text-sm font-semibold transition duration-150 ease-in-out hover:cursor-pointer active:scale-95 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 disabled:grayscale-[30%]";

  const variants: Record<NonNullable<CommonProps["variant"]>, string> = {
    primary:
      "inline-flex items-center gap-1.5 px-3 py-2 bg-brand-500 text-white shadow-inner shadow-white/10 hover:bg-brand-600 focus:outline-none",
    secondary:
      "inline-flex items-center gap-1.5 px-3 py-2 bg-white text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50",
    clear:
      "inline-flex items-center gap-1.5 px-3 py-2 bg-white text-gray-500 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 hover:text-gray-700",
    danger:
      "inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 shadow-sm ring-1 ring-inset ring-red-200 hover:bg-red-100",
    icon: "inline-flex items-center gap-1.5 px-0.5 py-1 rounded hover:bg-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-300 text-gray-400 hover:text-gray-600",
    // Icon-only button with no background (download/edit)
    iconGhost:
      "inline-flex items-center gap-1.5 p-0.5 px-1.5 text-gray-400 hover:text-gray-600 focus:outline-none",
    // Icon-only danger (delete) with no background (red tone)
    iconDangerGhost:
      "inline-flex items-center gap-1.5 p-0.5 px-1.5 text-red-400 hover:text-red-600 focus:outline-none",
    // Filter pill-style button (matches FilterComboBox inactive state)
    filter:
      "inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
    // Tab-style button for side navigation tabs
    tab: "inline-flex items-center gap-1.5 px-3 py-2 bg-white text-gray-700 border-2 border-gray-200 hover:bg-gray-50",
    // Active tab-style button
    tabActive:
      "inline-flex items-center gap-1.5 px-3 py-2 bg-brand-50 text-brand-700 border-2 border-brand-500 font-medium",
    // Procore tool tile-style button used in ProcoreFetch tool grid
    procoreTool:
      "flex flex-col items-center justify-center text-center w-full bg-white border border-gray-200 rounded-lg p-4 py-6 hover:bg-gray-50 hover:border-gray-300",
    // Sidebar prominent primary action
    sidebarPrimary:
      "inline-flex items-center gap-2 w-full justify-start px-4 py-3 bg-brand text-white hover:bg-brand-600 shadow-md shadow-brand/20 ring-1 ring-brand-400/30",
    // Sidebar secondary action on dark background
    sidebarSecondary:
      "inline-flex items-center gap-2 w-full justify-start px-4 py-3 bg-gray-800 text-gray-100 hover:bg-gray-700 ring-1 ring-gray-700",
    // Sidebar general quick access
    sidebarGeneral:
      "inline-flex items-center gap-2 w-full justify-start px-3 py-2 text-gray-300 hover:text-brand-400 hover:bg-gray-800",
    // Square icon-only toolbar/button
    iconSquare:
      "inline-flex items-center justify-center h-10 w-10 text-brand-700 text-xl ring-inset bg-brand-50 focus:outline-none ring-2 ring-brand-400 rounded-md hover:bg-brand-100 hover:scale-104 active:scale-99",
  };

  const content = (
    <>
      {leftIcon ?? (leftIconClass ? <i className={leftIconClass}></i> : null)}
      {children}
      {rightIcon ??
        (rightIconClass ? <i className={rightIconClass}></i> : null)}
    </>
  );

  const selectedVariant = (variant ?? "secondary") as NonNullable<
    CommonProps["variant"]
  >;
  const classes = `${base} ${variants[selectedVariant]} ${className}`;

  if ("href" in (props as AnchorProps)) {
    const { href, ...anchorRest } = rest as AnchorProps;
    return (
      <a href={href} className={classes} {...anchorRest}>
        {content}
      </a>
    );
  }

  return (
    <button className={classes} {...(rest as ButtonProps)}>
      {content}
    </button>
  );
}
