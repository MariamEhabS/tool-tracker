import { Page, Locator } from "@playwright/test";

/**
 * Page Object for the QR Code Scanning route (/scannedQR)
 * Provides helper methods for interacting with the main entry point of the app.
 */
export class ScannedQRPage {
  readonly page: Page;
  readonly categoryButtons: Locator;
  readonly expandedToolHeading: Locator;

  // Loading & Error States
  readonly splashScreen: Locator;
  readonly errorTitle: Locator;
  readonly errorMessage: Locator;
  readonly tryAgainButton: Locator;
  readonly deviceBlockMessage: Locator;

  // Password Gate
  readonly passwordCard: Locator;
  readonly passwordHeading: Locator;
  readonly passwordInput: Locator;
  readonly accessButton: Locator;
  readonly passwordError: Locator;
  readonly passwordProtectedMessage: Locator;

  // Category Menu
  readonly categoryGrid: Locator;
  readonly qrCodeName: Locator;
  readonly filesAndFoldersButton: Locator;
  readonly menuButton: Locator;
  readonly emptyStateMessage: Locator;

  // Project Dropdown
  readonly projectDropdown: Locator;
  readonly projectName: Locator;
  readonly projectAddress: Locator;

  // FAB (Create Menu)
  readonly fabButton: Locator;
  readonly createMenu: Locator;
  readonly createFormOption: Locator;
  readonly createInspectionOption: Locator;
  readonly createPunchListOption: Locator;

  // User Info Modal
  readonly userInfoModal: Locator;
  readonly userNameInput: Locator;
  readonly userCompanyInput: Locator;
  readonly userInfoSaveButton: Locator;
  readonly userInfoCancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.categoryButtons = page.locator(".category-button");
    this.expandedToolHeading = page.locator("span.text-2xl.font-semibold");

    // Loading & Error States
    this.splashScreen = page.locator(
      '[data-testid="splash-screen"], .taliho-splash-screen',
    );
    this.errorTitle = page.locator("p.text-xl.font-semibold");
    this.errorMessage = page.locator("p.text-gray-600");
    this.tryAgainButton = page.getByRole("button", { name: "Try Again" });
    this.deviceBlockMessage = page.locator(
      "text=It seems that you are not using a mobile device",
    );

    // Password Gate
    this.passwordCard = page.locator(".rounded-lg.border");
    this.passwordHeading = page.locator("text=Enter Password");
    this.passwordInput = page.locator('input[type="password"]');
    this.accessButton = page.getByRole("button", { name: "Access" });
    this.passwordError = page.locator("p.text-red-600, .text-red-500");
    this.passwordProtectedMessage = page.locator("text=protected by");

    // Category Menu
    this.categoryGrid = page.locator(".grid.grid-cols-2");
    this.qrCodeName = page.locator(".underline.decoration-yellow-400");
    this.filesAndFoldersButton = page.locator(
      'button:has-text("Files and Folders")',
    );
    this.menuButton = page.getByRole("button", { name: "Menu" });
    this.emptyStateMessage = page.locator("text=Nothing to See Here Yet");

    // Project Dropdown
    this.projectDropdown = page.locator("details");
    this.projectName = page.locator("summary");
    this.projectAddress = page.locator("details p");

    // FAB (Create Menu)
    this.fabButton = page.getByRole("button", { name: "Create new item" });
    this.createMenu = page.locator("text=Create Procore Item");
    this.createFormOption = page.getByRole("button", {
      name: "Form",
      exact: true,
    });
    this.createInspectionOption = page.getByRole("button", {
      name: "Inspection",
      exact: true,
    });
    this.createPunchListOption = page.getByRole("button", {
      name: "Punch List",
      exact: true,
    });

    // User Info Modal
    this.userInfoModal = page.locator("text=Your Info");
    this.userNameInput = page.locator(
      'input[placeholder*="Name"], input[name="name"]',
    );
    this.userCompanyInput = page.locator(
      'input[placeholder*="Company"], input[name="company"]',
    );
    this.userInfoSaveButton = page.getByRole("button", { name: "Save" });
    this.userInfoCancelButton = page.getByRole("button", { name: "Cancel" });
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  async goto(qrCodeId: string) {
    await this.page.goto(`/scannedQR?qrcodeId=${qrCodeId}`, {
      waitUntil: "commit",
    });
  }

  private async waitForReadyState(timeout: number) {
    const readyLocators = [
      this.passwordInput,
      this.errorTitle,
      this.emptyStateMessage,
      this.categoryGrid,
      this.menuButton,
      this.fabButton,
      this.categoryButtons.first(),
      this.expandedToolHeading.first(),
    ];

    try {
      await Promise.any(
        readyLocators.map((locator) =>
          locator.waitFor({ state: "visible", timeout }),
        ),
      );
    } catch {
      throw new Error(
        "Scanned QR page did not reach a visible ready state within the expected timeout.",
      );
    }
  }

