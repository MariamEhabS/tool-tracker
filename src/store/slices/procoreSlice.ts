/**
 * Manages cached Procore tool data fetched from the Procore API via the backend.
 *
 * This slice stores arrays of items for each Procore tool type (documents,
 * drawings, RFIs, submittals, inspections, etc.). The state keys are derived
 * from `toolsMap` in `src/utils/toolMap.ts`, ensuring a 1:1 mapping between
 * tool keys and their cached data arrays.
 *
 * State shape:
 * - One key per Procore tool (e.g. "coordination-issue", "document", "drawing",
 *   "form", "incident", "inspection", "instruction", "observation", "photo",
 *   "punch-list", "rfi", "submittal", "specification", "task", "directory"),
 *   each holding an `unknown[]` array of that tool's items.
 * - default: A fallback empty array for unrecognized tool keys.
 *
 * Procore API responses may arrive as plain arrays, `{ data, hiddenIds }` objects,
 * or `{ items }` objects. The `normalizeResponse` helper normalizes all shapes
 * into a consistent array before storing.
 *
 * Used by: Display category data component, QR code paginated table
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { toolsMap } from "../../utils/toolMap";

type ProcoreResponse =
  | unknown[]
  | { data: unknown[]; hiddenIds?: unknown }
  | { items: unknown[] };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

function normalizeResponse(response: ProcoreResponse): unknown[] {
  if (Array.isArray(response)) return response;
  if (!isRecord(response)) return [];

  if ("data" in response && Array.isArray(response.data)) {
    return response.data;
  }

  if ("items" in response && Array.isArray(response.items)) {
    return response.items;
  }

  return [];
}

type ToolKey = keyof typeof toolsMap;
type ProcoreState = Record<ToolKey, unknown[]> & { default: unknown[] };

const toolInitialState = Object.fromEntries(
  (Object.keys(toolsMap) as ToolKey[]).map((tool) => [tool, [] as unknown[]]),
) as Record<ToolKey, unknown[]>;

const initialState: ProcoreState = {
  ...toolInitialState,
  default: [],
};

const procoreDataSlice = createSlice({
  name: "procore",
  initialState,
  reducers: {
    /**
     * Stores (or replaces) the cached item array for a specific Procore tool.
     * The response is normalized from various API response shapes into a flat array.
     */
    updateProcore: (
      state,
      action: PayloadAction<{ tool: ToolKey; response: ProcoreResponse }>,
    ) => {
      const { tool, response } = action.payload;
      // Most Procore tool endpoints return arrays, but some endpoints (or modes)
      // may return `{ data, hiddenIds }`. Keep the Redux shape consistent as an array.
      const normalized = normalizeResponse(response);

      state[tool] = normalized;
    },
  },
});

export const { updateProcore } = procoreDataSlice.actions;
export default procoreDataSlice.reducer;
