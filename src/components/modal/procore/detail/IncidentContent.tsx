import type { ContentProps } from "./types";
import { asString, asRecord, getArray } from "@lib/coerce";
import {
  DetailField,
  DetailStatusField,
  DetailBooleanField,
  DetailDateField,
  DetailDescription,
  DetailSection,
} from "./helpers";

export default function IncidentContent({ item }: ContentProps) {
  const harmSource = asString(asRecord(item.harm_source)?.name);
  const eventType = asString(item.event_type);
  const location = asString(asRecord(item.location)?.node_name);
  const witnesses = getArray(item, "witness_statements");

  return (
    <div>
      <div className="divide-y divide-gray-200">
        <DetailStatusField label="Status" value={item.status} />
        <DetailBooleanField label="Recordable" value={item.recordable} />
        <DetailField label="Severity" value={asString(item.severity)} icon="bx-error" />
        <DetailField label="Event Type" value={harmSource || eventType} icon="bx-category" />
        <DetailField label="Location" value={location} icon="bx-map" />
      </div>

      <DetailDescription text={item.description} />

      <DetailSection title="Dates">
        <div className="divide-y divide-gray-100">
          <DetailDateField label="Occurred" value={item.event_date} />
          <DetailDateField label="Created" value={item.created_at} />
          <DetailBooleanField label="Time Unknown" value={item.time_unknown} />
        </div>
      </DetailSection>

      {witnesses.length > 0 && (
        <DetailSection title="Witness Statements">
          <ul className="space-y-2">
            {witnesses.map((w, i) => {
              const rec = asRecord(w);
              const text = asString(rec?.statement || rec?.description || rec?.name);
              if (!text) return null;
              return (
                <li key={i} className="text-sm text-gray-700 bg-gray-50 rounded p-2">
                  {text}
                </li>
              );
            })}
          </ul>
        </DetailSection>
      )}
    </div>
  );
}
