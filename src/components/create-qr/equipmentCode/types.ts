/**
 * Equipment Code domain types for the v2 flat creation flow.
 *
 * Minimal by design: each equipment code is just a string identifier (the
 * code itself) with optional project + group association. V3's Equipment
 * type carried legacy fields (passwords, time-window passwords,
 * descriptions, Procore webhook config, etc.) that are not in scope for v2
 * — see BUGS.md Q-001 for the open question on whether any production
 * customers depend on those.
 */

export interface EquipmentCode {
  /** Stable backend ID once persisted. */
  equipmentCodeId: string;
  /** QR code ID (one per equipment record). */
  qrCodeId: string;
  /** What the QR encodes (the public scan URL). */
  qrPayloadUrl: string;
  /** The code string itself — what the user typed/imported/generated. */
  code: string;
  /** Optional project association. */
  projectId?: string;
  /** Optional group association. */
  groupingId?: string;
  /** ISO timestamp. */
  createdAt: string;
}

export interface CreateEquipmentCodesPayload {
  /** Flat list of code strings to create. */
  codes: string[];
  /** Optional project to associate with every code in this batch. */
  projectId?: string;
  /** Optional group to associate with every code in this batch. */
  groupingId?: string;
}

export interface CreateEquipmentCodesResponse {
  equipmentCodes: EquipmentCode[];
}
