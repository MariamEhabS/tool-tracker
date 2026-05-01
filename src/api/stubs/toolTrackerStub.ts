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
