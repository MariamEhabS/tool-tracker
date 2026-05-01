import { axiosInstance } from "../index";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { QRCodeAggregate } from "../../types";
import { logQRError } from "@/utils/rollbar";

export const QrKeys = {
  all: ["Qrs"] as const,
  detail: (id: string) => [...QrKeys.all, id] as const,
};

type ScannedQrQueryOptions = Pick<
  UseQueryOptions<QRCodeAggregate>,
  "enabled" | "staleTime" | "gcTime" | "refetchOnWindowFocus" | "refetchOnMount"
>;

export const useScannedQR = (
  qrCodeId: string | undefined,
  verifyToken?: string,
  queryOptions?: ScannedQrQueryOptions,
) => {
  const { enabled, ...restQueryOptions } = queryOptions || {};

  return useQuery({
    queryKey: [...QrKeys.detail(qrCodeId || ""), verifyToken || ""],
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get<QRCodeAggregate>(
          `/qr-code/scanned/${qrCodeId}`,
          verifyToken
            ? {
                headers: {
                  "X-QR-Verify-Token": verifyToken,
                },
              }
            : undefined,
        );
        return data;
      } catch (error) {
        logQRError(error, "scan-qrcode-failed", qrCodeId, {});
        throw error;
      }
    },
    enabled: enabled ?? Boolean(qrCodeId),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...restQueryOptions,
  });
};

export const verifyQrPassword = async (
  qrCodeId: string,
  password: string,
): Promise<{
  valid: boolean;
  requiredBy: string;
  verifyToken: string | null;
}> => {
  try {
    const { data } = await axiosInstance.post(
      `/qr-code/scanned/${qrCodeId}/verify-password`,
      { password },
    );
    return data;
  } catch (error) {
    logQRError(error, "verify-qrcode-password-failed", qrCodeId, {});
    throw error;
  }
};

// ─── Tool Tracker scan-flow endpoints (scan PRD §10.1–§10.7) ─────────────
//
// Thin re-exports / wrappers around the stub clients. The wrappers exist so
// call sites import from this canonical endpoint module rather than the
// stub directly — production swap is a one-line change per function once
// the real endpoints ship.

import {
  getToolByQRCode as scanGetToolByQRCode,
  signOut as scanSignOut,
  signIn as scanSignIn,
  uploadScanPhoto as scanUploadPhoto,
  verifySmartPin as scanVerifySmartPin,
  reportWrongTool as scanReportWrongTool,
  requestHandoff as scanRequestHandoff,
} from "@/api/stubs/toolTrackerStub";

export const getToolByQRCode = scanGetToolByQRCode;
export const signOutScannedTool = scanSignOut;
export const signInScannedTool = scanSignIn;
export const uploadScanPhoto = scanUploadPhoto;
export const verifySmartPin = scanVerifySmartPin;
export const reportWrongTool = scanReportWrongTool;
export const requestHandoff = scanRequestHandoff;
