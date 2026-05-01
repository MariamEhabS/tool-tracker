import { test, expect } from "../../fixtures/authenticated-test";
import { createMockQRCode, createMockProject } from "../../fixtures/builders";
import { type RouteTracker } from "../../utils/route-tracker";
import type { Page } from "@playwright/test";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProject = createMockProject({
  _id: "proj-states-001",
  projectName: "States Test Project",
});

const mockProjectWithProcore = {
  ...mockProject,
  procoreProjectID: 77777,
  procoreCompanyID: 88888,
};

const mockQRCode = createMockQRCode({
  _id: "qr-states-001",
  qrcodeName: "States Test QR",
  project: mockProject._id,
  procoreConnect: true,
  procoreFetch: false,
});

/**
 * Permissions mock using the correct shape expected by fetch.tsx:
 *   permissionsData.tools[] with { available_for_user, friendly_name, name }
 */
const mockPermissions = {
  tools: [
    {
      available_for_user: true,
      friendly_name: "Inspections",
      name: "inspection",
    },
    {
      available_for_user: true,
      friendly_name: "Punch List",
      name: "punch-list",
    },
  ],
};

/**
 * Tools mock using the correct shape expected by fetch.tsx:
 *   Array<{ id, title, is_active }>
 */
const mockTools = [
  { id: 1, title: "Inspections", is_active: true },
  { id: 2, title: "Punch List", is_active: true },
];

/**
 * Inspection tool data returned by `/procore/inspections` endpoint.
 * Shape: { data: [...], hiddenIds: [...] }
 */
