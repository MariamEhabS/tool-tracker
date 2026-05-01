import { axiosInstance } from "../index";
import { safeLocalStorage } from "@/utils/safeStorage";

// ─── Response Types (matching backend DTOs) ──────────────────────────────────

export type CsvImportMatchedItem = {
  rowIndex: number;
  qrCodeName: string;
  qrCodeId: string;
  tool: string;
  csvIdentifier: string;
  procoreItemID: string;
  procoreItemTitle: string;
  procoreToolName: string;
};

export type CsvImportUnmatchedItem = {
  rowIndex: number;
  qrCodeName: string;
  tool: string;
  csvIdentifier: string;
  procoreItemTitle?: string;
  reason: "no_match" | "qr_not_found" | "qr_not_in_scope" | "private";
};

export type CsvImportAlreadyLinkedItem = {
  rowIndex: number;
  qrCodeName: string;
  qrCodeId: string;
  tool: string;
  csvIdentifier: string;
  procoreItemID: string;
};

export type CsvImportPreviewResponse = {
  matched: CsvImportMatchedItem[];
  unmatched: CsvImportUnmatchedItem[];
  alreadyLinked: CsvImportAlreadyLinkedItem[];
  summary: {
    totalRows: number;
    totalQRCodes: number;
    matchedItems: number;
    unmatchedItems: number;
    alreadyLinkedItems: number;
    qrCodesNotFound: string[];
    qrCodesOutOfScope: string[];
  };
};

// ─── Request Types ───────────────────────────────────────────────────────────

export type CsvImportPreviewParams = {
  file: File;
  companyId: string;
  projectId: string;
  context: "qr" | "group" | "project";
  contextId: string;
};

export type CsvImportProgressStage =
  | "starting"
  | "parsing_file"
  | "loading_project_context"
  | "looking_up_qr_codes"
  | "fetching_procore_data"
  | "fetching_private_data"
  | "matching_rows"
  | "completed";

export type CsvImportProgressEvent = {
  stage: CsvImportProgressStage;
  progress: number;
  message: string;
  tool?: string;
  completed?: number;
  total?: number;
};

export type CsvImportSaveItem = {
  qrCodeId: string;
  procoreToolName: string;
  procoreItemID: string;
};

export type CsvImportSavePayload = {
  companyId: string;
  projectId: string;
  items: CsvImportSaveItem[];
};

export type CsvImportSaveResponse = {
  created: number;
};

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Upload a CSV/XLSX file and preview matched, unmatched, and already-linked
 * Procore items before committing any changes.
 *
 * Sends a multipart/form-data POST to `POST /procore-item/csv-import`.
 */
export const csvImportPreview = async (
  params: CsvImportPreviewParams,
): Promise<CsvImportPreviewResponse> => {
  const fd = new FormData();
  fd.append("file", params.file, params.file.name);
  fd.append("companyId", params.companyId);
  fd.append("projectId", params.projectId);
  fd.append("context", params.context);
  fd.append("contextId", params.contextId);

  const { data } = await axiosInstance.post<CsvImportPreviewResponse>(
    "/procore-item/csv-import",
    fd,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return data;
};

/**
 * Upload a CSV/XLSX file and consume progress updates from an SSE stream.
 * Falls back to axios JSON path at the call site when this throws.
 */
export const csvImportPreviewStream = async (
  params: CsvImportPreviewParams,
  options?: {
    onProgress?: (event: CsvImportProgressEvent) => void;
  },
): Promise<CsvImportPreviewResponse> => {
  const fd = new FormData();
  fd.append("file", params.file, params.file.name);
  fd.append("companyId", params.companyId);
  fd.append("projectId", params.projectId);
  fd.append("context", params.context);
  fd.append("contextId", params.contextId);

  const backendUrl = String(import.meta.env.VITE_BACKEND_URL ?? "").replace(
    /\/+$/,
    "",
  );
  const token =
    safeLocalStorage.getItem("accessToken") ||
    safeLocalStorage.getItem("token");

  const response = await fetch(`${backendUrl}/procore-item/csv-import`, {
    method: "POST",
    body: fd,
    credentials: "include",
    headers: {
      Accept: "text/event-stream",
      "x-api-key": import.meta.env.VITE_TALIHO_API_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`CSV import stream failed (${response.status}).`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    throw new Error("CSV import progress stream is not available.");
  }
  if (!response.body) {
    throw new Error("CSV import progress stream is unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: CsvImportPreviewResponse | null = null;

  const handleEvent = (eventName: string, rawData: string) => {
    if (!rawData) return;

    if (eventName === "progress") {
      const parsed = JSON.parse(rawData) as CsvImportProgressEvent;
      options?.onProgress?.(parsed);
      return;
    }

    if (eventName === "complete") {
      const parsed = JSON.parse(rawData) as {
        result?: CsvImportPreviewResponse;
      };
      finalResult =
        parsed.result ?? (parsed as unknown as CsvImportPreviewResponse);
      return;
    }

    if (eventName === "error") {
      const parsed = JSON.parse(rawData) as { message?: string };
      throw new Error(parsed?.message || "CSV import failed.");
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const lines = chunk.split(/\r?\n/);
      let eventName = "message";
      const dataLines: string[] = [];

      for (const line of lines) {
        if (!line) continue;
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) {
          eventName = line.slice("event:".length).trim() || "message";
          continue;
        }
        if (line.startsWith("data:")) {
          dataLines.push(line.slice("data:".length).trimStart());
        }
      }

      handleEvent(eventName, dataLines.join("\n"));
    }
  }

  if (finalResult) {
    return finalResult;
  }

  throw new Error("CSV import stream closed before completion.");
};

/**
 * Save (commit) the matched items from a CSV import preview.
 *
 * Sends a JSON POST to `POST /procore-item/csv-import/save`.
 */
export const csvImportSave = async (
  payload: CsvImportSavePayload,
): Promise<CsvImportSaveResponse> => {
  const { data } = await axiosInstance.post<CsvImportSaveResponse>(
    "/procore-item/csv-import/save",
    payload,
  );
  return data;
};
