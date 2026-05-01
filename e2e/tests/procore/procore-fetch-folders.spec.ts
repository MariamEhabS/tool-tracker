import { test, expect } from "../../fixtures/authenticated-test";
import { createMockQRCode, createMockProject } from "../../fixtures/builders";
import { type RouteTracker } from "../../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProject = createMockProject({
  _id: "proj-folders-001",
  projectName: "Folder Nav Project",
});

const mockProjectWithProcore = {
  ...mockProject,
  procoreProjectID: 11111,
  procoreCompanyID: 22222,
};

const mockQRCode = createMockQRCode({
  _id: "qr-folders-001",
  qrcodeName: "Folder Nav QR",
  project: mockProject._id,
  procoreConnect: true,
  procoreFetch: false,
});

/**
 * Permissions mock â€” Documents tool available for user.
 */
const mockPermissions = {
  tools: [
    {
      available_for_user: true,
      friendly_name: "Documents",
      name: "document",
    },
  ],
};

/**
 * Tools mock â€” Documents tool active.
 */
const mockTools = [{ id: 1, title: "Documents", is_active: true }];

/**
 * Root documents data â€” tree structure expected by ProcoreDocumentsTable.
 * The component expects: { id, folders: [...], files: [...] }
 * Folders have: { id: number, name: string, folders?: [], files?: [] }
 * Files have: { id: number|string, name: string, size: number, file_type?: string, updated_at?: string, file_versions?: [] }
 */
const mockDocumentsRoot = {
  id: 0,
  name: "Root",
  folders: [
    {
      id: 100,
      name: "Floor Plans",
      folders: [],
      files: [],
    },
    {
      id: 200,
      name: "Specifications",
      folders: [],
      files: [],
    },
  ],
  files: [
    {
      id: 301,
      name: "Site Photo.jpg",
      size: 2621440,
      file_type: "JPG",
      updated_at: "2026-01-15T09:00:00Z",
      file_versions: [
        { number: "1", url: "https://example.com/site-photo.jpg" },
      ],
    },
  ],
};

/**
 * Folder contents response from the getFolders API.
 * The handleNavigateToFolder handler calls getFolders() which returns folder data.
 * The response may be wrapped in { data: ... } â€” the component handles both.
 * The data becomes currentFolderData and replaces the root data in the table.
 */
