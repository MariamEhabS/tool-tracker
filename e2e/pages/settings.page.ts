import { Page, Locator } from "@playwright/test";

/**
 * Page Object for the Settings page (/settings)
 * Provides selectors and helpers for interacting with all settings sections.
 */
export class SettingsPage {
  readonly page: Page;

  // ============================================================================
  // PAGE HEADER
  // ============================================================================
  readonly pageTitle: Locator;
  readonly pageSubtitle: Locator;

  // ============================================================================
  // SETTINGS SECTIONS (Accordion wrappers)
  // ============================================================================
  readonly userSettingsSection: Locator;
  readonly securitySection: Locator;
  readonly qrDesignSection: Locator;
  readonly categoriesSection: Locator;
  readonly companySection: Locator;
  readonly usersSection: Locator;
  readonly integrationsSection: Locator;
  readonly subscriptionSection: Locator;
  readonly storageSection: Locator;

  // ============================================================================
  // USER PROFILE
  // ============================================================================
  readonly userProfileContainer: Locator;
  readonly displayFirstName: Locator;
  readonly displayLastName: Locator;
  readonly displayEmail: Locator;
  readonly displayPhoneNumber: Locator;
  readonly userProfileEditButton: Locator;
  readonly inputFirstName: Locator;
  readonly inputLastName: Locator;
  readonly inputPhoneNumber: Locator;
  readonly userProfileSaveButton: Locator;
  readonly userProfileCancelButton: Locator;

  // ============================================================================
  // SECURITY
  // ============================================================================
  readonly changePasswordButton: Locator;
  readonly changeEmailButton: Locator;

  // ============================================================================
  // COMPANY INFO
  // ============================================================================
  readonly companyInfoContainer: Locator;
  readonly displayCompanyName: Locator;
  readonly displayAddress: Locator;
  readonly displayCity: Locator;
  readonly displayState: Locator;
  readonly displayZip: Locator;
  readonly displayPhone: Locator;
  readonly displayWebsite: Locator;
  readonly companyInfoEditButton: Locator;
  readonly inputCompanyName: Locator;
  readonly inputAddress: Locator;
  readonly companySaveButton: Locator;

  // ============================================================================
  // TEAM & USERS
  // ============================================================================
  readonly inviteUserForm: Locator;
  readonly inviteEmailInput: Locator;
  readonly inviteRoleSelect: Locator;
  readonly inviteSubmitButton: Locator;
  readonly userTable: Locator;
  readonly transferAdminButton: Locator;

  // ============================================================================
  // SUBSCRIPTION
  // ============================================================================
  readonly subscriptionContainer: Locator;
  readonly tierBadge: Locator;
  readonly manageSubscriptionButton: Locator;
  readonly addStorageButton: Locator;
  readonly subscribeButton: Locator;

  // ============================================================================
  // QR DESIGN STUDIO
  // ============================================================================
  readonly qrDesignStudioContainer: Locator;
  readonly qrDesignPreviewSection: Locator;
  readonly qrDesignControlsSection: Locator;

  // ============================================================================
  // CATEGORIES
  // ============================================================================
  readonly addCategoryButton: Locator;
  readonly importCSVButton: Locator;
  readonly categorySearchInput: Locator;

  // ============================================================================
  // PRINT BRANDING
  // ============================================================================
  readonly printBrandingContainer: Locator;

  // ============================================================================
  // STORAGE METRICS
  // ============================================================================
  readonly storageStatsContainer: Locator;
  readonly storageDonutChart: Locator;
  readonly storageTrendChart: Locator;

