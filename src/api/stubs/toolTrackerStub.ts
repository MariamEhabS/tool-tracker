import type {
  CreateToolTrackersPayload,
  CreateToolTrackersResponse,
  ToolTracker,
} from "@/components/create-qr/toolTracker/types";

type ToolTrackerStatus = "available" | "checked-out" | "handoff-requested";

type ToolTrackerRecord = {
  toolId: string;
  qrCodeId: string;
  name: string;
  status: ToolTrackerStatus;
  lastEventAt: string | null;
};

type ScanMutationResult = {
  ok: boolean;
  status: ToolTrackerStatus;
  timestamp: string;
};

const nowIso = () => new Date().toISOString();
const toolTrackers: ToolTracker[] = [];

const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const createToolTrackers = async (
  payload: CreateToolTrackersPayload,
): Promise<CreateToolTrackersResponse> => {
  console.info("[stub] toolTracker:createToolTrackers:", payload);
  await delay(500);

  const baseTimestamp = Date.now();
  const created = payload.tools.map((tool, index) => {
    const now = nowIso();
    const createdTool: ToolTracker = {
      toolId: `stub-tt-${baseTimestamp}-${index}`,
      qrCodeId: `stub-qr-${baseTimestamp}-${index}`,
      qrPayloadUrl: `https://taliho.test/scan/stub-tt-${baseTimestamp}-${index}`,
      tool,
      rules: payload.rules,
      status: "available",
      createdAt: now,
      updatedAt: now,
    };
    toolTrackers.push(createdTool);
    return createdTool;
  });

  return { toolTrackers: created };
};

export const getPrintablePDF = async (_toolId: string): Promise<Blob> => {
  await delay(200);
  return new Blob([new Uint8Array([0x25])], { type: "application/pdf" });
};

export const getToolByQRCode = async (
  qrCodeId: string,
): Promise<ToolTrackerRecord> => ({
  toolId: `stub-tool-${qrCodeId}`,
  qrCodeId,
  name: "Tool Tracker Stub",
  status: "available",
  lastEventAt: null,
});

export const signOut = async (): Promise<ScanMutationResult> => ({
  ok: true,
  status: "checked-out",
  timestamp: nowIso(),
});

export const signIn = async (): Promise<ScanMutationResult> => ({
  ok: true,
  status: "available",
  timestamp: nowIso(),
});

export const uploadScanPhoto = async (): Promise<{
  ok: boolean;
  imageUrl: string;
}> => ({
  ok: true,
  imageUrl: "https://example.com/tool-tracker-stub-photo.jpg",
});

export const verifySmartPin = async (
  _toolId: string,
  smartPin: string,
): Promise<{ valid: boolean }> => ({
  valid: smartPin.trim().length > 0,
});

export const reportWrongTool = async (): Promise<{
  ok: boolean;
  reportedAt: string;
}> => ({
  ok: true,
  reportedAt: nowIso(),
});

export const requestHandoff = async (): Promise<ScanMutationResult> => ({
  ok: true,
  status: "handoff-requested",
  timestamp: nowIso(),
});
