import Button from "@/components/ui/Button";
import { getTypeById, type TypeId } from "./typeCatalog";

export interface QuantitySelectionViewProps {
  typeId: TypeId;
  onBack: () => void;
  onPick: (quantity: "single" | "bulk") => void;
}

const SINGLE_BEST_FOR = [
  "A new item just created",
  "Replacing a damaged label",
  "One-off additions",
];

const BULK_BEST_FOR = [
  "Outfitting a new crew or project",
  "Large rollouts in one pass",
  "Anything that exists in a spreadsheet",
];

/**
 * Step 2 of the Type-first Create QR flow. Asks Single vs Bulk for a chosen
 * Type. Only rendered for dual-quantity types (Taliho Code, Tool Tracker,
 * Procore Drawing). Single-only and bulk-only types bypass this step via
 * the flow model in `create-qr.lazy.tsx`.
 */
export default function QuantitySelectionView({
  typeId,
  onBack,
  onPick,
}: QuantitySelectionViewProps) {
  const card = getTypeById(typeId);
  if (!card) return null;
  const typeName = card.name;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <QuantityCard
          testIdPrefix="quantity-card-single"
          iconClass={card.icon}
          title={`Single ${typeName}`}
          description={`Create one ${typeName} that points to a single destination.`}
          bestFor={SINGLE_BEST_FOR}
          buttonLabel={`Create a Single ${typeName}`}
          onClick={() => onPick("single")}
        />
        <QuantityCard
          testIdPrefix="quantity-card-bulk"
          iconClass="bx bx-collection"
          title={`Bulk ${typeName}s`}
          description={`Generate multiple ${typeName}s at once.`}
          bestFor={BULK_BEST_FOR}
          buttonLabel={`Create Bulk ${typeName}s`}
          onClick={() => onPick("bulk")}
        />
      </div>
    </div>
  );
}

interface QuantityCardProps {
  testIdPrefix: string;
  iconClass: string;
  title: string;
  description: string;
  bestFor: string[];
  buttonLabel: string;
  onClick: () => void;
}

function QuantityCard({
  testIdPrefix,
  iconClass,
  title,
  description,
  bestFor,
  buttonLabel,
  onClick,
}: QuantityCardProps) {
  return (
    <article
      className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur p-6 flex flex-col transition-all duration-150 hover:shadow-lg hover:-translate-y-0.5 hover:border-yellow-200"
      data-testid={testIdPrefix}
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-shrink-0 rounded-lg bg-brand-100 text-brand-700 w-12 h-12 flex items-center justify-center border border-brand-300">
          <i className={`${iconClass} text-2xl`} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-base font-semibold text-gray-900">{title}</h4>
          <p className="mt-1 text-xs text-gray-600 leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Best for
        </p>
        <ul
          className="mt-2 space-y-1.5 text-xs text-gray-600"
          data-testid={`${testIdPrefix}-best-for`}
        >
          {bestFor.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-brand-500 mt-0.5" aria-hidden="true">
                •
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <Button
        variant="primary"
        onClick={onClick}
        className="w-full justify-center"
        data-testid={`${testIdPrefix}-submit`}
      >
        {buttonLabel}
      </Button>
    </article>
  );
}
