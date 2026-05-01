import type { ContentProps } from "./types";
import { asString, asRecord, getArray } from "@lib/coerce";
import {
  DetailField,
  DetailStatusField,
  DetailPersonField,
  DetailPeopleList,
  DetailDateField,
  DetailDescription,
  DetailAttachments,
  DetailSection,
} from "./helpers";

export default function RfiContent({ item, qrCodeId }: ContentProps) {
  const rfiNumber = asString(item.number ?? item.rfi_number);
  const location = asString(asRecord(item.location)?.node_name);
  const responsibleContractor = asString(
    asRecord(item.responsible_contractor)?.name,
  );
  const assignees = getArray(item, "assignees");

  return (
    <div>
      <div className="divide-y divide-gray-200">
        <DetailField label="RFI #" value={rfiNumber} icon="bx-hash" />
        <DetailStatusField label="Status" value={item.status} />
        <DetailField label="Priority" value={asString(item.priority)} icon="bx-flag" />
        <DetailField label="Location" value={location} icon="bx-map" />
      </div>

      <DetailDescription text={item.official_response} />

      <DetailSection title="People">
        <div className="divide-y divide-gray-100">
          <DetailPeopleList label="Assignees" people={assignees} />
          <DetailField label="Resp. Contractor" value={responsibleContractor} />
          <DetailPersonField label="Received From" person={item.received_from} />
        </div>
      </DetailSection>

      <DetailSection title="Dates">
        <div className="divide-y divide-gray-100">
          <DetailDateField label="Due Date" value={item.due_date} />
          <DetailDateField label="Created" value={item.created_at} />
          <DetailDateField label="Updated" value={item.updated_at} />
        </div>
      </DetailSection>

      <DetailSection title="Details">
        <div className="divide-y divide-gray-100">
          <DetailField label="Cost Impact" value={asString(item.cost_impact)} />
          <DetailField label="Schedule Impact" value={asString(item.schedule_impact)} />
        </div>
      </DetailSection>

      <DetailAttachments item={item} qrCodeId={qrCodeId} />
    </div>
  );
}
