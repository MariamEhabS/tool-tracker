import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import {
  readCreateQRState,
  writeCreateQRState,
  type CreateQRState,
} from "@/lib/urlState";
import { SAMPLE_TOOL_CATEGORIES } from "@/data/seed/toolTrackerSeed";
import type {
  CreateToolTrackersResponse,
  ToolInput,
} from "@/components/create-qr/toolTracker/types";
import ToolTrackerRules from "./ToolTrackerRules";
import ToolTrackerGenerated from "./ToolTrackerGenerated";
import QuantityModeToggle from "./QuantityModeToggle";
import {
  consumeCarryDraft,
  writeLastMode,
} from "./toolTrackerCarryDraft";

/**
 * Tool Tracker — Bulk Configure flow.
 *
 * Multi-stage Configure that dispatches by `phase` URL param:
 *   - undefined / "info" → Bulk row table
 *   - "rules"            → ToolTrackerRules (PRD §4 Stage 4)
 *   - "generated"        → ToolTrackerGenerated (PRD §4 Stage 5)
 *
 * State lifting: rows + the createToolTrackers response live at the dispatch
 * level so they survive phase navigation. BulkToolForm receives rows + setRows
 * + the id counter; ToolTrackerRules consumes the filled rows mapped to
 * `ToolInput[]`. ToolTrackerGenerated receives the response.
 */
export default function ConfigureToolTrackerBulk() {
  const navigate = useNavigate();
  const { location } = useRouterState();
  const phase = useMemo(
    () => readCreateQRState(location.search).phase,
    [location.search],
  );

  // Row IDs are local-only (not persisted). Use a monotonic counter so that
  // adding rows after a paste doesn't collide with timestamp-based IDs.
  const idCounterRef = useRef(3);
  // On mount, consume any carry-draft handed off from the Single form so the
  // user's typed work becomes row 1 instead of being silently discarded.
  const [rows, setRows] = useState<BulkRow[]>(() => {
    const draft = consumeCarryDraft();
    if (draft) {
      return [
        {
          id: 1,
          name: draft.name,
          category: draft.category || DEFAULT_CATEGORY,
          serial: draft.serial,
          homeLocation: draft.homeLocation,
        },
        makeEmptyRow(2),
        makeEmptyRow(3),
      ];
    }
    return [makeEmptyRow(1), makeEmptyRow(2), makeEmptyRow(3)];
  });
  const [createdResponse, setCreatedResponse] =
    useState<CreateToolTrackersResponse | null>(null);

  // Record that the user is engaging with the Bulk form so the next visit to
  // Tool Tracker lands them in Bulk by default.
  useEffect(() => {
    writeLastMode("bulk");
  }, []);

  const filledTools = useMemo<ToolInput[]>(
    () =>
      rows
        .filter((r) => r.name.trim().length > 0)
        .map((r) => ({
          name: r.name,
          category: r.category,
          ...(r.serial ? { serial: r.serial } : {}),
          ...(r.homeLocation ? { homeLocation: r.homeLocation } : {}),
        })),
    [rows],
  );

  const handleBackToInfo = () => {
    writeCreateQRState(navigate, {
      ...readCreateQRState(location.search),
      phase: null,
      replace: false,
    });
  };

  const handleGenerated = (response: CreateToolTrackersResponse) => {
    setCreatedResponse(response);
    writeCreateQRState(navigate, {
      ...readCreateQRState(location.search),
      phase: "generated",
      replace: false,
    });
  };

  const handleCreateMore = () => {
    setRows([makeEmptyRow(1), makeEmptyRow(2), makeEmptyRow(3)]);
    idCounterRef.current = 3;
    setCreatedResponse(null);
    writeCreateQRState(navigate, {
      ...readCreateQRState(location.search),
      typeId: null,
      tab: null,
      sub: null,
      method: null,
      phase: null,
      replace: false,
    });
  };

  if (phase === "rules") {
    return (
      <ToolTrackerRules
        tools={filledTools}
        onBackToInfo={handleBackToInfo}
        onGenerated={handleGenerated}
      />
    );
  }
  if (phase === "generated") {
    if (!createdResponse) {
      // Edge case: page refreshed on phase=generated. Bounce to phase=info.
      writeCreateQRState(navigate, {
        ...readCreateQRState(location.search),
        phase: null,
        replace: true,
      });
      return null;
    }
    return (
      <ToolTrackerGenerated
        response={createdResponse}
        onCreateMore={handleCreateMore}
      />
    );
  }
  return (
    <BulkToolForm rows={rows} setRows={setRows} idCounterRef={idCounterRef} />
  );
}

interface BulkRow {
  id: number;
  name: string;
  category: string;
  serial: string;
  homeLocation: string;
}

const DEFAULT_CATEGORY = "Uncategorized";

/**
 * Maximum number of rows the bulk form will hold at once. Applies to both
 * paste imports (Stage 7 edge case: warn + cap) and manual `Add another
 * tool` clicks. The cap exists to keep the form responsive in the browser
 * and to keep payload sizes sane until the backend defines its own limit.
 */
