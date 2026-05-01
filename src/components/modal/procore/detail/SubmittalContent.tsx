import type { ContentProps } from "./types";
import { asString, asRecord } from "@lib/coerce";
import {
  DetailField,
  DetailStatusField,
  DetailPersonField,
  DetailDateField,
  DetailAttachments,
  DetailSection,
} from "./helpers";

export default function SubmittalContent({ item, qrCodeId }: ContentProps) {
  const submittalType = asString(
    asRecord(item.type)?.name ?? item.submittal_type,
  );
  const ballInCourt = asRecord(item.ball_in_court);
  const ballName = asString(ballInCourt?.name);
  const responsibleContractor = asString(
    asRecord(item.responsible_contractor)?.name,
  );
  const specSection = asString(item.specification_section);

  return (
    <div>
      <div className="divide-y divide-gray-200">
        <DetailField label="Number" value={asString(item.number)} icon="bx-hash" />
        <DetailField label="Revision" value={asString(item.revision)} />
        <DetailStatusField label="Status" value={item.status} />
        <DetailField label="Type" value={submittalType} icon="bx-category" />
      </div>

      <DetailSection title="People">
        <div className="divide-y divide-gray-100">
          <DetailField label="Ball In Court" value={ballName} />
          <DetailPersonField label="Submitted By" person={item.submitted_by} />
          <DetailField label="Resp. Contractor" value={responsibleContractor} />
        </div>
      </DetailSection>

      <DetailSection title="Dates">
        <div className="divide-y divide-gray-100">
          <DetailDateField label="Received" value={item.received_date} />
          <DetailDateField label="Due Date" value={item.due_date} />
          <DetailDateField label="Issue Date" value={item.issue_date} />
          <DetailDateField label="Created" value={item.created_at} />
        </div>
      </DetailSection>

      <DetailSection title="Details">
        <div className="divide-y divide-gray-100">
          <DetailField label="Spec Section" value={specSection} />
        </div>
      </DetailSection>

      <DetailAttachments item={item} qrCodeId={qrCodeId} />
    </div>
  );
}
