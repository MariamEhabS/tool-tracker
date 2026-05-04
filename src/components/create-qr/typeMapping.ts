/**
 * @fileoverview Pure mapping helpers for the Type-first Create QR flow.
 *
 * Bridges the new `typeId` URL parameter to the legacy `(tab, sub, method)`
 * triple so existing Configure components keep working unchanged. These
 * functions have no React/routing dependencies and are unit-tested in
 * isolation.
 */

import type { CreateQRState } from "@/lib/urlState";
import type { TypeId } from "./typeCatalog";

export type Quantity = "single" | "bulk";

/** The four methods surfaced on the Taliho Code → Bulk Method page. */
export type BulkMethod =
  | "assorted"
  | "prefix-quantity"
  | "upload-csv"
  | "manual-entry";

/**
 * The subset of `TypeId` that has real routing behavior — these are the 10
 * types the Type-first flow can write to the URL, map to the legacy
 * (tab, sub, method) triple, and resolve a `configureKey` for. The wider
 * `TypeId` union (in typeCatalog.ts) also includes coming-soon catalog-only
 * placeholders (e.g. `simple-wifi`) that must never reach state writers.
 */
export type ActiveTypeId =
  | "tool-tracker"
  | "taliho-code"
  | "equipment-code"
  | "qr-arrangement"
  | "procore-location"
  | "procore-inspections"
  | "procore-tool"
  | "procore-drawing"
  | "vcard"
  | "url";

const VALID_TYPE_IDS = new Set<ActiveTypeId>([
  "tool-tracker",
  "taliho-code",
  "equipment-code",
  "qr-arrangement",
  "procore-location",
  "procore-inspections",
  "procore-tool",
  "procore-drawing",
  "vcard",
  "url",
]);

function isValidTypeId(value: unknown): value is ActiveTypeId {
  return (
    typeof value === "string" &&
    (VALID_TYPE_IDS as Set<string>).has(value)
  );
}

/**
 * Type guard narrowing a `TypeId` (all 19 catalog entries) down to an
 * `ActiveTypeId` (the 10 with routing behavior). Use this at the picker →
 * state-writer boundary so the 9 catalog-only placeholders cannot slip into
 * URL state at compile time.
 */
export function isActiveTypeId(id: TypeId): id is ActiveTypeId {
  return (VALID_TYPE_IDS as Set<string>).has(id);
}

/**
 * Resolves an `ActiveTypeId` from URL state. Prefers the explicit `typeId`
 * param when present and valid; otherwise derives from the legacy
 * `(tab, sub, method)` triple so bookmarked URLs from the old flow keep
 * resolving to the correct Type card.
 *
 * Returns null for the existing-group shortcut path (`tab=bulk` with
 * `groupingId` and `sub=existing-group`) — that path bypasses Type selection
 * entirely. Also returns null for catalog-only placeholders (e.g.
 * `simple-wifi`) since they have no routing behavior.
 */
export function resolveTypeId(state: CreateQRState): ActiveTypeId | null {
  if (isValidTypeId(state.typeId)) return state.typeId;

  // Existing-group shortcut bypasses Type selection.
  if (
    state.tab === "bulk" &&
    state.groupingId &&
    state.sub === "existing-group"
  ) {
    return null;
  }

  const legacy = fromLegacyState(state);
  return legacy?.typeId ?? null;
}

/**
 * Maps a (typeId, quantity, method) triple back into the legacy
 * `(tab, sub, method)` URL shape that `resolveConfigureKey` understands.
 * Returns a partial CreateQRState so callers can merge it into the URL
 * without overwriting unrelated fields like `projectId` or `groupingId`.
 *
 * Coming-soon type IDs (equipment-code, qr-arrangement, procore-inspections)
 * have no legacy representation — callers should only set `typeId` in the
 * URL for those, never the legacy triple. Catalog-only placeholders
 * (`simple-*`) are excluded by the `ActiveTypeId` parameter type so they
 * cannot reach this function.
 */
