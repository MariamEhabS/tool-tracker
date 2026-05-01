import { axiosInstance } from "../index";
import { refreshProcoreAccessToken } from "../endpoints/authentication";
import { logProcoreError, isClientError } from "@/utils/rollbar";

// Track Procore token refresh state per company to prevent concurrent refreshes.
// When multiple requests fail with 401 simultaneously, only one refresh is triggered
// and other requests wait for it to complete.
const procoreRefreshLocks = new Map<string, Promise<void>>();

async function refreshProcoreWithLock(companyId: string): Promise<void> {
  // If a refresh is already in progress for this company, wait for it
  const existingRefresh = procoreRefreshLocks.get(companyId);
  if (existingRefresh) {
    return existingRefresh;
  }

  // Start a new refresh and track the promise
  const refreshPromise = refreshProcoreAccessToken(companyId).then(
    () => {
      // Clear the lock on success
      procoreRefreshLocks.delete(companyId);
    },
    (error) => {
      // Clear the lock on failure before re-throwing
      procoreRefreshLocks.delete(companyId);
      throw error;
    },
  );

  procoreRefreshLocks.set(companyId, refreshPromise);
  return refreshPromise;
}

async function procoreGet<T = unknown>(
  url: string,
  companyId?: string | null,
  config?: { headers?: Record<string, string> } & Record<string, unknown>,
): Promise<T> {
  const cfg = {
    ...(config || {}),
    headers: { ...(config?.headers || {}), "x-skip-401-reload": "true" },
  };
  try {
    const { data } = await axiosInstance.get<T>(url, cfg);
    return data;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response
      ?.status;
    if (status === 401 && companyId) {
      await refreshProcoreWithLock(String(companyId));
      try {
        const { data } = await axiosInstance.get<T>(url, cfg);
        return data;
      } catch (retryError) {
        if (!isClientError(retryError)) {
          logProcoreError(retryError, "procore-request-retry-failed", {
            url,
            method: "GET",
          });
        }
        throw retryError;
      }
    }

    // Log non-401/non-4xx errors before throwing (4xx are client errors, skip logging)
    if (status !== 401 && !isClientError(err)) {
      logProcoreError(err, "procore-request-failed", { url, method: "GET" });
    }

    throw err;
  }
}

async function procorePost<T = unknown>(
  url: string,
  body: unknown,
  companyId?: string | null,
  config?: { headers?: Record<string, string> } & Record<string, unknown>,
): Promise<T> {
  const cfg = {
    ...(config || {}),
    headers: { ...(config?.headers || {}), "x-skip-401-reload": "true" },
  };
  try {
    const { data } = await axiosInstance.post<T>(url, body, cfg);
    return data;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response
      ?.status;
    if (status === 401 && companyId) {
      await refreshProcoreWithLock(String(companyId));
      try {
        const { data } = await axiosInstance.post<T>(url, body, cfg);
        return data;
      } catch (retryError) {
        if (!isClientError(retryError)) {
          logProcoreError(retryError, "procore-request-retry-failed", {
            url,
            method: "POST",
          });
        }
        throw retryError;
      }
    }

    // Log non-401/non-4xx errors before throwing (4xx are client errors, skip logging)
    if (status !== 401 && !isClientError(err)) {
      logProcoreError(err, "procore-request-failed", { url, method: "POST" });
    }

    throw err;
  }
}


export const getSignedProcoreUrl = async ({
  qrCodeId,
  fileUrl,
  urlOnly,
  sendBuffer,
}: {
  qrCodeId: string;
  fileUrl: string;
  urlOnly: boolean;
  sendBuffer?: boolean;
}) => {
  const config = sendBuffer
    ? { responseType: "arraybuffer" as const }
    : urlOnly
      ? { responseType: "text" as const }
      : {};
  const resp = await axiosInstance.post(
    `/document/procore`,
    {
      formQr: qrCodeId,
      formPdfUrl: fileUrl,
      urlOnly,
      sendBuffer,
    },
    config,
  );
  if (sendBuffer) return resp.data as ArrayBuffer;
  if (urlOnly) return resp.data as string;
  return resp.request?.responseURL as string;
};

