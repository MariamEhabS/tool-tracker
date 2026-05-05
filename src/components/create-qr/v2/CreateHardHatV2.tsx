import Button from "@/components/ui/Button";

interface CreateHardHatV2Props {
  onBackToTypes?: () => void;
}

const INCLUDED_SECTIONS = [
  "Worker identity and role details",
  "Credential status with expiration tracking",
  "Emergency contact and safety notes",
  "Document uploads for certifications and inspections",
];

export default function CreateHardHatV2({
  onBackToTypes,
}: CreateHardHatV2Props) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(249,250,251,0.9))] px-6 py-7 sm:px-8">
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">
              <i className="bx bxs-hard-hat" aria-hidden="true" />
              Hard Hat
            </span>
            <span className="rounded-full bg-white/80 px-3 py-1 font-medium text-gray-600 ring-1 ring-gray-200">
              Route shell restored
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">
            Hard Hat QR flow is scaffolded in this branch
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-700">
            The type is now routable again, but the full form implementation
            has not landed with this branch. This screen keeps navigation and
            builds stable while the dedicated workflow is completed.
          </p>
        </div>

        <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[1.1fr,0.9fr]">
          <section>
            <h2 className="text-base font-semibold text-gray-900">
              Planned profile contents
            </h2>
            <div className="mt-4 space-y-3">
              {INCLUDED_SECTIONS.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm text-gray-700"
                >
                  <i
                    className="bx bx-check-circle mt-0.5 text-base text-emerald-600"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-5">
            <h2 className="text-base font-semibold text-gray-900">
              What you can do now
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Use the type picker to continue with a fully implemented QR flow,
              or keep this scaffold in place while the Hard Hat form is built
              out in a follow-up change.
            </p>
            {onBackToTypes ? (
              <div className="mt-5">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onBackToTypes}
                  leftIconClass="bx bx-left-arrow-alt"
                >
                  Back to types
                </Button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
