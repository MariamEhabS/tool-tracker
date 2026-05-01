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

export default function TaskContent({ item, qrCodeId }: ContentProps) {
  const location = asString(asRecord(item.location)?.node_name);

  return (
    <div>
      <div className="divide-y divide-gray-200">
        <DetailField label="Number" value={asString(item.number)} icon="bx-hash" />
        <DetailStatusField label="Status" value={item.status} />
        <DetailField label="Location" value={location} icon="bx-map" />
      </div>

      <DetailDescription text={item.description} />

      <DetailSection title="People">
        <div className="divide-y divide-gray-100">
          <DetailPersonField label="Assignee" person={item.assignee} />
        </div>
      </DetailSection>

      <DetailSection title="Dates">
        <div className="divide-y divide-gray-100">
          <DetailDateField label="Due Date" value={item.due_date} />
          <DetailDateField label="Created" value={item.created_at} />
          <DetailDateField label="Updated" value={item.updated_at} />
        </div>
      </DetailSection>

      <DetailAttachments item={item} qrCodeId={qrCodeId} />
    </div>
  );
}