export const getCoordinationIssues = async (
  qrCodeId: string,
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  desktop?: boolean,
  fetchPage?: boolean,
) => {
  const desktopParam = desktop ? `&desktop=true` : "";
  const fetchPageParam = fetchPage ? `&fetchPage=true` : "";
  const url = `/procore/coordination-issues?qrCodeId=${qrCodeId}&companyId=${companyId}&projectId=${projectId}${itemId ? `&itemId=${itemId}` : ""}${desktopParam}${fetchPageParam}`;
  const cfg = { headers: { "x-skip-401-reload": "true" } };
  try {
    const { data } = await axiosInstance.get<unknown>(url, cfg);
    return data;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response
      ?.status;
    if (status === 401 && companyId) {
      await refreshProcoreWithLock(String(companyId));
      try {
        const { data } = await axiosInstance.get<unknown>(url, cfg);
        return data;
      } catch (retryError) {
        if (!isClientError(retryError)) {
          logProcoreError(retryError, "procore-request-retry-failed", {
            url,
            method: "GET",
          });
        }
        throw retryError;
      }
    }
    throw err;
  }
};

export const getDrawings = async (
  qrCodeId: string,
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  desktop?: boolean,
  fetchPage?: boolean,
) => {
  const desktopParam = desktop ? `&desktop=true` : "";
  const fetchPageParam = fetchPage ? `&fetchPage=true` : "";
  return procoreGet(
    `/procore/drawings?qrCodeId=${qrCodeId}&companyId=${companyId}&projectId=${projectId}${itemId ? `&itemId=${itemId}` : ""}${desktopParam}${fetchPageParam}`,
    companyId,
  );
};

export const getDocuments = async (
  qrCodeId: string,
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  desktop?: boolean,
  fetchPage?: boolean,
) => {
  const desktopParam = desktop ? `&desktop=true` : "";
  const fetchPageParam = fetchPage ? `&fetchPage=true` : "";
  return procoreGet(
    `/procore/documents?qrCodeId=${qrCodeId}&companyId=${companyId}&projectId=${projectId}${itemId ? `&itemId=${itemId}` : ""}${desktopParam}${fetchPageParam}`,
    companyId,
  );
};

export const getFolders = async (
  qrCodeId: string,
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  desktop?: boolean,
) => {
  const desktopParam = desktop ? `&desktop=true` : "";
  return procoreGet(
    `/procore/folders?qrCodeId=${qrCodeId}&companyId=${companyId}&projectId=${projectId}${itemId ? `&itemId=${itemId}` : ""}${desktopParam}`,
    companyId,
  );
};

export const getIncidents = async (
  qrCodeId: string,
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  desktop?: boolean,
  fetchPage?: boolean,
) => {
  const desktopParam = desktop ? `&desktop=true` : "";
  const fetchPageParam = fetchPage ? `&fetchPage=true` : "";
  return procoreGet(
    `/procore/incidents?qrCodeId=${qrCodeId}&companyId=${companyId}&projectId=${projectId}&itemId=${itemId}${desktopParam}${fetchPageParam}`,
    companyId,
  );
};

export const getInspections = async (
  qrCodeId: string,
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  desktop?: boolean,
  fetchPage?: boolean,
) => {
  const desktopParam = desktop ? `&desktop=true` : "";
  const fetchPageParam = fetchPage ? `&fetchPage=true` : "";
  return procoreGet(
    `/procore/inspections?qrCodeId=${qrCodeId}&companyId=${companyId}&projectId=${projectId}&itemId=${itemId}${desktopParam}${fetchPageParam}`,
    companyId,
  );
};

export const getInspectionTemplates = async (
  companyId: string | undefined,
  projectId: string,
  itemId?: string,
  desktop?: boolean,
) => {
  const desktopParam = desktop ? `&desktop=true` : "";
  const itemParam = itemId ? `&itemId=${itemId}` : "";
  return procoreGet(
    `/procore/inspection-templates?companyId=${companyId}&projectId=${projectId}${itemParam}${desktopParam}`,
    companyId,
  );
};

