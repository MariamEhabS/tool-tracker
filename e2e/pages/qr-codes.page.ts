import { Page, Locator } from "@playwright/test";

/**
 * Page Object Model for QR Code management pages:
 * - /my-qrcodes (list)
 * - /qrcode/:id (detail)
 * - /create-qr (create wizard)
 */
export class QRCodesPage {
  readonly page: Page;

  // ============================================================================
  // LIST PAGE — /my-qrcodes
  // ============================================================================

  // Header
  readonly pageTitle: Locator;
  readonly createQRButton: Locator;
  readonly bulkActionsButton: Locator;

  // Search & Filters
  readonly searchInput: Locator;
  readonly typeFilter: Locator;
  readonly groupFilter: Locator;
  readonly projectFilter: Locator;
  readonly clearFiltersButton: Locator;

  // Table
  readonly table: Locator;
  readonly tableRows: Locator;
  readonly selectAllCheckbox: Locator;
  readonly emptyStateTitle: Locator;
  readonly emptyStateDescription: Locator;
  readonly emptyStateAction: Locator;

  // Pagination
  readonly paginationNext: Locator;
  readonly paginationPrev: Locator;

  // Bulk Actions Bar
  readonly bulkMoveToGroup: Locator;
  readonly bulkMoveToProject: Locator;
  readonly bulkSetPassword: Locator;
  readonly bulkDelete: Locator;

  // Modals
  readonly editModal: Locator;
  readonly deleteModal: Locator;
  readonly confirmDeleteButton: Locator;

  // ============================================================================
  // DETAIL PAGE — /qrcode/:id
  // ============================================================================

  // Info Card
  readonly qrTitle: Locator;
  readonly qrDescription: Locator;
  readonly qrTypeBadge: Locator;

  // Detail Actions
  readonly editButton: Locator;
  readonly setPasswordButton: Locator;
  readonly printButton: Locator;
  readonly deleteButton: Locator;
  readonly backToListButton: Locator;

  // Detail Content
  readonly breadcrumbs: Locator;
  readonly toolsTable: Locator;
  readonly docsTable: Locator;

  // ============================================================================
  // CREATE PAGE — /create-qr
  // ============================================================================

  // Step 1 - Quantity
  readonly singleQRCard: Locator;
  readonly bulkCodesCard: Locator;
  readonly createSingleButton: Locator;
  readonly createBulkButton: Locator;

  // Step Indicator
  readonly stepBadge1: Locator;
  readonly stepBadge2: Locator;
  readonly stepBadge3: Locator;

