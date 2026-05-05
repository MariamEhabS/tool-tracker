import type { ReactNode } from "react";
import Modal from "@/components/modal/Modal";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import type { BadgeVariant } from "@/components/ui/Badge";
import type {
  SampleToolRecord,
  SampleToolStatus,
} from "@/data/seed/toolTrackerSeed";
import ReceiptUpload, { type ReceiptFile } from "./ReceiptUpload";
import { formatRelative, formatShortDate } from "./row-transforms";

const STATUS_VARIANT: Record<SampleToolStatus, BadgeVariant> = {
  available: "green",
  out: "blue",
  overdue: "red",
  retired: "slate",
};

const STATUS_LABELS: Record<SampleToolStatus, string> = {
  available: "Available",
  out: "Checked out",
  overdue: "Overdue",
  retired: "Retired",
};

const RETIREMENT_REASON_LABELS = {
  broken: "Broken / no longer functional",
  lost: "Lost or stolen",
  sold: "Sold or transferred",
  scrapped: "Scrapped / disposed",
  other: "Other",
} as const;

interface ToolDetailModalProps {
  open: boolean;
  tool: SampleToolRecord | null;
  projectName: string;
  onClose: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onMove: () => void;
  onRetire: () => void;
  onRestore: () => void;
  onReceiptChange: (receipt: ReceiptFile | null) => void;
}

export default function ToolDetailModal(props: ToolDetailModalProps) {
  const {
    open,
    tool,
    projectName,
    onClose,
    onEdit,
    onPrint,
    onMove,
    onRetire,
    onRestore,
    onReceiptChange,
  } = props;

  if (!tool) return null;
  const isRetired = tool.status === "retired";
  const isOut = tool.status === "out" || tool.status === "overdue";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="2xl"
      scrollable
      withoutPadding
      title={
        <div className="flex items-start gap-4">
          <div className="shrink-0 h-16 w-16 rounded-lg bg-gray-100 ring-1 ring-gray-200 flex items-center justify-center overflow-hidden">
            <i className="bx bx-wrench text-3xl text-gray-400" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-gray-900 truncate">
              {tool.name}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {tool.manufacturer} · {tool.model}
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge variant={STATUS_VARIANT[tool.status]} shape="full">
                {STATUS_LABELS[tool.status]}
              </Badge>
              <span className="text-xs text-gray-500">
                <i className="bx bx-user mr-1" aria-hidden />
                {tool.assignedTo}
              </span>
              <span className="text-xs text-gray-500">
                <i className="bx bx-folder mr-1" aria-hidden />
                {projectName}
              </span>
            </div>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            data-testid="tool-detail-close"
          >
            Close
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onPrint}
            leftIconClass="bx bx-printer"
            data-testid="tool-detail-print"
          >
            Print QR
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onEdit}
            leftIconClass="bx bx-pencil"
            data-testid="tool-detail-edit"
          >
            Edit…
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onMove}
            leftIconClass="bx bx-folder-open"
            data-testid="tool-detail-move"
          >
            Move…
          </Button>
          {isRetired ? (
            <Button
              type="button"
              variant="primary"
              onClick={onRestore}
              leftIconClass="bx bx-undo"
              data-testid="tool-detail-restore"
            >
              Restore to active
            </Button>
          ) : (
            <Button
              type="button"
              variant="danger"
              onClick={onRetire}
              leftIconClass="bx bx-archive-in"
              data-testid="tool-detail-retire"
            >
              Retire tool…
            </Button>
          )}
        </div>
      }
    >
      <div className="px-6 py-5 space-y-6" data-testid="tool-detail-modal">
        {isRetired && tool.retirement && (
          <div
            className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
            role="status"
          >
            <i
              className="bx bx-archive text-amber-600 text-xl mt-0.5"
              aria-hidden
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-amber-900">
                Retired — hidden from the active list
              </div>
              <div className="mt-0.5 text-xs text-amber-800">
                {RETIREMENT_REASON_LABELS[tool.retirement.reason]} ·{" "}
                {formatShortDate(tool.retirement.retiredAt)}
              </div>
              {tool.retirement.notes && (
                <div className="mt-1 text-xs text-amber-800">
                  {tool.retirement.notes}
                </div>
              )}
            </div>
          </div>
        )}

        {isOut && (
          <Section
            label="Currently checked out"
            tone={tool.status === "overdue" ? "danger" : "info"}
          >
            <Field
              label="Custodian"
              value={tool.currentCustodian?.name ?? tool.assignedTo}
            />
            {tool.currentCustodian?.phone && (
              <Field label="Phone" value={tool.currentCustodian.phone} />
            )}
            <Field
              label="Out since"
              value={`${formatRelative(tool.lastScanAt)} (${formatShortDate(tool.lastScanAt)})`}
            />
            {tool.dueBackAt && (
              <Field
                label="Due back"
                value={formatShortDate(tool.dueBackAt)}
                emphasis={tool.status === "overdue" ? "danger" : "warning"}
              />
            )}
          </Section>
        )}

        <Section label="Identification">
          <Field label="Serial number" value={tool.serial} />
          {tool.barcode && <Field label="Barcode" value={tool.barcode} />}
          <Field label="Category" value={tool.category} />
          <Field label="Home location" value={tool.homeLocation} />
        </Section>

        <Section label="Activity">
          <Field
            label="Last scan"
            value={`${formatRelative(tool.lastScanAt)} (${formatShortDate(tool.lastScanAt)})`}
          />
          <Field label="Created" value={formatShortDate(tool.createdAt)} />
        </Section>

        {(tool.vendor || tool.purchasePrice || tool.warrantyDate) && (
          <Section label="Purchase & warranty">
            {tool.vendor && <Field label="Vendor" value={tool.vendor} />}
            <Field
              label="Purchase date"
              value={formatShortDate(tool.purchaseDate)}
            />
            {tool.purchasePrice && (
              <Field
                label="Purchase price"
                value={`$${tool.purchasePrice}`}
              />
            )}
            <Field
              label="Warranty date"
              value={formatShortDate(tool.warrantyDate)}
            />
          </Section>
        )}

        <section className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-gray-500">
            Receipt
          </div>
          <ReceiptUpload
            receipt={tool.receipt ?? null}
            onSelect={onReceiptChange}
            onRemove={() => onReceiptChange(null)}
            testIdPrefix="tool-detail-receipt"
          />
        </section>

        {tool.description && (
          <Section label="Description">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {tool.description}
            </p>
          </Section>
        )}

        {(tool.productUrl || tool.manualUrl) && (
          <Section label="Documentation">
            {tool.productUrl && (
              <LinkField label="Product website" href={tool.productUrl} />
            )}
            {tool.manualUrl && (
              <LinkField label="Owner's manual" href={tool.manualUrl} />
            )}
          </Section>
        )}
      </div>
    </Modal>
  );
}

