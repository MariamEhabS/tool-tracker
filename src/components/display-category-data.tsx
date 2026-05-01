import { useRouter } from "@tanstack/react-router";
import { useScannedQR } from "../api/endpoints/scanned-qr";
import { FileList } from "./file-list";
import { ProcoreToolData, SelectedCategory } from "../types";
import { useEffect, useState } from "react";
import { toolsMap, toolsMapTitles } from "../utils/toolMap";
import { updateProcore } from "../store/slices/procoreSlice";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store";
import {
  updateProcoreFolders,
  updateProcoreFiles,
} from "../store/slices/folderFileSlice";
import { FoldersViewWrapper } from "./folder-swipe-view";
import { isProjectArchivedError } from "../utils/httpErrors";
import { logProcoreError } from "@/utils/rollbar";

// Normalize category to a valid toolsMap key
// Handles cases where category might be a title (e.g., "Directory") instead of key ("directory")
function normalizeCategory(
  category: SelectedCategory,
): keyof typeof toolsMap | "taliho-local" | null {
  if (!category) return null;
  if (category === "taliho-local") return "taliho-local";

  // First check if it's already a valid key
  if (category in toolsMap) {
    return category as keyof typeof toolsMap;
  }

  // Check if it's a title and map to key
  // toolsMapTitles maps titles like "Directory" to keys like "directory"
  const titleToKey = toolsMapTitles as Record<string, string>;
  if (category in titleToKey) {
    return titleToKey[category] as keyof typeof toolsMap;
  }

  // Try case-insensitive match on keys
  const lowerCategory = category.toLowerCase();
  const matchingKey = Object.keys(toolsMap).find(
    (key) => key.toLowerCase() === lowerCategory,
  );
  if (matchingKey) {
    return matchingKey as keyof typeof toolsMap;
  }

  return null;
}

function normalizeResponse(rawResponse: unknown): unknown[] {
  if (Array.isArray(rawResponse)) return rawResponse;
  if (rawResponse != null && typeof rawResponse === "object") {
    const obj = rawResponse as { data?: unknown; items?: unknown };
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.items)) return obj.items;
  }
  return [];
}

/**
 * Filter items to only show those linked to this QR code via ProcoreItem records.
 * This ensures mobile users only see specifically fetched/linked items, not all Procore items.
 */
function filterByLinkedIds(
  items: unknown[],
  linkedIds: string[] | undefined,
): unknown[] {
  // If no linkedIds provided or empty, return all items (fallback for backward compatibility)
  if (!linkedIds || linkedIds.length === 0) {
    return items;
  }

  // Create a Set for O(1) lookups
  const linkedIdSet = new Set(linkedIds.map((id) => String(id)));

  return items.filter((item) => {
    const itemObj = item as {
      id?: string | number;
      procoreItemID?: string | number;
    };
    // Check both 'id' and 'procoreItemID' fields
    const itemId = itemObj?.procoreItemID ?? itemObj?.id;
    if (itemId === undefined || itemId === null) return false;
    return linkedIdSet.has(String(itemId));
  });
}