const mockFolderContents = {
  id: 100,
  name: "Floor Plans",
  folders: [],
  files: [
    {
      id: 101,
      name: "Plan-A1.pdf",
      size: 5242880,
      file_type: "PDF",
      updated_at: "2026-01-10T09:00:00Z",
      file_versions: [{ number: "1", url: "https://example.com/plan-a1.pdf" }],
    },
    {
      id: 102,
      name: "Plan-A2.pdf",
      size: 3145728,
      file_type: "PDF",
      updated_at: "2026-01-12T09:00:00Z",
      file_versions: [{ number: "2", url: "https://example.com/plan-a2.pdf" }],
    },
  ],
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Sets up all required API mocks for the single QR context fetch page
 * with the Documents tool available.
 */
async function setupDocumentsFetchPage(routeTracker: RouteTracker) {
  // Mock QR code endpoint
  await routeTracker.mockRoute(`**/qr-code/${mockQRCode._id}**`, {
    data: mockQRCode,
  });

  // Mock project endpoint (standard fetch with companyId + projectId)
  await routeTracker.mockRoute(`**/project/${mockProject._id}**`, {
    data: mockProjectWithProcore,
  });

  // Mock Procore permissions
  await routeTracker.mockRoute("**/procore/permissions**", mockPermissions);

  // Mock Procore tools list
  await routeTracker.mockRoute("**/procore/tools**", mockTools);

  // Mock Documents tool data endpoint (single QR context uses getDocuments)
  await routeTracker.mockRoute("**/procore/documents**", mockDocumentsRoot);
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Procore Fetch â€” Document Folder Navigation @desktop", () => {
  // --------------------------------------------------------------------------
  // P2: Clicking folder row navigates into folder
  // --------------------------------------------------------------------------
  test("clicking folder row navigates into folder", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupDocumentsFetchPage(routeTracker);

    // Mock the folder contents endpoint â€” called when user clicks a folder row.
    // getFolders calls: /procore/folders?qrCodeId=...&companyId=...&projectId=...&itemId=100&desktop=true
    await routeTracker.mockRoute("**/procore/folders**", {
      data: mockFolderContents,
    });

    // Navigate to fetch page with single QR context
    await authenticatedPage.goto(
      `/procore/fetch?selectedIds=${mockQRCode._id}`,
    );

    // Wait for the fetch page to render
    const fetchPage = authenticatedPage.locator(
      '[data-page-id="procore-fetch"]',
    );
    await expect(fetchPage).toBeVisible({ timeout: 15000 });

    // Wait for Documents tool card to appear and click it
    const documentsCard = authenticatedPage.locator("text=Documents").first();
    await expect(documentsCard).toBeVisible({ timeout: 10000 });
    await documentsCard.click();

    // Wait for root documents content to render in the modal data table.
    // Folders should be visible: "Floor Plans" and "Specifications"
    await expect(authenticatedPage.getByText("Floor Plans")).toBeVisible({
      timeout: 10000,
    });
    await expect(authenticatedPage.getByText("Specifications")).toBeVisible({
      timeout: 5000,
    });
    // Root file should also be visible
    await expect(authenticatedPage.getByText("Site Photo.jpg")).toBeVisible({
      timeout: 5000,
    });

    // Click the "Floor Plans" folder row to navigate into it.
    // The row has __isFolder: true and folderId: 100, which triggers
    // handleNavigateToFolder(100, "Floor Plans").
    await authenticatedPage.getByText("Floor Plans").click();

    // Wait for folder contents to load â€” the mocked /procore/folders endpoint
    // returns mockFolderContents with Plan-A1.pdf and Plan-A2.pdf.
    await expect(authenticatedPage.getByText("Plan-A1.pdf")).toBeVisible({
      timeout: 10000,
    });
    await expect(authenticatedPage.getByText("Plan-A2.pdf")).toBeVisible({
      timeout: 5000,
    });

    // Assert breadcrumb trail appears with "Documents" and "Floor Plans".
    // The Breadcrumbs component renders with variant="folder" and
    // aria-label="FolderBreadcrumb".
    const breadcrumbNav = authenticatedPage.locator(
      'nav[aria-label="FolderBreadcrumb"]',
    );
    await expect(breadcrumbNav).toBeVisible({ timeout: 5000 });

    // "Documents" should be a clickable button (not last crumb)
    await expect(
      breadcrumbNav.getByRole("button", { name: "Documents" }),
    ).toBeVisible({ timeout: 5000 });

    // "Floor Plans" should be a text span (last crumb = current page)
    await expect(breadcrumbNav.getByText("Floor Plans")).toBeVisible({
      timeout: 5000,
    });

    // Root items should no longer be visible (we're inside the folder now)
    await expect(authenticatedPage.getByText("Site Photo.jpg")).not.toBeVisible(
      { timeout: 3000 },
    );
  });

  // --------------------------------------------------------------------------
  // P2: Breadcrumb back-navigation returns to root
  // --------------------------------------------------------------------------
  test("breadcrumb back-navigation returns to root", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupDocumentsFetchPage(routeTracker);

    // Mock folder contents endpoint for initial drill-down
    await routeTracker.mockRoute("**/procore/folders**", {
      data: mockFolderContents,
    });

    // Navigate to fetch page
    await authenticatedPage.goto(
      `/procore/fetch?selectedIds=${mockQRCode._id}`,
    );

    // Wait for the fetch page
    const fetchPage = authenticatedPage.locator(
      '[data-page-id="procore-fetch"]',
    );
    await expect(fetchPage).toBeVisible({ timeout: 15000 });

    // Click Documents tool card
    const documentsCard = authenticatedPage.locator("text=Documents").first();
    await expect(documentsCard).toBeVisible({ timeout: 10000 });
    await documentsCard.click();

    // Wait for root content
    await expect(authenticatedPage.getByText("Floor Plans")).toBeVisible({
      timeout: 10000,
    });

    // Navigate into the "Floor Plans" folder
    await authenticatedPage.getByText("Floor Plans").click();

    // Wait for folder contents to load
    await expect(authenticatedPage.getByText("Plan-A1.pdf")).toBeVisible({
      timeout: 10000,
    });

    // Verify breadcrumb trail is visible
    const breadcrumbNav = authenticatedPage.locator(
      'nav[aria-label="FolderBreadcrumb"]',
    );
    await expect(breadcrumbNav).toBeVisible({ timeout: 5000 });

    // Click "Documents" breadcrumb (index 0) to navigate back to root.
    // The onCrumbClick handler calls handleNavigateToBreadcrumb(-1) for index 0,
    // which resets activeProcoreFolderId to null and clears folder data.
    await breadcrumbNav.getByRole("button", { name: "Documents" }).click();

    // Assert root documents content is shown again
    await expect(authenticatedPage.getByText("Floor Plans")).toBeVisible({
      timeout: 10000,
    });
    await expect(authenticatedPage.getByText("Specifications")).toBeVisible({
      timeout: 5000,
    });
    await expect(authenticatedPage.getByText("Site Photo.jpg")).toBeVisible({
      timeout: 5000,
    });

    // Folder contents should no longer be visible
    await expect(authenticatedPage.getByText("Plan-A1.pdf")).not.toBeVisible({
      timeout: 3000,
    });

    // Breadcrumb trail should be reset â€” the nav should not be visible
    // because the condition is: activeProcoreFolderId !== null || folderTrailState.length > 0
    // After clicking "Documents" breadcrumb, both are reset.
    await expect(breadcrumbNav).not.toBeVisible({ timeout: 3000 });
  });

  // --------------------------------------------------------------------------
  // P2: Select file inside folder and add to panel
  // --------------------------------------------------------------------------
  test("select file inside folder and add to panel", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupDocumentsFetchPage(routeTracker);

    // Mock folder contents endpoint for drill-down
    await routeTracker.mockRoute("**/procore/folders**", {
      data: mockFolderContents,
    });

    // Navigate to fetch page
    await authenticatedPage.goto(
      `/procore/fetch?selectedIds=${mockQRCode._id}`,
    );

    // Wait for the fetch page
    const fetchPage = authenticatedPage.locator(
      '[data-page-id="procore-fetch"]',
    );
    await expect(fetchPage).toBeVisible({ timeout: 15000 });

    // Click Documents tool card
    const documentsCard = authenticatedPage.locator("text=Documents").first();
    await expect(documentsCard).toBeVisible({ timeout: 10000 });
    await documentsCard.click();

    // Wait for root content
    await expect(authenticatedPage.getByText("Floor Plans")).toBeVisible({
      timeout: 10000,
    });

    // Navigate into "Floor Plans" folder
    await authenticatedPage.getByText("Floor Plans").click();

    // Wait for folder contents
    await expect(authenticatedPage.getByText("Plan-A1.pdf")).toBeVisible({
      timeout: 10000,
    });

    // Click on Plan-A1.pdf file row to select it.
    // For file rows (not folders), clicking toggles selection via toggleRow().
    await authenticatedPage.getByText("Plan-A1.pdf").click();

    // Click "Add Selected" button to move the file to the right panel.
    // The button shows "Add Selected (1)" when one item is selected.
    const addSelectedButton = authenticatedPage.getByRole("button", {
      name: /Add Selected/i,
    });
    await expect(addSelectedButton).toBeVisible({ timeout: 5000 });
    await expect(addSelectedButton).toBeEnabled();
    await addSelectedButton.click();

    // Verify the file appears in the right panel (aside element with "Selected Items" heading).
    const selectedPanel = authenticatedPage.locator("aside").filter({
      has: authenticatedPage.getByRole("heading", {
        name: /Selected Items/i,
      }),
    });
    await expect(selectedPanel).toBeVisible({ timeout: 5000 });

    // Assert the panel heading shows "Selected Items (1)"
    await expect(selectedPanel.getByText(/Selected Items \(1\)/i)).toBeVisible({
      timeout: 5000,
    });

    // Assert the file name appears in the panel
    await expect(selectedPanel.getByText("Plan-A1.pdf")).toBeVisible({
      timeout: 5000,
    });
  });
});
