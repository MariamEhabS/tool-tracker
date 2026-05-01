import type { BulkMethod } from "./typeMapping";

export interface BulkMethodSelectionViewProps {
  onBack: () => void;
  onPick: (method: BulkMethod) => void;
}

interface MethodDef {
  id: BulkMethod;
  name: string;
  icon: string;
  description: string;
}

const METHODS: readonly MethodDef[] = [
  {
    id: "assorted",
    name: "Assorted Group",
    icon: "bx bxs-folder",
    description: "Mix different types of QR codes into one collection.",
  },
  {
    id: "prefix-quantity",
    name: "Prefix + Quantity",
    icon: "bx bxs-hash",
    description: "Generate a sequential series like AHU-1 through AHU-100.",
  },
  {
    id: "upload-csv",
    name: "Upload CSV",
    icon: "bx bxs-spreadsheet",
    description: "Import a spreadsheet to create many codes at once.",
  },
  {
    id: "manual-entry",
    name: "Manual Entry",
    icon: "bx bxs-pencil",
    description: "Type individual items to generate codes one row at a time.",
  },
];

/**
 * Step 2.5 of the Type-first Create QR flow. Shown only for
 * Taliho Code → Bulk — asks which data-entry method to use. Each method card
 * routes to an existing Configure form (ConfigureBulkGroup or
 * ConfigureBulkDrawings) via the legacy (tab, sub, method) URL triple.
 */
export default function BulkMethodSelectionView({
  onBack,
  onPick,
}: BulkMethodSelectionViewProps) {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded"
        data-testid="method-back-to-quantity"
      >
        <i className="bx bx-chevron-left" aria-hidden="true" />
        Back to quantity
      </button>

      <header className="mb-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900">
          How do you want to add the Taliho Codes?
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Pick the way that matches where your data lives today.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {METHODS.map((method) => (
          <MethodCard
            key={method.id}
            method={method}
            onClick={() => onPick(method.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface MethodCardProps {
  method: MethodDef;
  onClick: () => void;
}

function MethodCard({ method, onClick }: MethodCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-2xl border border-gray-200 bg-white/80 backdrop-blur p-6 flex flex-col transition-all duration-150 hover:shadow-lg hover:-translate-y-0.5 hover:border-yellow-200 cursor-pointer active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      data-testid={`method-card-${method.id}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 rounded-lg bg-brand-100 text-brand-700 w-12 h-12 flex items-center justify-center border border-brand-300">
          <i className={`${method.icon} text-2xl`} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-base font-semibold text-gray-900">
            {method.name}
          </h4>
          <p className="mt-1 text-xs text-gray-600 leading-relaxed">
            {method.description}
          </p>
        </div>
        <i
          className="bx bx-chevron-right text-gray-400 text-xl mt-1 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
    </button>
  );
}
