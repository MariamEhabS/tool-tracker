/**
 * Shared TypeScript types for the Tool Tracker creation flow.
 * Backend contract per PRD §10.
 */

export type ToolTrackerIdentification = "name" | "name_phone" | "login";

export type ToolTrackerLoanPeriod = "4h" | "1d" | "3d" | "1w" | "custom";

export type ToolTrackerPinMode = "smart" | "custom";

export type ToolTrackerStatus = "available" | "out" | "overdue" | "retired";

export type ToolRetirementReason =
  | "broken"
  | "lost"
  | "sold"
  | "scrapped"
  | "other";

export interface ToolRetirement {
  reason: ToolRetirementReason;
  /** ISO 8601 date string (YYYY-MM-DD). */
  retiredAt: string;
  notes?: string;
}

export interface ToolTrackerRules {
  identification: ToolTrackerIdentification;
  allowHandoffs: boolean;
  trackDueDates: boolean;
  defaultLoanPeriod: ToolTrackerLoanPeriod;
  /** Hours when defaultLoanPeriod === "custom". */
  customLoanPeriodHours?: number;
  pinEnabled: boolean;
  /** Required when pinEnabled is true. */
  pinMode?: ToolTrackerPinMode;
  /** 4-digit numeric PIN; required when pinMode === "custom". */
  customPin?: string;
}

export interface ToolTrackerPhoto {
  mediaUrl: string;
}

export interface ToolAssignedStaff {
  name: string;
  phone?: string;
}

export interface ToolInput {
  name: string;
  category?: string;
  serial?: string;
  homeLocation?: string;
  photo?: ToolTrackerPhoto;
  /** Staff member who owns this tool's kit. Distinct from `currentCustodian`,
   * which is whoever has it signed out *right now*. */
  assignedTo?: ToolAssignedStaff;
  // Granular fields (single-tool form only):
  manufacturer?: string;
  model?: string;
  barcode?: string;
  description?: string;
  vendor?: string;
  /** ISO 8601 date string. */
  purchaseDate?: string;
  /** Stored as string for display fidelity (e.g. "129.99"). */
  purchasePrice?: string;
  /** ISO 8601 date string. */
  warrantyDate?: string;
  productUrl?: string;
  manualUrl?: string;
}

export interface ToolTrackerCustodian {
  name: string;
  phone?: string;
  /** ISO timestamp when the tool was signed out. */
  signedOutAt: string;
  gpsLat?: number;
  gpsLng?: number;
  /** ISO timestamp when the tool is due back; present when rules.trackDueDates. */
  dueAt?: string;
}

export interface ToolTracker {
  toolId: string;
  qrCodeId: string;
  /** What the QR encodes (the public scan URL). */
  qrPayloadUrl: string;
  tool: ToolInput;
  rules: ToolTrackerRules;
  status: ToolTrackerStatus;
  currentCustodian?: ToolTrackerCustodian;
  /** ISO timestamp. */
  createdAt: string;
  /** ISO timestamp. */
  updatedAt: string;
  /** True if the PM has retired the tool (Stage 7 ToolNoLongerActive). */
  disabled?: boolean;
  /** Set when the tool has been decommissioned. Preserves history per Stage 7. */
  retirement?: ToolRetirement;
}

export interface ToolHistoryGps {
  lat: number;
  lng: number;
}

export interface ToolHistoryEvent {
  eventId: string;
  custodianName: string;
  custodianPhone?: string;
  /** ISO timestamp. */
  signedOutAt: string;
  /** ISO timestamp; null/undefined while still out. */
  signedInAt?: string;
  durationMinutes?: number;
  signOutGps?: ToolHistoryGps;
  signInGps?: ToolHistoryGps;
}

export interface ToolHistoryPage {
  events: ToolHistoryEvent[];
  page: number;
  pageSize: number;
  totalEvents: number;
}

export interface CreateToolTrackersPayload {
  tools: ToolInput[];
  rules: ToolTrackerRules;
  groupId?: string;
  projectId?: string;
}

export interface CreateToolTrackersResponse {
  toolTrackers: ToolTracker[];
}
