import type { CSSProperties } from "react";
import CategoryRow from "./CategoryRow";
import QRMotifSingle from "./QRMotifSingle";
import {
  CATEGORY_DEFINITIONS,
  SINGLE_CATEGORY_CONTENT,
  SINGLE_CTA_LABEL,
  SINGLE_HEADLINE,
  SINGLE_KICKER,
  SINGLE_LEAD,
} from "./quantityStepCopy";

/**
 * `SingleQRCard` (Quantity Step Card Redesign Stage 2).
 *
 * Editorial-style card composed of:
 *   - top header: kicker + headline (with italic counterpoint) on the
 *     left, `QRMotifSingle` graphic on the right (1fr × 120px grid)
 *   - hard 1px ink rule
 *   - lead paragraph
 *   - five `CategoryRow`s in the locked Knowledge / Action / Logging /
 *     Identity / Project order
 *   - full-width amber CTA at the bottom
 *
 * All copy comes from `quantityStepCopy.ts` — no inline strings. The
 * card itself only takes an `onClick` prop; routing logic stays in the
 * parent route per Stage 0 recon.
 */

interface SingleQRCardProps {
  onClick: () => void;
}

/**
 * Layered card background per PRD §5.1: an amber radial bloom from
 * the upper-right (the dominant warmth), a softer secondary glow at
 * the lower-left, then the white-to-amber-tint linear base. Split
 * across `backgroundImage` (gradient stack) and `backgroundColor`
 * (the lightened final stop) — using the `background` shorthand
 * works in real browsers but jsdom drops the value in tests, so we
 * reach for the longhand props which round-trip cleanly.
 */
const CARD_BACKGROUND: CSSProperties = {
  backgroundImage:
    "radial-gradient(900px 400px at 100% 0%, rgba(245,158,11,0.20), transparent 55%), " +
    "radial-gradient(500px 250px at 0% 100%, rgba(245,158,11,0.08), transparent 60%), " +
    "linear-gradient(180deg, #ffffff 0%, #fffbeb 100%)",
  backgroundColor: "#fffbeb",
  boxShadow:
    "0 18px 40px -12px rgba(17,24,39,0.18), 0 4px 14px rgba(17,24,39,0.06)",
};

export default function SingleQRCard({ onClick }: SingleQRCardProps) {
  return (
    <article
      className="rounded-[18px] border border-[#fde9c2] p-7 flex flex-col gap-[14px] relative overflow-hidden"
      style={CARD_BACKGROUND}
      data-testid="single-qr-card"
    >
      <header
        className="grid grid-cols-[1fr_120px] gap-[18px] items-start"
        data-testid="single-qr-card-top"
      >
        <div>
          <div
            className="font-display-mono text-[11px] uppercase tracking-[0.14em] text-amber-700 font-semibold"
            data-testid="single-qr-card-kicker"
          >
            {SINGLE_KICKER}
          </div>
          <h3
            className="font-display text-[30px] font-extrabold tracking-[-0.03em] leading-[1.1] mt-2 text-gray-900"
            data-testid="single-qr-card-headline"
          >
            {SINGLE_HEADLINE.lead}{" "}
            <em
              className="font-normal italic text-amber-700"
              data-testid="single-qr-card-headline-counterpoint"
            >
              {SINGLE_HEADLINE.counterpoint}
            </em>
          </h3>
        </div>
        <QRMotifSingle />
      </header>

      <div
        className="h-px bg-gray-900 my-1"
        aria-hidden="true"
        data-testid="single-qr-card-rule"
      />

      <p
        className="text-[14px] leading-[1.65] text-gray-700"
        data-testid="single-qr-card-lead"
      >
        {SINGLE_LEAD}
      </p>

      <div
        className="flex flex-col gap-[14px]"
        data-testid="single-qr-card-categories"
      >
        {CATEGORY_DEFINITIONS.map((definition, idx) => (
          <CategoryRow
            key={definition.key}
            definition={definition}
            content={SINGLE_CATEGORY_CONTENT[definition.key]}
            isLast={idx === CATEGORY_DEFINITIONS.length - 1}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onClick}
        className="mt-auto w-full inline-flex items-center justify-center gap-2 px-[18px] py-[14px] bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-[15px] rounded-[12px] transition-colors min-h-[44px]"
        data-testid="single-qr-card-cta"
      >
        <i className="bx bx-plus text-lg" aria-hidden="true" />
        {SINGLE_CTA_LABEL}
      </button>
    </article>
  );
}
