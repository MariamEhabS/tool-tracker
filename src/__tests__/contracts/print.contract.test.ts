/**
 * Contract Test: Print API
 *
 * Validates that the frontend Print API client functions send requests
 * that align with the backend DTO specifications declared in backend-contracts.ts.
 *
 * When the backend changes a Print DTO or route, update backend-contracts.ts first,
 * then run these tests to surface any frontend drift.
 *
 * @see ./backend-contracts.ts for the canonical backend DTO definitions.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import {
  type BackendPrintLetterDto,
  type BackendPrintLabelDto,
  BACKEND_ROUTES,
} from "./backend-contracts";

// ---------------------------------------------------------------------------
// Mocks — must appear before imports that depend on them
// ---------------------------------------------------------------------------

vi.mock("@api/index", () => ({
  axiosInstance: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: new Blob() }),
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
  postPrintLetter,
  postPrintAvery,
  postPrintZebra,
} from "@api/endpoints/print";

import { axiosInstance } from "@api/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_GROUP_ID = "665af1b2c3d4e5f6a7b8c9d0";

function keysOf<T extends Record<string, unknown>>(obj: T): string[] {
  return Object.keys(obj);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Contract: Print API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. postPrintLetter sends body matching BackendPrintLetterDto
  // =========================================================================
  it("postPrintLetter sends body matching BackendPrintLetterDto via POST /print/group/:groupId/letter", async () => {
    const payload = {
      groupId: FAKE_GROUP_ID,
      perPage: 4,
      headerProjectName: true,
      headerGroupName: false,
      footerMode: "logo" as const,
      qrCodeIds: ["qr1", "qr2"],
    };

    await postPrintLetter(payload);

    expect(axiosInstance.post).toHaveBeenCalledTimes(1);

    const [url, body, config] = (axiosInstance.post as Mock).mock.calls[0];

    // Verify URL matches the backend route pattern
    expect(url).toBe(`/print/group/${FAKE_GROUP_ID}/letter`);

    // Verify body fields
    expect(body).toHaveProperty("perPage", 4);
    expect(body).toHaveProperty("headerProjectName", true);
    expect(body).toHaveProperty("headerGroupName", false);
    expect(body).toHaveProperty("footerMode", "logo");
    expect(body).toHaveProperty("qrCodeIds", ["qr1", "qr2"]);

    // Verify groupId is NOT in the body (it's in the URL path)
    expect(body).not.toHaveProperty("groupId");

    // Verify responseType is blob for PDF
    expect(config).toEqual({ responseType: "blob" });

    // Verify all sent keys are valid backend DTO keys
    const backendDtoKeys = keysOf<BackendPrintLetterDto>({
      perPage: 0,
      headerProjectName: false,
      headerGroupName: false,
      footerMode: "logo",
      qrCodeIds: [],
    });
    for (const sentKey of Object.keys(body)) {
      expect(backendDtoKeys).toContain(sentKey);
    }

    // Type-level assertion
    const _typeCheck: BackendPrintLetterDto = {
      perPage: body.perPage,
      headerProjectName: body.headerProjectName,
      headerGroupName: body.headerGroupName,
      footerMode: body.footerMode,
      qrCodeIds: body.qrCodeIds,
    };
    expect(_typeCheck.perPage).toBe(4);
  });

  // =========================================================================
  // 2. postPrintAvery sends body matching BackendPrintLabelDto
  // =========================================================================
  it("postPrintAvery sends body matching BackendPrintLabelDto via POST /print/group/:groupId/labels/avery", async () => {
    const payload = {
      groupId: FAKE_GROUP_ID,
      qrCodeIds: ["qr1", "qr2", "qr3"],
    };

    await postPrintAvery(payload);

    expect(axiosInstance.post).toHaveBeenCalledTimes(1);

    const [url, body, config] = (axiosInstance.post as Mock).mock.calls[0];

    // Verify URL matches the backend route pattern
    expect(url).toBe(`/print/group/${FAKE_GROUP_ID}/labels/avery`);

    // Verify body fields
    expect(body).toHaveProperty("qrCodeIds", ["qr1", "qr2", "qr3"]);

    // Verify groupId is NOT in the body (it's in the URL path)
    expect(body).not.toHaveProperty("groupId");

    // Verify responseType is blob for PDF
    expect(config).toEqual({ responseType: "blob" });

    // Verify all sent keys are valid backend DTO keys
    const backendDtoKeys = keysOf<BackendPrintLabelDto>({
      qrCodeIds: [],
    });
    for (const sentKey of Object.keys(body)) {
      expect(backendDtoKeys).toContain(sentKey);
    }

    // Type-level assertion
    const _typeCheck: BackendPrintLabelDto = {
      qrCodeIds: body.qrCodeIds,
    };
    expect(_typeCheck.qrCodeIds).toEqual(["qr1", "qr2", "qr3"]);
  });

  // =========================================================================
  // 3. postPrintZebra sends body matching BackendPrintLabelDto
  // =========================================================================
  it("postPrintZebra sends body matching BackendPrintLabelDto via POST /print/group/:groupId/labels/zebra", async () => {
    const payload = {
      groupId: FAKE_GROUP_ID,
      qrCodeIds: ["qr1"],
    };

    await postPrintZebra(payload);

    expect(axiosInstance.post).toHaveBeenCalledTimes(1);

    const [url, body, config] = (axiosInstance.post as Mock).mock.calls[0];

    // Verify URL matches the backend route pattern
    expect(url).toBe(`/print/group/${FAKE_GROUP_ID}/labels/zebra`);

    // Verify body fields
    expect(body).toHaveProperty("qrCodeIds", ["qr1"]);

    // Verify groupId is NOT in the body (it's in the URL path)
    expect(body).not.toHaveProperty("groupId");

    // Verify responseType is blob for PDF
    expect(config).toEqual({ responseType: "blob" });

    // Verify all sent keys are valid backend DTO keys
    const backendDtoKeys = keysOf<BackendPrintLabelDto>({
      qrCodeIds: [],
    });
    for (const sentKey of Object.keys(body)) {
      expect(backendDtoKeys).toContain(sentKey);
    }

    // Type-level assertion
    const _typeCheck: BackendPrintLabelDto = {
      qrCodeIds: body.qrCodeIds,
    };
    expect(_typeCheck.qrCodeIds).toEqual(["qr1"]);
  });

  // =========================================================================
  // 4. postPrintAvery with no qrCodeIds sends empty body
  // =========================================================================
  it("postPrintAvery with no qrCodeIds sends body with undefined qrCodeIds", async () => {
    await postPrintAvery({ groupId: FAKE_GROUP_ID });

    expect(axiosInstance.post).toHaveBeenCalledTimes(1);

    const [url, body] = (axiosInstance.post as Mock).mock.calls[0];

    expect(url).toBe(`/print/group/${FAKE_GROUP_ID}/labels/avery`);

    // qrCodeIds should be undefined (not sent) when not provided
    expect(body.qrCodeIds).toBeUndefined();
  });

  // =========================================================================
  // 5. Route paths and HTTP methods match backend specification
  // =========================================================================
  describe("Route paths and HTTP methods match backend specification", () => {
    it("print letter URL matches backend route pattern", async () => {
      await postPrintLetter({ groupId: FAKE_GROUP_ID, perPage: 1 });

      const route = BACKEND_ROUTES["print.letter"];
      const [url] = (axiosInstance.post as Mock).mock.calls[0];
      expect(url).toMatch(
        new RegExp("^" + route.path.replace(":groupId", "[\\w]+") + "$"),
      );
      expect(route.method).toBe("POST");
      expect(axiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it("print avery URL matches backend route pattern", async () => {
      await postPrintAvery({ groupId: FAKE_GROUP_ID });

      const route = BACKEND_ROUTES["print.avery"];
      const [url] = (axiosInstance.post as Mock).mock.calls[0];
      expect(url).toMatch(
        new RegExp("^" + route.path.replace(":groupId", "[\\w]+") + "$"),
      );
      expect(route.method).toBe("POST");
      expect(axiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it("print zebra URL matches backend route pattern", async () => {
      await postPrintZebra({ groupId: FAKE_GROUP_ID });

      const route = BACKEND_ROUTES["print.zebra"];
      const [url] = (axiosInstance.post as Mock).mock.calls[0];
      expect(url).toMatch(
        new RegExp("^" + route.path.replace(":groupId", "[\\w]+") + "$"),
      );
      expect(route.method).toBe("POST");
      expect(axiosInstance.post).toHaveBeenCalledTimes(1);
    });
  });
});
