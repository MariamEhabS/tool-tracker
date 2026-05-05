export const SAMPLE_TOOL_CATEGORIES = [
  "Uncategorized",
  "Power Tools",
  "Hand Tools",
  "Safety Gear",
  "Electrical",
  "Plumbing",
  "Surveying",
  "Ladders",
  "Material Handling",
  "Testing Equipment",
];

/**
 * Prototype seed for the Tool Tracker single-create form. Used as the
 * initial form state so client demos land on a realistic, fully-populated
 * tool record instead of empty fields. Remove (or gate behind a dev flag)
 * before the feature ships to real users.
 */
export const SAMPLE_TOOL_SEED = {
  name: "DeWalt 20V Impact Driver (DCF887)",
  category: "Power Tools",
  serial: "4821-A9C",
  homeLocation: "Warehouse B — Cage 3",
  manufacturer: "DeWalt",
  model: "DCF887",
  barcode: "885911614283",
  description:
    "Brushless 1/4\" hex impact driver. Includes (2) 20V MAX 5.0Ah batteries, fast charger, and contractor bag.",
  vendor: "Home Depot — Pro Desk",
  purchaseDate: "2024-08-12",
  purchasePrice: "199.00",
  warrantyDate: "2027-08-12",
  productUrl: "https://www.dewalt.com/product/dcf887b",
  manualUrl: "https://www.dewalt.com/manuals/dcf887",
} as const;

/**
 * Prototype project list. Real projects come from the API; for the demo
 * we use these so Move-to-project actions and the project filter share
 * a single source of truth.
 */
export const SAMPLE_PROJECTS: { id: string; name: string }[] = [
  { id: "proj-oak", name: "Oak St. House" },
  { id: "proj-pine", name: "14th & Pine Tower" },
  { id: "proj-river", name: "Riverside Civic Center" },
];

export type SampleToolStatus = "available" | "out" | "overdue" | "retired";

export type SampleToolRetirementReason =
  | "broken"
  | "lost"
  | "sold"
  | "scrapped"
  | "other";

export interface SampleToolRecord {
  id: string;
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  serial: string;
  homeLocation: string;
  assignedTo: string;
  projectId: string;
  status: SampleToolStatus;
  /** ISO date the tool last had a sign-in or sign-out scan. */
  lastScanAt: string;
  /** ISO date the tool is due to be returned. Only meaningful when
   * status is "out" or "overdue"; undefined otherwise. */
  dueBackAt?: string;
  /** ISO date the QR record was created. */
  createdAt: string;
  purchaseDate: string;
  warrantyDate: string;
  /** Set when status === "retired". */
  retirement?: {
    reason: SampleToolRetirementReason;
    retiredAt: string;
    notes?: string;
  };
  // Rich detail fields surfaced in the Tool Detail modal. All optional so
  // less-fleshed-out demo records render gracefully.
  barcode?: string;
  description?: string;
  vendor?: string;
  /** Stored as a string for display fidelity (e.g. "199.00"). */
  purchasePrice?: string;
  productUrl?: string;
  manualUrl?: string;
  /** When status is "out" or "overdue", who has it right now. */
  currentCustodian?: { name: string; phone?: string };
  /** Optional purchase receipt — image or PDF. UI-only for the prototype. */
  receipt?: {
    name: string;
    mimeType: string;
    kind: "image" | "pdf";
    url: string;
  };
  /** When set, this tool is bundled into a Gang (a named kit/crew bundle). */
  gangId?: string;
}

export interface SampleGang {
  id: string;
  name: string;
  /** The gang foreman / lead. Tools inside may have different owners
   * (assignedTo) — the foreman is who's responsible for the kit overall. */
  foreman?: string;
  createdAt: string;
}

/**
 * Prototype seed: ~15 tools across 4 staff, 3 projects, all 4 statuses.
 * Used by the Tools list page (`/tools`) so the demo table renders with
 * realistic variety. Replace with a live `useListQRCodes({ types:
 * ["tool-tracker"] })` query when the backend exists.
 */
