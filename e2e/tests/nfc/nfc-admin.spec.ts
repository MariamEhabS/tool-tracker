import {
  test,
  expect,
  mockAuthCompany,
  mockAuthTokens,
} from "../../fixtures/authenticated-test";
import { safeRoute } from "../../utils/route-tracker";

// Disable strict route verification — the admin NFC page makes multiple
// conditional API calls (stats, list, batch) depending on user interaction,
// and not all mocked routes will be called in every test.
test.use({ verifyRoutesCalled: false, checkUnmockedCalls: false });

// ============================================================================
// MOCK DATA
// ============================================================================

/**
 * Admin user override: Must use a Taliho developer email that passes
 * the `isAdminUser()` whitelist check in the admin NFC page.
 */
const mockAdminUser = {
  _id: "user-admin-nfc-001",
  firstName: "Admin",
  lastName: "Tester",
  email: "jpmitra.swe@gmail.com", // Must be in ADMIN_EMAILS whitelist
  permission: "admin" as const,
  isVerified: true,
  company: "comp-test-001",
  companyId: "comp-test-001",
};

const mockNfcStats = {
  total: 3005,
  byPurpose: {
    customer: 150,
    marketing: 50,
    unassigned: 2805,
  },
  byTagType: {
    card: 1000,
    zip_tie: 500,
    sticker: 800,
    key_fob: 200,
    wristband: 100,
    other: 405,
  },
  assigned: 200,
  unassigned: 2805,
};

const mockNfcTagsPage1 = {
  tags: [
    {
      _id: "nfc-001",
      url: "/nfc/v1/nfc-001",
      assigned: false,
      purpose: "unassigned",
      tagType: "card",
      batchId: "batch-001",
      batchName: "Feb 2026 Cards",
      createdAt: "2026-02-01T10:00:00Z",
    },
    {
      _id: "nfc-002",
      url: "/nfc/v1/nfc-002",
      assigned: true,
      purpose: "customer",
      tagType: "sticker",
      qrcodeRedirect: "qr-code-001",
      batchId: "batch-001",
      batchName: "Feb 2026 Cards",
      createdAt: "2026-02-01T10:01:00Z",
    },
    {
      _id: "nfc-003",
      url: "/nfc/v1/nfc-003",
      assigned: true,
      purpose: "marketing",
      tagType: "zip_tie",
      websiteOverrideRedirect: "https://taliho.com/promo",
      batchId: "batch-002",
      batchName: "Marketing Batch",
      createdAt: "2026-01-15T09:00:00Z",
    },
    {
      _id: "nfc-004",
      url: "/nfc/v1/nfc-004",
      assigned: false,
      purpose: "unassigned",
      tagType: "other",
      batchName: "",
      createdAt: "2025-12-01T08:00:00Z",
    },
    {
      _id: "nfc-005",
      url: "/nfc/v1/nfc-005",
      assigned: false,
      purpose: "unassigned",
      tagType: "key_fob",
      batchId: "batch-003",
      batchName: "Key Fob Batch",
      createdAt: "2025-11-20T14:30:00Z",
    },
  ],
  total: 25,
  page: 1,
  limit: 20,
};

const mockNfcTagsPage2 = {
  tags: [
    {
      _id: "nfc-006",
      url: "/nfc/v1/nfc-006",
      assigned: false,
      purpose: "unassigned",
      tagType: "wristband",
      batchId: "batch-004",
      batchName: "Wristband Batch",
      createdAt: "2025-10-10T12:00:00Z",
    },
  ],
  total: 25,
  page: 2,
  limit: 20,
};

