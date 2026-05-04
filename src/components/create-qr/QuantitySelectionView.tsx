import { getTypeById, type TypeId } from "./typeCatalog";
import BulkQRCard from "./QuantityStep/BulkQRCard";
import SingleQRCard from "./QuantityStep/SingleQRCard";

export interface QuantitySelectionViewProps {
  typeId: TypeId;
  onBack: () => void;
  onPick: (quantity: "single" | "bulk") => void;
}

/**
 * Step 2 of the Type-first Create QR flow. Asks Single vs Bulk for a chosen
 * Type. Only rendered for dual-quantity types (Taliho Code, Tool Tracker,
 * Procore Drawing). Single-only and bulk-only types bypass this step via
 * the flow model in `create-qr.lazy.tsx`.
 *
 * Stage 4 of the Quantity Step Card Redesign swaps the original
 * type-interpolated `QuantityCard` pair for the generic
 * `<SingleQRCard />` and `<BulkQRCard />` editorial-style components.
 * The page-level heading still interpolates the type name; the cards
 * themselves are type-agnostic. The wrapping grid (1 col mobile, 2 cols
 * desktop) and surrounding screen frame (back link + heading) are
 * unchanged.
 */
export default function QuantitySelectionView({
  typeId,
  onBack,
  onPick,
}: QuantitySelectionViewProps) {
  const card = getTypeById(typeId);
  if (!card) return null;
  const typeName = card.name;

  // Stage 5 width relaxation: bump from `max-w-5xl` (1024px) to
  // `max-w-7xl` (1280px) so the redesigned cards have room to breathe
  // on standard laptop viewports. The cards are content-dense (kicker
  // + headline + lead + 5 category rows + CTA) and were rendering
  // cramped inside a 1024px column. Stack-breakpoint moves from `md:`
  // (768px) to `xl:` (1280px) — at 768–1280px tablet widths the cards
  // would have been side-by-side but cramped; stacked is the better
  // experience there.
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded"
        data-testid="quantity-back-to-type"
      >
        <i className="bx bx-chevron-left" aria-hidden="true" />
        Back to type
      </button>

      <header className="mb-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900">
          How many {typeName}s do you need?
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Pick one to get started — you can always create more later.
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        <SingleQRCard onClick={() => onPick("single")} />
        <BulkQRCard onClick={() => onPick("bulk")} />
      </div>
    </div>
  );
}
