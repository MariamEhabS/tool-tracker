import type { ContentProps } from "./types";
import { asString, asNumber, asRecord } from "@lib/coerce";
import {
  DetailField,
  DetailStatusField,
  DetailBooleanField,
  DetailDateField,
  DetailDescription,
  DetailSection,
  DetailImagePreview,
} from "./helpers";

export default function PhotoContent({ item, qrCodeId }: ContentProps) {
  const location = asString(asRecord(item.location)?.node_name);
  const trade = asString(asRecord(item.trade)?.name);
  const photoCount = asNumber(item.photos_count ?? item.num_photos);
  const imageUrl = asString(item.url);
  const filename = asString(item.filename);

  return (
    <div>
      <DetailImagePreview
        fileUrl={imageUrl}
        qrCodeId={qrCodeId}
        alt={filename || "Photo"}
      />

      <div className="divide-y divide-gray-200">
        <DetailStatusField label="Status" value={item.status} />
        <DetailField label="Location" value={location} icon="bx-map" />
        <DetailField label="Trade" value={trade} />
        <DetailBooleanField label="Private" value={item.private} />
        <DetailField
          label="Photos"
          value={photoCount > 0 ? String(photoCount) : undefined}
          icon="bx-image"
        />
      </div>

      <DetailDescription text={item.description} />

      <DetailSection title="Dates">
        <div className="divide-y divide-gray-100">
          <DetailDateField label="Created" value={item.created_at} />
          <DetailDateField label="Updated" value={item.updated_at} />
        </div>
      </DetailSection>
    </div>
  );
}
