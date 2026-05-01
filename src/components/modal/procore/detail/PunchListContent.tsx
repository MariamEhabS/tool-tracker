import type { ContentProps } from "./types";
import { asString, asRecord, getFirstRecord } from "@lib/coerce";
import {
  DetailField,
  DetailStatusField,
  DetailPersonField,
  DetailDateField,
  DetailDescription,
  DetailAttachments,
  DetailSection,
} from "./helpers";

export default function PunchListContent({ item, qrCodeId }: ContentProps) {
  const priority = asString(asRecord(item.priority)?.label);
  const punchType = asString(asRecord(item.punch_item_type)?.name);
  const location = asString(asRecord(item.location)?.node_name);
  const trade = asString(asRecord(item.trade)?.name);
  const costCode = asString(asRecord(item.cost_code)?.name);

  const firstAssignee =
    getFirstRecord(item, "assignees") ?? getFirstRecord(item, "ball_in_court");

  return (
    <div>
      <div className="divide-y divide-gray-200">
        <DetailStatusField label="Status" value={item.status} />
        <DetailField label="Priority" value={priority} icon="bx-flag" />
        <DetailField label="Type" value={punchType} icon="bx-category" />
        <DetailField label="Location" value={location} icon="bx-map" />
      </div>

      <DetailDescription text={item.description} />

      <DetailSection title="People">
        <div className="divide-y divide-gray-100">
          <DetailPersonField label="Assignee" person={firstAssignee} />
          <DetailPersonField label="Manager" person={item.punch_item_manager} />
          <DetailField label="Trade" value={trade} />
        </div>
      </DetailSection>

      <DetailSection title="Dates">
        <div className="divide-y divide-gray-100">
          <DetailDateField label="Due Date" value={item.due_date} />
          <DetailDateField label="Created" value={item.created_at} />
          <DetailDateField label="Closed" value={item.closed_at} />
        </div>
      </DetailSection>

      <DetailSection title="Details">
        <div className="divide-y divide-gray-100">
          <DetailField label="Cost Code" value={costCode} />
        </div>
      </DetailSection>

      <DetailAttachments item={item} qrCodeId={qrCodeId} />
    </div>
  );
}
