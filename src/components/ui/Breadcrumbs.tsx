import type { HTMLAttributes } from "react";

/** A single breadcrumb item with a display label and optional navigation href. */
type Crumb = {
  /** Display text for this breadcrumb segment */
  label: string;
  /** Optional URL for link-based navigation; when omitted with onCrumbClick, renders as a button */
  href?: string;
};

/** Props for the Breadcrumbs component -- a navigation trail showing the current page hierarchy. */
type BreadcrumbsProps = HTMLAttributes<HTMLElement> & {
  /** Visual style variant: "parent" for top-level navigation, "folder" for folder-based hierarchy. Defaults to "parent". */
  variant?: "parent" | "folder";
  /** Ordered list of breadcrumb segments from root to current location */
  items: Crumb[];
  /** Optional click handler for crumb navigation; when provided, non-last crumbs are rendered as buttons */
  onCrumbClick?: (index: number) => void;
};

function SeparatorIcon() {
  return (
    <svg
      className="h-4 w-4 text-gray-400"
      fill="currentColor"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M7.293 14.707a1 1 0 0 1 0-1.414L10.586 10 7.293 6.707a1 1 0 0 1 1.414-1.414l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function Breadcrumbs(props: BreadcrumbsProps) {
  const {
    variant = "parent",
    items,
    onCrumbClick,
    className = "",
    ...rest
  } = props;
  const isFolder = variant === "folder";
  const navLabel = isFolder ? "FolderBreadcrumb" : "Breadcrumb";
  const listClass = isFolder
    ? "flex items-center space-x-1 text-sm"
    : "flex items-center space-x-1 text-xs";

  if (isFolder) {
    return (
      <nav className={`flex ${className}`} aria-label={navLabel} {...rest}>
        <ol className={listClass}>
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={`${item.label}-${index}`} className="flex items-center">
                {index > 0 && <SeparatorIcon />}
                {item.href && !isLast ? (
                  <a
                    href={item.href}
                    onClick={
                      onCrumbClick
                        ? (e) => {
                            e.preventDefault();
                            onCrumbClick(index);
                          }
                        : undefined
                    }
                    className="ml-1 text-gray-500 hover:text-gray-700"
                  >
                    {item.label}
                  </a>
                ) : !isLast && onCrumbClick ? (
                  <button
                    type="button"
                    onClick={() => onCrumbClick(index)}
                    className="ml-1 text-gray-500 hover:text-gray-700"
                  >
                    {item.label}
                  </button>
                ) : (
                  <span
                    className="ml-1 text-gray-800 font-medium"
                    aria-current="page"
                  >
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  return (
    <nav className={`flex ${className}`} aria-label={navLabel} {...rest}>
      <ol className={listClass}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          if (index === 0) {
            return (
              <li key={`${item.label}-${index}`} className="text-gray-500">
                {item.href && !isLast ? (
                  <a href={item.href} className="hover:text-gray-700">
                    {item.label}
                  </a>
                ) : (
                  <span
                    className="text-gray-800 font-medium"
                    aria-current="page"
                  >
                    {item.label}
                  </span>
                )}
              </li>
            );
          }
          return (
            <li key={`${item.label}-${index}`} className="flex items-center">
              <SeparatorIcon />
              {item.href && !isLast ? (
                <a
                  href={item.href}
                  className="ml-1 text-gray-500 hover:text-gray-700"
                >
                  {item.label}
                </a>
              ) : (
                <span
                  className="ml-1 text-gray-800 font-medium"
                  aria-current="page"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