const mockInspectionItems = {
  data: [
    {
      id: 2001,
      name: "Elevator Safety Check",
      status: "Open",
      identifier: "INS-ST-001",
      inspection_type: { name: "Safety" },
      created_at: "2026-01-10T09:00:00Z",
    },
    {
      id: 2002,
      name: "Roof Inspection February",
      status: "Ready for Review",
      identifier: "INS-ST-002",
      inspection_type: { name: "Structural" },
      created_at: "2026-01-20T09:00:00Z",
    },
  ],
  hiddenIds: [],
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Sets up all required API mocks for the single QR context fetch page
 * WITHOUT delay on setup endpoints (for tests that need the page fully loaded).
 */
async function setupFetchPageNoDelay(routeTracker: RouteTracker) {
  await routeTracker.mockRoute(`**/qr-code/${mockQRCode._id}**`, {
    data: mockQRCode,
  });

  await routeTracker.mockRoute(`**/project/${mockProject._id}**`, {
    data: mockProjectWithProcore,
  });

  await routeTracker.mockRoute("**/procore/permissions**", mockPermissions);

  await routeTracker.mockRoute("**/procore/tools**", mockTools);
}

/**
 * Sets up all required API mocks WITH delay on permissions and tools endpoints
 * to test loading states.
 */
async function setupFetchPageWithDelay(
  routeTracker: RouteTracker,
  delay: number,
) {
  await routeTracker.mockRoute(`**/qr-code/${mockQRCode._id}**`, {
    data: mockQRCode,
  });

  await routeTracker.mockRoute(`**/project/${mockProject._id}**`, {
    data: mockProjectWithProcore,
  });

  // Delay permissions and tools to trigger loading state
  await routeTracker.mockRoute("**/procore/permissions**", mockPermissions, {
    delay,
  });

  await routeTracker.mockRoute("**/procore/tools**", mockTools, { delay });
}

/**
 * Navigates to the fetch page, opens the Inspections tool modal,
 * selects item(s), and clicks "Add Selected" to move them to the right panel.
 *
 * Returns after items are visible in the selected items panel.
 */
async function selectInspectionItems(
  authenticatedPage: Page,
  routeTracker: RouteTracker,
  options?: { itemCount?: number },
) {
  const itemCount = options?.itemCount ?? 1;

  // Mock inspections tool data endpoint
  await routeTracker.mockRoute("**/procore/inspections**", mockInspectionItems);

  // Navigate to fetch page with single QR context
  await authenticatedPage.goto(`/procore/fetch?selectedIds=${mockQRCode._id}`);

  // Wait for the fetch page to render
  const fetchPage = authenticatedPage.locator('[data-page-id="procore-fetch"]');
  await expect(fetchPage).toBeVisible({ timeout: 15000 });

  // Wait for tool cards to load and click Inspections
  const inspectionsCard = authenticatedPage.locator("text=Inspections").first();
  await expect(inspectionsCard).toBeVisible({ timeout: 10000 });
  await inspectionsCard.click();

  // Wait for inspection items to appear in the modal data table
  await expect(
    authenticatedPage.getByText("Elevator Safety Check"),
  ).toBeVisible({ timeout: 10000 });

  // Select items by clicking on rows (toggles selection)
  const itemNames = ["Elevator Safety Check", "Roof Inspection February"];
  for (let i = 0; i < itemCount && i < itemNames.length; i++) {
    await authenticatedPage.getByText(itemNames[i]).click();
  }

  // Click "Add Selected" button in the modal footer
  const addSelectedButton = authenticatedPage.getByRole("button", {
    name: /Add Selected/i,
  });
  await expect(addSelectedButton).toBeVisible({ timeout: 5000 });
  await expect(addSelectedButton).toBeEnabled();
  await addSelectedButton.click();

  // Verify items appear in the right panel (aside element with "Selected Items" heading)
  const selectedPanel = authenticatedPage.locator("aside").filter({
    has: authenticatedPage.getByRole("heading", {
      name: /Selected Items/i,
    }),
  });
  await expect(selectedPanel).toBeVisible({ timeout: 5000 });

  // Verify correct count in panel heading
  await expect(
    selectedPanel.getByText(
      new RegExp(`Selected Items \\(${itemCount}\\)`, "i"),
    ),
  ).toBeVisible({ timeout: 5000 });

  return { selectedPanel };
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Procore Fetch Loading States & Item Removal @desktop", () => {
  // --------------------------------------------------------------------------
  // P1: Shows loading spinner while tool data loads
  // --------------------------------------------------------------------------
  test("shows loading spinner while tool data loads", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    // Setup with 1500ms delay on permissions and tools endpoints
    await setupFetchPageWithDelay(routeTracker, 1500);

    // Navigate to fetch page
    await authenticatedPage.goto(
      `/procore/fetch?selectedIds=${mockQRCode._id}`,
    );

    // Assert a loading indicator is visible during the delay period.
    // The component shows: animate-spin spinner + "Loading Procore tools..." text
    await expect(authenticatedPage.locator(".animate-spin")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      authenticatedPage.getByText("Loading Procore tools..."),
    ).toBeVisible({ timeout: 5000 });

    // Wait for the delay to resolve â€” tool cards should become visible
    await expect(
      authenticatedPage.locator("text=Inspections").first(),
    ).toBeVisible({ timeout: 10000 });

    // Assert loading indicator disappears
    await expect(
      authenticatedPage.getByText("Loading Procore tools..."),
    ).not.toBeVisible({ timeout: 5000 });
  });

  // --------------------------------------------------------------------------
  // P1: Shows loading state in tool modal
  // --------------------------------------------------------------------------
  test("shows loading state in tool modal", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    // Setup page without delay on initial setup endpoints
    await setupFetchPageNoDelay(routeTracker);

    // Mock the inspection tool data endpoint WITH delay to test modal loading
    await routeTracker.mockRoute(
      "**/procore/inspections**",
      mockInspectionItems,
      { delay: 1500 },
    );

    // Navigate to fetch page
    await authenticatedPage.goto(
      `/procore/fetch?selectedIds=${mockQRCode._id}`,
    );

    // Wait for tool cards to load
    const fetchPage = authenticatedPage.locator(
      '[data-page-id="procore-fetch"]',
    );
    await expect(fetchPage).toBeVisible({ timeout: 15000 });

    const inspectionsCard = authenticatedPage
      .locator("text=Inspections")
      .first();
    await expect(inspectionsCard).toBeVisible({ timeout: 10000 });

    // Click tool card to open the modal
    await inspectionsCard.click();

    // Wait for data to appear after the delayed tool request resolves.
    await expect(
      authenticatedPage.getByText("Elevator Safety Check"),
    ).toBeVisible({ timeout: 10000 });
  });

  // --------------------------------------------------------------------------
  // P1: Remove item from right panel
  // --------------------------------------------------------------------------
  test("remove item from right panel", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupFetchPageNoDelay(routeTracker);

    // Select 2 items into the right panel
    const { selectedPanel } = await selectInspectionItems(
      authenticatedPage,
      routeTracker,
      { itemCount: 2 },
    );

    // Verify both items are in the panel
    await expect(selectedPanel.getByText("Elevator Safety Check")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      selectedPanel.getByText("Roof Inspection February"),
    ).toBeVisible({ timeout: 5000 });

    // The heading should show "Selected Items (2)"
    await expect(selectedPanel.getByText(/Selected Items \(2\)/i)).toBeVisible({
      timeout: 5000,
    });

    // Click the remove button on the first item card.
    // The remove button has aria-label="Remove item"
    const removeButtons = selectedPanel.getByRole("button", {
      name: /Remove item/i,
    });
    await expect(removeButtons.first()).toBeVisible({ timeout: 5000 });
    await removeButtons.first().click();

    // Assert the item is no longer visible after the 200ms animation.
    // Use a reasonable timeout that exceeds the 200ms animation duration.
    await expect(
      selectedPanel.getByText("Elevator Safety Check"),
    ).not.toBeVisible({ timeout: 3000 });

    // Assert the selected items count in the heading decreases to 1
    await expect(selectedPanel.getByText(/Selected Items \(1\)/i)).toBeVisible({
      timeout: 3000,
    });

    // Assert the remaining item is still visible
    await expect(
      selectedPanel.getByText("Roof Inspection February"),
    ).toBeVisible({ timeout: 3000 });
  });

  // --------------------------------------------------------------------------
  // P1: Removing all items shows empty state
  // --------------------------------------------------------------------------
  test("removing all items shows empty state", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupFetchPageNoDelay(routeTracker);

    // Add 1 item to right panel
    const { selectedPanel } = await selectInspectionItems(
      authenticatedPage,
      routeTracker,
      { itemCount: 1 },
    );

    // Verify item is in the panel with count 1
    await expect(selectedPanel.getByText("Elevator Safety Check")).toBeVisible({
      timeout: 5000,
    });
    await expect(selectedPanel.getByText(/Selected Items \(1\)/i)).toBeVisible({
      timeout: 5000,
    });

    // Remove the item
    const removeButton = selectedPanel.getByRole("button", {
      name: /Remove item/i,
    });
    await expect(removeButton).toBeVisible({ timeout: 5000 });
    await removeButton.click();

    // Assert the panel shows empty state after the 200ms animation.
    // The empty state shows "No items selected" text.
    await expect(selectedPanel.getByText("No items selected")).toBeVisible({
      timeout: 3000,
    });

    // Assert the count is 0 in the heading
    await expect(selectedPanel.getByText(/Selected Items \(0\)/i)).toBeVisible({
      timeout: 3000,
    });
  });
});
