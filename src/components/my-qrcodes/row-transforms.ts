import { useMemo } from "react";
import type { Row, QrCodesListResponse } from "./types";
import type { RowType } from "@/components/ui/Icon";
import type { QRCode } from "@/types";
import { iconColorMap } from "@/utils/icon-color-map";

// ---- Lookup map builders ----

/**
 * Builds a map of project ID -> normalized status for use in row rendering and filtering.
 */
export function useProjectStatusById(
  projects: Array<{ _id: string; archived?: boolean; status?: string }>,
) {
  return useMemo(() => {
    const m = new Map<
      string,
      "active" | "archived" | "completed" | "on-hold" | "others"
    >();
    for (const p of projects) {
      const archived = Boolean(p.archived);
      const raw = (p.status ?? "").toString().toLowerCase().trim();
      let key: "active" | "archived" | "completed" | "on-hold" | "others";
      if (archived) key = "archived";
      else if (!raw || raw === "active") key = "active";
      else if (raw === "completed") key = "completed";
      else if (raw === "on hold" || raw === "on-hold") key = "on-hold";
      else key = "others";
      m.set(p._id, key);
    }
    return m;
  }, [projects]);
}

/**
 * Builds a map of qrCodeId -> backend bucket string (e.g., 'archived'|'active'|...).
 */
export function useBucketById(qrCodesData: QrCodesListResponse | undefined) {
  return useMemo(() => {
    const m = new Map<string, string>();
    for (const q of qrCodesData?.data ?? []) {
      if (q && q._id && typeof q.bucket === "string") m.set(q._id, q.bucket);
    }
    return m;
  }, [qrCodesData]);
}

/**
 * Builds a map of normalized project name -> project ID for fallback lookups.
 */
export function useProjectIdByName(
  projects: Array<{ _id: string; name?: string }>,
) {
  return useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) {
      const name = (p.name ?? "").toString().toLowerCase().trim();
      if (name) m.set(name, p._id);
    }
    return m;
  }, [projects]);
}

/**
 * Builds a map of project ID -> archived boolean for row coloring.
 */
export function useProjectArchivedMap(
  projects: Array<{ _id: string; archived?: boolean }>,
) {
  return useMemo(() => {
    const m = new Map<string, boolean>();
    for (const p of projects) {
      m.set(p._id, Boolean(p.archived));
    }
    return m;
  }, [projects]);
}

// ---- Row builder ----

/**
 * Builds the `apiRows` array from QR code data with group/project resolution.
 *
 * Handles both backend-resolved group info and frontend fallback lookups
 * using arrangement, equipment, and unified group maps.
 */
export function useApiRows({
  qrCodesData,
  arrangementNameById,
  arrangementTypeById,
  equipmentNameById,
  groupNameById,
  nameOverrides,
}: {
  qrCodesData: QrCodesListResponse | undefined;
  arrangementNameById: Map<string, string>;
  arrangementTypeById: Map<string, string>;
  equipmentNameById: Map<string, string>;
  groupNameById: Map<string, { name: string; type: string }>;
  nameOverrides: Record<string, string>;
}): Row[] {
  return useMemo(
    () =>
      ((qrCodesData?.data ?? []) as QRCode[]).map((item) => {
        // Cast to access resolved fields from backend and potential groupId/groupingId fields
        const itemWithResolved = item as QRCode & {
          resolvedGroupName?: string;
          resolvedGroupType?: string;
          resolvedArrangementType?: string;
          resolvedType?: string;
          groupId?: string;
          groupingId?: string;
          group?: string;
        };

        // Use backend-resolved group name if available
        let groupLabel = itemWithResolved.resolvedGroupName || "";
        let groupId: string | undefined = undefined;
        let groupType: Row["groupType"] =
          (itemWithResolved.resolvedGroupType as Row["groupType"]) || "none";
        let groupArrangementType: string | undefined =
          itemWithResolved.resolvedArrangementType;

        // Fallback to frontend lookup only if backend didn't resolve
        if (!groupLabel) {
          // Check for v3 unified group first (groupId or groupingId)
          const unifiedGroupId =
            itemWithResolved.groupId || itemWithResolved.groupingId;
          if (unifiedGroupId) {
            groupId = unifiedGroupId;
            const groupInfo = groupNameById.get(unifiedGroupId);
            if (groupInfo) {
              groupLabel = groupInfo.name;
              groupType =
                groupInfo.type === "equipment" ? "equipment" : "arrangement";
            }
          }
          // Fallback to legacy arrangement field
          else if (item.arrangement) {
            groupId = item.arrangement;
            groupType = "arrangement";
            const groupInfo = groupNameById.get(item.arrangement);
            if (groupInfo) {
              groupLabel = groupInfo.name;
            } else {
              groupLabel = arrangementNameById.get(item.arrangement) || "";
            }
            groupArrangementType = arrangementTypeById.get(item.arrangement);
          }
          // Fallback to legacy equipment field
          else if (item.equipment) {
            groupId = item.equipment;
            groupType = "equipment";
            const groupInfo = groupNameById.get(item.equipment);
            if (groupInfo) {
              groupLabel = groupInfo.name;
            } else {
              groupLabel = equipmentNameById.get(item.equipment) || "";
            }
          }
          // Fallback to direct group name string
          else if (itemWithResolved.group) {
            groupLabel = itemWithResolved.group;
          }
        } else {
          // Backend resolved the group, try to get the ID
          groupId =
            itemWithResolved.groupId ||
            itemWithResolved.groupingId ||
            item.arrangement ||
            item.equipment;
        }

        // Use resolvedType from backend (computed with full type determination logic)
        // Falls back to item.type, then to "folder"
        const resolvedType = (itemWithResolved.resolvedType ||
          item?.type ||
          "folder") as RowType;

        return {
          id: item?._id,
          name: nameOverrides[item?._id ?? ""] ?? item?.qrcodeName,
          category: "qrcode",
          type: resolvedType,
          group: groupLabel,
          groupId,
          groupType,
          groupArrangementType,
          project: item?.projectName || "",
          projectId: item?.project,
          createdAt: String(item?.createdAt ?? ""),
          scans: item?.mobileScanCount || 0,
          icon: iconColorMap(resolvedType).icon,
          iconBg: iconColorMap(resolvedType).bg,
          iconColor: iconColorMap(resolvedType).color,
        };
      }),
    [
      qrCodesData?.data,
      arrangementNameById,
      arrangementTypeById,
      equipmentNameById,
      groupNameById,
      nameOverrides,
    ],
  );
}