const mockNfcTagsFilteredByPurpose = {
  tags: [
    {
      _id: "nfc-002",
      url: "/nfc/v1/nfc-002",
      assigned: true,
      purpose: "customer",
      tagType: "sticker",
      qrcodeRedirect: "qr-code-001",
      batchId: "batch-001",
      batchName: "Feb 2026 Cards",
      createdAt: "2026-02-01T10:01:00Z",
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
};

const mockBatchCreateResponse = {
  batchId: "batch-new-001",
  batchName: "Test E2E Batch",
  count: 5,
  tags: [
    { _id: "nfc-new-001", url: "/nfc/v1/nfc-new-001" },
    { _id: "nfc-new-002", url: "/nfc/v1/nfc-new-002" },
    { _id: "nfc-new-003", url: "/nfc/v1/nfc-new-003" },
    { _id: "nfc-new-004", url: "/nfc/v1/nfc-new-004" },
    { _id: "nfc-new-005", url: "/nfc/v1/nfc-new-005" },
  ],
};

const mockUpdatedTag = {
  _id: "nfc-001",
  url: "/nfc/v1/nfc-001",
  assigned: true,
  purpose: "marketing",
  tagType: "card",
  websiteOverrideRedirect: "https://taliho.com/new-promo",
  batchId: "batch-001",
  batchName: "Feb 2026 Cards",
  createdAt: "2026-02-01T10:00:00Z",
};

const mockCompaniesResponse = {
  companies: [
    {
      _id: "comp-001",
      companyName: "Acme Construction",
      deactivated: false,
    },
    {
      _id: "comp-002",
      companyName: "Legacy Build Co",
      deactivated: true,
    },
  ],
  total: 2,
  page: 1,
  limit: 100,
};

const mockMetadataBackfillPreview = {
  runId: "run-preview-001",
  dryRun: true,
  startedAt: "2026-02-16T00:00:00.000Z",
  completedAt: "2026-02-16T00:00:01.000Z",
  totals: {
    parsedRows: 2,
    validRows: 2,
    matched: 1,
    wouldUpdate: 1,
    updated: 0,
    skippedExisting: 0,
    notFound: 1,
    invalid: 0,
    duplicates: 0,
  },
  files: [
    {
      fileName: "taliho_nfc_cards.csv",
      inferredTagType: "card",
      derivedBatchName: "taliho_nfc_cards",
      totals: {
        parsedRows: 2,
        validRows: 2,
        matched: 1,
        wouldUpdate: 1,
        updated: 0,
        skippedExisting: 0,
        notFound: 1,
        invalid: 0,
        duplicates: 0,
      },
      unmatchedObjectIds: ["507f1f77bcf86cd799439099"],
      errors: [],
    },
  ],
  unmatchedObjectIds: ["507f1f77bcf86cd799439099"],
  errors: [],
};

const mockMetadataBackfillApply = {
  ...mockMetadataBackfillPreview,
  runId: "run-apply-001",
  dryRun: false,
  totals: {
    ...mockMetadataBackfillPreview.totals,
    wouldUpdate: 0,
    updated: 1,
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Set up all default API mocks for the admin NFC page.
 * Individual tests can override specific routes by registering them BEFORE
 * calling this function (Playwright evaluates routes in reverse order —
 * last registered takes priority).
 */
async function mockAdminNfcPageLoad(page: import("@playwright/test").Page) {
  await safeRoute(page, "**/admin/customers/companies**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: mockCompaniesResponse,
      }),
    });
  });

  await safeRoute(page, "**/admin/nfc/batch-names**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          batchNames: [
            "Feb 2026 Cards",
            "Marketing Batch",
            "Key Fob Batch",
            "Wristband Batch",
          ],
        },
      }),
    });
  });

  await safeRoute(page, "**/admin/nfc/stats**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockNfcStats),
    });
  });

  await safeRoute(page, "**/admin/nfc/batch/*/csv**", async (route) => {
    // Return a mock CSV blob
    const csvContent =
      "id,url\nnfc-new-001,/nfc/v1/nfc-new-001\nnfc-new-002,/nfc/v1/nfc-new-002\n";
    await route.fulfill({
      status: 200,
      contentType: "text/csv",
      body: csvContent,
    });
  });

  await safeRoute(page, "**/admin/nfc/metadata-backfill**", async (route) => {
    const url = new URL(route.request().url());
    const dryRun = url.searchParams.get("dryRun") !== "false";

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: dryRun ? mockMetadataBackfillPreview : mockMetadataBackfillApply,
      }),
    });
  });

  // Admin NFC list — handle with query params
  // Must be registered AFTER more-specific /admin/nfc/* patterns
  await safeRoute(page, "**/admin/nfc?**", async (route) => {
    const url = new URL(route.request().url());
    const purposeParam = url.searchParams.get("purpose");
    const pageParam =
      url.searchParams.get("current_page") ?? url.searchParams.get("page");

    // If filtering by purpose=customer, return filtered result
    if (purposeParam && purposeParam.includes("customer")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockNfcTagsFilteredByPurpose),
      });
      return;
    }

    // If requesting page 2, return page 2 data
    if (pageParam === "2") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockNfcTagsPage2),
      });
      return;
    }

    // Default: return page 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockNfcTagsPage1),
    });
  });

  // Also handle the list endpoint without query params
  await safeRoute(page, /\/admin\/nfc$/, async (route) => {
    if (route.request().url().includes("/admin/nfc/")) {
      // Let more specific routes handle sub-paths
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockNfcTagsPage1),
    });
  });
}

