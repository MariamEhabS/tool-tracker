import { Page, Locator } from "@playwright/test";

/**
 * Page Object for Tool Detail pages (Inspection, Punch List, Form, etc.)
 * Provides helper methods for interacting with the common detail view structure.
 */
export class ToolDetailPage {
  readonly page: Page;

  // Navigation
  readonly backButton: Locator;
  readonly menuButton: Locator;

  // Header Section
  readonly headerGrid: Locator;
  readonly titleHeading: Locator;
  readonly statusBadge: Locator;
  readonly descriptionSection: Locator;

  // Tabs
  readonly tabContainer: Locator;
  readonly documentsTab: Locator;
  readonly datesTab: Locator;
  readonly peopleTab: Locator;
  readonly linksTab: Locator;
  readonly moreTab: Locator;

  // Action Buttons
  readonly editInTalihoButton: Locator;
  readonly editInProcoreLink: Locator;

  // Modals
  readonly modalOverlay: Locator;
  readonly modalCloseButton: Locator;
  readonly modalContent: Locator;

  // Loading States
  readonly loadingSpinner: Locator;
  readonly errorMessage: Locator;
  readonly retryButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation
    this.backButton = page
      .locator("button.menu-button-shadow")
      .filter({ has: page.locator("svg") })
      .first();
    this.menuButton = page.getByRole("button", { name: "Menu", exact: true });

    // Header Section
    this.headerGrid = page.locator(".grid.grid-cols-3");
    this.titleHeading = page.locator(
      "h2.text-2xl.font-bold, h2.text-xl.font-bold",
    );
    this.statusBadge = page
      .locator('.rounded-full, [class*="bg-"][class*="text-"]')
      .first();
    this.descriptionSection = page
      .locator(".min-h-\\[100px\\], .overflow-y-auto")
      .first();

    // Tabs
    this.tabContainer = page
      .locator(".flex.justify-evenly, .border-b.border-gray-300")
      .first();
    this.documentsTab = page.getByRole("button", { name: /documents/i });
    this.datesTab = page.getByRole("button", { name: /dates/i });
    this.peopleTab = page.getByRole("button", { name: /people/i });
    this.linksTab = page.getByRole("button", { name: /links/i });
    this.moreTab = page.getByRole("button", { name: /more/i });

    // Action Buttons
    this.editInTalihoButton = page.getByRole("button", {
      name: /edit in taliho/i,
    });
    this.editInProcoreLink = page.locator(
      'a:has-text("Edit in Procore"), button:has-text("Edit in Procore")',
    );

    // Modals
    this.modalOverlay = page.locator(
      ".fixed.inset-0.z-50, .fixed.inset-0.z-\\[70\\]",
    );
    this.modalCloseButton = page
      .locator(
        '.fixed.inset-0 button:has-text("×"), .fixed.inset-0 button:has(svg)',
      )
      .first();
    this.modalContent = page.locator(".fixed.inset-0 .bg-white.rounded-lg");

    // Loading States
    this.loadingSpinner = page.locator('.animate-spin, [class*="spinner"]');
    this.errorMessage = page.locator("text=Something went wrong, text=Error");
    this.retryButton = page.getByRole("button", { name: /retry|try again/i });
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  async goto(
    tool: string,
    itemId: string,
    qrCodeId: string,
    options?: { openEdit?: boolean },
  ) {
    let url = `/tools/${tool}/${itemId}?qrCodeId=${qrCodeId}`;
    if (options?.openEdit) {
      url += "&openEdit=true";
    }
    await this.page.goto(url, { waitUntil: "domcontentloaded" });
  }

  async waitForLoad() {
    // Wait for either the header grid or an error message
    await Promise.race([
      this.headerGrid.waitFor({ state: "visible", timeout: 15000 }),
      this.errorMessage.waitFor({ state: "visible", timeout: 15000 }),
    ]).catch(() => {
      // Continue even if timeout - tests will handle assertions
    });
  }

  async clickBack() {
    await this.backButton.click();
  }

