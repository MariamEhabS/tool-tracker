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

export default function InspectionContent({ item, qrCodeId }: ContentProps) {
  const typeRec = asRecord(item.type) ?? asRecord(item.inspection_type);
  const typeName = asString(typeRec?.name);
  const location = asString(asRecord(item.location)?.node_name);
  const members = getArray(item, "distribution_members");

  return (
    <div>
      <div className="divide-y divide-gray-200">
        <DetailStatusField label="Status" value={item.status} />
        <DetailField label="Type" value={typeName} icon="bx-category" />
        <DetailField label="Location" value={location} icon="bx-map" />
      </div>

      <DetailDescription text={item.description} />

      <DetailSection title="People">
        <div className="divide-y divide-gray-100">
          <DetailPersonField label="Inspector" person={item.inspector} />
          <DetailPeopleList label="Distribution" people={members} />
        </div>
      </DetailSection>

      <DetailSection title="Dates">
        <div className="divide-y divide-gray-100">
          <DetailDateField label="Date" value={item.due_at ?? item.inspection_date} />
          <DetailDateField label="Created" value={item.created_at} />
          <DetailDateField label="Closed" value={item.closed_at} />
        </div>
      </DetailSection>

      <DetailAttachments item={item} qrCodeId={qrCodeId} />
    </div>
  );
}