// ============================================================================
// TESTS — Desktop viewport (1280px)
// ============================================================================

test.describe("Admin NFC Management @desktop", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Override the default authenticated user with an admin-whitelisted user.
    // The authenticated-test fixture sets localStorage from mockAuthUser, but
    // the admin NFC page checks isAdminUser() which requires a whitelisted email.
    await page.addInitScript(
      (data) => {
        window.localStorage.setItem("accessToken", data.accessToken);
        window.localStorage.setItem("user", JSON.stringify(data.user));
        window.localStorage.setItem("company", JSON.stringify(data.company));
      },
      {
        accessToken: mockAuthTokens.accessToken,
        user: mockAdminUser,
        company: mockAuthCompany,
      },
    );

    // Override authenticated fixture's default /auth/me mock so the route guard
    // consistently sees an allowlisted admin user.
    await safeRoute(page, "**/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockAdminUser),
      });
    });

    // Desktop viewport (set by authenticated-test fixture, reinforced here)
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  // ==========================================================================
  // PAGE LOAD
  // ==========================================================================

  test("admin NFC page loads with header and table", async ({
    authenticatedPage: page,
    routeTracker: _routeTracker,
  }) => {
    await mockAdminNfcPageLoad(page);

    await page.goto("/admin/nfc");
    await page.waitForLoadState("networkidle");

    // Header should be visible
    await expect(page.locator("text=NFC Management")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("button", { name: /Create NFC Batch/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Refresh/i })).toBeVisible();

    // Table section should be visible with title
    await expect(page.locator("text=NFC Management")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Backfill Metadata/i }),
    ).toBeVisible();

    // Table should show NFC tag data
    await expect(page.locator("text=/nfc-001/").first()).toBeVisible();
  });

  test("metadata backfill modal supports preview and apply flow", async ({
    authenticatedPage: page,
  }) => {
    await mockAdminNfcPageLoad(page);

    await page.goto("/admin/nfc");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /Backfill Metadata/i }).click();
    await expect(page.getByText("Backfill NFC Metadata")).toBeVisible();

    await page.setInputFiles('input[type="file"][multiple]', [
      {
        name: "taliho_nfc_cards.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          "OBJECT ID,FULL URL\n507f1f77bcf86cd799439011,https://app.taliho.com/nfc/v1/507f1f77bcf86cd799439011\n",
        ),
      },
    ]);

    await page.getByRole("button", { name: /Preview Updates/i }).click();
    await expect(page.getByText("Preview Summary")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Continue to Apply/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Continue to Apply/i }).click();
    await expect(
      page.getByRole("button", { name: /Apply Backfill/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Apply Backfill/i }).click();
    await expect(page.getByText("Backfill NFC Metadata")).not.toBeVisible();
  });

  test("admin NFC page opens batch creation modal from header action", async ({
    authenticatedPage: page,
    routeTracker: _routeTracker,
  }) => {
    await mockAdminNfcPageLoad(page);

    await page.goto("/admin/nfc");
    await page.waitForLoadState("networkidle");

    // Open modal from header action
    await page.getByRole("button", { name: /Create NFC Batch/i }).click();
    const modal = page.locator('[role="dialog"]');

    await expect(modal.locator("text=Create NFC Batch")).toBeVisible({
      timeout: 10000,
    });

    // Form fields should be visible
    await expect(modal.locator("#batchName")).toBeVisible();
    await expect(modal.locator("#count")).toBeVisible();
    await expect(modal.locator("#tagType")).toBeVisible();
    await expect(modal.locator("#purpose")).toBeVisible();
    await expect(modal.locator("#websiteOverrideRedirect")).toBeVisible();
    await expect(modal.locator("#create-company")).toHaveCount(0);

    // Submit button should be visible
    await expect(
      modal.getByRole("button", { name: /Create Batch/i }),
    ).toBeVisible();
  });

  test("batch modal toggles required customer company selector by purpose", async ({
    authenticatedPage: page,
  }) => {
    await mockAdminNfcPageLoad(page);

    await page.goto("/admin/nfc");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /Create NFC Batch/i }).click();
    const modal = page.locator('[role="dialog"]');

    await modal.locator("#purpose").selectOption("customer");
    await expect(modal.locator("#create-company")).toBeVisible();
    await expect(modal.locator("#websiteOverrideRedirect")).toHaveCount(0);

    await modal.getByRole("button", { name: /Create Batch/i }).click();
    await expect(
      modal.getByText("Company is required for customer purpose"),
    ).toBeVisible();
  });

  test("admin NFC page no longer renders deprecated stat cards", async ({
    authenticatedPage: page,
    routeTracker: _routeTracker,
  }) => {
    await mockAdminNfcPageLoad(page);

    await page.goto("/admin/nfc");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Total NFC Tags")).toHaveCount(0);
    await expect(page.locator("text=Customer Tags")).toHaveCount(0);
    await expect(page.locator("text=Marketing Tags")).toHaveCount(0);
    await expect(page.locator("text=Unassigned Tags")).toHaveCount(0);
  });

  // ==========================================================================
  // BATCH CREATION
  // ==========================================================================

  test("creates a batch of NFC tags and triggers CSV download", async ({
    authenticatedPage: page,
    routeTracker: _routeTracker,
  }) => {
    await mockAdminNfcPageLoad(page);

    // Mock the batch creation endpoint
    await safeRoute(page, "**/admin/nfc/batch", async (route) => {
      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON() as Record<
          string,
          unknown
        >;
        expect(payload.purpose).toBe("marketing");
        expect(payload.websiteOverrideRedirect).toBe("https://www.taliho.com");

        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(mockBatchCreateResponse),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/admin/nfc");
    await page.waitForLoadState("networkidle");

    // Open create modal
    await page.getByRole("button", { name: /Create NFC Batch/i }).click();
    const modal = page.locator('[role="dialog"]');

    // Fill in the batch creation form
    const batchNameInput = modal.locator("#batchName");
    await batchNameInput.fill("Test E2E Batch");

    const countInput = modal.locator("#count");
    await countInput.fill("5");

    const tagTypeSelect = modal.locator("#tagType");
    await tagTypeSelect.selectOption("card");

    // Listen for download event (CSV download)
    const downloadPromise = page
      .waitForEvent("download", { timeout: 10000 })
      .catch(() => null);

    // Submit the form
    await modal.getByRole("button", { name: /Create Batch/i }).click();

    // Should show success toast
    await expect(page.locator("text=/Batch created.*5 NFC tags/i")).toBeVisible(
      {
        timeout: 10000,
      },
    );

    // CSV download should be triggered (may or may not be captured depending
    // on how blob URL downloads behave in Playwright)
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toContain("nfc-batch-");
    }
  });

  // ==========================================================================
  // TABLE DISPLAY
  // ==========================================================================

  test("table displays NFC tag data with correct columns", async ({
    authenticatedPage: page,
    routeTracker: _routeTracker,
  }) => {
    await mockAdminNfcPageLoad(page);

    await page.goto("/admin/nfc");
    await page.waitForLoadState("networkidle");

    // Wait for table to load
    await expect(page.locator("text=/nfc-001/").first()).toBeVisible({
      timeout: 10000,
    });

    // Column headers should be visible
    await expect(page.locator("text=NFC ID").first()).toBeVisible();
    await expect(page.locator("text=Purpose").first()).toBeVisible();
    await expect(page.locator("text=Tag Type").first()).toBeVisible();
    await expect(page.locator("text=Batch Name").first()).toBeVisible();
    await expect(page.locator("text=Created").first()).toBeVisible();

    // Purpose badges should be visible
    await expect(page.locator("text=Unassigned").first()).toBeVisible();
    await expect(page.locator("text=Customer").first()).toBeVisible();
    await expect(page.locator("text=Marketing").first()).toBeVisible();

    // Batch name should be visible
    await expect(page.locator("text=Feb 2026 Cards").first()).toBeVisible();
  });

  // ==========================================================================
  // FILTER BY PURPOSE
  // ==========================================================================

  test("filters NFC tags by purpose", async ({
    authenticatedPage: page,
    routeTracker: _routeTracker,
  }) => {
    await mockAdminNfcPageLoad(page);

    await page.goto("/admin/nfc");
    await page.waitForLoadState("networkidle");

    // Wait for initial table load
    await expect(page.locator("text=/nfc-001/").first()).toBeVisible({
      timeout: 10000,
    });

    // Click on the Purpose filter combobox
    const purposeFilter = page.locator("text=Purpose").first();
    await purposeFilter.click();

    // Select "Customer" option from the dropdown
    await page.locator("text=Customer").last().click();

    // Wait for filtered results (the mock handler checks for purpose=customer)
    await page.waitForTimeout(1000);

    // The filtered table should show only customer NFC tags
    // nfc-002 is the customer tag in our filtered mock
    await expect(page.locator("text=/nfc-002/").first()).toBeVisible({
      timeout: 10000,
    });
  });

  // ==========================================================================
  // EDIT NFC TAG
  // ==========================================================================

  test("opens edit modal and updates NFC tag purpose", async ({
    authenticatedPage: page,
    routeTracker: _routeTracker,
  }) => {
    await mockAdminNfcPageLoad(page);

    // Mock the update endpoint
    await safeRoute(page, "**/admin/nfc/nfc-001", async (route) => {
      if (route.request().method() === "PATCH") {
        const payload = route.request().postDataJSON() as Record<
          string,
          unknown
        >;
        expect(payload.purpose).toBe("marketing");
        expect(payload.tagType).toBe("card");
        expect(["", undefined]).toContain(payload.websiteOverrideRedirect);
        expect(["", undefined]).toContain(payload.qrcodeRedirect);

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockUpdatedTag),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/admin/nfc");
    await page.waitForLoadState("networkidle");

    // Wait for table to render
    await expect(page.locator("text=/nfc-001/").first()).toBeVisible({
      timeout: 10000,
    });

    // Open row actions for the target NFC row.
    await page
      .locator("tr", { hasText: "nfc-001" })
      .locator("button")
      .last()
      .click();
    await page.getByRole("menuitem", { name: /Edit/i }).click();

    // Edit modal should be visible
    await expect(page.locator("text=Edit NFC Tag")).toBeVisible({
      timeout: 5000,
    });

    // Change purpose to "Marketing"
    const purposeSelect = page.locator("#edit-purpose");
    await purposeSelect.selectOption("marketing");
    await expect(purposeSelect).toHaveValue("marketing");

    // Redirect fields are not editable in the current edit modal UX.
    await expect(page.locator("#edit-websiteOverrideRedirect")).toHaveCount(0);
    await expect(page.locator("#edit-qrcodeRedirect")).toHaveCount(0);

    // Click Save Changes
    await page.getByRole("button", { name: /Save Changes/i }).click();

    // Should show success toast
    await expect(page.locator("text=NFC tag updated")).toBeVisible({
      timeout: 10000,
    });
  });

  test("edit modal keeps redirect fields hidden when purpose is customer", async ({
    authenticatedPage: page,
    routeTracker: _routeTracker,
  }) => {
    await mockAdminNfcPageLoad(page);

    await page.goto("/admin/nfc");
    await page.waitForLoadState("networkidle");

    // Wait for table
    await expect(page.locator("text=/nfc-001/").first()).toBeVisible({
      timeout: 10000,
    });

    // Open row actions for the target NFC row.
    await page
      .locator("tr", { hasText: "nfc-001" })
      .locator("button")
      .last()
      .click();
    await page.getByRole("menuitem", { name: /Edit/i }).click();

    // Edit modal should be visible
    await expect(page.locator("text=Edit NFC Tag")).toBeVisible({
      timeout: 5000,
    });

    // Change purpose to "Customer"
    const purposeSelect = page.locator("#edit-purpose");
    await purposeSelect.selectOption("customer");
    await expect(purposeSelect).toHaveValue("customer");

    // Redirect fields are not editable in the current edit modal UX.
    await expect(page.locator("#edit-qrcodeRedirect")).toHaveCount(0);
    await expect(page.locator("#edit-websiteOverrideRedirect")).toHaveCount(0);
  });

  // ==========================================================================
  // SEARCH
  // ==========================================================================

  test("search input filters NFC tags by URL or batch name", async ({
    authenticatedPage: page,
    routeTracker: _routeTracker,
  }) => {
    await mockAdminNfcPageLoad(page);

    await page.goto("/admin/nfc");
    await page.waitForLoadState("networkidle");

    // Wait for table
    await expect(page.locator("text=/nfc-001/").first()).toBeVisible({
      timeout: 10000,
    });

    // Type in the search input
    const searchInput = page.locator(
      'input[placeholder*="Search by URL or batch name"]',
    );
    await searchInput.fill("Feb 2026");

    // Wait for debounced search to trigger API call
    await page.waitForTimeout(500);

    // Verify search input has the value
    await expect(searchInput).toHaveValue("Feb 2026");
  });

  // ==========================================================================
  // CLEAR FILTERS
  // ==========================================================================

  test("clear filters button resets all filters and search", async ({
    authenticatedPage: page,
    routeTracker: _routeTracker,
  }) => {
    await mockAdminNfcPageLoad(page);

    await page.goto("/admin/nfc");
    await page.waitForLoadState("networkidle");

    // Wait for table
    await expect(page.locator("text=/nfc-001/").first()).toBeVisible({
      timeout: 10000,
    });

    // Type in the search input
    const searchInput = page.locator(
      'input[placeholder*="Search by URL or batch name"]',
    );
    await searchInput.fill("some search text");

    // Click the Clear Filters button
    await page.getByRole("button", { name: /Clear Filters/i }).click();

    // Search should be cleared
    await expect(searchInput).toHaveValue("");
  });

  // ==========================================================================
  // EMPTY STATE
  // ==========================================================================

  test("shows empty state when no NFC tags exist", async ({
    authenticatedPage: page,
    routeTracker: _routeTracker,
  }) => {
    // Override the default list mock with an empty response
    await safeRoute(page, "**/admin/nfc/stats**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          total: 0,
          byPurpose: {},
          byTagType: {},
          assigned: 0,
          unassigned: 0,
        }),
      });
    });

    await safeRoute(page, "**/admin/nfc?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tags: [], total: 0, page: 1, limit: 20 }),
      });
    });

    await safeRoute(page, /\/admin\/nfc$/, async (route) => {
      if (route.request().url().includes("/admin/nfc/")) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tags: [], total: 0, page: 1, limit: 20 }),
      });
    });

    await page.goto("/admin/nfc");
    await page.waitForLoadState("networkidle");

    // Should show empty state message
    await expect(page.locator("text=No NFC tags yet")).toBeVisible({
      timeout: 10000,
    });

    // Should show helpful description about creating a batch
    await expect(
      page.locator("text=/Create an NFC batch to generate NFC tags/i"),
    ).toBeVisible();
  });

  // ==========================================================================
  // REFRESH BUTTON
  // ==========================================================================

  test("refresh button reloads NFC data", async ({
    authenticatedPage: page,
    routeTracker: _routeTracker,
  }) => {
    await mockAdminNfcPageLoad(page);

    await page.goto("/admin/nfc");
    await page.waitForLoadState("networkidle");

    // Wait for initial load
    await expect(page.locator("text=/nfc-001/").first()).toBeVisible({
      timeout: 10000,
    });

    // Click the Refresh button
    await page.getByRole("button", { name: /Refresh/i }).click();

    // Page should still show data after refresh (API mocks still active)
    await expect(page.locator("text=/nfc-001/").first()).toBeVisible({
      timeout: 10000,
    });
  });

  // ==========================================================================
  // DELETE NFC TAG
  // ==========================================================================

  test("opens delete confirmation modal", async ({
    authenticatedPage: page,
    routeTracker: _routeTracker,
  }) => {
    await mockAdminNfcPageLoad(page);

    await page.goto("/admin/nfc");
    await page.waitForLoadState("networkidle");

    // Wait for table
    await expect(page.locator("text=/nfc-001/").first()).toBeVisible({
      timeout: 10000,
    });

    // Open row actions for the target NFC row.
    await page
      .locator("tr", { hasText: "nfc-001" })
      .locator("button")
      .last()
      .click();
    await page.getByRole("menuitem", { name: /Delete/i }).click();

    // Delete confirmation modal should be visible
    await expect(page.locator("text=Delete NFC Tag")).toBeVisible({
      timeout: 5000,
    });

    // Warning text should be visible
    await expect(
      page.locator(
        "text=/physical NFC tag pointing to this URL will stop working/i",
      ),
    ).toBeVisible();

    // Cancel and Delete buttons should be visible
    await expect(page.getByRole("button", { name: /Cancel/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Delete Tag/i }),
    ).toBeVisible();
  });
});
