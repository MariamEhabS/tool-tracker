import type { ContentProps } from "./types";
import { asString, asRecord, getArray } from "@lib/coerce";
import { DetailField, DetailBooleanField, DetailSection } from "./helpers";

export default function DirectoryContent({ item }: ContentProps) {
  const isPerson = !!(item.email_address || item.login || item.job_title);

  if (isPerson) {
    const company = asString(
      asRecord(item.company)?.name ?? asRecord(item.vendor)?.name,
    );
    const email = asString(item.email_address ?? item.login);
    const phone = asString(item.mobile_phone ?? item.business_phone);
    const trades = getArray(item, "trades");
    const tradeNames = trades
      .map((t) => asString(asRecord(t)?.name))
      .filter(Boolean);
    const tradeSingle = asString(asRecord(item.trade)?.name);

    return (
      <div>
        <div className="divide-y divide-gray-200">
          <DetailField
            label="Job Title"
            value={asString(item.job_title ?? item.title)}
            icon="bx-briefcase"
          />
          <DetailField label="Company" value={company} icon="bx-building" />
        </div>

        <DetailSection title="Contact">
          <div className="divide-y divide-gray-100">
            {email ? (
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-xs uppercase tracking-wider font-medium text-gray-500 flex items-center gap-1.5">
                  <i className="bx bx-envelope text-sm" />
                  Email
                </dt>
                <dd className="text-sm text-right">
                  <a
                    href={`mailto:${email}`}
                    className="text-brand-600 hover:underline"
                  >
                    {email}
                  </a>
                </dd>
              </div>
            ) : (
              <DetailField label="Email" value={undefined} icon="bx-envelope" />
            )}
            {phone ? (
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-xs uppercase tracking-wider font-medium text-gray-500 flex items-center gap-1.5">
                  <i className="bx bx-phone text-sm" />
                  Phone
                </dt>
                <dd className="text-sm text-right">
                  <a
                    href={`tel:${phone}`}
                    className="text-brand-600 hover:underline"
                  >
                    {phone}
                  </a>
                </dd>
              </div>
            ) : (
              <DetailField label="Phone" value={undefined} icon="bx-phone" />
            )}
          </div>
        </DetailSection>

        <DetailSection title="Details">
          <div className="divide-y divide-gray-100">
            <DetailField
              label="Trade"
              value={tradeNames.length > 0 ? tradeNames.join(", ") : tradeSingle}
            />
            <DetailBooleanField
              label="Active"
              value={item.is_active}
              trueLabel="Active"
              falseLabel="Inactive"
            />
          </div>
        </DetailSection>
      </div>
    );
  }

  // Company view
  const trade = asString(item.primary_trade ?? asRecord(item.trade)?.name);
  const city = asString(item.city);
  const state = asString(item.state_code ?? item.state);
  const locationParts = [city, state].filter(Boolean);

  return (
    <div>
      <div className="divide-y divide-gray-200">
        <DetailField label="Trade" value={trade} />
        <DetailField
          label="Location"
          value={locationParts.length > 0 ? locationParts.join(", ") : undefined}
          icon="bx-map"
        />
      </div>

      <DetailSection title="Contact">
        <div className="divide-y divide-gray-100">
          {asString(item.phone) ? (
            <div className="py-2.5 flex items-center justify-between gap-4">
              <dt className="text-xs uppercase tracking-wider font-medium text-gray-500 flex items-center gap-1.5">
                <i className="bx bx-phone text-sm" />
                Phone
              </dt>
              <dd className="text-sm text-right">
                <a
                  href={`tel:${asString(item.phone)}`}
                  className="text-brand-600 hover:underline"
                >
                  {asString(item.phone)}
                </a>
              </dd>
            </div>
          ) : (
            <DetailField label="Phone" value={undefined} icon="bx-phone" />
          )}
          {asString(item.website) ? (
            <div className="py-2.5 flex items-center justify-between gap-4">
              <dt className="text-xs uppercase tracking-wider font-medium text-gray-500 flex items-center gap-1.5">
                <i className="bx bx-globe text-sm" />
                Website
              </dt>
              <dd className="text-sm text-right">
                <a
                  href={asString(item.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  {asString(item.website)}
                </a>
              </dd>
            </div>
          ) : (
            <DetailField label="Website" value={undefined} icon="bx-globe" />
          )}
        </div>
      </DetailSection>

      <DetailSection title="Details">
        <div className="divide-y divide-gray-100">
          <DetailField
            label="License"
            value={asString(item.license_number)}
            icon="bx-id-card"
          />
          <DetailBooleanField
            label="Active"
            value={item.is_active}
            trueLabel="Active"
            falseLabel="Inactive"
          />
        </div>
      </DetailSection>
    </div>
  );
}
