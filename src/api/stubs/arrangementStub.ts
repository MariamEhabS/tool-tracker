/**
 * QR Arrangement backend stub.
 *
 * TODO(backend): replace with the real client. The v2 QR Arrangement
 * creation flow currently calls this stub synchronously. V3's production
 * wizard hits `POST /qr-code/bulk-items-async` (returns a jobId; SSE/poll)
 * after creating the underlying Group via `POST /groups`. The async-job
 * pattern needs to be preserved when productionizing — see BUGS.md OBS-002
 * for the parallel Equipment-Code handoff note.
 *
 * Returns a Promise with a 500–800ms artificial delay so loading states
 * are visible during click-through QA.
 */

import type {
  CreateArrangementPayload,
  CreateArrangementResponse,
  CreatedArrangement,
} from "@/components/create-qr/arrangement/types";

function delay(): Promise<void> {
  const ms = 500 + Math.floor(Math.random() * 300);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createArrangement(
  payload: CreateArrangementPayload,
): Promise<CreateArrangementResponse> {
  console.info("[stub] arrangement:createArrangement:", payload);
  await delay();

  const baseTimestamp = Date.now();
  const arrangementId = `stub-arr-${baseTimestamp}`;
  const arrangement: CreatedArrangement = {
    arrangementId,
    groupId: arrangementId,
    name: payload.name,
    projectId: payload.projectId,
    itemCount: payload.items.length,
    createdAt: new Date().toISOString(),
  };
  return {
    arrangement,
    items: payload.items,
  };
}
