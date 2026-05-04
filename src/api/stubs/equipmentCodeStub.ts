/**
 * Equipment Code backend stub.
 *
 * TODO(backend): replace with the real client. The v2 Equipment Code
 * creation flow currently calls this stub synchronously. V3's production
 * wizard hits two endpoints depending on method:
 *   - Prefix + Quantity → POST /qr-code/bulk-async (returns a jobId; SSE/poll)
 *   - CSV / Manual     → POST /qr-code/bulk-items-async (returns a jobId; SSE/poll)
 *
 * The async-job-tracking pattern (see `connectJobStream` /
 * `getJobStatus` in `src/api/endpoints/qr-codes.ts`) needs to be
 * preserved when productionizing — see BUGS.md OBS-002.
 *
 * Returns a Promise with a 500–800ms artificial delay so loading states
 * are visible during click-through QA.
 */

import type {
  CreateEquipmentCodesPayload,
  CreateEquipmentCodesResponse,
  EquipmentCode,
} from "@/components/create-qr/equipmentCode/types";

function delay(): Promise<void> {
  const ms = 500 + Math.floor(Math.random() * 300);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createEquipmentCodes(
  payload: CreateEquipmentCodesPayload,
): Promise<CreateEquipmentCodesResponse> {
  console.info("[stub] equipmentCode:createEquipmentCodes:", payload);
  await delay();

  const baseTimestamp = Date.now();
  const created: EquipmentCode[] = payload.codes.map((code, index) => {
    const equipmentCodeId = `stub-eq-${baseTimestamp}-${index}`;
    const qrCodeId = `stub-qr-${baseTimestamp}-${index}`;
    const now = new Date().toISOString();
    return {
      equipmentCodeId,
      qrCodeId,
      qrPayloadUrl: `https://taliho.example/scan/${qrCodeId}`,
      code,
      projectId: payload.projectId,
      groupingId: payload.groupingId,
      createdAt: now,
    };
  });

  return { equipmentCodes: created };
}