export const SAMPLE_TOOLS_ARRAY: SampleToolRecord[] = [
  {
    id: "tool-001",
    name: "DeWalt 20V Impact Driver (DCF887)",
    category: "Power Tools",
    manufacturer: "DeWalt",
    model: "DCF887",
    serial: "4821-A9C",
    homeLocation: "Warehouse B — Cage 3",
    assignedTo: "Mike R.",
    projectId: "proj-oak",
    status: "out",
    lastScanAt: "2026-05-04T08:14:00Z",
    dueBackAt: "2026-05-07",
    createdAt: "2024-08-13T14:22:00Z",
    purchaseDate: "2024-08-12",
    warrantyDate: "2027-08-12",
    barcode: "885911614283",
    description:
      "Brushless 1/4\" hex impact driver. Includes (2) 20V MAX 5.0Ah batteries, fast charger, and contractor bag.",
    vendor: "Home Depot — Pro Desk",
    purchasePrice: "199.00",
    productUrl: "https://www.dewalt.com/product/dcf887b",
    manualUrl: "https://www.dewalt.com/manuals/dcf887",
    currentCustodian: { name: "Mike R.", phone: "555-0143" },
  },
  {
    id: "tool-002",
    name: "Milwaukee Sawzall (2720-21)",
    category: "Power Tools",
    manufacturer: "Milwaukee",
    model: "2720-21",
    serial: "MW-77310",
    homeLocation: "Truck 4",
    assignedTo: "Mike R.",
    projectId: "proj-oak",
    status: "available",
    lastScanAt: "2026-05-02T17:05:00Z",
    createdAt: "2024-09-02T10:11:00Z",
    purchaseDate: "2024-09-01",
    warrantyDate: "2029-09-01",
  },
  {
    id: "tool-003",
    name: "Bosch GLL3-330CG Laser Level",
    category: "Surveying",
    manufacturer: "Bosch",
    model: "GLL3-330CG",
    serial: "BSH-44918",
    homeLocation: "Warehouse A — Bin 12",
    assignedTo: "Sarah K.",
    projectId: "proj-pine",
    status: "overdue",
    lastScanAt: "2026-04-26T13:40:00Z",
    dueBackAt: "2026-04-29",
    createdAt: "2024-06-18T09:00:00Z",
    purchaseDate: "2024-06-17",
    warrantyDate: "2026-06-17",
    description:
      "Self-leveling 360° green-beam laser. Includes BM1 mount and L-Boxx case.",
    vendor: "Acme Construction Supply",
    purchasePrice: "599.00",
    currentCustodian: { name: "Sarah K.", phone: "555-0188" },
  },
  {
    id: "tool-004",
    name: "Stanley FatMax 25' Tape Measure",
    category: "Hand Tools",
    manufacturer: "Stanley",
    model: "33-725",
    serial: "ST-12044",
    homeLocation: "Warehouse B — Bin 5",
    assignedTo: "Devon P.",
    projectId: "proj-river",
    status: "available",
    lastScanAt: "2026-05-04T11:50:00Z",
    createdAt: "2024-03-22T08:30:00Z",
    purchaseDate: "2024-03-21",
    warrantyDate: "2025-03-21",
  },
  {
    id: "tool-005",
    name: "Klein Tools Lineman's Pliers (D213-9NE)",
    category: "Hand Tools",
    manufacturer: "Klein",
    model: "D213-9NE",
    serial: "KL-88121",
    homeLocation: "Truck 2",
    assignedTo: "Devon P.",
    projectId: "proj-river",
    status: "out",
    lastScanAt: "2026-05-05T07:22:00Z",
    dueBackAt: "2026-05-08",
    createdAt: "2024-04-08T15:00:00Z",
    purchaseDate: "2024-04-07",
    warrantyDate: "2099-12-31",
  },
  {
    id: "tool-006",
    name: "Stabila 48\" Box Beam Level",
    category: "Surveying",
    manufacturer: "Stabila",
    model: "37448",
    serial: "SB-99214",
    homeLocation: "Warehouse A — Rack 7",
    assignedTo: "Sarah K.",
    projectId: "proj-pine",
    status: "available",
    lastScanAt: "2026-04-30T16:10:00Z",
    createdAt: "2024-05-12T11:45:00Z",
    purchaseDate: "2024-05-11",
    warrantyDate: "2034-05-11",
  },
  {
    id: "tool-007",
    name: "DeWalt 12\" Compound Miter Saw",
    category: "Power Tools",
    manufacturer: "DeWalt",
    model: "DWS779",
    serial: "DW-66401",
    homeLocation: "Warehouse B — Floor",
    assignedTo: "Lou T.",
    projectId: "proj-oak",
    status: "out",
    lastScanAt: "2026-05-05T06:48:00Z",
    dueBackAt: "2026-05-06",
    createdAt: "2024-02-14T09:00:00Z",
    purchaseDate: "2024-02-13",
    warrantyDate: "2027-02-13",
    vendor: "Home Depot — Pro Desk",
    purchasePrice: "549.00",
    description:
      "Double-bevel sliding compound miter saw. Stand, blade guard, and dust bag included.",
    currentCustodian: { name: "Lou T.", phone: "555-0220" },
  },
  {
    id: "tool-008",
    name: "Werner 8' Fiberglass Step Ladder",
    category: "Ladders",
    manufacturer: "Werner",
    model: "6208",
    serial: "WR-30015",
    homeLocation: "Warehouse A — Rack 1",
    assignedTo: "Lou T.",
    projectId: "proj-oak",
    status: "available",
    lastScanAt: "2026-05-01T10:00:00Z",
    createdAt: "2023-11-04T14:30:00Z",
    purchaseDate: "2023-11-03",
    warrantyDate: "2028-11-03",
  },
  {
    id: "tool-009",
    name: "MSA V-Gard Hard Hat",
    category: "Safety Gear",
    manufacturer: "MSA",
    model: "V-Gard 475358",
    serial: "MSA-71200",
    homeLocation: "Warehouse A — PPE Locker",
    assignedTo: "Mike R.",
    projectId: "proj-oak",
    status: "available",
    lastScanAt: "2026-05-03T07:00:00Z",
    createdAt: "2025-01-10T08:00:00Z",
    purchaseDate: "2025-01-09",
    warrantyDate: "2030-01-09",
  },
  {
    id: "tool-010",
    name: "Milwaukee M18 Drill (2804-20)",
    category: "Power Tools",
    manufacturer: "Milwaukee",
    model: "2804-20",
    serial: "MW-90122",
    homeLocation: "Truck 4",
    assignedTo: "Sarah K.",
    projectId: "proj-pine",
    status: "out",
    lastScanAt: "2026-05-05T08:30:00Z",
    dueBackAt: "2026-05-09",
    createdAt: "2024-10-19T13:20:00Z",
    purchaseDate: "2024-10-18",
    warrantyDate: "2029-10-18",
  },
  {
    id: "tool-011",
    name: "Bosch SDS-Plus Rotary Hammer (RH328VC)",
    category: "Power Tools",
    manufacturer: "Bosch",
    model: "RH328VC",
    serial: "BSH-22078",
    homeLocation: "Warehouse B — Cage 4",
    assignedTo: "Lou T.",
    projectId: "proj-river",
    status: "overdue",
    lastScanAt: "2026-04-22T12:00:00Z",
    dueBackAt: "2026-04-25",
    createdAt: "2024-07-30T16:00:00Z",
    purchaseDate: "2024-07-29",
    warrantyDate: "2025-07-29",
    description:
      "Variable-speed SDS-Plus rotary hammer with vibration control.",
    vendor: "Acme Construction Supply",
    purchasePrice: "319.00",
    currentCustodian: { name: "Lou T.", phone: "555-0220" },
  },
  {
    id: "tool-012",
    name: "Klein Tools Voltage Tester (NCVT-3)",
    category: "Hand Tools",
    manufacturer: "Klein",
    model: "NCVT-3",
    serial: "KL-44091",
    homeLocation: "Truck 2",
    assignedTo: "Devon P.",
    projectId: "proj-river",
    status: "available",
    lastScanAt: "2026-05-04T14:55:00Z",
    createdAt: "2024-12-05T10:00:00Z",
    purchaseDate: "2024-12-04",
    warrantyDate: "2026-12-04",
  },
  {
    id: "tool-013",
    name: "DeWalt Brushless Circular Saw (DCS570B)",
    category: "Power Tools",
    manufacturer: "DeWalt",
    model: "DCS570B",
    serial: "DW-50020",
    homeLocation: "Warehouse B — Cage 3",
    assignedTo: "Mike R.",
    projectId: "proj-oak",
    status: "retired",
    lastScanAt: "2025-12-18T15:30:00Z",
    createdAt: "2023-04-11T09:00:00Z",
    purchaseDate: "2023-04-10",
    warrantyDate: "2026-04-10",
    retirement: {
      reason: "broken",
      retiredAt: "2025-12-19",
      notes: "Motor seized after taking on water during the December storm. Replaced by tool-014.",
    },
  },
  {
    id: "tool-014",
    name: "DeWalt FlexVolt Circular Saw (DCS578X1)",
    category: "Power Tools",
    manufacturer: "DeWalt",
    model: "DCS578X1",
    serial: "DW-58812",
    homeLocation: "Warehouse B — Cage 3",
    assignedTo: "Mike R.",
    projectId: "proj-oak",
    status: "available",
    lastScanAt: "2026-05-03T09:15:00Z",
    createdAt: "2025-12-22T11:00:00Z",
    purchaseDate: "2025-12-20",
    warrantyDate: "2028-12-20",
  },
  {
    id: "tool-015",
    name: "Stanley 22oz Framing Hammer",
    category: "Hand Tools",
    manufacturer: "Stanley",
    model: "51-167",
    serial: "ST-09921",
    homeLocation: "Truck 1",
    assignedTo: "Lou T.",
    projectId: "proj-river",
    status: "retired",
    lastScanAt: "2025-09-05T08:00:00Z",
    createdAt: "2022-08-14T10:00:00Z",
    purchaseDate: "2022-08-13",
    warrantyDate: "2099-12-31",
    retirement: {
      reason: "lost",
      retiredAt: "2025-09-06",
      notes: "Last seen on the Riverside Civic Center site. Searched by two crews, never recovered.",
    },
  },
];

