import type { ContentProps } from "./types";
import { asString, asRecord, getArray } from "@lib/coerce";
import {
  DetailField,
  DetailStatusField,
  DetailPeopleList,
  DetailDateField,
  DetailDescription,
  DetailAttachments,
  DetailSection,
} from "./helpers";

export default function CoordinationIssueContent({ item, qrCodeId }: ContentProps) {
  const issueType = asString(asRecord(item.coordination_issue_type)?.label);
  const priority = asString(asRecord(item.priority)?.label);
  const location = asString(asRecord(item.location)?.node_name);
  const assignees = getArray(item, "assignees");

  return (
    <div>
      <div className="divide-y divide-gray-200">
        <DetailStatusField label="Status" value={item.status} />
        <DetailField label="Type" value={issueType} icon="bx-category" />
        <DetailField label="Priority" value={priority} icon="bx-flag" />
        <DetailField label="Location" value={location} icon="bx-map" />
      </div>

      <DetailDescription text={item.description} />

      <DetailSection title="People">
        <div className="divide-y divide-gray-100">
          <DetailPeopleList label="Assigned To" people={assignees} />
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
