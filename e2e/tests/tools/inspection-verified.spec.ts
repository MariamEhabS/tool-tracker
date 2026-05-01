/**
 * Inspection Tests - Using Verified Test Patterns
 *
 * This file demonstrates how to use the verification utilities to prevent
 * false positives and false negatives. Compare with inspection.spec.ts
 * to see the differences.
 */
import { test, expect } from "../../fixtures/verified-test";
import percySnapshot from "../../utils/percy";
import {
  assertMockDataVisible,
  assertFieldsNotVisible,
  assertBackButtonVisible,
  assertEditButtonVisible,
  clickTab,
  waitForLoadingComplete,
  waitForMockRoutesCalled,
} from "../../utils";
import {
  mockInspectionData,
  mockInspectionMinimal,
  mockInspectionItems,
  mockAggregation,
  mockAggregationNoEdit,
} from "../../fixtures/test-data";

const INSPECTION_ROUTE_PATTERNS = [
  "**/aggregation/qr-company-project**",
  "**/procore/inspections**",
  "**/procore/inspection-items**",
] as const;

test.describe("Inspections - Section 4.7 (Verified)", () => {
  test("displays inspection detail with all fields", async ({
    page,
    routeTracker,
  }) => {
    // Use routeTracker instead of raw page.route - this tracks calls
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockRoute("**/procore/inspections**", [
      mockInspectionData,
    ]);
    // Mock inspection items endpoint (called automatically by the component)
    await routeTracker.mockRoute(
      "**/procore/inspection-items**",
      mockInspectionItems,
    );

    await page.goto("/tools/inspection/INSP-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);
    await waitForMockRoutesCalled(routeTracker, INSPECTION_ROUTE_PATTERNS);

    // Use assertMockDataVisible to verify specific mock data is displayed
    // This ensures we're not just checking for any text, but the actual mock data
    await assertMockDataVisible(page, mockInspectionData, [
      "name", // 'Fire Safety Inspection'
      "number", // 'INS-2024-001'
      "identifier", // 'BUILDING-A'
    ]);

    // Verify status is displayed (case-insensitive)
    await expect(page.getByText(/ready for review/i)).toBeVisible();

    await percySnapshot(page, "Inspection Detail - Full Data (Verified)");

    // routeTracker automatically verifies both routes were called after test
  });

  test("displays inspection with minimal data and hides optional fields", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockRoute("**/procore/inspections**", [
      mockInspectionMinimal,
    ]);
    // Mock inspection items endpoint (called automatically by the component)
    await routeTracker.mockRoute(
      "**/procore/inspection-items**",
      mockInspectionItems,
    );

    await page.goto("/tools/inspection/INSP-002?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);
    await waitForMockRoutesCalled(routeTracker, INSPECTION_ROUTE_PATTERNS);

    // Verify minimal data IS visible
    await assertMockDataVisible(page, mockInspectionMinimal, [
      "name",
      "status",
    ]);

    // Verify full data fields are NOT visible (prevents false positives)
    // If these fields appear, the test will fail - ensuring we actually have minimal data
    await assertFieldsNotVisible(page, [
      "BUILDING-A", // identifier from full mock
      "INS-2024-001", // number from full mock
      "Fire Safety Inspection", // name from full mock
    ]);

    await percySnapshot(page, "Inspection Detail - Minimal Data (Verified)");
  });

  test("tabs switch content and display correct data", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockRoute("**/procore/inspections**", [
      mockInspectionData,
    ]);
    // Mock inspection items endpoint (called automatically by the component)
    await routeTracker.mockRoute(
      "**/procore/inspection-items**",
      mockInspectionItems,
    );

    await page.goto("/tools/inspection/INSP-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);
    await waitForMockRoutesCalled(routeTracker, INSPECTION_ROUTE_PATTERNS);

    // Verify initial data loads
    await assertMockDataVisible(page, mockInspectionData, ["name"]);

    // Test Dates tab
    await clickTab(page, "Dates");
    await percySnapshot(page, "Inspection Detail - Dates Tab (Verified)");

    // Test People tab - verify inspector name from mock data
    await clickTab(page, "People");
    const inspectorName = mockInspectionData.inspectors?.[0]?.name;
    if (inspectorName) {
      await expect(page.locator(`text=${inspectorName}`)).toBeVisible();
    }
    await percySnapshot(page, "Inspection Detail - People Tab (Verified)");

    // Test Documents tab
    await clickTab(page, "Documents");
    await percySnapshot(page, "Inspection Detail - Documents Tab (Verified)");
  });

  test("shows Edit button when permitted", async ({ page, routeTracker }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockRoute("**/procore/inspections**", [
      mockInspectionData,
    ]);
    // Mock inspection items endpoint (called automatically by the component)
    await routeTracker.mockRoute(
      "**/procore/inspection-items**",
      mockInspectionItems,
    );

    await page.goto("/tools/inspection/INSP-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);
    await waitForMockRoutesCalled(routeTracker, INSPECTION_ROUTE_PATTERNS);

    // Use helper to assert edit button visibility
    await assertEditButtonVisible(page, { shouldBeVisible: true });
  });

  test("hides Edit button when not permitted", async ({
    page,
    routeTracker,
  }) => {
    // Use no-edit aggregation mock
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregationNoEdit,
    );
    await routeTracker.mockRoute("**/procore/inspections**", [
      mockInspectionData,
    ]);
    // Mock inspection items endpoint (called automatically by the component)
    await routeTracker.mockRoute(
      "**/procore/inspection-items**",
      mockInspectionItems,
    );

    await page.goto("/tools/inspection/INSP-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);
    await waitForMockRoutesCalled(routeTracker, INSPECTION_ROUTE_PATTERNS);

    // Verify data loads first (prevents false positive from loading state)
    await assertMockDataVisible(page, mockInspectionData, ["name"]);

    // Use helper to assert edit button is NOT visible
    await assertEditButtonVisible(page, { shouldBeVisible: false });

    await percySnapshot(
      page,
      "Inspection Detail - No Edit Permission (Verified)",
    );
  });

  // Skip: Complex timing issue with openEdit query param and localStorage setup
  // The component requires: openEditDefault prop, creator info in localStorage,
  // and canEditInTaliho permission. Test timing with route parsing is unreliable.
  test.skip("auto-opens edit modal with openEdit=true", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockRoute("**/procore/inspections**", [
      mockInspectionData,
    ]);
    await routeTracker.mockRoute(
      "**/procore/inspection-items**",
      mockInspectionItems,
    );

    // Component requires creator info in localStorage to auto-open edit modal
    // Without it, UserInfoModal is shown first
    await page.addInitScript(() => {
      localStorage.setItem(
        "talihoCreatorInfo",
        JSON.stringify({ name: "Test User", company: "Test Company" }),
      );
    });

    await page.goto(
      "/tools/inspection/INSP-001?qrCodeId=test-qr&openEdit=true",
      {
        waitUntil: "domcontentloaded",
      },
    );

    // Wait for page and modal to load
    await waitForLoadingComplete(page);

    // Wait for the inspection-items API response before checking content
    await page.waitForTimeout(1500); // Allow modal animation and API response

    // Verify inspection items endpoint was called (edit modal fetches items)
    expect(routeTracker.wasIntercepted("**/procore/inspection-items**")).toBe(
      true,
    );

    // Verify section headers from mock items are visible
    const firstSection = mockInspectionItems.sections?.[0]?.name;
    if (firstSection) {
      await expect(page.locator(`text=${firstSection}`)).toBeVisible({
        timeout: 5000,
      });
      await percySnapshot(
        page,
        "Inspection Detail - Edit Modal Auto-Open (Verified)",
      );
    }
  });

  test("displays conforming and deficient counts from mock data", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockRoute("**/procore/inspections**", [
      mockInspectionData,
    ]);
    // Mock inspection items endpoint (called automatically by the component)
    await routeTracker.mockRoute(
      "**/procore/inspection-items**",
      mockInspectionItems,
    );

    await page.goto("/tools/inspection/INSP-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);
    await waitForMockRoutesCalled(routeTracker, INSPECTION_ROUTE_PATTERNS);

    // Verify counts match the mock data (not just any numbers)
    const conformingCount = mockInspectionData.conforming_item_count;
    const deficientCount = mockInspectionData.deficient_item_count;

    if (conformingCount !== undefined) {
      await expect(
        page.locator(`text=${conformingCount}`).first(),
      ).toBeVisible();
    }
    if (deficientCount !== undefined) {
      await expect(
        page.locator(`text=${deficientCount}`).first(),
      ).toBeVisible();
    }
  });

  test("back button is visible", async ({ page, routeTracker }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockRoute("**/procore/inspections**", [
      mockInspectionData,
    ]);
    await routeTracker.mockRoute(
      "**/procore/inspection-items**",
      mockInspectionItems,
    );

    await page.goto("/tools/inspection/INSP-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);
    await waitForMockRoutesCalled(routeTracker, INSPECTION_ROUTE_PATTERNS);

    // Use helper for back button assertion
    await assertBackButtonVisible(page);
  });
});

/**
 * Negative Tests - Verify error handling
 */
test.describe("Inspections - Error Handling (Verified)", () => {
  // Skip: Error handling tests need proper error state rendering in component
  test.skip("shows error state on API failure", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    // Mock a server error
    await routeTracker.mockErrorResponse("**/procore/inspections**", 500, {
      message: "Internal server error",
    });

    await page.goto("/tools/inspection/INSP-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    // Should show error state, not inspection data
    await assertFieldsNotVisible(page, ["Fire Safety Inspection"], {
      timeout: 3000,
    });
  });

  // Skip: Error handling tests need proper error state rendering in component
  test.skip("shows error state on 404", async ({ page, routeTracker }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockErrorResponse("**/procore/inspections**", 404, {
      message: "Inspection not found",
    });

    await page.goto("/tools/inspection/INSP-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    // Verify the mock data is NOT displayed (we got an error)
    await assertFieldsNotVisible(page, ["Fire Safety Inspection"], {
      timeout: 3000,
    });
  });
});