  async waitForLoad(timeout = 15000) {
    await this.page
      .waitForLoadState("domcontentloaded", { timeout })
      .catch(() => {});

    // Wait for splash screen to disappear
    await this.splashScreen.waitFor({ state: "hidden", timeout }).catch(() => {
      // Splash might not be present if data loaded quickly
    });

    await this.waitForReadyState(timeout);
  }

  // ============================================================================
  // PASSWORD FLOW
  // ============================================================================

  async enterPassword(password: string) {
    await this.passwordInput.fill(password);
    await this.accessButton.click();
  }

  async isPasswordGateVisible(): Promise<boolean> {
    return await this.passwordInput.isVisible();
  }

  // ============================================================================
  // CATEGORY SELECTION
  // ============================================================================

  async selectCategory(categoryName: string) {
    const button = this.getCategoryButton(categoryName);
    await this.categoryGrid.waitFor({ state: "visible", timeout: 15000 });
    await button.scrollIntoViewIfNeeded();
    await button.waitFor({ state: "visible", timeout: 15000 });
    await button.click({ trial: true });
    await button.click();
  }

  getCategoryButton(name: string): Locator {
    return this.page.locator(`button:has-text("${name}")`);
  }

  getCategoryBadge(name: string): Locator {
    // Badge is a span with rounded-full class that's inside the button
    // It has classes: absolute -right-3 -top-3 ... rounded-full
    return this.getCategoryButton(name).locator("span.rounded-full");
  }

  async getCategoryCount(name: string): Promise<string | null> {
    const badge = this.getCategoryBadge(name);
    if (await badge.isVisible()) {
      return await badge.textContent();
    }
    return null;
  }

  // ============================================================================
  // CREATE MENU (FAB)
  // ============================================================================

  async openCreateMenu() {
    await this.fabButton.waitFor({ state: "visible", timeout: 15000 });
    await this.fabButton.click({ trial: true });
    await this.fabButton.click();
    await this.createMenu.waitFor({ state: "visible" });
  }

  async selectCreateOption(option: "Form" | "Inspection" | "Punch List") {
    await this.openCreateMenu();
    switch (option) {
      case "Form":
        await this.createFormOption.click();
        break;
      case "Inspection":
        await this.createInspectionOption.click();
        break;
      case "Punch List":
        await this.createPunchListOption.click();
        break;
    }
  }

  async isFabVisible(): Promise<boolean> {
    return await this.fabButton.isVisible();
  }

  // ============================================================================
  // USER INFO MODAL
  // ============================================================================

  async fillUserInfo(name: string, company: string) {
    await this.userNameInput.fill(name);
    await this.userCompanyInput.fill(company);
    await this.userInfoSaveButton.click();
  }

  // ============================================================================
  // PROJECT DROPDOWN
  // ============================================================================

  async expandProjectDropdown() {
    await this.projectName.click();
  }

  async isProjectDropdownVisible(): Promise<boolean> {
    return await this.projectDropdown.isVisible();
  }

  // ============================================================================
  // ERROR STATES
  // ============================================================================

  async clickTryAgain() {
    await this.tryAgainButton.click();
  }

  async getErrorTitle(): Promise<string | null> {
    return await this.errorTitle.textContent();
  }

  // ============================================================================
  // STATE CHECKS
  // ============================================================================

  async isEmptyState(): Promise<boolean> {
    return await this.emptyStateMessage.isVisible();
  }

  async isCategoryGridVisible(): Promise<boolean> {
    return await this.categoryGrid.isVisible();
  }

  async isMenuButtonVisible(): Promise<boolean> {
    return await this.menuButton.isVisible();
  }

  async waitForCategoryMenu(timeout = 15000) {
    await this.categoryGrid.waitFor({ state: "visible", timeout });
    await this.categoryButtons.first().waitFor({ state: "visible", timeout });
  }

  getExpandedToolHeading(name: string): Locator {
    return this.page
      .locator("span.text-2xl.font-semibold", { hasText: name })
      .first();
  }

  async waitForExpandedTool(name?: string, timeout = 15000) {
    const readyLocators = [this.menuButton, this.expandedToolHeading.first()];

    if (name) {
      readyLocators.unshift(this.getExpandedToolHeading(name));
    }

    try {
      await Promise.any(
        readyLocators.map((locator) =>
          locator.waitFor({ state: "visible", timeout }),
        ),
      );
    } catch {
      throw new Error(
        `Expanded tool view${name ? ` for "${name}"` : ""} did not render in time.`,
      );
    }
  }
}
