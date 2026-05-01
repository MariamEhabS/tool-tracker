import { axiosInstance } from "..";
import { useQuery } from "@tanstack/react-query";
import type {
  BallInCourtWorkflow,
  BallInCourtTask,
  BicDateMode,
  BicWorkflowSummary,
  BicWorkflowWithTasks,
  BicTrade,
} from "@/types";

export type BicActorContext = {
  foremanProcoreId: string;
  foremanName: string;
  foremanEmail?: string;
  foremanCompany?: string;
  tradeName?: string;
};

export type BicNotificationResult = {
  audience: "first" | "all";
  eligibleCount: number;
  sentCount: number;
  recipients: string[];
};

export type BicRecordEmailResult = {
  sentTo: string;
  stepNumber: number;
};

const flattenBicActor = (actor?: BicActorContext) => ({
  foremanProcoreId: actor?.foremanProcoreId,
  foremanName: actor?.foremanName,
  foremanEmail: actor?.foremanEmail,
  foremanCompany: actor?.foremanCompany,
});

export const buildBicActorContext = (
  trade: Pick<
    BicTrade,
    | "foremanProcoreId"
    | "foremanName"
    | "foremanEmail"
    | "foremanCompany"
    | "tradeName"
  > | undefined,
): BicActorContext | undefined => {
  if (!trade) return undefined;
  return {
    foremanProcoreId: trade.foremanProcoreId,
    foremanName: trade.foremanName,
    foremanEmail: trade.foremanEmail,
    foremanCompany: trade.foremanCompany,
    tradeName: trade.tradeName,
  };
};

// ─── Query Key Factory ────────────────────────────────────────────────────────

export const BicKeys = {
  all: ["BallInCourt"] as const,
  byQrCode: (qrCodeId: string) =>
    [...BicKeys.all, "qr", qrCodeId] as const,
  single: (workflowId: string) =>
    [...BicKeys.all, "single", workflowId] as const,
};

// ─── PM Authenticated Mutations ───────────────────────────────────────────────

export const createWorkflow = async (dto: {
  name: string;
  qrCodeId: string;
  companyId: string;
  projectId?: string;
  procoreProjectId?: string;
  trades: Array<{
    order: number;
    foremanProcoreId: string;
    foremanName: string;
    foremanEmail?: string;
    foremanCompany: string;
    tradeName: string;
  }>;
  tasks: Array<{
    tradeIndex: number;
    order: number;
    description: string;
    requirePicture?: boolean;
    requireNotes?: boolean;
    datesAssignedByPm?: boolean;
    dateMode?: BicDateMode;
    startDate?: string;
    endDate?: string;
  }>;
}): Promise<{ workflow: BallInCourtWorkflow; tasks: BallInCourtTask[] }> => {
  const { data } = await axiosInstance.post("/ball-in-court", dto);
  return data.data;
};

export const deleteWorkflow = async (workflowId: string): Promise<void> => {
  await axiosInstance.delete(`/ball-in-court/${workflowId}`);
};

export const notifyFirstWorkflowParticipant = async (
  workflowId: string,
): Promise<BicNotificationResult> => {
  const { data } = await axiosInstance.post(
    `/ball-in-court/${workflowId}/notifications/first`,
  );
  return data.data;
};

export const notifyAllWorkflowParticipants = async (
  workflowId: string,
  opts?: { includeFirst?: boolean },
): Promise<BicNotificationResult> => {
  const { data } = await axiosInstance.post(
    `/ball-in-court/${workflowId}/notifications/all`,
    { includeFirst: opts?.includeFirst ?? true },
  );
  return data.data;
};

export const sendTradeRecordEmail = async (
  workflowId: string,
  tradeIndex: number,
  actor?: BicActorContext,
  opts?: { clientTimeZone?: string },
): Promise<BicRecordEmailResult> => {
  const { data } = await axiosInstance.post(
    `/ball-in-court/${workflowId}/trades/${tradeIndex}/record-email`,
    {
      ...flattenBicActor(actor),
      clientTimeZone: opts?.clientTimeZone,
    },
  );
  return data.data;
};

export const useWorkflowsByQrCode = (qrCodeId: string | undefined) =>
  useQuery({
    queryKey: BicKeys.byQrCode(qrCodeId ?? ""),
    queryFn: async () => {
      const { data } = await axiosInstance.get(
        `/ball-in-court/qr/${qrCodeId}`,
      );
      return data.data as BicWorkflowSummary[];
    },
    enabled: !!qrCodeId,
    staleTime: 2 * 60 * 1000,
  });

// ─── Public Endpoints (Foreman Mobile) ───────────────────────────────────────

export const useGetWorkflow = (workflowId: string | undefined) =>
  useQuery({
    queryKey: BicKeys.single(workflowId ?? ""),
    queryFn: async () => {
      const { data } = await axiosInstance.get(
        `/ball-in-court/${workflowId}`,
      );
      return data.data as BicWorkflowWithTasks;
    },
    enabled: !!workflowId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

export const updateTask = async (
  taskId: string,
  dto: Partial<{
    status: "pending" | "complete";
    photoUrl: string;
    clearPhoto: boolean;
    notes: string;
    foremanStartDate: string;
    foremanEndDate: string;
  }>,
  actor?: BicActorContext,
): Promise<BallInCourtTask> => {
  const { data } = await axiosInstance.patch(
    `/ball-in-court/tasks/${taskId}`,
    { ...dto, ...flattenBicActor(actor) },
  );
  return data.data;
};

export const completeTrade = async (
  workflowId: string,
  tradeIndex: number,
  actor?: BicActorContext,
): Promise<BallInCourtWorkflow> => {
  const { data } = await axiosInstance.post(
    `/ball-in-court/${workflowId}/trades/${tradeIndex}/complete`,
    flattenBicActor(actor),
  );
  return data.data;
};

export const uploadTaskPhoto = async (
  taskId: string,
  file: File,
  actor?: BicActorContext,
): Promise<{ photoUrl: string }> => {
  const formData = new FormData();
  formData.append("file", file);
  if (actor) {
    formData.append("foremanProcoreId", actor.foremanProcoreId);
    formData.append("foremanName", actor.foremanName);
    if (actor.foremanEmail) formData.append("foremanEmail", actor.foremanEmail);
    if (actor.foremanCompany) {
      formData.append("foremanCompany", actor.foremanCompany);
    }
  }
  const { data } = await axiosInstance.post(
    `/ball-in-court/tasks/${taskId}/photo`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data.data;
};
