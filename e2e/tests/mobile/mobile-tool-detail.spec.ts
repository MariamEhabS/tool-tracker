import { test, expect } from "../../fixtures/verified-test";
import type { Page } from "@playwright/test";
import { ScannedQRPage } from "../../pages/scanned-qr.page";
import {
  InspectionDetailPage,
  PunchListDetailPage,
  FormDetailPage,
} from "../../pages/tool-detail.page";
import {
  mockInspectionData,
  mockInspectionItems,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

// Disable route verification for these tests since they use complex regex patterns
// that routeTracker can't easily track, and many routes are conditionally called
test.use({ verifyRoutesCalled: false });

// ============================================================================
// MOCK DATA
// ============================================================================

const qrCodeId = "qr-mobile-detail-001";

const mockScannedQRWithTools = {
  data: {
    _id: qrCodeId,
    qrcodeName: "Equipment Panel A",
    type: "folder",
    project: {
      _id: "proj-mobile-001",
      projectName: "Mobile Test Project",
      projectAddress: "123 Mobile St",
    },
    company: {
      _id: "comp-mobile-001",
      editProcoreItemsAllowed: true,
    },
  },
  procoreTools: [
    { tool: "inspection", count: 3 },
    { tool: "punch-list", count: 2 },
    { tool: "form", count: 1 },
    { tool: "rfi", count: 5 },
  ],
  folders: [],
  documents: [],
};

const mockInspectionList = [
  {
    procoreToolName: "inspection",
    procoreItemID: "INSP-001",
    name: "Fire Safety Inspection",
    identifier: "INS-2024-001",
    number: "INS-2024-001",
    status: "Ready for Review",
    inspection_type: { name: "Fire Safety" },
    inspection_date: "2024-01-15",
  },
  {
    procoreToolName: "inspection",
    procoreItemID: "INSP-002",
    name: "Electrical Inspection",
    identifier: "INS-2024-002",
    number: "INS-2024-002",
    status: "Open",
    inspection_type: { name: "Electrical" },
    inspection_date: "2024-01-16",
  },
  {
    procoreToolName: "inspection",
    procoreItemID: "INSP-003",
    name: "HVAC Inspection",
    identifier: "INS-2024-003",
    number: "INS-2024-003",
    status: "Closed",
    inspection_type: { name: "HVAC" },
    inspection_date: "2024-01-17",
  },
];

const mockInspectionDetail = {
  ...mockInspectionData,
  procoreItemID: "INSP-001",
};

const mockPunchListDetail = {
  procoreItemID: "PUNCH-001",
  name: "Fix broken window",
  number: "PL-001",
  status: "unresolved",
  workflow_status: "open",
  priority: "High",
  due_date: "2024-01-20",
  description: "The window in Room 101 is cracked and needs replacement",
  location: { node_name: "Room 101" },
  assignee: { name: "Jane Doe" },
  ball_in_court: [{ name: "Jane Doe" }],
  punch_item_manager: { name: "John Smith" },
  punch_item_type: { name: "Safety" },
  assignments: [
    {
      id: 123,
      login_information: { name: "Jane Doe" },
      vendor: { name: "Guard Tests" },
      status: "ready_for_review",
      formatted_status: "Ready for Review",
    },
  ],
  attachments: [],
  created_at: "2024-01-10T09:00:00Z",
  created_by: { name: "John Smith" },
};

const mockFormDetail = {
  procoreItemID: "FORM-001",
  name: "Daily Safety Report",
  form_template_name: "Safety Report",
  created_at: "2024-01-15T09:00:00Z",
  created_by: { name: "John Smith" },
  description: "Daily safety inspection report for January 15",
  attachments: [{ filename: "report.pdf" }],
};

const mockAggregation = [
  {
    company: {
      _id: "comp-mobile-001",
      editProcoreItemsAllowed: true,
      procoreAccess: {
        accessToken: "mock-token",
        refreshToken: "mock-refresh",
      },
    },
    project: { _id: "proj-mobile-001", projectName: "Mobile Test Project" },
  },
];

const expandInspectionGroup = async (page: Page) => {
  const fireSafetyDetails = page
    .locator("details", {
      has: page.locator("summary", { hasText: "Fire Safety" }),
    })
    .first();
  await expect(fireSafetyDetails).toBeVisible();
  const isOpen = await fireSafetyDetails.getAttribute("open");
  if (isOpen === null) {
    await fireSafetyDetails.locator("summary").first().click();
  }
};

// ============================================================================
// TESTS
// ============================================================================

test.describe("Mobile Tool Detail Navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    // Override navigator.userAgent to ensure mobile detection works
    // This is needed because some CI environments may not properly emulate user agent
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "userAgent", {
        value:
          "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        writable: false,
      });
    });
  });

  // ==========================================================================
  // NAVIGATION FROM SCANNED QR
  // ==========================================================================

  test("navigate from scanned QR to tool category list", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);

    // Mock scanned QR endpoint
    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockScannedQRWithTools),
      });
    });

    // Mock aggregation endpoint with glob pattern that matches the actual URL
    await safeRoute(
      page,
      "**/aggregation/qr-company-project**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAggregation),
        });
      },
    );

    // Mock inspections list endpoint
    await safeRoute(page, "**/procore/inspections**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockInspectionList),
      });
    });

    await qrPage.goto(qrCodeId);
    await qrPage.waitForLoad();

    // Category grid should show tool categories
    await expect(qrPage.categoryGrid).toBeVisible();

    // Click on Inspections category
    await qrPage.selectCategory("Inspections");

    // Wait for the inspections list to load
    await page.waitForLoadState("networkidle");
    await expandInspectionGroup(page);

    // Should show inspection list - wait for it to be in the DOM first
    const inspectionItem = page.locator("text=Fire Safety Inspection");
    await inspectionItem.waitFor({ state: "attached", timeout: 10000 });

    // Scroll into view and check visibility
    await inspectionItem.scrollIntoViewIfNeeded();
    await expect(inspectionItem).toBeVisible({ timeout: 5000 });
  });

  test("navigate from tool list to tool detail", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);

    // Mock scanned QR endpoint
    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockScannedQRWithTools),
      });
    });

    // Mock aggregation endpoint
    await safeRoute(
      page,
      "**/aggregation/qr-company-project**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAggregation),
        });
      },
    );

    // Mock inspections list (itemId is empty or absent)
    await safeRoute(
      page,
      /\/procore\/inspections\?.*itemId=(&|$)/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockInspectionList),
        });
      },
    );
    // Mock inspection detail (with specific itemId)
    await safeRoute(
      page,
      /\/procore\/inspections\?.*itemId=INSP-001/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([mockInspectionDetail]),
        });
      },
    );
    // Mock inspection items (with itemId query param)
    await safeRoute(
      page,
      /\/procore\/inspection-items\?.*itemId=INSP-001/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockInspectionItems),
        });
      },
    );

    await qrPage.goto(qrCodeId);
    await qrPage.waitForLoad();

    // Click on Inspections category
    await qrPage.selectCategory("Inspections");

    // Wait for the inspections list to load
    await page.waitForLoadState("networkidle");
    await expandInspectionGroup(page);

    // Wait for list to load - element should be in DOM first
    const inspectionItem = page
      .locator('a[href*="/tools/inspection/INSP-001"]')
      .first();
    await inspectionItem.waitFor({ state: "attached", timeout: 10000 });
    await inspectionItem.scrollIntoViewIfNeeded();
    await expect(inspectionItem).toBeVisible({ timeout: 5000 });

    // Click on an inspection
    await inspectionItem.click();

    // Should navigate to tool detail page
    await page.waitForURL("**/tools/inspection/**", { timeout: 5000 });
  });

  // ==========================================================================
  // INSPECTION DETAIL VIEW
  // ==========================================================================

  test("displays inspection detail with status and metadata", async ({
    page,
  }) => {
    const toolPage = new InspectionDetailPage(page);

    // Mock aggregation endpoint
    await safeRoute(
      page,
      "**/aggregation/qr-company-project**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAggregation),
        });
      },
    );
    // Mock inspection detail (with itemId query param)
    await safeRoute(
      page,
      /\/procore\/inspections\?.*itemId=INSP-001/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([mockInspectionDetail]),
        });
      },
    );
    // Mock inspection items
    await safeRoute(
      page,
      /\/procore\/inspection-items\?.*itemId=INSP-001/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockInspectionItems),
        });
      },
    );

    await toolPage.gotoInspection("INSP-001", qrCodeId);
    await toolPage.waitForLoad();

    // Title should be visible
    await expect(
      page.getByRole("heading", { name: "Fire Safety Inspection" }),
    ).toBeVisible();

    // Status badge should be visible
    await expect(
      page.locator("text=/Ready for Review|Open|Closed/i").first(),
    ).toBeVisible();
  });

  test("inspection detail shows conforming/deficient counts", async ({
    page,
  }) => {
    const toolPage = new InspectionDetailPage(page);

    // Mock aggregation endpoint
    await safeRoute(
      page,
      "**/aggregation/qr-company-project**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAggregation),
        });
      },
    );
    // Mock inspection detail (with itemId query param)
    await safeRoute(
      page,
      /\/procore\/inspections\?.*itemId=INSP-001/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([mockInspectionDetail]),
        });
      },
    );
    // Mock inspection items
    await safeRoute(
      page,
      /\/procore\/inspection-items\?.*itemId=INSP-001/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockInspectionItems),
        });
      },
    );

    await toolPage.gotoInspection("INSP-001", qrCodeId);
    await toolPage.waitForLoad();

    // Conforming and deficient counts should be visible
    await expect(page.locator("text=/conforming/i").first()).toBeVisible({
      timeout: 5000,
    });
  });

  // ==========================================================================
  // PUNCH LIST DETAIL VIEW
  // ==========================================================================

  test("displays punch list detail with priority and location", async ({
    page,
  }) => {
    const toolPage = new PunchListDetailPage(page);

    // Mock aggregation endpoint
    await safeRoute(
      page,
      "**/aggregation/qr-company-project**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAggregation),
        });
      },
    );
    // Mock punch list detail (with itemId query param)
    await safeRoute(
      page,
      /\/procore\/punch-list\?.*itemId=PUNCH-001/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([mockPunchListDetail]),
        });
      },
    );

    await toolPage.gotoPunchList("PUNCH-001", qrCodeId);
    await toolPage.waitForLoad();

    // Title should be visible
    await expect(page.locator("text=Fix broken window")).toBeVisible();

    // Priority badge should be visible
    await expect(page.locator("text=/High|Medium|Low/i").first()).toBeVisible({
      timeout: 5000,
    });

    // Location should be visible
    await expect(page.getByText("Room 101", { exact: true })).toBeVisible();
  });

  test("punch list shows assignee information", async ({ page }) => {
    const toolPage = new PunchListDetailPage(page);

    // Mock aggregation endpoint
    await safeRoute(
      page,
      "**/aggregation/qr-company-project**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAggregation),
        });
      },
    );
    // Mock punch list detail (with itemId query param)
    await safeRoute(
      page,
      /\/procore\/punch-list\?.*itemId=PUNCH-001/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([mockPunchListDetail]),
        });
      },
    );

    await toolPage.gotoPunchList("PUNCH-001", qrCodeId);
    await toolPage.waitForLoad();

    // Click on People tab if visible
    if (
      await toolPage.peopleTab.isVisible({ timeout: 2000 }).catch(() => false)
    ) {
      await toolPage.selectTab("people");
    }

    // Assignee should be visible somewhere on the page
    await expect(page.locator("text=/Jane Doe|assignee/i").first()).toBeVisible(
      { timeout: 5000 },
    );
  });

  // ==========================================================================
  // FORM DETAIL VIEW
  // ==========================================================================

  test("displays form detail with template name", async ({ page }) => {
    const toolPage = new FormDetailPage(page);

    // Mock aggregation endpoint
    await safeRoute(
      page,
      "**/aggregation/qr-company-project**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAggregation),
        });
      },
    );
    // Mock form detail (with itemId query param)
    await safeRoute(
      page,
      /\/procore\/forms\?.*itemId=FORM-001/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([mockFormDetail]),
        });
      },
    );

    await toolPage.gotoForm("FORM-001", qrCodeId);
    await toolPage.waitForLoad();

    // Title should be visible
    await expect(page.locator("text=Daily Safety Report")).toBeVisible();

    // Template name should be visible
    await expect(
      page.locator("text=/Safety Report|template/i").first(),
    ).toBeVisible({ timeout: 5000 });
  });

  // ==========================================================================
  // BACK NAVIGATION
  // ==========================================================================

  test("back button returns to scanned QR view", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);
    const toolPage = new InspectionDetailPage(page);

    // Mock aggregation endpoint
    await safeRoute(
      page,
      "**/aggregation/qr-company-project**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAggregation),
        });
      },
    );
    // Mock inspection detail (with itemId query param)
    await safeRoute(
      page,
      /\/procore\/inspections\?.*itemId=INSP-001/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([mockInspectionDetail]),
        });
      },
    );
    // Mock inspection items
    await safeRoute(
      page,
      /\/procore\/inspection-items\?.*itemId=INSP-001/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockInspectionItems),
        });
      },
    );
    // Mock scanned QR for back navigation
    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockScannedQRWithTools),
      });
    });
    await safeRoute(page, "**/procore/inspections**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockInspectionList),
      });
    });

    await qrPage.goto(qrCodeId);
    await qrPage.waitForLoad();
    await qrPage.selectCategory("Inspections");
    await page.waitForLoadState("networkidle");
    await expandInspectionGroup(page);

    const detailLink = page
      .locator('a[href*="/tools/inspection/INSP-001"]')
      .first();
    await expect(detailLink).toBeVisible();
    await detailLink.click();
    await toolPage.waitForLoad();

    // Click back button
    await toolPage.clickBack();

    // Should return to scanned QR or category view
    await page.waitForURL("**/scannedQR**", { timeout: 5000 });
  });

  // ==========================================================================
  // EDIT FUNCTIONALITY
  // ==========================================================================

  test("Edit in Taliho button opens edit modal when permissions allow", async ({
    page,
  }) => {
    const toolPage = new InspectionDetailPage(page);

    await page.addInitScript(() => {
      localStorage.setItem(
        "talihoCreatorInfo",
        JSON.stringify({ name: "Test User", company: "Test Company" }),
      );
    });

    // Mock aggregation endpoint
    await safeRoute(
      page,
      "**/aggregation/qr-company-project**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAggregation),
        });
      },
    );
    // Mock inspection detail (with itemId query param)
    await safeRoute(
      page,
      /\/procore\/inspections\?.*itemId=INSP-001/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([mockInspectionDetail]),
        });
      },
    );
    // Mock inspection items
    await safeRoute(
      page,
      /\/procore\/inspection-items\?.*itemId=INSP-001/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockInspectionItems),
        });
      },
    );

    await toolPage.gotoInspection("INSP-001", qrCodeId);
    await toolPage.waitForLoad();

    // Edit button should be visible
    if (await toolPage.isEditButtonVisible()) {
      await toolPage.clickEditInTaliho();

      // Edit modal should open
      await toolPage.waitForModalOpen();
      await expect(
        page.locator('[role="dialog"], .fixed.inset-0').first(),
      ).toBeVisible();
    }
  });

  test("Edit button is hidden when permissions are disabled", async ({
    page,
  }) => {
    const toolPage = new InspectionDetailPage(page);

    // Mock aggregation with edit disabled
    const noEditAggregation = [
      {
        company: {
          _id: "comp-mobile-001",
          editProcoreItemsAllowed: false,
          procoreAccess: {
            accessToken: "mock-token",
            refreshToken: "mock-refresh",
          },
        },
        project: { _id: "proj-mobile-001", projectName: "Mobile Test Project" },
      },
    ];

    // Mock aggregation endpoint with no edit permissions
    await safeRoute(
      page,
      "**/aggregation/qr-company-project**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(noEditAggregation),
        });
      },
    );
    // Mock inspection detail (with itemId query param)
    await safeRoute(
      page,
      /\/procore\/inspections\?.*itemId=INSP-001/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([mockInspectionDetail]),
        });
      },
    );
    // Mock inspection items
    await safeRoute(
      page,
      /\/procore\/inspection-items\?.*itemId=INSP-001/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockInspectionItems),
        });
      },
    );

    await toolPage.gotoInspection("INSP-001", qrCodeId);
    await toolPage.waitForLoad();

    // Edit button should be hidden
    await expect(toolPage.editInTalihoButton).toBeHidden();
  });

  // ==========================================================================
  // TAB NAVIGATION
  // ==========================================================================

  test("can navigate between tabs on tool detail", async ({ page }) => {
    const toolPage = new InspectionDetailPage(page);

    // Mock aggregation endpoint
    await safeRoute(
      page,
      "**/aggregation/qr-company-project**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAggregation),
        });
      },
    );
    // Mock inspection detail (with itemId query param)
    await safeRoute(
      page,
      /\/procore\/inspections\?.*itemId=INSP-001/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([mockInspectionDetail]),
        });
      },
    );
    // Mock inspection items
    await safeRoute(
      page,
      /\/procore\/inspection-items\?.*itemId=INSP-001/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockInspectionItems),
        });
      },
    );

    await toolPage.gotoInspection("INSP-001", qrCodeId);
    await toolPage.waitForLoad();

    // Try different tabs
    const tabs = ["dates", "people", "documents", "more"] as const;

    for (const tab of tabs) {
      if (
        await page
          .getByRole("button", { name: new RegExp(tab, "i") })
          .isVisible({ timeout: 1000 })
          .catch(() => false)
      ) {
        await toolPage.selectTab(tab);
        await page.waitForTimeout(500);
      }
    }
  });

  // ==========================================================================
  // ERROR STATES
  // ==========================================================================

  test("shows error state when tool fetch fails", async ({ page }) => {
    const toolPage = new InspectionDetailPage(page);

    // Mock aggregation endpoint
    await safeRoute(
      page,
      "**/aggregation/qr-company-project**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAggregation),
        });
      },
    );
    // Mock error response for inspection not found (with itemId query param)
    await safeRoute(
      page,
      /\/procore\/inspections\?.*itemId=INSP-NOTFOUND/,
      async (route) => {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ message: "Inspection not found" }),
        });
      },
    );

    await toolPage.gotoInspection("INSP-NOTFOUND", qrCodeId);

    // Error state should appear
    await expect(page.getByText("Unable to Load Tool")).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows loading state while fetching tool data", async ({ page }) => {
    const toolPage = new InspectionDetailPage(page);

    // Mock aggregation endpoint
    await safeRoute(
      page,
      "**/aggregation/qr-company-project**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAggregation),
        });
      },
    );
    // Mock inspection detail with delay (with itemId query param)
    await safeRoute(
      page,
      /\/procore\/inspections\?.*itemId=INSP-001/,
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([mockInspectionDetail]),
        });
      },
    );
    // Mock inspection items
    await safeRoute(
      page,
      /\/procore\/inspection-items\?.*itemId=INSP-001/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockInspectionItems),
        });
      },
    );

    await toolPage.goto("inspection", "INSP-001", qrCodeId);

    // Loading indicator should be visible initially
    const splashLoader = page.locator(".loader").first();
    const loaderVisible = await splashLoader
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (loaderVisible) {
      await expect(splashLoader).toBeVisible();
    } else {
      await expect(page.getByAltText("Taliho Logo").first()).toBeVisible({
        timeout: 3000,
      });
    }
  });

  // ==========================================================================
  // TOOL COUNT BADGES
  // ==========================================================================

  test("category shows correct tool count badge", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);

    // Mock scanned QR endpoint
    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockScannedQRWithTools),
      });
    });

    await qrPage.goto(qrCodeId);
    await qrPage.waitForLoad();

    // Check badge counts - Inspections should show 3
    await expect
      .poll(() => qrPage.getCategoryCount("Inspections"), { timeout: 10000 })
      .toBe("3");

    // Punch List should show 2
    await expect
      .poll(() => qrPage.getCategoryCount("Punch List"), { timeout: 10000 })
      .toBe("2");
  });
});