  constructor(page: Page) {
    this.page = page;

    // Page Header
    this.pageTitle = page.locator("h1:has-text('Settings')");
    this.pageSubtitle = page.locator(
      "text=Manage your account and company settings",
    );

    // Settings Sections (accordion containers)
    this.userSettingsSection = page.locator("#settings-section-user-settings");
    this.securitySection = page.locator("#settings-section-security");
    this.qrDesignSection = page.locator("#settings-section-qr-design");
    this.categoriesSection = page.locator("#settings-section-categories");
    this.companySection = page.locator("#settings-section-company");
    this.usersSection = page.locator("#settings-section-users");
    this.integrationsSection = page.locator("#settings-section-integrations");
    this.subscriptionSection = page.locator("#settings-section-subscription");
    this.storageSection = page.locator("#settings-section-storage");

    // User Profile
    this.userProfileContainer = page.locator('[data-testid="user-profile"]');
    this.displayFirstName = page.locator('[data-testid="display-first-name"]');
    this.displayLastName = page.locator('[data-testid="display-last-name"]');
    this.displayEmail = page.locator('[data-testid="display-email"]');
    this.displayPhoneNumber = page.locator(
      '[data-testid="display-phone-number"]',
    );
    this.userProfileEditButton = this.userProfileContainer.locator(
      '[data-testid="edit-button"]',
    );
    this.inputFirstName = page.locator('[data-testid="input-first-name"]');
    this.inputLastName = page.locator('[data-testid="input-last-name"]');
    this.inputPhoneNumber = page.locator('[data-testid="input-phone-number"]');
    this.userProfileSaveButton = this.userProfileContainer.locator(
      '[data-testid="save-button"]',
    );
    this.userProfileCancelButton = this.userProfileContainer.locator(
      '[data-testid="cancel-button"]',
    );

    // Security
    this.changePasswordButton = page.getByRole("button", {
      name: "Change Password",
    });
    this.changeEmailButton = page.getByRole("button", {
      name: "Change Email",
    });

    // Company Info
    this.companyInfoContainer = page.locator('[data-testid="company-info"]');
    this.displayCompanyName = page.locator(
      '[data-testid="display-company-name"]',
    );
    this.displayAddress = page.locator('[data-testid="display-address"]');
    this.displayCity = page.locator('[data-testid="display-city"]');
    this.displayState = page.locator('[data-testid="display-state"]');
    this.displayZip = page.locator('[data-testid="display-zip"]');
    this.displayPhone = page.locator('[data-testid="display-phone"]');
    this.displayWebsite = page.locator('[data-testid="display-website"]');
    this.companyInfoEditButton = this.companyInfoContainer.locator(
      '[data-testid="edit-button"]',
    );
    this.inputCompanyName = page.locator('[data-testid="input-company-name"]');
    this.inputAddress = page.locator('[data-testid="input-address"]');
    this.companySaveButton = this.companyInfoContainer.locator(
      '[data-testid="save-button"]',
    );

    // Team & Users
    this.inviteUserForm = page.locator('[data-testid="invite-user-form"]');
    this.inviteEmailInput = page.locator('[data-testid="invite-email-input"]');
    this.inviteRoleSelect = page.locator('[data-testid="invite-role-select"]');
    this.inviteSubmitButton = page.locator(
      '[data-testid="invite-submit-button"]',
    );
    this.userTable = page.locator('[data-testid="user-table"]');
    this.transferAdminButton = page.locator(
      "text=Transfer Admin Role to Another User",
    );

    // Subscription
    this.subscriptionContainer = page.locator('[data-testid="subscription"]');
    this.tierBadge = page.locator('[data-testid="tier-badge"]');
    this.manageSubscriptionButton = page.locator(
      '[data-testid="manage-subscription-button"]',
    );
    this.addStorageButton = page.locator('[data-testid="add-storage-button"]');
    this.subscribeButton = page.locator('[data-testid="subscribe-button"]');

    // QR Design Studio
    this.qrDesignStudioContainer = page.locator(
      '[data-testid="qr-design-studio"]',
    );
    this.qrDesignPreviewSection = page.locator(
      '[data-testid="preview-section"]',
    );
    this.qrDesignControlsSection = page.locator(
      '[data-testid="controls-section"]',
    );

    // Categories
    this.addCategoryButton = page.getByRole("button", {
      name: "Add Category",
    });
    this.importCSVButton = page.getByRole("button", {
      name: "Import CSV",
    });
    this.categorySearchInput = page.locator(
      'input[placeholder="Search categories..."]',
    );

    // Print Branding
    this.printBrandingContainer = page.locator(
      '[data-testid="print-branding-logo"]',
    );

    // Storage Metrics
    this.storageStatsContainer = page.locator('[data-testid="storage-stats"]');
    this.storageDonutChart = page.locator(
      '[data-testid="storage-donut-chart"]',
    );
    this.storageTrendChart = page.locator(
      '[data-testid="storage-trend-chart"]',
    );
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  async goto() {
    await this.page.goto("/settings");
  }

  async gotoSection(sectionId: string) {
    await this.page.goto(`/settings#${sectionId}`);
  }

  // ============================================================================
  // SECTION TOGGLING
  // ============================================================================

  /** Get the section header toggle button by section ID */
  getSectionToggle(sectionId: string): Locator {
    return this.page.locator(
      `#settings-section-${sectionId} button[aria-expanded]`,
    );
  }

  /** Check if a section is expanded */
  async isSectionExpanded(sectionId: string): Promise<boolean> {
    const toggle = this.getSectionToggle(sectionId);
    const expanded = await toggle.getAttribute("aria-expanded");
    return expanded === "true";
  }

  /** Toggle a section open or closed */
  async toggleSection(sectionId: string) {
    const toggle = this.getSectionToggle(sectionId);
    await toggle.click();
  }

  /** Expand a section (no-op if already expanded) */
  async expandSection(sectionId: string) {
    if (!(await this.isSectionExpanded(sectionId))) {
      await this.toggleSection(sectionId);
      // Wait for the section content to be visible after animation
      await this.getSectionContent(sectionId).waitFor({
        state: "visible",
        timeout: 5000,
      });
    }
  }

  /** Collapse a section (no-op if already collapsed) */
  async collapseSection(sectionId: string) {
    if (await this.isSectionExpanded(sectionId)) {
      await this.toggleSection(sectionId);
    }
  }

  // ============================================================================
  // SECTION VISIBILITY
  // ============================================================================

  /** Get the section content container by section ID */
  getSectionContent(sectionId: string): Locator {
    return this.page.locator(`#settings-section-content-${sectionId}`);
  }

  /** Check if a section container exists on the page (admin-only sections may not render) */
  async isSectionVisible(sectionId: string): Promise<boolean> {
    return await this.page
      .locator(`#settings-section-${sectionId}`)
      .isVisible();
  }

  // ============================================================================
  // USER PROFILE HELPERS
  // ============================================================================

  async editUserProfile() {
    await this.userProfileEditButton.click();
  }

  async fillUserProfile(data: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
  }) {
    if (data.firstName !== undefined) {
      await this.inputFirstName.clear();
      await this.inputFirstName.fill(data.firstName);
    }
    if (data.lastName !== undefined) {
      await this.inputLastName.clear();
      await this.inputLastName.fill(data.lastName);
    }
    if (data.phoneNumber !== undefined) {
      await this.inputPhoneNumber.clear();
      await this.inputPhoneNumber.fill(data.phoneNumber);
    }
  }

  async saveUserProfile() {
    await this.userProfileSaveButton.click();
  }

  async cancelUserProfileEdit() {
    await this.userProfileCancelButton.click();
  }

  // ============================================================================
  // COMPANY INFO HELPERS
  // ============================================================================

  async editCompanyInfo() {
    await this.companyInfoEditButton.click();
  }

  async saveCompanyInfo() {
    await this.companySaveButton.click();
  }
}
