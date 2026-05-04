import type { CSSProperties } from "react";
import CategoryRow from "./CategoryRow";
import QRMotifStack from "./QRMotifStack";
import {
  BULK_CATEGORY_CONTENT,
  BULK_CTA_LABEL,
  BULK_HEADLINE,
  BULK_KICKER,
  BULK_LEAD,
  CATEGORY_DEFINITIONS,
} from "./quantityStepCopy";

/**
 * `BulkQRCard` (Quantity Step Card Redesign Stage 3).
 *
 * Mirror of `SingleQRCard` with bulk-specific content. Same layout
 * primitives — header (kicker + headline with italic counterpoint +
 * QR motif right), hard rule, lead paragraph, five category rows,
 * full-width amber CTA. The differences are the QR motif (`QRMotifStack`
 * instead of `QRMotifSingle`), the copy (kicker / headline / lead /
 * category examples / CTA label), and the CTA icon (`bx-grid-alt` vs
 * `bx-plus`).
 *
 * The QR motif renders top-right to mirror Single exactly — the visual
 * pair only reads as a true pair when the motif positions match (PRD
 * §4 Stage 3).
 *
 * All copy comes from `quantityStepCopy.ts` — no inline strings. The
 * card itself only takes an `onClick` prop; routing logic stays in the
 * parent route per Stage 0 recon.
 */

interface BulkQRCardProps {
  onClick: () => void;
}

/**
 * Same gradient stack as `SingleQRCard` — the cards visibly read as a
 * pair when placed side-by-side. Split into longhand
 * `backgroundImage` + `backgroundColor` because jsdom drops the
 * shorthand `background` value when it carries multiple gradients
 * (see Stage 2 §13 Q11). Real browsers parse both correctly.
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

export default function BulkQRCard({ onClick }: BulkQRCardProps) {
  return (
    <article
      className="rounded-[18px] border border-[#fde9c2] p-7 flex flex-col gap-[14px] relative overflow-hidden"
      style={CARD_BACKGROUND}
      data-testid="bulk-qr-card"
    >
      <header
        className="grid grid-cols-[1fr_120px] gap-[18px] items-start"
        data-testid="bulk-qr-card-top"
      >
        <div>
          <div
            className="font-display-mono text-[11px] uppercase tracking-[0.14em] text-amber-700 font-semibold"
            data-testid="bulk-qr-card-kicker"
          >
            {BULK_KICKER}
          </div>
          <h3
            className="font-display text-[30px] font-extrabold tracking-[-0.03em] leading-[1.1] mt-2 text-gray-900"
            data-testid="bulk-qr-card-headline"
          >
            {BULK_HEADLINE.lead}{" "}
            <em
              className="font-normal italic text-amber-700"
              data-testid="bulk-qr-card-headline-counterpoint"
            >
              {BULK_HEADLINE.counterpoint}
            </em>
          </h3>
        </div>
        <QRMotifStack />
      </header>

      <div
        className="h-px bg-gray-900 my-1"
        aria-hidden="true"
        data-testid="bulk-qr-card-rule"
      />

      <p
        className="text-[14px] leading-[1.65] text-gray-700"
        data-testid="bulk-qr-card-lead"
      >
        {BULK_LEAD}
      </p>

      <div
        className="flex flex-col gap-[14px]"
        data-testid="bulk-qr-card-categories"
      >
        {CATEGORY_DEFINITIONS.map((definition, idx) => (
          <CategoryRow
            key={definition.key}
            definition={definition}
            content={BULK_CATEGORY_CONTENT[definition.key]}
            isLast={idx === CATEGORY_DEFINITIONS.length - 1}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onClick}
        className="mt-auto w-full inline-flex items-center justify-center gap-2 px-[18px] py-[14px] bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-[15px] rounded-[12px] transition-colors min-h-[44px]"
        data-testid="bulk-qr-card-cta"
      >
        <i className="bx bx-grid-alt text-lg" aria-hidden="true" />
        {BULK_CTA_LABEL}
      </button>
    </article>
  );
}