export function toLegacyState(
  typeId: ActiveTypeId,
  quantity: Quantity | null,
  method: BulkMethod | null,
): Partial<CreateQRState> {
  const out: Partial<CreateQRState> = { typeId };

  switch (typeId) {
    case "taliho-code":
      if (quantity === "single") {
        out.tab = "single";
        out.sub = "taliho";
        out.method = null;
      } else if (quantity === "bulk") {
        if (method === "assorted") {
          out.tab = "bulk";
          out.sub = "arrangements";
          out.method = null;
        } else if (
          method === "prefix-quantity" ||
          method === "upload-csv" ||
          method === "manual-entry"
        ) {
          out.tab = "bulk";
          out.sub = "equipments";
          out.method = method;
        }
      }
      return out;

    case "procore-location":
      out.tab = "single";
      out.sub = "procore-location";
      out.method = null;
      return out;

    case "procore-tool":
      out.tab = "single";
      out.sub = "procore-tool";
      out.method = null;
      return out;

    case "procore-drawing":
      if (quantity === "single") {
        out.tab = "single";
        out.sub = "procore-drawing";
        out.method = null;
      } else if (quantity === "bulk") {
        out.tab = "bulk";
        out.sub = "arrangements";
        out.method = "procore-drawings";
      }
      return out;

    case "vcard":
      out.tab = "single";
      out.sub = "vcard";
      out.method = null;
      return out;

    case "url":
      out.tab = "single";
      out.sub = "url";
      out.method = null;
      return out;

    case "tool-tracker":
      if (quantity === "single") {
        out.tab = "single";
        out.sub = "tool-tracker";
        out.method = null;
      } else if (quantity === "bulk") {
        out.tab = "bulk";
        out.sub = "tool-tracker";
        out.method = null;
      }
      return out;

    // Coming-soon types: no legacy mapping. Return typeId only.
    case "equipment-code":
    case "qr-arrangement":
    case "procore-inspections":
      return out;
  }
}

/**
 * Reverse derivation: given legacy URL state, produce the new-flow triple.
 * Used by `resolveTypeId` for back-compat. Returns null when the state is
 * ambiguous or doesn't correspond to any Type (e.g., existing-group path,
 * step-1 empty state). The `typeId` is always an `ActiveTypeId` since
 * legacy state can only encode the 10 routable types.
 */
export function fromLegacyState(
  state: CreateQRState,
): {
  typeId: ActiveTypeId;
  quantity: Quantity;
  method: BulkMethod | null;
} | null {
  const { tab, sub, method } = state;

  if (tab === "single") {
    switch (sub) {
      case "taliho":
      case "folder":
        return { typeId: "taliho-code", quantity: "single", method: null };
      case "procore-location":
      case "location":
        return {
          typeId: "procore-location",
          quantity: "single",
          method: null,
        };
      case "procore-tool":
      case "tool":
        return { typeId: "procore-tool", quantity: "single", method: null };
      case "procore-drawing":
      case "drawing":
      case "drawings":
        return { typeId: "procore-drawing", quantity: "single", method: null };
      case "vcard":
        return { typeId: "vcard", quantity: "single", method: null };
      case "url":
        return { typeId: "url", quantity: "single", method: null };
      case "tool-tracker":
        return { typeId: "tool-tracker", quantity: "single", method: null };
    }
  }

  if (tab === "bulk") {
    if (sub === "tool-tracker") {
      return { typeId: "tool-tracker", quantity: "bulk", method: null };
    }
    if (sub === "arrangements" || sub === "arrangement") {
      if (
        method === "procore" ||
        method === "drawings" ||
        method === "procore-drawings"
      ) {
        return { typeId: "procore-drawing", quantity: "bulk", method: null };
      }
      return { typeId: "taliho-code", quantity: "bulk", method: "assorted" };
    }
    if (sub === "equipments" || sub === "equipment") {
      let m: BulkMethod = "prefix-quantity";
      if (method === "upload-csv" || method === "csv") m = "upload-csv";
      else if (method === "manual-entry" || method === "manual")
        m = "manual-entry";
      return { typeId: "taliho-code", quantity: "bulk", method: m };
    }
    if (sub === "drawings") {
      return { typeId: "procore-drawing", quantity: "bulk", method: null };
    }
  }

  return null;
}