export const getInspectionItems = async (
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  desktop?: boolean,
) => {
  const desktopParam = desktop ? `&desktop=true` : "";
  return procoreGet(
    `/procore/inspection-items?companyId=${companyId}&projectId=${projectId}&itemId=${itemId}${desktopParam}`,
    companyId,
  );
};

export const postInspection = async (
  companyId: string | undefined,
  projectId: string,
  inspectionTemplateId: string,
  formData: {
    inspection_template_id: string;
    identifier: string;
    inspection_date: string;
    due_date: string;
    description: string;
  },
) => {
  return procorePost(
    `/procore/inspection?companyId=${companyId}&projectId=${projectId}&inspectionTemplateId=${inspectionTemplateId}`,
    formData,
    companyId,
  );
};

export const postInspectionComment = async (
  companyId: string | undefined,
  projectId: string,
  inspectionId: string | number,
  body: string,
) => {
  return procorePost(
    `/procore/inspection/comment?companyId=${companyId}&projectId=${projectId}&inspectionId=${inspectionId}`,
    { body },
    companyId,
  );
};

export const postPunchList = async (
  companyId: string | undefined,
  projectId: string,
  body: {
    name: string;
    due_date?: string;
    description?: string;
    assignees?: Array<string | number>;
  },
  attachments?: File[],
) => {
  // If there are attachments, send multipart/form-data
  if (attachments && attachments.length > 0) {
    const fd = new FormData();
    if (typeof body.name === "string") fd.append("name", body.name);
    if (body.due_date) fd.append("due_date", body.due_date);
    if (body.description) fd.append("description", body.description);
    if (Array.isArray(body.assignees)) {
      body.assignees.forEach((id, idx) => {
        fd.append(`assignees[${idx}]`, String(id));
      });
    }
    attachments.forEach((file, i) => {
      fd.append("attachments", file, file.name || `attachment-${i}`);
    });
    return procorePost(
      `/procore/punch-list?companyId=${companyId}&projectId=${projectId}`,
      fd,
      companyId,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
  }

  // Fallback to JSON when no attachments
  return procorePost(
    `/procore/punch-list?companyId=${companyId}&projectId=${projectId}`,
    body,
    companyId,
  );
};

export const postPhoto = async (
  companyId: string | undefined,
  projectId: string,
  body: {
    description?: string;
  },
  imageFile: File,
) => {
  const fd = new FormData();
  if (body.description) fd.append("description", body.description);
  fd.append("image", imageFile, imageFile.name || "photo.jpg");
  return procorePost(
    `/procore/photo?companyId=${companyId}&projectId=${projectId}`,
    fd,
    companyId,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
};

export const getPunchAssigneeOptions = async (
  companyId: string | undefined,
  projectId: string,
) => {
  const raw = await procoreGet(
    `/procore/punch-list-assignee-options?companyId=${companyId}&projectId=${projectId}`,
    companyId,
  );
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown[] })?.data)
      ? (raw as { data?: unknown[] }).data
      : [];
  return list as Array<{
    id: string | number;
    name?: string;
    login_information?: { name?: string };
  }>;
};

export const postInspectionItemResponse = async (
  companyId: string | undefined,
  projectId: string,
  itemId: string | number,
  formData: {
    status?: string;
    response_option_id?: string | number;
    text_value?: string;
    number_value?: number | string;
    date_value?: string;
  },
) => {
  return procorePost(
    `/procore/inspection-list-item-response?companyId=${companyId}&projectId=${projectId}&itemId=${itemId}`,
    formData,
    companyId,
  );
};

export const getObservations = async (
  qrCodeId: string,
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  desktop?: boolean,
  fetchPage?: boolean,
) => {
  const desktopParam = desktop ? `&desktop=true` : "";
  const fetchPageParam = fetchPage ? `&fetchPage=true` : "";
  return procoreGet(
    `/procore/observations?qrCodeId=${qrCodeId}&companyId=${companyId}&projectId=${projectId}&itemId=${itemId}${desktopParam}${fetchPageParam}`,
    companyId,
  );
};

