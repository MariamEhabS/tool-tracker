import { useMemo } from "react";
import { useListGroups } from "@/api/endpoints/groups";
import type { QrCodesListResponse } from "../types";

/**
 * Resolves group names and types for QR codes in the My QR Codes listing.
 *
 * Fetches arrangement and equipment groups based on IDs found in QR code data,
 * plus a full company groups listing for unified v3 group resolution.
 *
 * Returns lookup maps for group name, arrangement name, arrangement type,
 * and equipment name by their IDs.
 */
export function useQRCodeGroupResolution(
  companyId: string | undefined,
  qrCodesData: QrCodesListResponse | undefined,
) {
  // Collect all group-related IDs from QR codes
  // QR codes can have: arrangement (legacy), equipment (legacy), or groupId (v3 unified groups)
  const { arrangementIds, equipmentIds } = useMemo(() => {
    const arrangements = new Set<string>();
    const equipment = new Set<string>();
    for (const q of (qrCodesData?.data ?? []) as Array<{
      _id: string;
      arrangement?: string;
      equipment?: string;
    }>) {
      if (q.arrangement) arrangements.add(q.arrangement);
      if (q.equipment) equipment.add(q.equipment);
    }
    return {
      arrangementIds: Array.from(arrangements),
      equipmentIds: Array.from(equipment),
    };
  }, [qrCodesData]);

  const arrangementsRes = useListGroups(
    arrangementIds.length > 0
      ? {
          companyId,
          filter_ids: arrangementIds,
          type: "arrangement",
          per_page: arrangementIds.length,
        }
      : { companyId: undefined },
  );

  const equipmentRes = useListGroups(
    equipmentIds.length > 0
      ? {
          companyId,
          filter_ids: equipmentIds,
          type: "equipment",
          per_page: equipmentIds.length,
        }
      : { companyId: undefined },
  );

  const arrangementNameById = useMemo(() => {
    const map = new Map<string, string>();
    const rows = (arrangementsRes.data?.data ?? []) as Array<{
      _id: string;
      arrangementName: string;
    }>;
    for (const a of rows) map.set(a._id, a.arrangementName);
    return map;
  }, [arrangementsRes.data]);

  const arrangementTypeById = useMemo(() => {
    const map = new Map<string, string>();
    const rows = (arrangementsRes.data?.data ?? []) as Array<{
      _id: string;
      arrangementType?: string;
    }>;
    for (const a of rows)
      if (a.arrangementType) map.set(a._id, a.arrangementType);
    return map;
  }, [arrangementsRes.data]);

  const equipmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    const rows = (equipmentRes.data?.data ?? []) as Array<{
      _id: string;
      equipmentName: string;
    }>;
    for (const e of rows) map.set(e._id, e.equipmentName);
    return map;
  }, [equipmentRes.data]);

  // Fetch all groups for the company (unified groups API - covers both legacy and v3 groups)
  const { data: groupsData } = useListGroups({
    companyId,
    per_page: 500, // Fetch more to cover all groups
  });

  // Create a map of group IDs to group info from the unified groups data
  // This handles both legacy group types and v3 unified groups
  const groupNameById = useMemo(() => {
    const map = new Map<string, { name: string; type: string }>();
    const groups = groupsData?.data ?? [];
    for (const g of groups) {
      const name = g.groupName || g.arrangementName || g.equipmentName || "";
      const type = g.type || "group";
      if (name) {
        map.set(g._id, { name, type });
      }
    }
    return map;
  }, [groupsData]);

  return {
    arrangementNameById,
    arrangementTypeById,
    equipmentNameById,
    groupNameById,
    groupsData,
  };
}