// ---- Client-side filtering ----

/**
 * Applies client-side filtering on the loaded page rows for hybrid search
 * and project status filtering.
 */
export function useFilteredRows({
  apiRows,
  projectFilters,
  useLocalSearch,
  localModeQuery,
  debouncedQuery,
  sortKey,
  qrCodesData,
  projectStatusById,
  projectArchivedMap,
  projectIdByName,
  bucketById,
}: {
  apiRows: Row[];
  projectFilters: string[];
  useLocalSearch: boolean;
  localModeQuery: string | undefined;
  debouncedQuery: string;
  sortKey: string;
  qrCodesData: QrCodesListResponse | undefined;
  projectStatusById: Map<
    string,
    "active" | "archived" | "completed" | "on-hold" | "others"
  >;
  projectArchivedMap: Map<string, boolean>;
  projectIdByName: Map<string, string>;
  bucketById: Map<string, string>;
}): Row[] {
  return useMemo(() => {
    let base = apiRows;
    // Apply client-side search only in local mode AND only when the query hasn't changed since local mode engaged
    const localFilterEnabled =
      useLocalSearch &&
      localModeQuery === (debouncedQuery || undefined) &&
      sortKey === "createdAt";
    if (localFilterEnabled && debouncedQuery) {
      const q = String(debouncedQuery).toLowerCase();
      base = base.filter((x) => (x.name || "").toLowerCase().includes(q));
    }
    // Project status filter (client-side). Prefer backend bucket when available; fallback to project maps
    if (projectFilters.length) {
      const wanted = new Set(projectFilters.map((v) => String(v)));
      if (bucketById.size > 0) {
        base = base.filter((row) => {
          const b = bucketById.get(row.id);
          return b ? wanted.has(String(b)) : false;
        });
      } else {
        // Map of qrCodeId -> projectId from server data
        const qrCodeProjectIdById = new Map<string, string | undefined>();
        const list = qrCodesData?.data ?? [];
        for (const q of list) {
          qrCodeProjectIdById.set(q._id, q.project);
        }
        base = base.filter((row) => {
          let pid = qrCodeProjectIdById.get(row.id);
          if (!pid) {
            const nameKey = (row.project ?? "").toString().toLowerCase().trim();
            if (nameKey) pid = projectIdByName.get(nameKey);
          }
          if (!pid) return false;
          const key =
            projectStatusById.get(pid) ??
            (projectArchivedMap.get(pid) ? "archived" : "active");
          return wanted.has(key);
        });
      }
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    apiRows,
    projectFilters,
    useLocalSearch,
    debouncedQuery,
    sortKey,
    qrCodesData?.data,
    projectStatusById,
    projectArchivedMap,
    projectIdByName,
    bucketById,
  ]);
}
