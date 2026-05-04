import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import { getPrintablePDF } from "@/api/stubs/toolTrackerStub";
import type {
  CreateToolTrackersResponse,
  ToolTracker,
} from "@/components/create-qr/toolTracker/types";
import ToolTrackerScanPreview from "./ToolTrackerScanPreview";

/**
 * Tool Tracker — Generated / Ready to print screen (PRD §4 Stage 5).
 *
 * Shown after the Rules screen successfully fires `createToolTrackers`.
 * The dispatch parent (ConfigureToolTrackerSingle / ConfigureToolTrackerBulk)
 * passes the stub response so we know each created tool's qrCodeId,
 * qrPayloadUrl, and tool metadata.
 *
 * Three actions:
 *   - Preview scan   → opens the existing ToolTrackerScanPreview modal
 *   - Download PDF   → fires getPrintablePDF stub, triggers a Blob download
 *   - Print labels   → window.print() with the print-only sheet visible
 *
 * Print stylesheet: a `@media print` block at the bottom of this component
 * hides everything in the body and shows only `.tt-print-sheet` so the
 * output looks like a clean sticker page (no chrome, no shadows). The
 * embedded `<style>` block scopes the rules to the print container's class
 * names, so it won't affect other routes.
 *
 * Backend stub note: the stub returns a placeholder Blob with no real QR
 * image URL. We render a deterministic fake QR pattern so the layout looks
 * like a sticker sheet during local QA. When a real backend ships a QR
 * image URL, swap `<FakeQR />` for `<QrCodeImage src={…} />` per the
 * existing pattern in [src/components/qr/QrCodeImage.tsx].
 */

interface ToolTrackerGeneratedProps {
  response: CreateToolTrackersResponse;
  onCreateMore: () => void;
}

/** Avery label template a print sheet targets. */
type LabelSize = "5160" | "5163";