export const getPhotos = async (
  qrCodeId: string,
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  desktop?: boolean,
  fetchPage?: boolean,
) => {
  const desktopParam = desktop ? `&desktop=true` : "";
  const fetchPageParam = fetchPage ? `&fetchPage=true` : "";
  return procoreGet(
    `/procore/photo?qrCodeId=${qrCodeId}&companyId=${companyId}&projectId=${projectId}&itemId=${itemId}${desktopParam}${fetchPageParam}`,
    companyId,
  );
};

export const getSubmittals = async (
  qrCodeId: string,
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  desktop?: boolean,
  fetchPage?: boolean,
) => {
  const desktopParam = desktop ? `&desktop=true` : "";
  const fetchPageParam = fetchPage ? `&fetchPage=true` : "";
  return procoreGet(
    `/procore/submittals?qrCodeId=${qrCodeId}&companyId=${companyId}&projectId=${projectId}&itemId=${itemId}${desktopParam}${fetchPageParam}`,
    companyId,
  );
};

export const getRFIs = async (
  qrCodeId: string,
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  desktop?: boolean,
  fetchPage?: boolean,
) => {
  const desktopParam = desktop ? `&desktop=true` : "";
  const fetchPageParam = fetchPage ? `&fetchPage=true` : "";
  return procoreGet(
    `/procore/rfis?qrCodeId=${qrCodeId}&companyId=${companyId}&projectId=${projectId}&itemId=${itemId}${desktopParam}${fetchPageParam}`,
    companyId,
  );
};

export const getPunchLists = async (
  qrCodeId: string,
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  desktop?: boolean,
  fetchPage?: boolean,
) => {
  const desktopParam = desktop ? `&desktop=true` : "";
  const fetchPageParam = fetchPage ? `&fetchPage=true` : "";
  return procoreGet(
    `/procore/punch-list?qrCodeId=${qrCodeId}&companyId=${companyId}&projectId=${projectId}&itemId=${itemId}${desktopParam}${fetchPageParam}`,
    companyId,
  );
};

export type PunchListStatus =
  | "unresolved"
  | "work_not_accepted"
  | "ready_for_review"
  | "resolved";

export const updatePunchListAssignmentStatus = async (
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  formData: {
    assignmentId: string | number;
    status: PunchListStatus;
  },
) => {
  const { data } = await axiosInstance.post<unknown>(
    `/procore/punch-list/assignment-status?companyId=${companyId}&projectId=${projectId}&itemId=${itemId}`,
    formData,
  );
  return data;
};

export const updatePunchListItem = async (
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  formData: {
    name: string;
    closed?: boolean;
  },
) => {
  const { data } = await axiosInstance.post<unknown>(
    `/procore/punch-list/update?companyId=${companyId}&projectId=${projectId}&itemId=${itemId}`,
    formData,
  );
  return data;
};

export const getSpecifications = async (
  qrCodeId: string,
  companyId: string | undefined,
  projectId: string,
  itemId?: string,
  desktop?: boolean,
  fetchPage?: boolean,
) => {
  const desktopParam = desktop ? `&desktop=true` : "";
  const fetchPageParam = fetchPage ? `&fetchPage=true` : "";
  return procoreGet(
    `/procore/specifications?qrCodeId=${qrCodeId}&companyId=${companyId}&projectId=${projectId}${itemId ? `&itemId=${itemId}` : ""}${desktopParam}${fetchPageParam}`,
    companyId,
  );
};

export const getInstructions = async (
  qrCodeId: string,
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  desktop?: boolean,
  fetchPage?: boolean,
) => {
  const desktopParam = desktop ? `&desktop=true` : "";
  const fetchPageParam = fetchPage ? `&fetchPage=true` : "";
  return procoreGet(
    `/procore/instructions?qrCodeId=${qrCodeId}&companyId=${companyId}&projectId=${projectId}&itemId=${itemId}${desktopParam}${fetchPageParam}`,
    companyId,
  );
};

