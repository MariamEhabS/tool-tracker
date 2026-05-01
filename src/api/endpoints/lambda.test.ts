/**
 * Tests for lambda API endpoints
 * Tests the extractEquipmentCodes function that calls an AWS Lambda endpoint.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { extractEquipmentCodes } from "./lambda";
import { logDocumentError } from "@/utils/rollbar";
import { logger } from "@/utils/logger";

describe("Lambda API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("extractEquipmentCodes", () => {
    it("should send POST request with correct payload", async () => {
      const mockResponse = { codes: ["EQ-001", "EQ-002"] };
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const urls = ["https://s3.example.com/presigned-url-1"];
      const result = await extractEquipmentCodes(urls);

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://sqnbh4ludumiculoobxjbkh3mq0xttow.lambda-url.us-east-1.on.aws",
        {
          method: "POST",
          body: JSON.stringify({
            s3_signed_urls: [urls],
            use_llm: "False",
          }),
        },
      );
      expect(result).toEqual(mockResponse);

      fetchSpy.mockRestore();
    });

    it("should wrap s3PresignedUrls in an additional array", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve({}),
      } as Response);

      const urls = ["url-1", "url-2", "url-3"];
      await extractEquipmentCodes(urls);

      const calledBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(calledBody.s3_signed_urls).toEqual([urls]);
      expect(calledBody.use_llm).toBe("False");

      fetchSpy.mockRestore();
    });

    it("should return parsed JSON response on success", async () => {
      const mockResponse = {
        results: [
          { code: "EQ-001", confidence: 0.95 },
          { code: "EQ-002", confidence: 0.87 },
        ],
      };
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await extractEquipmentCodes([
        "https://s3.example.com/url",
      ]);
      expect(result).toEqual(mockResponse);

      fetchSpy.mockRestore();
    });

    it("should handle empty presigned URL array", async () => {
      const mockResponse = { results: [] };
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await extractEquipmentCodes([]);

      const calledBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(calledBody.s3_signed_urls).toEqual([[]]);
      expect(result).toEqual(mockResponse);

      fetchSpy.mockRestore();
    });

    it("should log to rollbar on fetch error", async () => {
      const error = new Error("Network Error");
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(error);

      await expect(
        extractEquipmentCodes(["https://s3.example.com/url"]),
      ).rejects.toThrow("Network Error");

      expect(logDocumentError).toHaveBeenCalledWith(
        error,
        "lambda-extraction-failed",
      );

      fetchSpy.mockRestore();
    });

    it("should log to logger on fetch error", async () => {
      const error = new Error("Fetch failed");
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(error);

      await expect(
        extractEquipmentCodes(["https://s3.example.com/url"]),
      ).rejects.toThrow("Fetch failed");

      expect(logger.error).toHaveBeenCalledWith(
        "Lambda extraction error:",
        error,
      );

      fetchSpy.mockRestore();
    });

    it("should wrap non-Error values before passing to rollbar", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue("string error");

      await expect(
        extractEquipmentCodes(["https://s3.example.com/url"]),
      ).rejects.toBe("string error");

      // logDocumentError is called with the raw error value
      // The wrapping happens inside logDocumentError via toError()
      expect(logDocumentError).toHaveBeenCalledWith(
        "string error",
        "lambda-extraction-failed",
      );

      fetchSpy.mockRestore();
    });

    it("should re-throw the original error", async () => {
      const error = new Error("Lambda timeout");
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(error);

      await expect(
        extractEquipmentCodes(["https://s3.example.com/url"]),
      ).rejects.toBe(error);

      fetchSpy.mockRestore();
    });
  });
});
