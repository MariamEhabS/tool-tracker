import type { ContentProps } from "./types";
import { asString, asNumber } from "@lib/coerce";
import { formatBytes } from "@lib/format";
import { DetailField, DetailDateField, DetailSection } from "./helpers";

export default function DocumentContent({ item }: ContentProps) {
  const size = asNumber(item.file_size);
  const sizeStr = size > 0 ? formatBytes(size) : undefined;

  return (
    <div>
      <div className="divide-y divide-gray-200">
        <DetailField label="Type" value={asString(item.document_type)} icon="bx-file" />
        <DetailField label="Size" value={sizeStr} icon="bx-data" />
      </div>

      <DetailSection title="Dates">
        <div className="divide-y divide-gray-100">
          <DetailDateField label="Updated" value={item.updated_at} />
          <DetailDateField label="Created" value={item.created_at} />
        </div>
      </DetailSection>
    </div>
  );
}