  async clickMenu() {
    await this.menuButton.click();
  }

  // ============================================================================
  // TABS
  // ============================================================================

  async selectTab(
    tabName: "documents" | "dates" | "people" | "links" | "more",
  ) {
    const tabMap = {
      documents: this.documentsTab,
      dates: this.datesTab,
      people: this.peopleTab,
      links: this.linksTab,
      more: this.moreTab,
    };
    await tabMap[tabName].click();
  }

  async isTabActive(tabName: string): Promise<boolean> {
    const tab = this.page.getByRole("button", {
      name: new RegExp(tabName, "i"),
    });
    const className = await tab.getAttribute("class");
    return className?.includes("bg-yellow-100") || false;
  }

  // ============================================================================
  // ACTIONS
  // ============================================================================

  async clickEditInTaliho() {
    await this.editInTalihoButton.click();
  }

  async isEditButtonVisible(): Promise<boolean> {
    return await this.editInTalihoButton.isVisible();
  }

  // ============================================================================
  // MODALS
  // ============================================================================

  async isModalOpen(): Promise<boolean> {
    return await this.modalOverlay.isVisible();
  }

  async closeModal() {
    await this.modalCloseButton.click();
    await this.modalOverlay.waitFor({ state: "hidden", timeout: 5000 });
  }

  async waitForModalOpen() {
    await this.modalOverlay.waitFor({ state: "visible", timeout: 5000 });
  }

  // ============================================================================
  // FIELD HELPERS
  // ============================================================================

  getFieldByLabel(label: string): Locator {
    return this.page
      .locator(`text=${label}`)
      .locator("..")
      .locator("p, span, div")
      .last();
  }

  async getFieldValue(label: string): Promise<string | null> {
    const field = this.getFieldByLabel(label);
    if (await field.isVisible()) {
      return await field.textContent();
    }
    return null;
  }

  // ============================================================================
  // STATE CHECKS
  // ============================================================================

  async hasError(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  async isLoading(): Promise<boolean> {
    return await this.loadingSpinner.isVisible();
  }
}

/**
 * Page Object for Inspection Detail specifics
 */
export class InspectionDetailPage extends ToolDetailPage {
  // Inspection-specific elements
  readonly viewItemsButton: Locator;
  readonly inspectionItemsModal: Locator;
  readonly conformingCount: Locator;
  readonly deficientCount: Locator;

  // Edit Modal Elements
  readonly editItemsModal: Locator;
  readonly sectionAccordion: Locator;
  readonly itemRow: Locator;
  readonly passButton: Locator;
  readonly failButton: Locator;
  readonly naButton: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    super(page);

    // Inspection-specific elements
    this.viewItemsButton = page.getByRole("button", {
      name: /view.*items|view inspection items/i,
    });
    this.inspectionItemsModal = page.locator(
      ".fixed.inset-0.z-50 .bg-white.rounded-lg",
    );
    this.conformingCount = page
      .locator("text=Conforming")
      .locator("..")
      .locator("span, p")
      .first();
    this.deficientCount = page
      .locator("text=Deficient")
      .locator("..")
      .locator("span, p")
      .first();

    // Edit Modal Elements
    this.editItemsModal = page.locator(".fixed.inset-0.z-\\[70\\] .bg-white");
    this.sectionAccordion = page.locator("details");
    this.itemRow = page.locator('[class*="border-b"]');
    this.passButton = page.getByRole("button", { name: /^pass$/i });
    this.failButton = page.getByRole("button", { name: /^fail$/i });
    this.naButton = page.getByRole("button", { name: /^n\/a$/i });
    this.saveButton = page.getByRole("button", { name: /save/i });
  }

  async gotoInspection(
    itemId: string,
    qrCodeId: string,
    options?: { openEdit?: boolean },
  ) {
    await this.goto("inspection", itemId, qrCodeId, options);
  }

  async openViewItemsModal() {
    await this.viewItemsButton.click();
    await this.inspectionItemsModal.waitFor({
      state: "visible",
      timeout: 5000,
    });
  }