function Section({
  label,
  tone = "default",
  children,
}: {
  label: string;
  tone?: "default" | "info" | "danger";
  children: ReactNode;
}) {
  const toneClass =
    tone === "danger"
      ? "bg-red-50/60 border-red-200"
      : tone === "info"
        ? "bg-blue-50/60 border-blue-200"
        : "bg-white border-gray-200";
  const labelClass =
    tone === "danger"
      ? "text-red-800"
      : tone === "info"
        ? "text-blue-800"
        : "text-gray-500";
  return (
    <section className={`rounded-lg border ${toneClass} px-4 py-3`}>
      <div
        className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${labelClass}`}
      >
        {label}
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {children}
      </dl>
    </section>
  );
}

function Field({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: "warning" | "danger";
}) {
  const valueClass =
    emphasis === "danger"
      ? "text-red-700 font-semibold"
      : emphasis === "warning"
        ? "text-yellow-800 font-semibold"
        : "text-gray-900";
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`text-sm mt-0.5 truncate ${valueClass}`} title={value}>
        {value}
      </dd>
    </div>
  );
}

function LinkField({ label, href }: { label: string; href: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm mt-0.5 truncate">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-brand-600 hover:text-brand-700 underline underline-offset-2 inline-flex items-center gap-1"
          title={href}
        >
          <span className="truncate">{href}</span>
          <i className="bx bx-link-external text-xs shrink-0" aria-hidden />
        </a>
      </dd>
    </div>
  );
}
