import { useState, useEffect } from "react";
import { asString, asRecord, asDateLike, getArray } from "@lib/coerce";
import { formatDate } from "@lib/format";
import { VerticalAttachmentSection } from "@components/vertical-attachment-section";
import { getSignedProcoreUrl } from "@/api/endpoints/tools";

/* ── Shared constants ───────────────────────────────────────── */

const EMPTY = "—";
const emptyCls = "text-gray-300 italic";
const labelCls =
  "text-xs uppercase tracking-wider font-medium text-gray-500 flex items-center gap-1.5";

/* ── DetailField ─────────────────────────────────────────────── */

export function DetailField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | undefined | null;
  icon?: string;
}) {
  const isEmpty = !value || value === EMPTY;
  return (
    <div className="py-2.5 flex items-center justify-between gap-4">
      <dt className={labelCls}>
        {icon && <i className={`bx ${icon} text-sm`} />}
        {label}
      </dt>
      <dd
        className={`text-sm text-right ${isEmpty ? emptyCls : "text-gray-900"}`}
      >
        {isEmpty ? EMPTY : value}
      </dd>
    </div>
  );
}

/* ── DetailBadge ─────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  closed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  draft: "bg-gray-100 text-gray-600",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-600",
  passed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  ready_for_review: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  initiated: "bg-blue-100 text-blue-700",
};

export function DetailBadge({
  label,
  colorClass,
}: {
  label: string;
  colorClass?: string;
}) {
  if (!label) return null;
  const cls =
    colorClass ||
    STATUS_COLORS[label.toLowerCase()] ||
    "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

/* ── DetailStatusField ───────────────────────────────────────── */

export function DetailStatusField({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  const text =
    typeof value === "string" ? value : asString(asRecord(value)?.label);
  return (
    <div className="py-2.5 flex items-center justify-between gap-4">
      <dt className={labelCls}>{label}</dt>
      <dd>
        {text ? (
          <DetailBadge label={text} />
        ) : (
          <span className={`text-sm ${emptyCls}`}>{EMPTY}</span>
        )}
      </dd>
    </div>
  );
}

/* ── DetailPersonField ───────────────────────────────────────── */

export function DetailPersonField({
  label,
  person,
}: {
  label: string;
  person: unknown;
}) {
  const rec = asRecord(person);
  const name = asString(rec?.name);
  const company = asString(asRecord(rec?.company)?.name);
  return (
    <div className="py-2.5 flex items-center justify-between gap-4">
      <dt className={labelCls}>{label}</dt>
      <dd
        className={`text-sm text-right ${name ? "text-gray-900" : emptyCls}`}
      >
        {name ? (
          <>
            {name}
            {company && (
              <span className="text-gray-500 ml-1">({company})</span>
            )}
          </>
        ) : (
          EMPTY
        )}
      </dd>
    </div>
  );
}

/* ── DetailPeopleList ────────────────────────────────────────── */

export function DetailPeopleList({
  label,
  people,
}: {
  label: string;
  people: unknown[];
}) {
  const names = people
    .map((p) => asString(asRecord(p)?.name))
    .filter(Boolean);
  return (
    <DetailField
      label={label}
      value={names.length > 0 ? names.join(", ") : undefined}
    />
  );
}

/* ── DetailDateField ─────────────────────────────────────────── */

export function DetailDateField({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  const dateLike = asDateLike(value);
  const formatted =
    dateLike !== null && dateLike !== undefined ? formatDate(dateLike) : null;
  const display = formatted && formatted !== "-" ? formatted : undefined;
  return <DetailField label={label} value={display} />;
}

/* ── DetailDescription ───────────────────────────────────────── */

export function DetailDescription({ text }: { text: unknown }) {
  const str = asString(text);
  if (!str) return null;
  return (
    <div className="mt-3 rounded-md bg-gray-50 p-3">
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{str}</p>
    </div>
  );
}

/* ── DetailAttachments ───────────────────────────────────────── */

export function DetailAttachments({
  item,
  qrCodeId,
}: {
  item: Record<string, unknown>;
  qrCodeId?: string;
}) {
  const raw = getArray(item, "attachments");
  if (raw.length === 0) {
    return (
      <DetailSection title="Attachments">
        <p className={`text-sm py-2 ${emptyCls}`}>No attachments</p>
      </DetailSection>
    );
  }
  const attachments = raw.map((a) => {
    const r = asRecord(a) ?? {};
    return {
      url: asString(r.url),
      content_type: asString(r.content_type),
      name: asString(r.name || r.filename, "file"),
      filename: asString(r.filename),
    };
  });
  return (
    <DetailSection title="Attachments">
      <VerticalAttachmentSection
        attachments={attachments}
        qrCodeId={qrCodeId ?? ""}
      />
    </DetailSection>
  );
}

/* ── DetailSection ───────────────────────────────────────────── */

export function DetailSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-4">
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs uppercase tracking-wider font-medium text-gray-500 hover:text-gray-700 mb-2"
        onClick={() => setOpen(!open)}
      >
        <i
          className={`bx bx-chevron-${open ? "down" : "right"} text-base`}
        />
        {title}
      </button>
      {open && (
        <div className="border-l-2 border-gray-200 pl-3">{children}</div>
      )}
    </div>
  );
}

/* ── DetailBooleanField ──────────────────────────────────────── */

export function DetailBooleanField({
  label,
  value,
  trueLabel = "Yes",
  falseLabel = "No",
}: {
  label: string;
  value: unknown;
  trueLabel?: string;
  falseLabel?: string;
}) {
  if (value === undefined || value === null) {
    return <DetailField label={label} value={undefined} />;
  }
  const bool = value === true || value === "true";
  return <DetailField label={label} value={bool ? trueLabel : falseLabel} />;
}

/* ── DetailImagePreview ─────────────────────────────────────── */

export function DetailImagePreview({
  fileUrl,
  qrCodeId,
  alt,
}: {
  fileUrl: string | undefined | null;
  qrCodeId?: string;
  alt?: string;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!fileUrl || !qrCodeId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);

    getSignedProcoreUrl({
      qrCodeId,
      fileUrl,
      urlOnly: false,
      sendBuffer: true,
    })
      .then((buffer) => {
        if (cancelled) return;
        const ext = (fileUrl || "").toLowerCase();
        const contentType = ext.endsWith(".png")
          ? "image/png"
          : ext.endsWith(".gif")
            ? "image/gif"
            : ext.endsWith(".webp")
              ? "image/webp"
              : "image/jpeg";
        const blob = new Blob([buffer as ArrayBuffer], { type: contentType });
        setSignedUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fileUrl, qrCodeId]);

  // Clean up object URL
  useEffect(() => {
    return () => {
      if (signedUrl) URL.revokeObjectURL(signedUrl);
    };
  }, [signedUrl]);

  if (!fileUrl) return null;

  return (
    <div className="mb-4 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-400" />
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <div className="text-center">
            <i className="bx bx-image text-3xl mb-1" />
            <p className="text-sm">Failed to load image</p>
          </div>
        </div>
      )}
      {signedUrl && !loading && (
        <img
          src={signedUrl}
          alt={alt || "Preview"}
          className="w-full max-h-80 object-contain bg-gray-100"
        />
      )}
    </div>
  );
}
