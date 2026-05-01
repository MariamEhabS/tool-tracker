import type { ContentProps } from "./types";
import { asString, asRecord } from "@lib/coerce";
import { DetailField, DetailDateField, DetailDescription, DetailSection } from "./helpers";

export default function SpecificationContent({ item }: ContentProps) {
  const set = asString(asRecord(item.specification_set)?.name);

  return (
    <div>
      <div className="divide-y divide-gray-200">
        <DetailField label="Number" value={asString(item.number)} icon="bx-hash" />
        <DetailField label="Revision" value={asString(item.revision)} />
        <DetailField label="Set" value={set} />
      </div>

      <DetailDescription text={item.description} />

      <DetailSection title="Dates">
        <div className="divide-y divide-gray-100">
          <DetailDateField label="Issued" value={item.issued_date ?? item.created_at} />
        </div>
      </DetailSection>
    </div>
  );
}
