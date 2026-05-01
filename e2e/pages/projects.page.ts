import { Page, Locator } from "@playwright/test";

/**
 * Page Object for the Projects List page (/projects)
 * and the Project Detail page (/project/:projectId).
 */
export class ProjectsPage {
  readonly page: Page;

  // ============================================================================
  // LIST PAGE — Header & Actions
  // ============================================================================

  readonly pageTitle: Locator;
  readonly createProjectButton: Locator;
  readonly bulkActionsToggle: Locator;
  readonly searchInput: Locator;

  // ============================================================================
  // LIST PAGE — Table
  // ============================================================================

  /** All table body rows */
  readonly tableRows: Locator;

  // ============================================================================
  // LIST PAGE — Empty State
  // ============================================================================

  readonly emptyStateTitle: Locator;
  readonly emptyStateDescription: Locator;
  readonly emptyStateAction: Locator;

  // ============================================================================
  // LIST PAGE — Modals
  // ============================================================================

  readonly createModal: Locator;
  readonly createModalTitle: Locator;
  readonly editModal: Locator;
  readonly editModalTitle: Locator;
  readonly archiveModal: Locator;
  readonly deleteModal: Locator;
  readonly deleteModalConfirmButton: Locator;

  // Create Modal form fields
  readonly createProjectNameInput: Locator;
  readonly createClientNameInput: Locator;
  readonly createAddressInput: Locator;
  readonly createCityInput: Locator;
  readonly createStateInput: Locator;
  readonly createZIPInput: Locator;
  readonly createSubmitButton: Locator;
  readonly createCancelButton: Locator;

  // Edit Modal form fields
  readonly editProjectNameInput: Locator;
  readonly editClientNameInput: Locator;
  readonly editSaveButton: Locator;

  // ============================================================================
  // DETAIL PAGE
  // ============================================================================

  readonly detailProjectName: Locator;
  readonly detailStatusBadge: Locator;
  readonly detailAddress: Locator;
  readonly detailClientName: Locator;
  readonly settingsButton: Locator;
  readonly qrCodesTab: Locator;
  readonly groupsTab: Locator;
  readonly detailCreateButton: Locator;
  readonly detailBulkActionsToggle: Locator;

