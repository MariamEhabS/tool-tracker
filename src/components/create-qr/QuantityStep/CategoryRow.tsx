import type {
  CategoryContent,
  CategoryDefinition,
} from "./quantityStepCopy";

/**
 * Shared category-row primitive used by both `SingleQRCard` and
 * `BulkQRCard` (Quantity Step Card Redesign Stage 1).
 *
 * Layout: 110px-fixed left column for the small uppercase color-coded
 * label, 1fr right column for the bold examples + tagline. A 1px
 * bottom hairline separates rows; the last row in a stack receives
 * `isLast` to suppress its border (and the bottom padding that
 * accompanies it) so the card's own padding controls the bottom gap
 * instead of an orphan rule.
 */

interface CategoryRowProps {
  definition: CategoryDefinition;
  content: CategoryContent;
  /**
   * True for the last row in a category stack. Suppresses the
   * bottom hairline + bottom padding so the card's footer area
   * doesn't gain an extra orphan rule.
   */
  isLast?: boolean;
}

/**
 * Resolves the locked color tokens to Tailwind utility classes. The
 * tokens are typed in `quantityStepCopy.ts` so any divergence from
 * the locked palette becomes a typecheck error before this map gets
 * involved.
 */
const COLOR_TOKEN_TO_CLASS = {
  "amber-700": "text-amber-700",
  "green-700": "text-green-700",
  "indigo-700": "text-indigo-700",
  "violet-700": "text-violet-700",
  "teal-700": "text-teal-700",
} as const;

export default function CategoryRow({
  definition,
  content,
  isLast = false,
}: CategoryRowProps) {
  const colorClass = COLOR_TOKEN_TO_CLASS[definition.colorToken];
  return (
    <div
      className={`grid grid-cols-[110px_1fr] gap-4 items-start ${
        isLast ? "" : "pb-3 border-b border-gray-200"
      }`}
      data-testid={`category-row-${definition.key}`}
    >
      <div
        className={`text-[11px] font-bold uppercase tracking-[0.12em] pt-px ${colorClass}`}
        data-testid={`category-row-${definition.key}-label`}
      >
        {definition.label}
      </div>
      <div
        className="text-[13px] leading-snug text-gray-700"
        data-testid={`category-row-${definition.key}-content`}
      >
        <strong className="text-gray-900 font-bold">
          {content.examples}
        </strong>{" "}
        — {content.description}
      </div>
    </div>
  );
}