/** The four labels shown in the step indicator per flow stage. See PRD §6. */
export type FlowStage = "type" | "quantity" | "method" | "configure";

export interface FlowModel {
  /** True when the Type-first flow is active. */
  enabled: boolean;
  stage: FlowStage;
  typeId: ActiveTypeId | null;
  quantity: Quantity | null;
  method: BulkMethod | null;
}

const SINGLE_ONLY_TYPES = new Set<ActiveTypeId>([
  "procore-location",
  "procore-tool",
  "procore-inspections",
  "vcard",
  "url",
]);

const BULK_ONLY_TYPES = new Set<ActiveTypeId>([
  "equipment-code",
  "qr-arrangement",
]);

/**
 * Types that skip the dedicated Quantity step. The Single/Bulk choice is
 * surfaced as an in-form segmented control instead, with the user's last-used
 * mode persisted in localStorage. When `tab` is null for one of these types,
 * the flow defaults to single configure rather than the Quantity step.
 */
const SKIPS_QUANTITY_STEP = new Set<ActiveTypeId>(["tool-tracker"]);

function isBulkMethod(v: unknown): v is BulkMethod {
  return (
    v === "assorted" ||
    v === "prefix-quantity" ||
    v === "upload-csv" ||
    v === "manual-entry"
  );
}

/**
 * Derives the new-flow stage model from URL state. Returns `enabled: false`
 * when the Type-first flag is off so the route keeps the legacy rendering
 * path unchanged.
 *
 * Precedence for `stage` when enabled:
 *   1. Existing-group shortcut (legacy `configureKey === "bulk:existing-group"`)
 *      → "configure" — bypasses Type selection.
 *   2. Legacy triple already resolves a configureKey → "configure".
 *   3. No typeId → "type".
 *   4. Type is single-only or bulk-only → "configure" (quantity implied).
 *   5. Taliho Code + bulk + no method → "method".
 *   6. Otherwise no quantity → "quantity".
 *   7. Else → "configure".
 */
export function computeFlowModel(
  state: CreateQRState,
  flagEnabled: boolean,
  hasLegacyConfigureKey: boolean,
): FlowModel {
  if (!flagEnabled) {
    return {
      enabled: false,
      stage: "type",
      typeId: null,
      quantity: null,
      method: null,
    };
  }

  // Existing-group shortcut: route straight to configure regardless of typeId.
  const isExistingGroupShortcut =
    state.tab === "bulk" &&
    !!state.groupingId &&
    state.sub === "existing-group";

  if (isExistingGroupShortcut || hasLegacyConfigureKey) {
    // Legacy triple resolves a configureKey — the Configure view will render.
    // Pull typeId/quantity/method if derivable so the step tracker can label correctly.
    const derived = fromLegacyState(state);
    return {
      enabled: true,
      stage: "configure",
      typeId: isValidTypeId(state.typeId)
        ? state.typeId
        : (derived?.typeId ?? null),
      quantity: derived?.quantity ?? null,
      method: derived?.method ?? null,
    };
  }

  const typeId = resolveTypeId(state);
  if (!typeId) {
    return {
      enabled: true,
      stage: "type",
      typeId: null,
      quantity: null,
      method: null,
    };
  }

  // Single-only types imply quantity = single and go straight to configure
  // once the legacy triple is written. If we get here with a single-only
  // type but no legacy triple, we're mid-transition — treat as configure.
  if (SINGLE_ONLY_TYPES.has(typeId)) {
    return {
      enabled: true,
      stage: "configure",
      typeId,
      quantity: "single",
      method: null,
    };
  }

  // Bulk-only types (coming soon) behave similarly.
  if (BULK_ONLY_TYPES.has(typeId)) {
    return {
      enabled: true,
      stage: "configure",
      typeId,
      quantity: "bulk",
      method: null,
    };
  }

  // Dual-quantity types: Tool Tracker, Taliho Code, Procore Drawing.
  // Quantity is encoded via `tab` in the legacy triple. If tab is null we
  // haven't picked quantity yet.
  const quantity: Quantity | null =
    state.tab === "single" ? "single" : state.tab === "bulk" ? "bulk" : null;

  if (quantity === null) {
    // Types that skip the Quantity step (Tool Tracker) default to single
    // configure rather than rendering a dedicated picker.
    if (SKIPS_QUANTITY_STEP.has(typeId)) {
      return {
        enabled: true,
        stage: "configure",
        typeId,
        quantity: "single",
        method: null,
      };
    }
    return {
      enabled: true,
      stage: "quantity",
      typeId,
      quantity: null,
      method: null,
    };
  }

  // Taliho Code + Bulk without a method yet → Method step.
  if (typeId === "taliho-code" && quantity === "bulk") {
    const method = isBulkMethod(state.method)
      ? state.method
      : state.sub === "equipments" || state.sub === "equipment"
        ? "prefix-quantity" // default method for equipment sub
        : state.sub === "arrangements" || state.sub === "arrangement"
          ? "assorted"
          : null;

    if (method === null) {
      return {
        enabled: true,
        stage: "method",
        typeId,
        quantity,
        method: null,
      };
    }
    return {
      enabled: true,
      stage: "configure",
      typeId,
      quantity,
      method,
    };
  }

  // Everything else lands on configure.
  return {
    enabled: true,
    stage: "configure",
    typeId,
    quantity,
    method: null,
  };
}