export const getForms = async (
  qrCodeId: string,
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  desktop?: boolean,
  fetchPage?: boolean,
) => {
  const desktopParam = desktop ? `&desktop=true` : "";
  const fetchPageParam = fetchPage ? `&fetchPage=true` : "";
  return procoreGet(
    `/procore/forms?qrCodeId=${qrCodeId}&companyId=${companyId}&projectId=${projectId}${itemId ? `&itemId=${itemId}` : ""}${desktopParam}${fetchPageParam}`,
    companyId,
  );
};

export const postForm = async (
  companyId: string | undefined,
  projectId: string,
  body: {
    name: string;
    formTemplateId: string;
    description?: string;
  },
  fillablePdf: File,
  attachments?: File[],
) => {
  if ((attachments && attachments.length > 0) || fillablePdf) {
    const fd = new FormData();
    fd.append("name", body.name);
    fd.append("formTemplateId", body.formTemplateId);
    if (body.description) fd.append("description", body.description);
    if (fillablePdf) {
      fd.append(
        "fillable_pdf",
        fillablePdf,
        fillablePdf.name || "fillable.pdf",
      );
    }
    if (attachments && attachments.length > 0) {
      attachments.forEach((file, i) => {
        fd.append("attachments", file, file.name || `attachment-${i}`);
      });
    }
    return procorePost(
      `/procore/forms?companyId=${companyId}&projectId=${projectId}`,
      fd,
      companyId,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
  }

  // Fallback to JSON when no files
  return procorePost(
    `/procore/forms?companyId=${companyId}&projectId=${projectId}`,
    body,
    companyId,
  );
};

export const getFormTemplates = async (
  companyId: string | undefined,
  projectId: string,
) => {
  return procoreGet(
    `/procore/form-templates?companyId=${companyId}&projectId=${projectId}`,
    companyId,
  );
};

export const getTasks = async (
  qrCodeId: string,
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  desktop?: boolean,
  fetchPage?: boolean,
) => {
  const desktopParam = desktop ? `&desktop=true` : "";
  const fetchPageParam = fetchPage ? `&fetchPage=true` : "";
  return procoreGet(
    `/procore/tasks?qrCodeId=${qrCodeId}&companyId=${companyId}&projectId=${projectId}${itemId ? `&itemId=${itemId}` : ""}${desktopParam}${fetchPageParam}`,
    companyId,
  );
};

export const getDirectory = async (
  qrCodeId: string,
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  desktop?: boolean,
  fetchPage?: boolean,
) => {
  const desktopParam = desktop ? `&desktop=true` : "";
  const fetchPageParam = fetchPage ? `&fetchPage=true` : "";
  return procoreGet(
    `/procore/directory?qrCodeId=${qrCodeId}&companyId=${companyId}&projectId=${projectId}${itemId ? `&itemId=${itemId}` : ""}${desktopParam}${fetchPageParam}`,
    companyId,
  );
};

export const getRFIResponses = async (
  companyId: string | undefined,
  projectId: string,
  itemId: string,
) => {
  return procoreGet(
    `/procore/rfi-responses?companyId=${companyId}&projectId=${projectId}&itemId=${itemId}`,
    companyId,
  );
};

export const getDrawingsAreas = async (
  companyId: string | undefined,
  projectId: string,
) => {
  return procoreGet(
    `/procore/drawing-areas?companyId=${companyId}&projectId=${projectId}`,
    companyId,
  );
};

// Placeholder upload for updated form PDF
export const uploadUpdatedProcoreForm = async (
  qrCodeId: string,
  companyId: string | undefined,
  projectId: string,
  itemId: string,
  file: File,
  fileName?: string,
) => {
  const formData = new FormData();
  formData.append("qrCodeId", qrCodeId);
  if (companyId) formData.append("companyId", companyId);
  formData.append("projectId", projectId);
  formData.append("itemId", itemId);
  formData.append("file", file, fileName || file.name);

  return procorePost(`/procore/forms/update`, formData, companyId, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
