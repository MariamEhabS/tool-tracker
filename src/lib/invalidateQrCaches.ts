/**
 * @fileoverview Cache invalidation helper for QR code React Query caches.
 */

import { QueryClient } from "@tanstack/react-query";
import { QrKeys } from "@/api/endpoints/qr-codes";
import { QrKeys as ScannedQrKeys } from "@/api/endpoints/scanned-qr";

/** Invalidate all QR-related caches for a single QR code */
export function invalidateQrCaches(queryClient: QueryClient, id: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: QrKeys.single(id) }),
    queryClient.invalidateQueries({ queryKey: ScannedQrKeys.detail(id) }),
  ]);
}