export const BULK_TOOL_TRACKER_MAX_ROWS = 200;

function makeEmptyRow(id: number): BulkRow {
  return {
    id,
    name: "",
    category: DEFAULT_CATEGORY,
    serial: "",
    homeLocation: "",
  };
}

interface BulkToolFormProps {
  rows: BulkRow[];
  setRows: Dispatch<SetStateAction<BulkRow[]>>;
  idCounterRef: MutableRefObject<number>;
}

function BulkToolForm({ rows, setRows, idCounterRef }: BulkToolFormProps) {
  const navigate = useNavigate();
  const { location } = useRouterState();
  const [pasteOpen, setPasteOpen] = useState(false);

  const filled = useMemo(
    () => rows.filter((r) => r.name.trim().length > 0).length,
    [rows],
  );
  const canContinue = filled > 0;

  const atRowCap = rows.length >= BULK_TOOL_TRACKER_MAX_ROWS;

  const addRow = () => {
    if (atRowCap) {
      toast.error(
        `You've reached the limit of ${BULK_TOOL_TRACKER_MAX_ROWS} tools per batch. Remove a row before adding another, or split into multiple batches.`,
      );
      return;
    }
    idCounterRef.current += 1;
    setRows((prev) => [...prev, makeEmptyRow(idCounterRef.current)]);
  };

  const removeRow = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRow = (id: number, patch: Partial<BulkRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const replaceRowsFromPaste = (parsed: BulkRow[]) => {
    if (parsed.length === 0) {
      setPasteOpen(false);
      return;
    }
    // Cap pasted rows at BULK_TOOL_TRACKER_MAX_ROWS. Anything beyond the
    // cap is dropped with a warning toast — the user can split into
    // multiple batches if they have more.
    let imported = parsed;
    if (parsed.length > BULK_TOOL_TRACKER_MAX_ROWS) {
      toast.error(
        `Capped at ${BULK_TOOL_TRACKER_MAX_ROWS} tools — ${parsed.length - BULK_TOOL_TRACKER_MAX_ROWS} extra row(s) were dropped. Split your spreadsheet into multiple batches if you need more.`,
      );
      imported = parsed.slice(0, BULK_TOOL_TRACKER_MAX_ROWS);
    }
    // Re-base IDs on the counter so subsequent addRow() calls stay unique.
    idCounterRef.current = imported.length;
    setRows(imported.map((r, i) => ({ ...r, id: i + 1 })));
    setPasteOpen(false);
  };

  const handleCancel = () => {
    // Tool Tracker skips the Quantity step, so Cancel returns the user all
    // the way to Type selection rather than looping back into Configure.
    const merged: CreateQRState & { replace?: boolean } = {
      ...readCreateQRState(location.search),
      typeId: null,
      tab: null,
      sub: null,
      method: null,
      phase: null,
      replace: false,
    };
    writeCreateQRState(navigate, merged);
  };

  const handleSwitchToSingle = () => {
    if (filled > 0) {
      const noun = filled === 1 ? "tool" : "tools";
      const ok = window.confirm(
        `Switch to Single? Your ${filled} ${noun} will be cleared.`,
      );
      if (!ok) return;
    }
    const merged: CreateQRState & { replace?: boolean } = {
      ...readCreateQRState(location.search),
      tab: "single",
      sub: "tool-tracker",
      phase: null,
      replace: false,
    };
    writeCreateQRState(navigate, merged);
  };

  const handleContinue = () => {
    if (!canContinue) return;
    const merged: CreateQRState & { replace?: boolean } = {
      ...readCreateQRState(location.search),
      phase: "rules",
      replace: false,
    };
    writeCreateQRState(navigate, merged);
  };

  return (
    <div className="space-y-4" data-testid="configure-tool-tracker-bulk">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Add your tools
          </h3>
          <p className="mt-1 text-xs text-gray-600">
            One row per tool. Only the name is required.
          </p>
          <p
            className="mt-1.5 text-xs text-gray-500"
            data-testid="required-field-legend"
          >
            <span className="text-red-600" aria-hidden="true">
              *
            </span>{" "}
            Required field
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <QuantityModeToggle
            mode="bulk"
            onChange={(next) => {
              if (next === "single") handleSwitchToSingle();
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPasteOpen(true)}
            data-testid="bulk-paste-open"
          >
            Paste from spreadsheet
          </Button>
        </div>
      </div>

      <div
        className="border border-gray-200 rounded-xl overflow-hidden"
        data-testid="bulk-row-table"
      >
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
          <div className="col-span-4">
            Tool name
            <span className="text-red-600 ml-0.5" aria-hidden="true">
              *
            </span>
          </div>
          <div className="col-span-3">Category</div>
          <div className="col-span-2">Serial</div>
          <div className="col-span-2">Home location</div>
          <div className="col-span-1" aria-hidden />
        </div>
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-12 gap-2 px-4 py-2 border-t border-gray-100 items-center"
            data-testid={`bulk-row-${row.id}`}
          >
            <input
              value={row.name}
              onChange={(e) => updateRow(row.id, { name: e.target.value })}
              placeholder="e.g., Milwaukee M18 Drill"
              data-testid="bulk-name"
              aria-label="Tool name"
              className="col-span-4 border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <select
              value={row.category}
              onChange={(e) =>
                updateRow(row.id, { category: e.target.value })
              }
              data-testid="bulk-category"
              aria-label="Category"
              className="col-span-3 border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-brand-500"
            >
              {SAMPLE_TOOL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={row.serial}
              onChange={(e) => updateRow(row.id, { serial: e.target.value })}
              data-testid="bulk-serial"
              aria-label="Serial number"
              className="col-span-2 border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-brand-500"
            />
            <input
              value={row.homeLocation}
              onChange={(e) =>
                updateRow(row.id, { homeLocation: e.target.value })
              }
              data-testid="bulk-home"
              aria-label="Home location"
              className="col-span-2 border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-brand-500"
            />
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              className="col-span-1 text-gray-400 hover:text-red-500 justify-self-end p-1 transition"
              aria-label="Remove row"
              data-testid={`bulk-remove-${row.id}`}
            >
              <i className="bx bx-trash text-base" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          disabled={atRowCap}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          data-testid="bulk-add-row"
          aria-label={
            atRowCap
              ? `Limit of ${BULK_TOOL_TRACKER_MAX_ROWS} rows reached`
              : "Add another tool"
          }
        >
          <i className="bx bx-plus text-sm" />
          Add another tool
        </button>
      </div>

      <div className="text-xs text-gray-500" data-testid="bulk-counter">
        {filled} of {rows.length} tools ready.
        {atRowCap && (
          <span className="text-amber-700 ml-2">
            (At the {BULK_TOOL_TRACKER_MAX_ROWS}-row batch limit.)
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-4 border-t border-gray-100">
        <Button
          type="button"
          variant="secondary"
          onClick={handleCancel}
          data-testid="bulk-cancel"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleContinue}
          disabled={!canContinue}
          data-testid="bulk-continue"
        >
          Continue
        </Button>
      </div>

      {pasteOpen && (
        <PasteModal
          counter={idCounterRef.current}
          onClose={() => setPasteOpen(false)}
          onApply={replaceRowsFromPaste}
        />
      )}
    </div>
  );
}

// ─── Paste-from-spreadsheet modal ────────────────────────────────────────

interface PasteModalProps {
  /** Current id counter — paste output starts IDs above existing rows. */
  counter: number;
  onClose: () => void;
  onApply: (rows: BulkRow[]) => void;
}

function PasteModal({ counter, onClose, onApply }: PasteModalProps) {
  const [text, setText] = useState("");

  const handleApply = () => {
    const parsed = parsePastedRows(text, counter);
    onApply(parsed);
    setText("");
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-paste-title"
      data-testid="bulk-paste-modal"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3
            id="bulk-paste-title"
            className="font-semibold text-gray-900"
          >
            Paste from spreadsheet
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Close"
            data-testid="bulk-paste-close"
          >
            <i className="bx bx-x text-xl" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm text-gray-600 mb-3">
            Copy a block of cells from Excel or Google Sheets and paste below.
            Column order: Name, Category, Serial, Home location.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            data-testid="bulk-paste-textarea"
            placeholder={
              "DeWalt DCF887\tPower Tools\t4821-A9C\tWarehouse B\nMilwaukee M18\tPower Tools\t7733-B1\tWarehouse B"
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-xs focus:outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            data-testid="bulk-paste-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleApply}
            data-testid="bulk-paste-apply"
          >
            Import rows
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Parses pasted Excel/Sheets content into BulkRow[]. Splits each line by tab
 * first, then comma — supports both delimiters per the JSX mockup. Maps
 * columns in order: Name, Category, Serial, Home location. Empty lines are
 * skipped. Unknown categories fall back to the default; the user can fix
 * them inline after paste.
 *
 * Exported for unit testing; not part of the component's public surface.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function parsePastedRows(text: string, baseId: number): BulkRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim().length > 0);

  return lines.map((line, i) => {
    // Tab is the dominant delimiter when copying from Excel/Sheets; comma is
    // the documented fallback. Prefer tab when present; otherwise comma.
    const parts = line.includes("\t")
      ? line.split("\t").map((p) => p.trim())
      : line.split(",").map((p) => p.trim());
    const category = parts[1] && SAMPLE_TOOL_CATEGORIES.includes(parts[1])
      ? parts[1]
      : DEFAULT_CATEGORY;
    return {
      id: baseId + i + 1,
      name: parts[0] ?? "",
      category,
      serial: parts[2] ?? "",
      homeLocation: parts[3] ?? "",
    };
  });
}

