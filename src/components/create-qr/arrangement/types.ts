/**
 * QR Arrangement domain types for the v2 flat creation flow.
 *
 * An "arrangement" in this app is a Group with `type: "arrangement"` that
 * bundles existing entities — Taliho QR codes, Procore Locations, Tools, and
 * Drawings — into a single printable layout. The user picks items from any
 * combination of the four sources via a unified search picker, names the
 * arrangement, optionally ties it to a project, and generates.
 *
 * V3 fans this out into four separate multi-selects on a 16-column wizard
 * page; v2 unifies into one search input + source-filter chips for a tighter
 * single-page experience. The underlying payload shape — one
 * `CreateQRCodeDto` per item with source-specific `type` / `procoreTool` /
 * `procoreLinkedItemId` fields — is preserved. The v2 stub lives in
 * `src/api/stubs/arrangementStub.ts`.
 */

/**
 * Where an arrangement item came from. Drives the `type` field on the
 * created QR code item per V3 conventions:
 *   - category → type: "folder", name = (raw name OR `custom:<name>` for custom-added)
 *   - taliho   → type: "folder"
 *   - location → type: "procore-location",     procoreLinkedItemId: locId
 *   - tool     → type: "procore-tool",         procoreTool: backendName
 *   - drawing  → type: "procore-drawing-code", procoreLinkedItemId: revId
 *
 * "Category" matches V3's "Company Categories" multi-select. The user
 * either picks an existing company category (the `_id` lives in the item
 * `id`) or types a free-text label and clicks Add — the latter becomes a
 * custom entry whose item id is `category-custom-<label>` and whose
 * `extras.isCustomCategory` is true so the submit-time builder can
 * prefix the payload `name` with `custom:` per V3.
 */
export type ArrangementItemSource =
  | "category"
  | "taliho"
  | "location"
  | "tool"
  | "drawing";

/**
 * Normalized item the unified picker hands around. Each Procore-derived
 * item carries its own `extras` (backend tool name, Procore latest-revision
 * ID, etc.) so the submit-time payload builder can reproduce V3 shapes
 * without re-reading the original objects.
 */
export interface ArrangementItem {
  /** Stable per-source identifier — used as the React key and for dedupe. */
  id: string;
  source: ArrangementItemSource;
  /** Display label shown in the picker and selection chips. */
  label: string;
  /**
   * Source-specific extras kept around for the submit payload. Optional
   * because Taliho codes don't need extras. See V3 payload shapes in
   * the file-level docstring.
   */
  extras?: {
    /** For tools: the backend enum name (e.g., "rfis"). */
    procoreTool?: string;
    /** For locations + drawings: the Procore-side ID we link to. */
    procoreLinkedItemId?: string;
    /** For drawings: optional sub-grouping label ("Floor 2 • Architectural"). */
    drawingArea?: string;
    /** For drawings: the discipline tag ("Structural", "Mechanical", etc.). */
    drawingDiscipline?: string;
    /**
     * For category entries the user typed and added (instead of picking from
     * existing). The submit-time builder prepends `custom:` per V3 so the
     * backend can distinguish stored vs ad-hoc category labels.
     */
    isCustomCategory?: boolean;
  };
}

export interface CreateArrangementPayload {
  /** Required — the user-visible name of the arrangement / Group. */
  name: string;
  /** Optional project association. Can be added later from the Groups page. */
  projectId?: string;
  /** All picked items in selection order. At least one is required. */
  items: ArrangementItem[];
}

export interface CreatedArrangement {
  arrangementId: string;
  /** Underlying Group ID — same value, but exposed under the V3 Group field name. */
  groupId: string;
  name: string;
  projectId?: string;
  /** Item count after creation. */
  itemCount: number;
  /** ISO timestamp. */
  createdAt: string;
}

export interface CreateArrangementResponse {
  arrangement: CreatedArrangement;
  /** Echo of the items that were placed into the arrangement. */
  items: ArrangementItem[];
}