/**
 * Maps the derived FlowModel stage to a 1-indexed step number for
 * `CreateQRStepTracker`. The step number equals the position of the current
 * stage in the `labels` array returned by `deriveStageLabels`.
 */
export function stageToCurrentStep(model: FlowModel, totalSteps: number): number {
  switch (model.stage) {
    case "type":
      return 1;
    case "quantity":
      return 2;
    case "method":
      return 3;
    case "configure":
      return totalSteps;
  }
}

/**
 * Produces the step-indicator label array for the new flow.
 *
 * - Single-only types → 2 steps: [typeName, "Name"]
 * - Dual-quantity types → 3 steps: [typeName, quantityLabel, "Name"]
 * - Taliho Code → Bulk → 4 steps: ["Taliho Code", "Bulk", "Method", "Name"]
 * - Pre-selection (stage=type, typeId=null) → ["Type", "Quantity", "Name"]
 */
export function deriveStageLabels(
  model: FlowModel,
  typeName: string | null,
): string[] {
  const { stage, typeId, quantity } = model;

  if (!typeId) {
    return ["Type", "Quantity", "Name"];
  }

  const label = typeName ?? "Type";

  // Taliho Code → Bulk branch has 4 steps.
  if (typeId === "taliho-code" && quantity === "bulk") {
    return [label, "Bulk", "Method", "Name"];
  }

  // Single-only types collapse to 2 steps.
  const isSingleOnlyType =
    typeId === "procore-location" ||
    typeId === "procore-tool" ||
    typeId === "procore-inspections" ||
    typeId === "vcard" ||
    typeId === "url";
  if (isSingleOnlyType) {
    return [label, "Name"];
  }

  // Bulk-only coming-soon types.
  const isBulkOnlyType =
    typeId === "equipment-code" || typeId === "qr-arrangement";
  if (isBulkOnlyType) {
    return [label, "Name"];
  }

  // Types that skip the Quantity step (Tool Tracker) also collapse to 2 steps.
  // Single vs Bulk is chosen via an in-form segmented control rather than a
  // dedicated step in the indicator.
  if (SKIPS_QUANTITY_STEP.has(typeId)) {
    return [label, "Name"];
  }

  // Dual-quantity types (Tool Tracker, Taliho Code single, Procore Drawing).
  if (stage === "quantity" || quantity === null) {
    return [label, "Quantity", "Name"];
  }

  // Quantity chosen → show concrete label (Single / Bulk).
  const qLabel = quantity === "single" ? "Single" : "Bulk";
  return [label, qLabel, "Name"];
}
