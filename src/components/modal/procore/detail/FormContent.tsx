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

export default function FormContent({ item, qrCodeId }: ContentProps) {
  const template = asString(asRecord(item.form_template)?.name);
  const assignees = getArray(item, "assignees");

  return (
    <div>
      <div className="divide-y divide-gray-200">
        <DetailStatusField label="Status" value={item.status} />
        <DetailField label="Template" value={template} icon="bx-file" />
      </div>

      <DetailDescription text={item.description} />

      <DetailSection title="People">
        <div className="divide-y divide-gray-100">
          <DetailPeopleList label="Assignees" people={assignees} />
        </div>
      </DetailSection>

      <DetailSection title="Dates">
        <div className="divide-y divide-gray-100">
          <DetailDateField label="Created" value={item.created_at} />
          <DetailDateField label="Updated" value={item.updated_at} />
        </div>
      </DetailSection>

      <DetailAttachments item={item} qrCodeId={qrCodeId} />
    </div>
  );
}