export default function ToolTrackerGenerated({
  response,
  onCreateMore,
}: ToolTrackerGeneratedProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [labelSize, setLabelSize] = useState<LabelSize>("5160");

  const tools = response.toolTrackers;
  const count = tools.length;
  const countWord = count === 1 ? "QR code" : "QR codes";

  const previewTool = tools[0]?.tool ?? { name: "Example Tool" };
  const previewRules =
    tools[0]?.rules ?? {
      identification: "name_phone" as const,
      allowHandoffs: true,
      trackDueDates: false,
      defaultLoanPeriod: "1d" as const,
      pinEnabled: false,
    };

  const handleDownload = async () => {
    if (count === 0) return;
    setIsDownloading(true);
    try {
      // PRD §10.6 stub takes one toolId. Bulk → fire sequentially. The real
      // backend should add a batch endpoint; flagged in Stage 5 handoff.
      for (const t of tools) {
        const blob = await getPrintablePDF(t.toolId);
        triggerBlobDownload(blob, `tool-tracker-${t.toolId}.pdf`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not download the PDF. Please try again.",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6" data-testid="tool-tracker-generated">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div
            className="inline-flex items-center gap-2 text-sm text-brand-700 bg-brand-50 border border-brand-200 px-3 py-1 rounded-full mb-3"
            data-testid="generated-success-badge"
          >
            <i className="bx bx-check text-base" aria-hidden /> {count}{" "}
            {countWord} created
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Ready to print</h3>
          <p className="text-sm text-gray-600 mt-1">
            Print these and stick them on your tools. Scans work right away.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <fieldset
            className="flex items-center gap-3 text-xs text-gray-600"
            data-testid="label-size-fieldset"
          >
            <legend className="font-medium text-gray-700">Label size:</legend>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="label-size"
                value="5160"
                checked={labelSize === "5160"}
                onChange={() => setLabelSize("5160")}
                className="accent-brand-600"
                data-testid="label-size-5160"
              />
              <span>Small &middot; Avery 5160 (1″ × 2⅝″, 30/sheet)</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="label-size"
                value="5163"
                checked={labelSize === "5163"}
                onChange={() => setLabelSize("5163")}
                className="accent-brand-600"
                data-testid="label-size-5163"
              />
              <span>Large &middot; Avery 5163 (2″ × 4″, 10/sheet)</span>
            </label>
          </fieldset>
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPreviewOpen(true)}
              data-testid="generated-preview-scan"
            >
              <i className="bx bx-mobile-alt text-sm mr-1" aria-hidden /> Preview
              scan
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleDownload}
              disabled={isDownloading || count === 0}
              data-testid="generated-download-pdf"
            >
              <i className="bx bx-download text-sm mr-1" aria-hidden />{" "}
              {isDownloading ? "Downloading…" : "Download PDF"}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handlePrint}
              disabled={count === 0}
              data-testid="generated-print-labels"
            >
              <i className="bx bx-printer text-sm mr-1" aria-hidden /> Print
              labels
            </Button>
          </div>
        </div>
      </div>

      <div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        data-testid="generated-card-grid"
      >
        {tools.map((t) => (
          <CodeCard key={t.toolId} tool={t} />
        ))}
      </div>

      <div>
        <button
          type="button"
          onClick={onCreateMore}
          className="text-sm text-brand-700 hover:text-brand-800 underline underline-offset-2 font-medium"
          data-testid="generated-create-more"
        >
          Create more QR codes
        </button>
      </div>

      {previewOpen && (
        <ToolTrackerScanPreview
          tool={previewTool}
          rules={previewRules}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {/* Print-only sheet: hidden on screen, becomes the only visible
          content during print. The data-label-size attr drives which
          Avery template the print stylesheet activates. */}
      <div
        className="tt-print-sheet"
        data-testid="generated-print-sheet"
        data-label-size={labelSize}
      >
        <div className="tt-print-grid">
          {tools.map((t) => (
            <PrintCard key={t.toolId} tool={t} labelSize={labelSize} />
          ))}
        </div>
      </div>

      <PrintStylesheet />
    </div>
  );
}

// ─── On-screen card ──────────────────────────────────────────────────────

function CodeCard({ tool }: { tool: ToolTracker }) {
  return (
    <div
      className="border border-gray-200 rounded-xl bg-white p-4 text-center hover:shadow-md transition"
      data-testid="generated-card"
    >
      <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center mb-3 p-3">
        <FakeQR seed={tool.qrCodeId} />
      </div>
      <div
        className="text-sm font-medium text-gray-900 truncate"
        title={tool.tool.name}
      >
        {tool.tool.name}
      </div>
      {tool.tool.serial && (
        <div
          className="text-xs text-gray-500 mt-0.5 truncate"
          title={`SN: ${tool.tool.serial}`}
        >
          SN: {tool.tool.serial}
        </div>
      )}
    </div>
  );
}

// ─── Print-only card (no chrome, just QR + name + serial) ────────────────

/**
 * One label cell. Layout differs slightly per Avery template:
 *   - 5160 (1″ × 2⅝″) — landscape strip; QR left, text right.
 *   - 5163 (2″ × 4″)  — wider; same row layout, larger QR + text.
 *
 * QR cell density (`cells` arg to FakeQR) increases for the larger label
 * so the pattern still looks like a QR at print resolution.
 */
function PrintCard({
  tool,
  labelSize,
}: {
  tool: ToolTracker;
  labelSize: LabelSize;
}) {
  const qrCells = labelSize === "5163" ? 25 : 17;
  return (
    <div className="tt-print-card">
      <div className="tt-print-qr-wrap">
        <FakeQR seed={tool.qrCodeId} cells={qrCells} />
      </div>
      <div className="tt-print-text">
        <div className="tt-print-name">{tool.tool.name}</div>
        {tool.tool.serial && (
          <div className="tt-print-serial">SN: {tool.tool.serial}</div>
        )}
      </div>
    </div>
  );
}

// ─── Deterministic fake QR pattern ───────────────────────────────────────

/**
 * Deterministic fake QR pattern. Hashes the `seed` string into bits driving
 * a `cells × cells` grid. Same seed → same pattern, so screenshots and
 * tests stay stable. Not a real QR — it's purely visual filler so the
 * sticker-sheet layout looks correct in local QA.
 *
 * Rendered as inline SVG (rather than a CSS-grid of `bg-*` divs) so the
 * cells print reliably across browsers without needing
 * `print-color-adjust: exact` — SVG `fill` is treated as paint, not
 * background, and prints by default.
 */
function FakeQR({ seed, cells = 13 }: { seed: string; cells?: number }) {
  const pattern = useMemo(() => mulberryPattern(seed, cells), [seed, cells]);
  return (
    <svg
      role="img"
      aria-label="QR code preview"
      viewBox={`0 0 ${cells} ${cells}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full block"
      data-testid="fake-qr"
    >
      <rect width={cells} height={cells} fill="white" />
      {pattern.map((on, i) => {
        if (!on) return null;
        const x = i % cells;
        const y = Math.floor(i / cells);
        return <rect key={i} x={x} y={y} width={1} height={1} fill="black" />;
      })}
    </svg>
  );
}

function hashString(s: string): number {
  // Simple FNV-1a hash, stable across runs.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberryPattern(seed: string, cells: number): boolean[] {
  // mulberry32 PRNG seeded by hash(seed). Deterministic across runs.
  let state = hashString(seed) || 1;
  const next = () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out: boolean[] = [];
  for (let i = 0; i < cells * cells; i++) out.push(next() > 0.5);
  return out;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Print stylesheet ────────────────────────────────────────────────────

/**
 * Embedded print stylesheet targeting two Avery label templates.
 * `data-label-size` on `.tt-print-sheet` selects which layout activates.
 *
 * Dimensions are taken verbatim from Avery's published spec sheets so the
 * grid lines up with real label stock when fed through any standard
 * printer.
 *
 * Avery 5160 — Easy Peel Address Labels
 *   Sheet: 8.5″ × 11″ (US Letter), 30 labels (3 cols × 10 rows)
 *   Label: 2.625″ W × 1″ H
 *   Top margin: 0.5″ · Side margin: 0.1875″ · Column gutter: 0.125″
 *
 * Avery 5163 — Shipping Labels
 *   Sheet: 8.5″ × 11″ (US Letter), 10 labels (2 cols × 5 rows)
 *   Label: 4″ W × 2″ H
 *   Top margin: 0.5″ · Side margin: 0.15625″ · Column gutter: 0.1875″
 *
 * Production note: the Taliho codebase reportedly already has prior
 * Avery-label printing work elsewhere — the dev integrating this should
 * search for and reuse that prior work rather than ship two parallel
 * print stylesheets. See Stage 5.5 handoff §13 Observations.
 *
 * On screen, `.tt-print-sheet` is `display: none` so it never takes up
 * space until print media activates it. SVG-based QR cells (see FakeQR)
 * render reliably in print without needing `print-color-adjust: exact`.
 */
function PrintStylesheet() {
  return (
    <style>{`
      .tt-print-sheet { display: none; }

      @media print {
        @page { margin: 0; }

        body * { visibility: hidden !important; }
        .tt-print-sheet, .tt-print-sheet * { visibility: visible !important; }
        .tt-print-sheet {
          display: block !important;
          position: absolute;
          top: 0;
          left: 0;
          width: 8.5in;
          margin: 0;
          padding: 0;
        }

        /* ─── Avery 5160 — 30 labels per sheet (3 × 10) ─── */
        .tt-print-sheet[data-label-size="5160"] .tt-print-grid {
          display: grid;
          grid-template-columns: 2.625in 2.625in 2.625in;
          grid-auto-rows: 1in;
          column-gap: 0.125in;
          row-gap: 0;
          padding-top: 0.5in;
          padding-left: 0.1875in;
          padding-right: 0.1875in;
          padding-bottom: 0.5in;
        }
        .tt-print-sheet[data-label-size="5160"] .tt-print-card {
          width: 2.625in;
          height: 1in;
        }
        .tt-print-sheet[data-label-size="5160"] .tt-print-qr-wrap {
          width: 0.85in;
          height: 0.85in;
          margin: 0.075in 0.1in 0.075in 0.075in;
          flex-shrink: 0;
        }
        .tt-print-sheet[data-label-size="5160"] .tt-print-name {
          font-size: 9pt;
          font-weight: 600;
        }
        .tt-print-sheet[data-label-size="5160"] .tt-print-serial {
          font-size: 7pt;
          margin-top: 1pt;
        }

        /* ─── Avery 5163 — 10 labels per sheet (2 × 5) ─── */
        .tt-print-sheet[data-label-size="5163"] .tt-print-grid {
          display: grid;
          grid-template-columns: 4in 4in;
          grid-auto-rows: 2in;
          column-gap: 0.1875in;
          row-gap: 0;
          padding-top: 0.5in;
          padding-left: 0.15625in;
          padding-right: 0.15625in;
          padding-bottom: 0.5in;
        }
        .tt-print-sheet[data-label-size="5163"] .tt-print-card {
          width: 4in;
          height: 2in;
        }
        .tt-print-sheet[data-label-size="5163"] .tt-print-qr-wrap {
          width: 1.8in;
          height: 1.8in;
          margin: 0.1in 0.15in 0.1in 0.1in;
          flex-shrink: 0;
        }
        .tt-print-sheet[data-label-size="5163"] .tt-print-name {
          font-size: 14pt;
          font-weight: 600;
        }
        .tt-print-sheet[data-label-size="5163"] .tt-print-serial {
          font-size: 10pt;
          margin-top: 4pt;
        }

        /* ─── Shared card layout ─── */
        .tt-print-card {
          page-break-inside: avoid;
          break-inside: avoid;
          display: flex;
          flex-direction: row;
          align-items: center;
          overflow: hidden;
          box-sizing: border-box;
          box-shadow: none !important;
          border: none !important;
          background: white !important;
          color: #111;
        }
        .tt-print-text {
          flex: 1 1 auto;
          min-width: 0;
          padding-right: 0.05in;
        }
        .tt-print-name {
          color: #111;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        .tt-print-serial {
          color: #555;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
      }
    `}</style>
  );
}