  constructor(page: Page) {
    this.page = page;

    // ---- LIST PAGE ----
    this.pageTitle = page.locator("text=My QR Codes").first();
    this.createQRButton = page.getByRole("button", { name: "Create QR Code" });
    this.bulkActionsButton = page.getByRole("button", {
      name: /Bulk Actions|Cancel/,
    });

    this.searchInput = page.getByPlaceholder("Search QR codes...");
    this.typeFilter = page.locator('button:has-text("Type")').first();
    this.groupFilter = page.locator('button:has-text("Group")').first();
    this.projectFilter = page.locator('button:has-text("Project")').first();
    this.clearFiltersButton = page.getByRole("button", {
      name: "Clear Filters",
    });

    this.table = page.locator("table").first();
    this.tableRows = page.locator("table tbody tr");
    this.selectAllCheckbox = page.locator(
      'input[aria-label="Select all on this page"]',
    );
    // EmptyState uses h4 for title - look for either empty state text
    this.emptyStateTitle = page.locator(
      'h4:has-text("No QR Codes yet"), h4:has-text("No QR Codes found")',
    );
    this.emptyStateDescription = page.locator(
      "p:has-text('Create your first QR code')",
    );
    this.emptyStateAction = page.locator('a:has-text("Create QR Code")');

    this.paginationNext = page.getByRole("button", { name: /next/i });
    this.paginationPrev = page.getByRole("button", { name: /prev/i });

    this.bulkMoveToGroup = page.getByRole("button", {
      name: /Move to Group/,
    });
    this.bulkMoveToProject = page.getByRole("button", {
      name: /Move to Project/,
    });
    this.bulkSetPassword = page.getByRole("button", {
      name: /Set Password/,
    });
    this.bulkDelete = page.getByRole("button", { name: "Delete" });

    this.editModal = page.locator("text=Edit QR Code");
    this.deleteModal = page.locator("text=Are you sure");
    this.confirmDeleteButton = page.getByRole("button", {
      name: /Delete|Confirm/,
    });

    // ---- DETAIL PAGE ----
    this.qrTitle = page.locator("h1, h2").first();
    this.qrDescription = page.locator("#qr-description");
    this.qrTypeBadge = page.locator(".badge, [class*='badge']").first();

    this.editButton = page.getByRole("button", { name: "Edit" });
    this.setPasswordButton = page.getByRole("button", {
      name: /Set Password|Update Password/,
    });
    this.printButton = page.getByRole("button", { name: "Print" });
    this.deleteButton = page.getByRole("button", { name: "Delete" });
    // Use role-based selector for better accessibility and stability
    this.backToListButton = page.getByRole("button", {
      name: /back to my qr codes/i,
    });

    this.breadcrumbs = page.locator("[class*='breadcrumb'], nav").first();
    this.toolsTable = page.locator("table").first();
    this.docsTable = page.locator("table").first();

    // ---- CREATE PAGE ----
    this.singleQRCard = page.locator("text=Single QR Code").first();
    this.bulkCodesCard = page.locator("text=Bulk Codes").first();
    // ItemCard uses a div with h4 for title, not a button element
    this.createSingleButton = page.locator(
      'h4:has-text("Create a Single QR Code")',
    );
    this.createBulkButton = page.locator('h4:has-text("Create Bulk QR Codes")');

    // Step badges are inside a grid-cols-3 container; scope to the wizard step indicator
    // Each badge is a span with rounded-full class containing the step number
    this.stepBadge1 = page
      .locator(".grid-cols-3 span")
      .filter({ hasText: /^1$/ })
      .first();
    this.stepBadge2 = page
      .locator(".grid-cols-3 span")
      .filter({ hasText: /^2$/ })
      .first();
    this.stepBadge3 = page
      .locator(".grid-cols-3 span")
      .filter({ hasText: /^3$/ })
      .first();
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  async gotoList() {
    await this.page.goto("/my-qrcodes");
  }

  async gotoDetail(qrcodeId: string) {
    await this.page.goto(`/qrcode/${qrcodeId}`);
  }

  async gotoCreate() {
    await this.page.goto("/create-qr");
  }

  // ============================================================================
  // LIST INTERACTIONS
  // ============================================================================

  async search(query: string) {
    await this.searchInput.fill(query);
  }

  async clearSearch() {
    await this.searchInput.clear();
  }

  async clickRow(index: number) {
    await this.tableRows.nth(index).click();
  }

  getRowByName(name: string): Locator {
    return this.page.locator(`table tbody tr:has-text("${name}")`);
  }

  async getRowCount(): Promise<number> {
    return await this.tableRows.count();
  }

  async enableBulkActions() {
    const text = await this.bulkActionsButton.textContent();
    if (text?.includes("Bulk Actions")) {
      await this.bulkActionsButton.click();
    }
  }

  async disableBulkActions() {
    const text = await this.bulkActionsButton.textContent();
    if (text?.includes("Cancel")) {
      await this.bulkActionsButton.click();
    }
  }

  async selectRow(index: number) {
    const checkbox = this.tableRows
      .nth(index)
      .locator('input[type="checkbox"]');
    await checkbox.check();
  }

  // ============================================================================
  // DETAIL INTERACTIONS
  // ============================================================================

  async clickEdit() {
    await this.editButton.click();
  }

  async clickDelete() {
    await this.deleteButton.click();
  }

  async clickBackToList() {
    await this.backToListButton.click();
  }

  // ============================================================================
  // CREATE INTERACTIONS
  // ============================================================================

  async selectSingleQR() {
    await this.createSingleButton.click();
  }

  async selectBulkQR() {
    await this.createBulkButton.click();
  }

  // ============================================================================
  // STATE CHECKS
  // ============================================================================

  async isEmptyState(): Promise<boolean> {
    return (
      (await this.page.locator("h4:has-text('No QR Codes yet')").isVisible()) ||
      (await this.page.locator("h4:has-text('No QR Codes found')").isVisible())
    );
  }

  async isTableVisible(): Promise<boolean> {
    return await this.table.isVisible();
  }
}