  async getSectionNames(): Promise<string[]> {
    const sections = this.sectionAccordion.locator("summary");
    const count = await sections.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await sections.nth(i).textContent();
      if (text) names.push(text.trim());
    }
    return names;
  }

  async expandSection(sectionName: string) {
    const section = this.page.locator(
      `details:has(summary:has-text("${sectionName}"))`,
    );
    await section.click();
  }
}

/**
 * Page Object for Punch List Detail specifics
 */
export class PunchListDetailPage extends ToolDetailPage {
  // Punch List-specific elements
  readonly viewAssignmentsButton: Locator;
  readonly assignmentsModal: Locator;
  readonly assignmentRow: Locator;
  readonly statusDropdown: Locator;
  readonly closeItemButton: Locator;
  readonly reopenItemButton: Locator;

  // Field elements
  readonly locationField: Locator;
  readonly priorityBadge: Locator;
  readonly dueDateField: Locator;
  readonly overdueIndicator: Locator;

  constructor(page: Page) {
    super(page);

    // Punch List-specific elements
    this.viewAssignmentsButton = page.getByRole("button", {
      name: /view assignments/i,
    });
    this.assignmentsModal = page.locator(
      ".fixed.inset-0.z-50 .bg-white.rounded-lg",
    );
    this.assignmentRow = page.locator('.fixed.inset-0 [class*="border-b"]');
    this.statusDropdown = page.locator(
      'button:has-text("Work Required"), button:has-text("Ready for Review")',
    );
    this.closeItemButton = page.getByRole("button", { name: /close item/i });
    this.reopenItemButton = page.getByRole("button", { name: /reopen item/i });

    // Field elements
    this.locationField = page
      .locator("text=Location")
      .locator("..")
      .locator("p, span")
      .last();
    this.priorityBadge = page.locator(
      '[class*="bg-"][class*="text-"]:has-text("High"), [class*="bg-"][class*="text-"]:has-text("Medium"), [class*="bg-"][class*="text-"]:has-text("Low")',
    );
    this.dueDateField = page
      .locator("text=Due Date")
      .locator("..")
      .locator("p, span")
      .last();
    this.overdueIndicator = page.locator(
      '.text-red-600, .text-red-500, [class*="overdue"]',
    );
  }

  async gotoPunchList(
    itemId: string,
    qrCodeId: string,
    options?: { openEdit?: boolean },
  ) {
    await this.goto("punch-list", itemId, qrCodeId, options);
  }

  async openAssignmentsModal() {
    await this.viewAssignmentsButton.click();
    await this.assignmentsModal.waitFor({ state: "visible", timeout: 5000 });
  }

  async getAssignmentCount(): Promise<number> {
    return await this.assignmentRow.count();
  }

  async isOverdue(): Promise<boolean> {
    return await this.overdueIndicator.isVisible();
  }
}

/**
 * Page Object for Form Detail specifics
 */
export class FormDetailPage extends ToolDetailPage {
  // Form-specific elements
  readonly templateName: Locator;
  readonly createdByField: Locator;
  readonly editModal: Locator;
  readonly pdfViewer: Locator;
  readonly textTool: Locator;

  constructor(page: Page) {
    super(page);

    // Form-specific elements
    this.templateName = page
      .locator("text=Template")
      .locator("..")
      .locator("p, span")
      .last();
    this.createdByField = page
      .locator("text=Created By")
      .locator("..")
      .locator("p, span")
      .last();
    this.editModal = page.locator(".fixed.inset-0.z-50 .bg-white.rounded-lg");
    this.pdfViewer = page.locator("canvas");
    this.textTool = page.locator('button:has-text("Text")');
  }

  async gotoForm(
    itemId: string,
    qrCodeId: string,
    options?: { openEdit?: boolean },
  ) {
    await this.goto("form", itemId, qrCodeId, options);
  }

  async isPdfLoaded(): Promise<boolean> {
    return await this.pdfViewer.isVisible();
  }
}
