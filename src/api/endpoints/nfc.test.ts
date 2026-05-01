import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockRollbarError = vi.fn();

vi.mock("..", () => ({
  axiosInstance: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

vi.mock("@/utils/rollbar", () => ({
  rollbar: {
    error: (...args: unknown[]) => mockRollbarError(...args),
  },
  ErrorCategories: {
    API: "api",
  },
}));

import {
  backfillNfcMetadata,
  createNfcBatch,
  getNfcBatchNames,
  getNfcList,
} from "./nfc";

describe("NFC API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getNfcList", () => {
    it("maps UI query params to backend contract", async () => {
      mockGet.mockResolvedValue({
        data: {
          data: {
            items: [],
            total: 0,
            current_page: 1,
            per_page: 20,
          },
        },
      });

      await getNfcList({
        page: 2,
        limit: 25,
        purpose: "customer,marketing",
        tagType: "card,sticker",
        sortBy: "createdAt",
        sortDir: "desc",
        search: "batch",
      });

      expect(mockGet).toHaveBeenCalledWith("/admin/nfc", {
        params: expect.objectContaining({
          current_page: 2,
          per_page: 25,
          purpose: "customer",
          tagType: "card",
          sortBy: "createdAt",
          sortDir: "desc",
          search: "batch",
        }),
      });
    });

    it("normalizes backend snake_case list responses", async () => {
      mockGet.mockResolvedValue({
        data: {
          data: {
            items: [{ _id: "nfc-1", url: "/nfc/v1/nfc-1", assigned: false }],
            total: 1,
            current_page: 3,
            per_page: 50,
          },
        },
      });

      const result = await getNfcList();

      expect(result).toEqual({
        tags: [{ _id: "nfc-1", url: "/nfc/v1/nfc-1", assigned: false }],
        total: 1,
        page: 3,
        limit: 50,
      });
    });

    it("supports legacy camelCase list responses", async () => {
      mockGet.mockResolvedValue({
        data: {
          tags: [{ _id: "nfc-2", url: "/nfc/v1/nfc-2", assigned: true }],
          total: 1,
          page: 1,
          limit: 20,
        },
      });

      const result = await getNfcList();

      expect(result).toEqual({
        tags: [{ _id: "nfc-2", url: "/nfc/v1/nfc-2", assigned: true }],
        total: 1,
        page: 1,
        limit: 20,
      });
    });
  });

  describe("createNfcBatch", () => {
    it("normalizes nested create-batch response shape", async () => {
      mockPost.mockResolvedValue({
        data: {
          data: {
            success_message: "NFC batch created successfully.",
            data: {
              batchId: "batch-123",
              batchName: "My Batch",
              count: 5,
              tags: [],
            },
          },
        },
      });

      const result = await createNfcBatch({
        count: 5,
        tagType: "card",
        purpose: "marketing",
        websiteOverrideRedirect: "https://www.taliho.com",
      });

      expect(result).toEqual({
        batchId: "batch-123",
        batchName: "My Batch",
        count: 5,
        tags: [],
      });
    });

    it("posts conditional customer fields in request payload", async () => {
      mockPost.mockResolvedValue({
        data: {
          data: {
            data: {
              batchId: "batch-456",
              batchName: "Customer Batch",
              count: 2,
              tags: [],
            },
          },
        },
      });

      await createNfcBatch({
        count: 2,
        tagType: "zip_tie",
        purpose: "customer",
        company: "507f1f77bcf86cd799439011",
      });

      expect(mockPost).toHaveBeenCalledWith("/admin/nfc/batch", {
        count: 2,
        tagType: "zip_tie",
        purpose: "customer",
        company: "507f1f77bcf86cd799439011",
      });
    });
  });

  describe("getNfcBatchNames", () => {
    it("returns batch names array from wrapped payload", async () => {
      mockGet.mockResolvedValue({
        data: {
          data: {
            batchNames: ["Batch A", "Batch B"],
          },
        },
      });

      const result = await getNfcBatchNames();

      expect(result).toEqual({
        batchNames: ["Batch A", "Batch B"],
      });
    });
  });

  describe("backfillNfcMetadata", () => {
    it("builds multipart request with dryRun query flag", async () => {
      mockPost.mockResolvedValue({
        data: {
          data: {
            runId: "run-123",
            dryRun: true,
            startedAt: "2026-02-16T00:00:00.000Z",
            completedAt: "2026-02-16T00:00:01.000Z",
            totals: {
              parsedRows: 1,
              validRows: 1,
              matched: 1,
              wouldUpdate: 1,
              updated: 0,
              skippedExisting: 0,
              notFound: 0,
              invalid: 0,
              duplicates: 0,
            },
            files: [],
            unmatchedObjectIds: [],
            errors: [],
          },
        },
      });

      const file = new File(
        [
          "OBJECT ID,FULL URL\n507f1f77bcf86cd799439011,https://app.taliho.com/nfc/v1/507f1f77bcf86cd799439011\n",
        ],
        "taliho_nfc_cards.csv",
        { type: "text/csv" },
      );

      const result = await backfillNfcMetadata([file], true);

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith(
        "/admin/nfc/metadata-backfill?dryRun=true",
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": undefined,
          }),
        }),
      );

      const sentFormData = mockPost.mock.calls[0][1] as FormData;
      const sentFiles = sentFormData.getAll("files");
      expect(sentFiles).toHaveLength(1);
      expect((sentFiles[0] as File).name).toBe("taliho_nfc_cards.csv");
      expect(result.runId).toBe("run-123");
      expect(result.dryRun).toBe(true);
      expect(result.totals.wouldUpdate).toBe(1);
    });
  });
});
