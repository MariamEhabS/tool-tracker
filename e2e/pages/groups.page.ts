import { Page, Locator } from "@playwright/test";

/**
 * Page Object for Groups routes:
 *   - /groups       (list page)
 *   - /group/:id    (detail page)
 */
export class GroupsPage {
  readonly page: Page;

  // ── List Page ──────────────────────────────────────────────────────────────

  /** Page title heading. */
  readonly pageTitle: Locator;

  /** Search input. */
  readonly searchInput: Locator;

  /** "Group Type" filter combo box trigger. */
  readonly groupTypeFilter: Locator;

  /** "Project" (status) filter combo box trigger. */
  readonly projectStatusFilter: Locator;

  /** "Clear Filters" button. */
  readonly clearFiltersButton: Locator;

  /** "Bulk Actions" / "Cancel" toggle button. */
  readonly bulkActionsButton: Locator;

  /** "Create Group" primary link-button. */
  readonly createGroupButton: Locator;

  /** The DataTable wrapper. */
  readonly dataTable: Locator;

  /** Empty state container. */
  readonly emptyState: Locator;

  /** Empty state title text. */
  readonly emptyStateTitle: Locator;

  /** Bulk action bar "Delete" button. */
  readonly bulkDeleteButton: Locator;

  /** Bulk action bar "Print" button. */
  readonly bulkPrintButton: Locator;

  /** Bulk action bar "Set Password" button. */
  readonly bulkSetPasswordButton: Locator;

  /** Delete confirmation modal. */
  readonly deleteModal: Locator;

  /** Delete modal confirm button. */
  readonly deleteConfirmButton: Locator;

  /** Edit modal. */
  readonly editModal: Locator;

  // ── Detail Page ────────────────────────────────────────────────────────────

  /** Group name heading on the detail page. */
  readonly groupName: Locator;

  /** Project badge link in the detail page subtitle. */
  readonly projectBadge: Locator;

  /** Detail-page search input for QR codes. */
  readonly qrSearchInput: Locator;

  /** "QR Type" filter on detail page. */
  readonly qrTypeFilter: Locator;

  /** "Sort by" filter on detail page. */
  readonly sortByFilter: Locator;

  /** DataGrid container on detail page. */
  readonly dataGrid: Locator;

  /** Settings combo (contains Edit Group / Delete Group). */
  readonly settingsButton: Locator;

  /** "Print" button on detail header. */
  readonly printButton: Locator;

  /** "Set Password" / "Update Password" button on detail header. */
  readonly setPasswordButton: Locator;

  /** "Add QR Codes" primary button on detail header. */
  readonly addQrCodesButton: Locator;

  /** Back-to-groups link shown in error states. */
  readonly backToGroupsLink: Locator;

  /** "Group Not Found" error component title. */
  readonly notFoundTitle: Locator;

  constructor(page: Page) {
    this.page = page;

    // ── List Page locators ────────────────────────────────────────────────

    // ListPageLayout renders an <h1> with text-2xl; the sidebar also has an h1
    // with text-lg (company name). Target the content h1 specifically.
    this.pageTitle = page.locator("h1.text-2xl");

    this.searchInput = page.getByPlaceholder("Search groups...");

    // FilterComboBox renders a <button> with the placeholder as its label
    this.groupTypeFilter = page.getByRole("button", { name: "Group Type" });
    this.projectStatusFilter = page.getByRole("button", {
      name: "Project",
      exact: true,
    });

    this.clearFiltersButton = page.getByRole("button", {
      name: "Clear Filters",
    });

    this.bulkActionsButton = page.getByRole("button", {
      name: /Bulk Actions|Cancel/,
    });

    this.createGroupButton = page
      .getByRole("button", { name: "Create Group" })
      .or(page.getByRole("link", { name: "Create Group" }));

    this.dataTable = page.locator("table");

    // EmptyState component renders its own title
    this.emptyState = page.locator('[class*="min-h-"]').filter({
      hasText: /No Groups/,
    });
    this.emptyStateTitle = page
      .locator("text=No Groups yet")
      .or(page.locator("text=No Groups found"));

    // Bulk action bar "Delete" button — use text filter to avoid ambiguity
    this.bulkDeleteButton = page
      .locator("main button")
      .filter({ hasText: "Delete" });
    this.bulkPrintButton = page.getByRole("button", {
      name: "Print",
      exact: true,
    });
    this.bulkSetPasswordButton = page.getByRole("button", {
      name: /Set Password/,
    });

    // Delete modal
    this.deleteModal = page.locator("text=permanently delete");
    this.deleteConfirmButton = page
      .getByRole("button", { name: /Confirm|Delete/ })
      .last();

    // Edit modal - target the modal dialog by its heading
    this.editModal = page.getByRole("heading", { name: "Edit Group" });

    // ── Detail Page locators ──────────────────────────────────────────────

    this.groupName = page.locator("h1.text-2xl");

    this.projectBadge = page.locator(
      'a[href*="/project/"] span, a[href*="/project/"] [class*="badge"]',
    );

    this.qrSearchInput = page.getByPlaceholder(
      "Search QR codes in this group...",
    );

    this.qrTypeFilter = page.getByPlaceholder("QR Type");
    this.sortByFilter = page.getByPlaceholder("Sort by");

    // DataGrid is a CSS grid
    this.dataGrid = page.locator('[class*="grid"]').first();

    // ItemComboBox has aria-label="Actions" by default, overriding visible text.
    // Target the button by its visible text within the main content area.
    this.settingsButton = page
      .locator("main")
      .locator("button")
      .filter({ hasText: "Settings" });

    this.printButton = page.getByRole("button", { name: "Print", exact: true });

    this.setPasswordButton = page.getByRole("button", {
      name: /Set Password|Update Password/,
    });

    this.addQrCodesButton = page
      .getByRole("button", {
        name: "Add QR Codes",
      })
      .or(page.getByRole("link", { name: "Add QR Codes" }));

    this.backToGroupsLink = page.getByRole("link", {
      name: "Back to Groups",
    });

    this.notFoundTitle = page.locator("text=Group Not Found");
  }

  // ── Navigation helpers ─────────────────────────────────────────────────

  async gotoList() {
    await this.page.goto("/groups");
  }

  async gotoDetail(groupId: string) {
    await this.page.goto(`/group/${groupId}`);
  }

  // ── List Page helpers ──────────────────────────────────────────────────

  /** Get a table row by its visible group name. */
  getRowByName(name: string): Locator {
    return this.page.locator("tr", { hasText: name });
  }

  /** Get all visible table body rows. */
  getTableRows(): Locator {
    return this.page.locator("tbody tr");
  }

  /** Click a row's name cell to navigate to its detail page. */
  async clickRow(name: string) {
    // Click the first td (name column) to avoid hitting the project badge link
    await this.getRowByName(name).locator("td").first().click();
  }

  /** Toggle bulk-actions mode. */
  async toggleBulkActions() {
    await this.bulkActionsButton.click();
  }

  /** Select a row's checkbox in bulk-actions mode. */
  async selectRow(name: string) {
    const row = this.getRowByName(name);
    await row.locator('input[type="checkbox"]').check();
  }

  /** Open the row-level actions menu (three-dot or combo). */
  async openRowActions(name: string) {
    const row = this.getRowByName(name);
    // The ItemComboBox trigger renders a button inside the actions cell
    await row.locator("button").last().click();
  }

  // ── Detail Page helpers ────────────────────────────────────────────────

  /** Get a QR card by its title text. */
  getQrCard(title: string): Locator {
    return this.page.locator(`text=${title}`).first();
  }
}
