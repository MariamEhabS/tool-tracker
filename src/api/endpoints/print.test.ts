/**
 * Tests for Print API endpoints
 * Tests postPrintLetter, postPrintAvery, postPrintZebra, and openBlobPdf.
 * Validates correct payload structure, blob response handling, rollbar error logging,
 * and fallback download behavior when window.open fails.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockPost = vi.fn();

vi.mock("..", () => ({
  axiosInstance: {
    post: (...args: unknown[]) => mockPost(...args),
    defaults: { baseURL: "http://localhost:3000" },
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/utils/rollbar", () => ({
  logApiError: vi.fn(),
}));

import {
  postPrintLetter,
  postPrintAvery,
  postPrintZebra,
  openBlobPdf,
} from "./print";
import { logApiError } from "@/utils/rollbar";
import { logger } from "@/utils/logger";

describe("Print API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==================== postPrintLetter ====================

  describe("postPrintLetter", () => {
    it("should make POST request with correct URL and payload", async () => {
      const mockBlob = new Blob(["pdf-data"], { type: "application/pdf" });
      mockPost.mockResolvedValue({ data: mockBlob });

      const result = await postPrintLetter({
        groupId: "group-123",
        perPage: 4,
        headerProjectName: true,
        headerGroupName: false,
        footerMode: "logo",
        qrCodeIds: ["qr-1", "qr-2"],
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/print/group/group-123/letter",
        {
          perPage: 4,
          headerProjectName: true,
          headerGroupName: false,
          footerMode: "logo",
          qrCodeIds: ["qr-1", "qr-2"],
        },
        { responseType: "blob" },
      );
      expect(result).toBe(mockBlob);
    });

    it("should handle optional qrCodeIds as undefined", async () => {
      const mockBlob = new Blob(["pdf"], { type: "application/pdf" });
      mockPost.mockResolvedValue({ data: mockBlob });

      await postPrintLetter({
        groupId: "group-123",
        perPage: 2,
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/print/group/group-123/letter",
        {
          perPage: 2,
          headerProjectName: undefined,
          headerGroupName: undefined,
          footerMode: undefined,
          qrCodeIds: undefined,
        },
        { responseType: "blob" },
      );
    });

    it("should report error to rollbar on failure", async () => {
      const error = new Error("Request failed");
      mockPost.mockRejectedValue(error);

      await expect(
        postPrintLetter({
          groupId: "group-123",
          perPage: 4,
          qrCodeIds: ["qr-1"],
        }),
      ).rejects.toThrow("Request failed");

      expect(logApiError).toHaveBeenCalledWith(
        error,
        "print-letter-generation-failed",
        {
          groupId: "group-123",
          perPage: 4,
          qrCodeCount: 1,
        },
      );
    });

    it("should wrap non-Error in new Error for rollbar", async () => {
      mockPost.mockRejectedValue("string error");

      await expect(
        postPrintLetter({ groupId: "group-123", perPage: 4 }),
      ).rejects.toBe("string error");

      expect(logApiError).toHaveBeenCalledWith(
        "string error",
        "print-letter-generation-failed",
        {
          groupId: "group-123",
          perPage: 4,
          qrCodeCount: undefined,
        },
      );
    });

    it("should propagate 500 Server Error", async () => {
      const error = {
        response: {
          status: 500,
          data: { message: "Internal Server Error" },
        },
      };
      mockPost.mockRejectedValue(error);

      await expect(
        postPrintLetter({ groupId: "group-123", perPage: 4 }),
      ).rejects.toEqual(error);
    });
  });

  // ==================== postPrintAvery ====================

  describe("postPrintAvery", () => {
    it("should make POST request with correct URL and payload", async () => {
      const mockBlob = new Blob(["avery-data"], { type: "application/pdf" });
      mockPost.mockResolvedValue({ data: mockBlob });

      const result = await postPrintAvery({
        groupId: "group-456",
        qrCodeIds: ["qr-1", "qr-2", "qr-3"],
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/print/group/group-456/labels/avery",
        { qrCodeIds: ["qr-1", "qr-2", "qr-3"] },
        { responseType: "blob" },
      );
      expect(result).toBe(mockBlob);
    });

    it("should handle missing qrCodeIds", async () => {
      const mockBlob = new Blob(["avery"], { type: "application/pdf" });
      mockPost.mockResolvedValue({ data: mockBlob });

      await postPrintAvery({ groupId: "group-456" });

      expect(mockPost).toHaveBeenCalledWith(
        "/print/group/group-456/labels/avery",
        { qrCodeIds: undefined },
        { responseType: "blob" },
      );
    });

    it("should report error to rollbar on failure", async () => {
      const error = new Error("Avery print failed");
      mockPost.mockRejectedValue(error);

      await expect(
        postPrintAvery({ groupId: "group-456", qrCodeIds: ["qr-1", "qr-2"] }),
      ).rejects.toThrow("Avery print failed");

      expect(logApiError).toHaveBeenCalledWith(
        error,
        "print-avery-generation-failed",
        {
          groupId: "group-456",
          qrCodeCount: 2,
        },
      );
    });
  });

  // ==================== postPrintZebra ====================

  describe("postPrintZebra", () => {
    it("should make POST request with correct URL and payload", async () => {
      const mockBlob = new Blob(["zebra-data"], { type: "application/pdf" });
      mockPost.mockResolvedValue({ data: mockBlob });

      const result = await postPrintZebra({
        groupId: "group-789",
        qrCodeIds: ["qr-1"],
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/print/group/group-789/labels/zebra",
        { qrCodeIds: ["qr-1"] },
        { responseType: "blob" },
      );
      expect(result).toBe(mockBlob);
    });

    it("should handle missing qrCodeIds", async () => {
      const mockBlob = new Blob(["zebra"], { type: "application/pdf" });
      mockPost.mockResolvedValue({ data: mockBlob });

      await postPrintZebra({ groupId: "group-789" });

      expect(mockPost).toHaveBeenCalledWith(
        "/print/group/group-789/labels/zebra",
        { qrCodeIds: undefined },
        { responseType: "blob" },
      );
    });

    it("should report error to rollbar on failure", async () => {
      const error = new Error("Zebra print failed");
      mockPost.mockRejectedValue(error);

      await expect(
        postPrintZebra({ groupId: "group-789", qrCodeIds: ["qr-1"] }),
      ).rejects.toThrow("Zebra print failed");

      expect(logApiError).toHaveBeenCalledWith(
        error,
        "print-zebra-generation-failed",
        {
          groupId: "group-789",
          qrCodeCount: 1,
        },
      );
    });
  });

  // ==================== openBlobPdf ====================

  describe("openBlobPdf", () => {
    let mockCreateObjectURL: ReturnType<typeof vi.fn>;
    let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
    let mockWindowOpen: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockCreateObjectURL = vi
        .fn()
        .mockReturnValue("blob:http://localhost/fake-url");
      mockRevokeObjectURL = vi.fn();
      mockWindowOpen = vi.fn().mockReturnValue({ focus: vi.fn() });

      window.URL.createObjectURL = mockCreateObjectURL;
      window.URL.revokeObjectURL = mockRevokeObjectURL;
      vi.spyOn(window, "open").mockImplementation(mockWindowOpen);
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("should open blob PDF in new window", () => {
      const blob = new Blob(["pdf-content"], { type: "application/pdf" });

      openBlobPdf(blob);

      expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
      expect(mockWindowOpen).toHaveBeenCalledWith(
        "blob:http://localhost/fake-url",
        "_blank",
      );
    });

    it("should revoke object URL after 60 seconds", () => {
      const blob = new Blob(["pdf"], { type: "application/pdf" });

      openBlobPdf(blob);

      expect(mockRevokeObjectURL).not.toHaveBeenCalled();
      vi.advanceTimersByTime(60_000);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(
        "blob:http://localhost/fake-url",
      );
    });

    it("should fall back to download when window.open returns null", () => {
      mockWindowOpen.mockReturnValue(null);

      const mockAnchor = {
        href: "",
        download: "",
        click: vi.fn(),
        remove: vi.fn(),
      };
      vi.spyOn(document, "createElement").mockReturnValue(
        mockAnchor as unknown as HTMLAnchorElement,
      );
      vi.spyOn(document.body, "appendChild").mockImplementation(
        () => mockAnchor as unknown as Node,
      );

      const blob = new Blob(["pdf"], { type: "application/pdf" });

      openBlobPdf(blob, "custom-report.pdf");

      expect(mockAnchor.href).toBe("blob:http://localhost/fake-url");
      expect(mockAnchor.download).toBe("custom-report.pdf");
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(mockAnchor.remove).toHaveBeenCalled();
    });

    it("should use default filename when none provided", () => {
      mockWindowOpen.mockReturnValue(null);

      const mockAnchor = {
        href: "",
        download: "",
        click: vi.fn(),
        remove: vi.fn(),
      };
      vi.spyOn(document, "createElement").mockReturnValue(
        mockAnchor as unknown as HTMLAnchorElement,
      );
      vi.spyOn(document.body, "appendChild").mockImplementation(
        () => mockAnchor as unknown as Node,
      );

      const blob = new Blob(["pdf"], { type: "application/pdf" });

      openBlobPdf(blob);

      expect(mockAnchor.download).toBe("print.pdf");
    });

    it("should log error to rollbar and logger when createObjectURL throws", () => {
      mockCreateObjectURL.mockImplementation(() => {
        throw new Error("Blob URL creation failed");
      });

      const blob = new Blob(["pdf"], { type: "application/pdf" });

      openBlobPdf(blob);

      expect(logApiError).toHaveBeenCalledWith(
        expect.any(Error),
        "open-blob-pdf-failed",
      );
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to open PDF blob",
        expect.any(Error),
      );
    });

    it("should wrap non-Error in new Error for rollbar warning", () => {
      mockCreateObjectURL.mockImplementation(() => {
        throw "string error";
      });

      const blob = new Blob(["pdf"], { type: "application/pdf" });

      openBlobPdf(blob);

      expect(logApiError).toHaveBeenCalledWith(
        "string error",
        "open-blob-pdf-failed",
      );
    });
  });
});