export const DisplayCategoryData = ({
  category: rawCategory,
}: {
  category: SelectedCategory;
}) => {
  const router = useRouter();
  const dispatch = useDispatch();
  const qrCodeIdInURL = router.parseLocation().search.qrcodeId;
  const qrId = qrCodeIdInURL ?? "";

  // Normalize category to handle titles or case mismatches
  const category = normalizeCategory(rawCategory);

  // Read verify token from sessionStorage to ensure authenticated QR requests work
  const verifyToken = (() => {
    try {
      return sessionStorage.getItem(`qr-token:${qrId}`) || undefined;
    } catch {
      return undefined;
    }
  })();

  const {
    data: qrData,
    isLoading: isQRLoading,
    isFetching: queryIsFetching,
  } = useScannedQR(qrId, verifyToken);
  const singleLayerData = useSelector((state: RootState) => state.procore);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isArchivedError, setIsArchivedError] = useState(false);
  const [refetchToken, setRefetchToken] = useState(0);

  useEffect(() => {
    setError(null);
    setIsArchivedError(false);
  }, [category, qrId]);

  useEffect(() => {
    if (!category || category === "taliho-local") return;

    if (!qrId) {
      setError("Missing QR code id.");
      return;
    }

    const companyId = qrData?.data?.company?._id ?? "";
    const projectId = qrData?.data?.project?._id ?? "";

    // Wait for QR data to be available before fetching tool data.
    if (!qrData || queryIsFetching) return;

    if (!companyId || !projectId) {
      setError("Missing company or project data.");
      return;
    }

    // Get linked IDs for this tool from qrData to filter results
    const toolInfo = qrData?.procoreTools?.find((t) => t.tool === category);
    const linkedIds = toolInfo?.linkedIds;

    let cancelled = false;

    const fetchData = async () => {
      setIsFetching(true);
      setError(null);
      try {
        if (category === "document") {
          const response: ProcoreToolData = (await toolsMap[category].fetch(
            qrId,
            companyId,
            projectId,
            "",
          )) as ProcoreToolData;
          if (cancelled) return;
          dispatch(updateProcoreFiles({ files: response.files ?? [] }));
          dispatch(updateProcoreFolders({ folders: response.folders ?? [] }));
        } else {
          const rawResponse = await toolsMap[category].fetch(
            qrId,
            companyId,
            projectId,
            "",
          );
          if (cancelled) return;
          const normalizedResponse = normalizeResponse(rawResponse);
          // Filter to only show items linked to this QR code via ProcoreItem records.
          // Directory is a reference contact list — the backend already returns all
          // project users, so skip client-side filtering for that tool.
          const response =
            category === "directory"
              ? normalizedResponse
              : filterByLinkedIds(normalizedResponse, linkedIds);
          dispatch(updateProcore({ tool: category, response }));
        }
      } catch (error) {
        logProcoreError(error, "category-data-fetch-failed", {
          category,
          qrId,
        });
        if (import.meta.env.DEV) {
          console.error("Fetch error:", error);
        }
        if (!cancelled) {
          if (isProjectArchivedError(error)) {
            setIsArchivedError(true);
            setError(
              "This project has been archived. Procore data is no longer accessible.",
            );
          } else {
            setError("Couldn't load data. Please try again.");
          }
        }
      } finally {
        if (!cancelled) {
          setIsFetching(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [category, qrId, refetchToken, qrData, queryIsFetching, dispatch]);

  if (!qrId) {
    return (
      <div className="flex items-center justify-center w-full py-10 text-gray-500">
        Missing QR code id.
      </div>
    );
  }

  if (isQRLoading || queryIsFetching || isFetching) {
    return (
      <div className="flex items-center justify-center w-full py-10">
        <div className="loader"></div>
      </div>
    );
  }

  if (error) {
    // Show different UI for archived project errors vs other errors
    if (isArchivedError) {
      return (
        <div className="flex flex-col items-center justify-center w-full py-10 gap-3 px-4">
          <div className="flex items-center gap-2 text-amber-600">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
            <span className="font-semibold">Archived Project</span>
          </div>
          <p className="text-sm text-gray-600 text-center">{error}</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center w-full py-10 gap-3">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => setRefetchToken((t) => t + 1)}
          className="rounded-md bg-yellow-500 px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  if (category === "taliho-local" || category === "document") {
    return <FoldersViewWrapper category={category} />;
  } else if (category) {
    return (
      <FileList
        category={category}
        files={(singleLayerData[category] as Record<string, unknown>[]) ?? []}
      />
    );
  } else {
    return (
      <div className="flex items-center justify-center w-full py-10 text-gray-500">
        No Tool Selected
      </div>
    );
  }
};