/** Convenience: unique staff names from the seed, for filter dropdowns. */
export const SAMPLE_STAFF: string[] = Array.from(
  new Set(SAMPLE_TOOLS_ARRAY.map((t) => t.assignedTo)),
).sort();

/**
 * Prototype seed: one Gang already exists so the demo lands showing the
 * grouped layout. Member tools (tool-001 Impact Driver, tool-002 Sawzall,
 * tool-009 Hard Hat) all happen to be assigned to Mike R., so this seed
 * exercises the "single owner" path. Use the Gang Tools button to
 * exercise the "mixed owner" conflict-resolution path.
 */
export const SAMPLE_GANGS: SampleGang[] = [
  {
    id: "gang-001",
    name: "M. Smith Gangbox",
    foreman: "Mike R.",
    createdAt: "2026-04-12T09:00:00Z",
  },
];

// Apply the seed gang membership to the underlying records.
const SEED_GANG_MEMBERSHIPS: Record<string, string> = {
  "tool-001": "gang-001",
  "tool-002": "gang-001",
  "tool-009": "gang-001",
};
for (const tool of SAMPLE_TOOLS_ARRAY) {
  const gangId = SEED_GANG_MEMBERSHIPS[tool.id];
  if (gangId) tool.gangId = gangId;
}
