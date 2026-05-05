import { useState } from "react";
import Button from "@/components/ui/Button";
import BusinessCardFlowPreview from "@/components/business-card-preview/BusinessCardFlowPreview";

interface CreateVCardV2Props {
  onBackToTypes?: () => void;
}

export default function CreateVCardV2({
  onBackToTypes,
}: CreateVCardV2Props) {
  const [previewOpen, setPreviewOpen] = useState(false);

  if (previewOpen) {
    return <BusinessCardFlowPreview onClose={() => setPreviewOpen(false)} />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
              <i className="bx bxs-contact" aria-hidden="true" />
              Business Card
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">
              Prototype flow
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">
            Create a digital business card QR
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            This branch includes the proposed Business Card experience as a
            preview flow. You can open it to walk through single, bulk, and
            created states without blocking the rest of the Create QR route.
          </p>
        </div>

        <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[1.2fr,0.8fr]">
          <section className="rounded-2xl border border-gray-200 bg-gray-50/70 p-5">
            <h2 className="text-base font-semibold text-gray-900">
              What the preview covers
            </h2>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <p>
                Single-card setup for one person's contact details.
              </p>
              <p>
                Bulk flow concepts for project-directory driven generation.
              </p>
              <p>
                Mock created and scanned states for the mobile contact card.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
            <h2 className="text-base font-semibold text-gray-900">
              Next step
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Open the interactive preview to review the current prototype, or
              head back to the type picker and continue with another QR flow.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="primary"
                onClick={() => setPreviewOpen(true)}
                rightIconClass="bx bx-right-arrow-alt"
              >
                Open business card preview
              </Button>
              {onBackToTypes ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onBackToTypes}
                  leftIconClass="bx bx-left-arrow-alt"
                >
                  Back to types
                </Button>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
