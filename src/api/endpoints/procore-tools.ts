import { useQuery } from "@tanstack/react-query";
import { toolsMap } from "@/utils/toolMap";
import { logProcoreError } from "@/utils/rollbar";

// Query key factory
export const procoreToolKeys = {
  all: ["ProcoreTool"] as const,
  tool: (
    tool: string,
    qrId: string,
    companyId: string,
    projectId: string,
    fetchPage: boolean = false,
  ) =>
    [
      ...procoreToolKeys.all,
      tool,
      qrId,
      companyId,
      projectId,
      fetchPage,
    ] as const,
};

// Type definitions
type ToolData = unknown[] | Record<string, unknown>;

type ProcoreToolResult = {
  data: ToolData;
  hiddenIds: Array<string | number> | undefined;
};

export type UseProcoreToolQueryOptions = {
  desktop?: boolean;
  fetchPage?: boolean;
};

// Response type guards and normalization helpers
type DataEnvelopeResponse = {
  data?: unknown;
  hiddenIds?: unknown;
};

type LegacyResponse = {
  items?: unknown;
};

type ApiResponse = DataEnvelopeResponse | LegacyResponse | unknown[];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const isApiResponse = (v: unknown): v is ApiResponse =>
  Array.isArray(v) || isRecord(v);

const normalizeToolData = (v: unknown): ToolData => {
  if (Array.isArray(v)) return v;
  if (isRecord(v)) return v;
  return [];
};

const parseHiddenIds = (v: unknown): Array<string | number> | undefined => {
  if (!Array.isArray(v)) return undefined;
  return v.filter(
    (id): id is string | number =>
      typeof id === "string" || typeof id === "number",
  );
};

/**
 * React Query hook for fetching Procore tool data with caching.
 * Replaces the useState/useEffect pattern in useProcoreToolData for better cache management.
 */
export function useProcoreToolQuery(
  tool: keyof typeof toolsMap,
  qrId: string,
  companyId: string,
  projectId: string,
  options?: UseProcoreToolQueryOptions,
) {
  const { desktop = true, fetchPage = false } = options ?? {};

  return useQuery({
    queryKey: procoreToolKeys.tool(tool, qrId, companyId, projectId, fetchPage),
    queryFn: async (): Promise<ProcoreToolResult> => {
      try {
        type ToolFetcher = (
          qrId: string,
          companyId: string | undefined,
          projectId: string,
          itemId: string,
          desktop?: boolean,
          fetchPage?: boolean,
        ) => Promise<unknown>;

        const fetcher: ToolFetcher = toolsMap[tool].fetch;
        const rawResponse: unknown = await fetcher(
          qrId,
          companyId,
          projectId,
          "",
          desktop,
          fetchPage,
        );

        const response: ApiResponse = isApiResponse(rawResponse)
          ? rawResponse
          : [];

        // Prefer `{ data, hiddenIds }` envelope when present
        const hasDataEnvelope = isRecord(response) && "data" in response;

        if (hasDataEnvelope) {
          const envelope: DataEnvelopeResponse = response;
          return {
            data: normalizeToolData(envelope.data ?? []),
            hiddenIds: parseHiddenIds(envelope.hiddenIds),
          };
        }

        // Handle legacy response structures
        if (Array.isArray(response)) {
          return {
            data: response,
            hiddenIds: undefined,
          };
        }

        if (isRecord(response) && "items" in response) {
          const legacy: LegacyResponse = response;
          return {
            data: normalizeToolData(legacy.items ?? []),
            hiddenIds: undefined,
          };
        }

        if (isRecord(response)) {
          return {
            data: response,
            hiddenIds: undefined,
          };
        }

        return {
          data: [],
          hiddenIds: undefined,
        };
      } catch (error) {
        logProcoreError(error, `fetch-${tool}-failed`, {
          qrId,
          companyId,
          projectId,
          tool,
        });
        throw error;
      }
    },
    enabled: Boolean(tool && qrId && companyId && projectId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });
}
