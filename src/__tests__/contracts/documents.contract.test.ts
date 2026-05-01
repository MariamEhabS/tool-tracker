/**
 * Contract Test: Documents API
 *
 * Validates that the frontend Document API client functions send requests
 * that align with the backend DTO specifications declared in backend-contracts.ts.
 *
 * When the backend changes a Document DTO, update backend-contracts.ts first,
 * then run these tests to surface any frontend drift.
 *
 * @see ./backend-contracts.ts for the canonical backend DTO definitions.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Backend contract types (source of truth)
import {
  type BackendDeleteManyDocumentsDto,
  type BackendRestoreDocumentsDto,
  type BackendMultipartInitDto,
  type BackendMultipartPartUrlDto,
  type BackendMultipartCompleteDto,
  type BackendMultipartAbortDto,
  type BackendBasicRequestDto,
  BACKEND_ROUTES,
} from "./backend-contracts";

// ---------------------------------------------------------------------------
// Mocks — must appear before imports that depend on them
// ---------------------------------------------------------------------------

vi.mock("@api/index", () => ({
  axiosInstance: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Frontend functions under test
import {
  uploadFile,
  uploadDocumentsMultiple,
  updateDocument,
  deleteDocument,
  deleteDocumentsBulk,
  restoreDocument,
  restoreDocumentsBulk,
  initMultipartUpload,
  getMultipartPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
} from "@api/endpoints/document";

import { axiosInstance } from "@api/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_MONGO_ID = "665af1b2c3d4e5f6a7b8c9d0";
const FAKE_COMPANY_ID = "665af1b2c3d4e5f6a7b8c9d1";
const FAKE_PROJECT_ID = "665af1b2c3d4e5f6a7b8c9d2";
const FAKE_QRCODE_ID = "665af1b2c3d4e5f6a7b8c9d3";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Contract: Documents API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. deleteSingleDocument sends BasicRequestDto
  // =========================================================================
  it("deleteSingleDocument sends BasicRequestDto via DELETE /document/:id", async () => {
    await deleteDocument(FAKE_MONGO_ID, FAKE_COMPANY_ID, FAKE_PROJECT_ID);

    expect(axiosInstance.delete).toHaveBeenCalledTimes(1);

    const [url, config] = (axiosInstance.delete as Mock).mock.calls[0];

    // Verify URL matches the backend route pattern
    expect(url).toBe(`/document/${FAKE_MONGO_ID}`);

    // Verify the payload includes the required companyId field from BasicRequestDto
    const payload = config?.data;
    expect(payload).toBeDefined();
    expect(payload).toHaveProperty("companyId", FAKE_COMPANY_ID);

    // Type-level assertion: the payload shape satisfies BackendBasicRequestDto
    const _typeCheck: BackendBasicRequestDto = {
      companyId: payload.companyId,
      projectId: payload.projectId,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
  });

  // =========================================================================
  // 2. deleteManyDocuments sends matching BackendDeleteManyDocumentsDto
  // =========================================================================
  it("deleteManyDocuments sends matching BackendDeleteManyDocumentsDto via DELETE /document/bulk", async () => {
    const documentIds = [FAKE_MONGO_ID, "665af1b2c3d4e5f6a7b8c9d4"];

    await deleteDocumentsBulk(documentIds, FAKE_COMPANY_ID);

    expect(axiosInstance.delete).toHaveBeenCalledTimes(1);

    const [url, config] = (axiosInstance.delete as Mock).mock.calls[0];

    // Verify URL matches the backend route
    expect(url).toBe("/document/bulk");

    // Verify the payload shape
    const payload = config?.data;
    expect(payload).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(payload).toHaveProperty("documentIds", documentIds);

    // Type-level assertion: the payload satisfies BackendDeleteManyDocumentsDto
    const _typeCheck: BackendDeleteManyDocumentsDto = {
      companyId: payload.companyId,
      documentIds: payload.documentIds,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
    expect(_typeCheck.documentIds).toEqual(documentIds);
  });

  // =========================================================================
  // 3. restoreManyDocuments sends matching BackendRestoreDocumentsDto
  // =========================================================================
  it("restoreManyDocuments sends matching BackendRestoreDocumentsDto via PATCH /document/restore/bulk", async () => {
    const documentIds = [FAKE_MONGO_ID, "665af1b2c3d4e5f6a7b8c9d4"];

    await restoreDocumentsBulk(documentIds, FAKE_COMPANY_ID);

    expect(axiosInstance.patch).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.patch as Mock).mock.calls[0];

    // Verify URL matches the backend route
    expect(url).toBe("/document/restore/bulk");

    // Verify payload shape matches BackendRestoreDocumentsDto
    expect(body).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(body).toHaveProperty("documentIds", documentIds);

    // Type-level assertion
    const _typeCheck: BackendRestoreDocumentsDto = {
      companyId: body.companyId,
      documentIds: body.documentIds,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
    expect(_typeCheck.documentIds).toEqual(documentIds);
  });

  // =========================================================================
  // 4. initMultipartUpload sends matching BackendMultipartInitDto
  // =========================================================================
  it("initMultipartUpload sends matching BackendMultipartInitDto via POST /document/multipart/init", async () => {
    const initBody = {
      companyId: FAKE_COMPANY_ID,
      projectId: FAKE_PROJECT_ID,
      qrcodeId: FAKE_QRCODE_ID,
      documentName: "test-file.pdf",
      documentPurpose: "file-qrcode" as const,
      contentType: "application/pdf",
      openToPage: 3,
    };

    await initMultipartUpload(initBody);

    expect(axiosInstance.post).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.post as Mock).mock.calls[0];

    // Verify URL
    expect(url).toBe("/document/multipart/init");

    // Verify all required fields from BackendMultipartInitDto
    expect(body).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(body).toHaveProperty("qrcodeId", FAKE_QRCODE_ID);
    expect(body).toHaveProperty("documentName", "test-file.pdf");
    expect(body).toHaveProperty("documentPurpose", "file-qrcode");

    // Verify optional fields are forwarded
    expect(body).toHaveProperty("projectId", FAKE_PROJECT_ID);
    expect(body).toHaveProperty("contentType", "application/pdf");
    expect(body).toHaveProperty("openToPage", 3);

    // Type-level assertion
    const _typeCheck: BackendMultipartInitDto = {
      companyId: body.companyId,
      qrcodeId: body.qrcodeId,
      documentName: body.documentName,
      documentPurpose: body.documentPurpose,
      projectId: body.projectId,
      contentType: body.contentType,
      openToPage: body.openToPage,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
  });

  // =========================================================================
  // 5. getMultipartPartUrl sends matching BackendMultipartPartUrlDto
  // =========================================================================
  it("getMultipartPartUrl sends matching BackendMultipartPartUrlDto with all required fields", async () => {
    const partUrlBody = {
      s3Key: "uploads/test-file.pdf",
      uploadId: "upload-123-abc",
      partNumber: 2,
      bucket: "taliho-uploads",
      contentType: "application/pdf",
    };

    await getMultipartPartUrl(partUrlBody);

    expect(axiosInstance.post).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.post as Mock).mock.calls[0];

    // Verify URL
    expect(url).toBe("/document/multipart/part-url");

    // Verify all required fields from BackendMultipartPartUrlDto
    expect(body).toHaveProperty("s3Key", "uploads/test-file.pdf");
    expect(body).toHaveProperty("uploadId", "upload-123-abc");
    expect(body).toHaveProperty("partNumber", 2);
    expect(body).toHaveProperty("bucket", "taliho-uploads");
    expect(body).toHaveProperty("contentType", "application/pdf");

    // Type-level assertion: every field in the body satisfies BackendMultipartPartUrlDto
    const _typeCheck: BackendMultipartPartUrlDto = {
      s3Key: body.s3Key,
      uploadId: body.uploadId,
      partNumber: body.partNumber,
      bucket: body.bucket,
      contentType: body.contentType,
    };
    expect(_typeCheck.s3Key).toBe("uploads/test-file.pdf");
    expect(_typeCheck.partNumber).toBe(2);
  });

  // =========================================================================
  // 6. completeMultipartUpload sends matching BackendMultipartCompleteDto
  // =========================================================================
  it("completeMultipartUpload sends matching BackendMultipartCompleteDto with all required fields", async () => {
    const completeBody = {
      s3Key: "uploads/test-file.pdf",
      uploadId: "upload-123-abc",
      parts: [
        { ETag: '"etag-1"', PartNumber: 1 },
        { ETag: '"etag-2"', PartNumber: 2 },
      ],
      companyId: FAKE_COMPANY_ID,
      projectId: FAKE_PROJECT_ID,
      qrcodeId: FAKE_QRCODE_ID,
      documentName: "test-file.pdf",
      documentPurpose: "file-qrcode" as const,
      openToPage: 5,
    };

    await completeMultipartUpload(completeBody);

    expect(axiosInstance.post).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.post as Mock).mock.calls[0];

    // Verify URL
    expect(url).toBe("/document/multipart/complete");

    // Verify all required fields from BackendMultipartCompleteDto
    expect(body).toHaveProperty("s3Key", "uploads/test-file.pdf");
    expect(body).toHaveProperty("uploadId", "upload-123-abc");
    expect(body).toHaveProperty("parts");
    expect(body.parts).toHaveLength(2);
    expect(body.parts[0]).toEqual({ ETag: '"etag-1"', PartNumber: 1 });
    expect(body).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(body).toHaveProperty("qrcodeId", FAKE_QRCODE_ID);
    expect(body).toHaveProperty("documentName", "test-file.pdf");
    expect(body).toHaveProperty("documentPurpose", "file-qrcode");

    // Type-level assertion
    const _typeCheck: BackendMultipartCompleteDto = {
      s3Key: body.s3Key,
      uploadId: body.uploadId,
      parts: body.parts,
      companyId: body.companyId,
      qrcodeId: body.qrcodeId,
      documentName: body.documentName,
      documentPurpose: body.documentPurpose,
      projectId: body.projectId,
      openToPage: body.openToPage,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
    expect(_typeCheck.parts).toHaveLength(2);
  });

  // =========================================================================
  // 7. abortMultipartUpload sends matching BackendMultipartAbortDto
  // =========================================================================
  it("abortMultipartUpload sends matching BackendMultipartAbortDto with required fields", async () => {
    const abortBody = {
      s3Key: "uploads/test-file.pdf",
      uploadId: "upload-123-abc",
    };

    await abortMultipartUpload(abortBody);

    expect(axiosInstance.post).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.post as Mock).mock.calls[0];

    // Verify URL
    expect(url).toBe("/document/multipart/abort");

    // Verify all required fields from BackendMultipartAbortDto
    expect(body).toHaveProperty("s3Key", "uploads/test-file.pdf");
    expect(body).toHaveProperty("uploadId", "upload-123-abc");

    // Type-level assertion
    const _typeCheck: BackendMultipartAbortDto = {
      s3Key: body.s3Key,
      uploadId: body.uploadId,
    };
    expect(_typeCheck.s3Key).toBe("uploads/test-file.pdf");
    expect(_typeCheck.uploadId).toBe("upload-123-abc");
  });

  // =========================================================================
  // 8. restoreDocument (single) sends BasicRequestDto via PATCH /document/restore/:id
  // =========================================================================
  it("restoreDocument sends BasicRequestDto via PATCH /document/restore/:id", async () => {
    await restoreDocument(FAKE_MONGO_ID, FAKE_COMPANY_ID, FAKE_PROJECT_ID);

    expect(axiosInstance.patch).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.patch as Mock).mock.calls[0];

    // Verify URL matches the backend route pattern
    expect(url).toBe(`/document/restore/${FAKE_MONGO_ID}`);

    // Verify the payload includes required companyId and optional projectId
    expect(body).toHaveProperty("companyId", FAKE_COMPANY_ID);
    expect(body).toHaveProperty("projectId", FAKE_PROJECT_ID);

    // Type-level assertion: the payload shape satisfies BackendBasicRequestDto
    const _typeCheck: BackendBasicRequestDto = {
      companyId: body.companyId,
      projectId: body.projectId,
    };
    expect(_typeCheck.companyId).toBe(FAKE_COMPANY_ID);
  });

  // =========================================================================
  // 9. uploadDocumentsMultiple sends FormData to POST /document/upload/multiple
  // =========================================================================
  it("uploadDocumentsMultiple sends FormData to POST /document/upload/multiple", async () => {
    const mockFile = new File(["test content"], "test.pdf", {
      type: "application/pdf",
    });

    await uploadDocumentsMultiple({
      companyId: FAKE_COMPANY_ID,
      projectId: FAKE_PROJECT_ID,
      qrcodeId: FAKE_QRCODE_ID,
      documentPurpose: "file-qrcode",
      files: [mockFile],
      documentNames: ["test.pdf"],
      openToPages: [1],
    });

    expect(axiosInstance.post).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.post as Mock).mock.calls[0];

    // Verify URL matches the backend route
    expect(url).toBe("/document/upload/multiple");

    // Verify FormData is sent
    expect(body).toBeInstanceOf(FormData);

    // Verify FormData contains required fields
    expect(body.get("companyId")).toBe(FAKE_COMPANY_ID);
    expect(body.get("projectId")).toBe(FAKE_PROJECT_ID);
    expect(body.get("qrcodeId")).toBe(FAKE_QRCODE_ID);
    expect(body.get("documentPurpose")).toBe("file-qrcode");
    expect(body.getAll("documentNames")).toEqual(["test.pdf"]);
    expect(body.getAll("openToPages")).toEqual(["1"]);
    expect(body.getAll("files")).toHaveLength(1);
  });

  // =========================================================================
  // 10. Route paths match backend
  // =========================================================================
  describe("Route paths match backend", () => {
    it("single document delete URL matches backend route pattern", async () => {
      await deleteDocument(FAKE_MONGO_ID, FAKE_COMPANY_ID);
      const [url] = (axiosInstance.delete as Mock).mock.calls[0];
      // Backend route: /document/:fileId
      expect(url).toMatch(/^\/document\/[a-f0-9]{24}$/);
      expect(BACKEND_ROUTES["document.delete"].path).toBe("/document/:fileId");
      expect(BACKEND_ROUTES["document.delete"].method).toBe("DELETE");
    });

    it("bulk document delete URL matches backend route", async () => {
      await deleteDocumentsBulk([FAKE_MONGO_ID], FAKE_COMPANY_ID);
      const [url] = (axiosInstance.delete as Mock).mock.calls[0];
      expect(url).toBe("/document/bulk");
      expect(BACKEND_ROUTES["document.delete-bulk"].path).toBe(
        "/document/bulk",
      );
      expect(BACKEND_ROUTES["document.delete-bulk"].method).toBe("DELETE");
    });

    it("bulk document restore URL matches backend route", async () => {
      await restoreDocumentsBulk([FAKE_MONGO_ID], FAKE_COMPANY_ID);
      const [url] = (axiosInstance.patch as Mock).mock.calls[0];
      expect(url).toBe("/document/restore/bulk");
      expect(BACKEND_ROUTES["document.restore-bulk"].path).toBe(
        "/document/restore/bulk",
      );
      expect(BACKEND_ROUTES["document.restore-bulk"].method).toBe("PATCH");
    });

    it("multipart init URL matches backend route", async () => {
      await initMultipartUpload({
        companyId: FAKE_COMPANY_ID,
        qrcodeId: FAKE_QRCODE_ID,
        documentName: "f.pdf",
        documentPurpose: "file-qrcode",
      });
      const [url] = (axiosInstance.post as Mock).mock.calls[0];
      expect(url).toBe("/document/multipart/init");
      expect(BACKEND_ROUTES["document.multipart-init"].path).toBe(
        "/document/multipart/init",
      );
      expect(BACKEND_ROUTES["document.multipart-init"].method).toBe("POST");
    });

    it("multipart part-url URL matches backend route", async () => {
      await getMultipartPartUrl({
        s3Key: "k",
        uploadId: "u",
        partNumber: 1,
        bucket: "b",
        contentType: "application/pdf",
      });
      const [url] = (axiosInstance.post as Mock).mock.calls[0];
      expect(url).toBe("/document/multipart/part-url");
      expect(BACKEND_ROUTES["document.multipart-part-url"].path).toBe(
        "/document/multipart/part-url",
      );
      expect(BACKEND_ROUTES["document.multipart-part-url"].method).toBe("POST");
    });

    it("multipart complete URL matches backend route", async () => {
      await completeMultipartUpload({
        s3Key: "k",
        uploadId: "u",
        parts: [{ ETag: "e", PartNumber: 1 }],
        companyId: FAKE_COMPANY_ID,
        qrcodeId: FAKE_QRCODE_ID,
        documentName: "f.pdf",
        documentPurpose: "file-qrcode",
      });
      const [url] = (axiosInstance.post as Mock).mock.calls[0];
      expect(url).toBe("/document/multipart/complete");
      expect(BACKEND_ROUTES["document.multipart-complete"].path).toBe(
        "/document/multipart/complete",
      );
      expect(BACKEND_ROUTES["document.multipart-complete"].method).toBe("POST");
    });

    it("multipart abort URL matches backend route", async () => {
      await abortMultipartUpload({ s3Key: "k", uploadId: "u" });
      const [url] = (axiosInstance.post as Mock).mock.calls[0];
      expect(url).toBe("/document/multipart/abort");
      expect(BACKEND_ROUTES["document.multipart-abort"].path).toBe(
        "/document/multipart/abort",
      );
      expect(BACKEND_ROUTES["document.multipart-abort"].method).toBe("POST");
    });

    it("upload URL matches backend route", async () => {
      const fd = new FormData();
      await uploadFile(fd);
      const [url] = (axiosInstance.post as Mock).mock.calls[0];
      expect(url).toBe("/document/upload");
      expect(BACKEND_ROUTES["document.upload"].path).toBe("/document/upload");
      expect(BACKEND_ROUTES["document.upload"].method).toBe("POST");
    });

    it("patch document URL matches backend route pattern", async () => {
      await updateDocument(FAKE_MONGO_ID, {
        companyId: FAKE_COMPANY_ID,
        projectId: FAKE_PROJECT_ID,
      });
      const [url] = (axiosInstance.patch as Mock).mock.calls[0];
      expect(url).toMatch(/^\/document\/[a-f0-9]{24}$/);
      expect(BACKEND_ROUTES["document.patch"].path).toBe("/document/:fileId");
      expect(BACKEND_ROUTES["document.patch"].method).toBe("PATCH");
    });

    it("single document restore URL matches backend route pattern", async () => {
      await restoreDocument(FAKE_MONGO_ID, FAKE_COMPANY_ID);
      const [url] = (axiosInstance.patch as Mock).mock.calls[0];
      expect(url).toMatch(/^\/document\/restore\/[a-f0-9]{24}$/);
      expect(BACKEND_ROUTES["document.restore-single"].path).toBe(
        "/document/restore/:documentId",
      );
      expect(BACKEND_ROUTES["document.restore-single"].method).toBe("PATCH");
    });

    it("upload multiple URL matches backend route", async () => {
      const mockFile = new File(["test"], "test.pdf", {
        type: "application/pdf",
      });
      await uploadDocumentsMultiple({
        companyId: FAKE_COMPANY_ID,
        documentPurpose: "file-qrcode",
        files: [mockFile],
      });
      const [url] = (axiosInstance.post as Mock).mock.calls[0];
      expect(url).toBe("/document/upload/multiple");
      expect(BACKEND_ROUTES["document.upload-multiple"].path).toBe(
        "/document/upload/multiple",
      );
      expect(BACKEND_ROUTES["document.upload-multiple"].method).toBe("POST");
    });
  });
});