  constructor(page: Page) {
    this.page = page;

    // List Page — Header & Actions
    this.pageTitle = page
      .locator("h1, h2")
      .filter({ hasText: "Projects" })
      .first();
    this.createProjectButton = page
      .getByRole("button", {
        name: "Create Project",
      })
      .first();
    this.bulkActionsToggle = page.getByRole("button", {
      name: /Bulk Actions|Cancel/,
    });
    this.searchInput = page.getByPlaceholder("Search projects...");

    // List Page — Table
    this.tableRows = page.locator("tbody tr");

    // List Page — Empty State
    this.emptyStateTitle = page.locator("text=No Projects yet");
    this.emptyStateDescription = page.locator(
      "text=Create a project to organize your QR codes by location or client.",
    );
    this.emptyStateAction = page
      .getByRole("button", {
        name: "Create Project",
      })
      .last();

    // List Page — Modals
    this.createModal = page.locator('[role="dialog"]').filter({
      hasText: "Create Project",
    });
    this.createModalTitle = this.createModal
      .locator("text=Create Project")
      .first();
    this.editModal = page.locator('[role="dialog"]').filter({
      hasText: "Edit Project",
    });
    this.editModalTitle = this.editModal.locator("text=Edit Project").first();
    this.archiveModal = page.locator('[role="dialog"]').filter({
      hasText: /Archive|Unarchive/,
    });
    this.deleteModal = page.locator('[role="dialog"]').filter({
      hasText: "permanently delete",
    });
    this.deleteModalConfirmButton = this.deleteModal.getByRole("button", {
      name: /Delete|Deleting/,
    });

    // Create Modal form fields
    this.createProjectNameInput =
      this.createModal.getByPlaceholder("Enter project name");
    this.createClientNameInput =
      this.createModal.getByPlaceholder("Enter client name");
    this.createAddressInput = this.createModal.getByPlaceholder("123 Main St");
    this.createCityInput = this.createModal.getByPlaceholder("Anytown");
    this.createStateInput = this.createModal.getByPlaceholder("CA");
    this.createZIPInput = this.createModal.getByPlaceholder("90001");
    this.createSubmitButton = this.createModal.getByRole("button", {
      name: /Create Project|Creating/,
    });
    this.createCancelButton = this.createModal.getByRole("button", {
      name: "Cancel",
    });

    // Edit Modal form fields
    this.editProjectNameInput =
      this.editModal.getByPlaceholder("Enter project name");
    this.editClientNameInput =
      this.editModal.getByPlaceholder("Enter client name");
    this.editSaveButton = this.editModal.getByRole("button", {
      name: /Save Changes|Saving/,
    });

    // Detail Page
    this.detailProjectName = page.locator("h2.text-xl, h2.text-2xl").first();
    this.detailStatusBadge = page
      .locator("h2.text-xl ~ span, h2.text-2xl ~ span")
      .first();
    this.detailAddress = page
      .locator(".text-xs.text-gray-600, .text-sm.text-gray-600")
      .first();
    this.detailClientName = page
      .locator(".text-xs.text-gray-600, .text-sm.text-gray-600")
      .nth(1);
    // Scope to main content area to avoid matching sidebar Settings link
    // The ItemComboBox has aria-label="Actions" but displays "Settings" text
    this.settingsButton = page
      .locator("main")
      .locator('button:has-text("Settings")')
      .first();
    this.qrCodesTab = page
      .locator("main aside")
      .getByRole("button", { name: "QR Codes" });
    this.groupsTab = page
      .locator("main aside")
      .getByRole("button", { name: "Groups" });
    this.detailCreateButton = page.getByRole("button", {
      name: /Create QR Code|Create Group/,
    });
    this.detailBulkActionsToggle = page
      .getByRole("button", { name: /Bulk Actions|Cancel/ })
      .first();
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  async gotoList() {
    await this.page.goto("/projects", { waitUntil: "domcontentloaded" });
  }

  async gotoDetail(projectId: string) {
    await this.page.goto(`/project/${projectId}`, {
      waitUntil: "domcontentloaded",
    });
  }

  async waitForListLoad() {
    await this.page
      .waitForLoadState("networkidle", { timeout: 5000 })
      .catch(() => {});
  }

  async waitForDetailLoad() {
    await this.page
      .waitForLoadState("networkidle", { timeout: 5000 })
      .catch(() => {});
  }

  // ============================================================================
  // LIST PAGE — INTERACTIONS
  // ============================================================================

  async searchProjects(query: string) {
    await this.searchInput.fill(query);
  }

  async clickCreateProject() {
    await this.createProjectButton.click();
  }

  /** Get a table row by its project name text */
  getRowByName(name: string): Locator {
    return this.tableRows.filter({ hasText: name });
  }

  /** Get the project name text within a table row */
  getProjectNameInRow(name: string): Locator {
    return this.getRowByName(name)
      .locator("td")
      .first()
      .getByText(name, { exact: true });
  }

  /** Get the status badge text within a row */
  getStatusBadge(name: string): Locator {
    return this.getRowByName(name).locator("span[class*='rounded-full']");
  }

  /** Click the actions menu (three-dot) for a specific row */
  async openRowActions(name: string) {
    const row = this.getRowByName(name);
    // The ItemComboBox trigger button is the action menu
    await row.locator("button").last().click();
  }

  // ============================================================================
  // CREATE MODAL — INTERACTIONS
  // ============================================================================

  async fillCreateForm(data: {
    name: string;
    client: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  }) {
    await this.createProjectNameInput.fill(data.name);
    await this.createClientNameInput.fill(data.client);
    await this.createAddressInput.fill(data.address);
    await this.createCityInput.fill(data.city);
    await this.createStateInput.fill(data.state);
    await this.createZIPInput.fill(data.zip);
  }

  async submitCreateForm() {
    await this.createSubmitButton.click();
  }

  // ============================================================================
  // DETAIL PAGE — INTERACTIONS
  // ============================================================================

  async switchToGroupsTab() {
    await this.groupsTab.click();
  }

  async switchToQRCodesTab() {
    await this.qrCodesTab.click();
  }
}
