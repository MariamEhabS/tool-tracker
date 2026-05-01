/**
 * Color variant for Badge UI components.
 *
 * Each variant maps to a distinct background/text color pair in the Badge component.
 * Common semantic usage:
 * - 'green': active / success (e.g., active project status)
 * - 'yellow': warning / on-hold (e.g., on-hold project status)
 * - 'red': error / equipment grouping badge
 * - 'blue': info / file type / arrangement grouping badge / completed project status
 * - 'orange': Procore-related items (e.g., procore-tool, procore-drawing QR types)
 * - 'gray': neutral / unassigned / archived
 * - 'indigo': arrangement type grouping / static QR type
 * - 'slate': Taliho-local / folder QR type
 * - 'cyan': completed project status (alternate badge helper)
 * - 'purple', 'pink', 'teal': available for future use
 */
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

/** Data structure for rendering a Badge component in the UI */
export type BadgeData = {
  /** Text displayed inside the badge (e.g., project name, status label, group name) */
  label: string;
  /** Color variant controlling the badge's visual appearance */
  variant: BadgeVariant;
  /** Optional navigation link; when provided the badge renders as a clickable link */
  href?: string;
};
