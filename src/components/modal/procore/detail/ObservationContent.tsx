import type { ContentProps } from "./types";
import { asString, asRecord } from "@lib/coerce";
import {
  DetailField,
  DetailStatusField,
  DetailPersonField,
  DetailDateField,
  DetailDescription,
  DetailAttachments,
  DetailSection,
} from "./helpers";

export default function ObservationContent({ item, qrCodeId }: ContentProps) {
  const typeRec = asRecord(item.type);
  const typeName = asString(typeRec?.name ?? typeRec?.label);
  const location = asString(asRecord(item.location)?.node_name);
  const trade = asString(asRecord(item.trade)?.name);

  return (
    <div>
      <div className="divide-y divide-gray-200">
        <DetailStatusField label="Status" value={item.status} />
        <DetailField label="Priority" value={asString(item.priority)} icon="bx-flag" />
        <DetailField label="Type" value={typeName} icon="bx-category" />
        <DetailField label="Location" value={location} icon="bx-map" />
      </div>

      <DetailDescription text={item.description} />

      <DetailSection title="People">
        <div className="divide-y divide-gray-100">
          <DetailPersonField label="Assignee" person={item.assignee} />
          <DetailField label="Trade" value={trade} />
        </div>
      </DetailSection>

      <DetailSection title="Dates">
        <div className="divide-y divide-gray-100">
          <DetailDateField label="Due Date" value={item.due_date} />
          <DetailDateField label="Created" value={item.created_at} />
        </div>
      </DetailSection>

      <DetailAttachments item={item} qrCodeId={qrCodeId} />
    </div>
  );
}
