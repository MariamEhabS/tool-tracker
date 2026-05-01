import { Page, Locator } from "@playwright/test";

/**
 * Page Object for Create Modals (Form, Inspection, Punch List)
 * Provides helper methods for interacting with creation flows.
 */
export class CreateModalPage {
  readonly page: Page;

  // Modal Structure
  readonly modalOverlay: Locator;
  readonly modalHeader: Locator;
  readonly modalCloseButton: Locator;
  readonly modalTitle: Locator;

  // Common Form Elements
  readonly descriptionInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  // Loading/Error States
  readonly loadingSpinner: Locator;
  readonly errorMessage: Locator;
  readonly successToast: Locator;

  constructor(page: Page) {
    this.page = page;

    // Modal Structure - use first() to avoid strict mode issues when multiple modals exist
    // Procore modals use fixed positioning with full-screen layout; locate via modal title heading
    this.modalOverlay = page
      .locator("div.fixed")
      .filter({ has: page.getByRole("heading", { level: 2 }) })
      .first();
    // Modal header contains the title h2 and close button
    this.modalHeader = page
      .getByRole("heading", { level: 2 })
      .first()
      .locator("..");
    // Close button has accessible name "Close" - use role-based selector
    this.modalCloseButton = page.getByRole("button", { name: /^close$/i });
    // Modal title is the h2 heading
    this.modalTitle = page.getByRole("heading", { level: 2 }).first();

    // Common Form Elements
    this.descriptionInput = page.getByPlaceholder(/description/i);
    // Submit button - use role-based selector; modal footers contain Submit/Create/Save buttons
    this.submitButton = page.getByRole("button", {
      name: /^(submit|create|save)$/i,
    });
    this.cancelButton = page.getByRole("button", { name: /cancel/i });

    // Loading/Error States
    this.loadingSpinner = page.locator('[class*="animate-spin"]');
    // Prefer role="alert" for error messages; fall back to red text classes
    this.errorMessage = page
      .getByRole("alert")
      .or(page.locator(".text-red-600, .text-red-500"));
    this.successToast = page.getByText(/created successfully/i);
  }

  // ============================================================================
  // MODAL ACTIONS
  // ============================================================================

  async isOpen(): Promise<boolean> {
    return await this.modalOverlay.isVisible();
  }

  async close() {
    await this.modalCloseButton.click();
    await this.modalOverlay.waitFor({ state: "hidden", timeout: 5000 });
  }

  async waitForOpen() {
    await this.modalOverlay.waitFor({ state: "visible", timeout: 5000 });
  }

  async fillDescription(text: string) {
    await this.descriptionInput.fill(text);
  }

  async submit() {
    await this.submitButton.click();
  }

  async isSubmitDisabled(): Promise<boolean> {
    return await this.submitButton.isDisabled();
  }

  async hasError(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  async getErrorText(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return await this.errorMessage.textContent();
    }
    return null;
  }
}

/**
 * Page Object for Create Inspection Modal
 */
export class CreateInspectionModal extends CreateModalPage {
  // Inspection-specific elements
  readonly templateDropdown: Locator;
  readonly templateDropdownMenu: Locator;
  readonly templateOption: Locator;
  readonly identifierInput: Locator;
  readonly inspectionDateInput: Locator;
  readonly dueDateInput: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    super(page);

    // Inspection-specific elements
    this.templateDropdown = page
      .getByRole("button", { name: /select.*template|inspection template/i })
      .first();
    // Dropdown menu is a listbox or list with options
    this.templateDropdownMenu = page
      .getByRole("listbox")
      .or(page.locator("ul").filter({ has: page.locator("li") }));
    // Dropdown options are listitem elements
    this.templateOption = page.getByRole("listitem");
    this.identifierInput = page.getByPlaceholder("Identifier");
    this.inspectionDateInput = page.locator('input[type="date"]').first();
    this.dueDateInput = page.locator('input[type="date"]').last();
    // Submit button for creating inspection
    this.createButton = page.getByRole("button", { name: /^submit$/i });
  }

  async selectTemplate(templateName: string) {
    await this.templateDropdown.click();
    await this.templateDropdownMenu.waitFor({
      state: "visible",
      timeout: 3000,
    });
    // Select template option by text
    await this.page
      .getByRole("listitem", { name: templateName })
      .or(this.page.locator("li").filter({ hasText: templateName }))
      .click();
  }

  async fillIdentifier(identifier: string) {
    await this.identifierInput.fill(identifier);
  }

  async setInspectionDate(date: string) {
    await this.inspectionDateInput.fill(date);
  }

  async setDueDate(date: string) {
    await this.dueDateInput.fill(date);
  }

  async createInspection(options: {
    template: string;
    identifier?: string;
    inspectionDate?: string;
    dueDate?: string;
    description?: string;
  }) {
    await this.selectTemplate(options.template);

    if (options.identifier) {
      await this.fillIdentifier(options.identifier);
    }

    if (options.inspectionDate) {
      await this.setInspectionDate(options.inspectionDate);
    }

    if (options.dueDate) {
      await this.setDueDate(options.dueDate);
    }

    if (options.description) {
      await this.fillDescription(options.description);
    }

    await this.createButton.click();
  }

  async isTemplateDropdownOpen(): Promise<boolean> {
    return await this.templateDropdownMenu.isVisible();
  }

  async getAvailableTemplates(): Promise<string[]> {
    await this.templateDropdown.click();
    await this.templateDropdownMenu.waitFor({
      state: "visible",
      timeout: 3000,
    });

    const options = this.templateOption;
    const count = await options.count();
    const templates: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent();
      if (text) templates.push(text.trim());
    }

    // Close dropdown
    await this.page.keyboard.press("Escape");
    return templates;
  }
}

/**
 * Page Object for Create Punch List Modal
 */
export class CreatePunchListModal extends CreateModalPage {
  // Punch List-specific elements
  readonly titleInput: Locator;
  readonly assigneesDropdown: Locator;
  readonly assigneesDropdownMenu: Locator;
  readonly assigneeCheckbox: Locator;
  readonly dueDateInput: Locator;
  readonly attachmentInput: Locator;
  readonly attachmentPreview: Locator;
  readonly removeAttachmentButton: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    super(page);

    // Punch List-specific elements
    this.titleInput = page.getByPlaceholder("Title");
    this.assigneesDropdown = page
      .getByRole("button", { name: /select assignees/i })
      .first();
    // Dropdown menu is a listbox or list with options
    this.assigneesDropdownMenu = page
      .getByRole("listbox")
      .or(page.locator("ul").filter({ has: page.locator("li") }));
    // Assignee checkboxes within dropdown options
    this.assigneeCheckbox = page.getByRole("checkbox");
    this.dueDateInput = page.locator('input[type="date"]');
    this.attachmentInput = page.locator('input[type="file"]');
    // Attachment previews are images within a grid layout
    this.attachmentPreview = page
      .getByRole("img")
      .or(page.locator(".attachment-preview"));
    this.removeAttachmentButton = page
      .getByRole("button", { name: /remove/i })
      .or(page.locator('button[aria-label="Remove attachment"]'));
    // Submit button for creating punch list
    this.createButton = page.getByRole("button", { name: /^submit$/i });
  }

  async fillTitle(title: string) {
    await this.titleInput.fill(title);
  }

  async selectAssignees(assigneeNames: string[]) {
    await this.assigneesDropdown.click();
    await this.assigneesDropdownMenu.waitFor({
      state: "visible",
      timeout: 3000,
    });

    for (const name of assigneeNames) {
      const checkbox = this.page.locator(
        `label:has-text("${name}") input[type="checkbox"], [role="option"]:has-text("${name}")`,
      );
      await checkbox.click();
    }

    // Close dropdown by clicking outside
    await this.page.keyboard.press("Escape");
  }

  async setDueDate(date: string) {
    await this.dueDateInput.fill(date);
  }

  async addAttachment(filePath: string) {
    await this.attachmentInput.setInputFiles(filePath);
  }

  async createPunchList(options: {
    title: string;
    assignees?: string[];
    dueDate?: string;
    description?: string;
  }) {
    await this.fillTitle(options.title);

    if (options.assignees && options.assignees.length > 0) {
      await this.selectAssignees(options.assignees);
    }

    if (options.dueDate) {
      await this.setDueDate(options.dueDate);
    }

    if (options.description) {
      await this.fillDescription(options.description);
    }

    await this.createButton.click();
  }

  async hasAttachmentPreview(): Promise<boolean> {
    return await this.attachmentPreview.isVisible();
  }

  async getAttachmentCount(): Promise<number> {
    return await this.attachmentPreview.count();
  }
}

/**
 * Page Object for Create Form Modal
 */
export class CreateFormModal extends CreateModalPage {
  // Form-specific elements
  readonly templateDropdown: Locator;
  readonly templateDropdownMenu: Locator;
  readonly templateOption: Locator;
  readonly formNameInput: Locator;
  readonly attachmentInput: Locator;
  readonly attachmentPreview: Locator;
  readonly removeAttachmentButton: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    super(page);

    // Form-specific elements
    this.templateDropdown = page
      .getByRole("button", { name: /select.*template|form template/i })
      .first();
    // Dropdown menu is a listbox or list with options
    this.templateDropdownMenu = page
      .getByRole("listbox")
      .or(page.locator("ul").filter({ has: page.locator("li") }));
    // Dropdown options are listitem elements
    this.templateOption = page.getByRole("listitem");
    this.formNameInput = page.getByPlaceholder("Form Name");
    this.attachmentInput = page.locator('input[type="file"]');
    // Attachment previews are images within a grid layout
    this.attachmentPreview = page
      .getByRole("img")
      .or(page.locator(".attachment-preview"));
    this.removeAttachmentButton = page
      .getByRole("button", { name: /remove/i })
      .or(page.locator('button[aria-label="Remove attachment"]'));
    // Create button for creating form
    this.createButton = page.getByRole("button", { name: /^create$/i });
  }

  async selectTemplate(templateName: string) {
    await this.templateDropdown.click();
    await this.templateDropdownMenu.waitFor({
      state: "visible",
      timeout: 3000,
    });
    // Select template option by text
    await this.page
      .getByRole("listitem", { name: templateName })
      .or(this.page.locator("li").filter({ hasText: templateName }))
      .click();
  }

  async fillFormName(name: string) {
    await this.formNameInput.fill(name);
  }

  async addAttachment(filePath: string) {
    await this.attachmentInput.setInputFiles(filePath);
  }

  async createForm(options: {
    template: string;
    name?: string;
    description?: string;
  }) {
    await this.selectTemplate(options.template);

    if (options.name) {
      await this.fillFormName(options.name);
    }

    if (options.description) {
      await this.fillDescription(options.description);
    }

    await this.createButton.click();
  }

  async isTemplateDropdownOpen(): Promise<boolean> {
    return await this.templateDropdownMenu.isVisible();
  }

  async getAvailableTemplates(): Promise<string[]> {
    await this.templateDropdown.click();
    await this.templateDropdownMenu.waitFor({
      state: "visible",
      timeout: 3000,
    });

    const options = this.templateOption;
    const count = await options.count();
    const templates: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent();
      if (text) templates.push(text.trim());
    }

    // Close dropdown
    await this.page.keyboard.press("Escape");
    return templates;
  }
}

/**
 * Page Object for User Info Modal
 * This modal appears when creating items to collect user information.
 */
export class UserInfoModal {
  readonly page: Page;

  readonly modalOverlay: Locator;
  readonly modalHeader: Locator;
  readonly nameInput: Locator;
  readonly companyInput: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // UserInfoModal contains "Your Info" heading; locate by text content
    this.modalOverlay = page
      .locator("div.fixed")
      .filter({ hasText: "Your Info" });
    // Modal header contains the "Your Info" title
    this.modalHeader = page.getByText("Your Info").locator("..");
    // Input fields use placeholder text - prefer getByPlaceholder
    this.nameInput = page
      .getByPlaceholder(/jane doe/i)
      .or(page.getByPlaceholder(/name/i));
    this.companyInput = page
      .getByPlaceholder(/acme builders/i)
      .or(page.getByPlaceholder(/company/i));
    this.saveButton = page.getByRole("button", { name: /save/i });
    this.cancelButton = page.getByRole("button", { name: /cancel/i });
    // Prefer role="alert" for error messages; fall back to red text classes
    this.errorMessage = page
      .getByRole("alert")
      .or(page.locator(".text-red-600, .text-red-500"));
  }

  async isOpen(): Promise<boolean> {
    return await this.modalOverlay.isVisible();
  }

  async waitForOpen() {
    await this.modalOverlay.waitFor({ state: "visible", timeout: 5000 });
  }

  async fillUserInfo(name: string, company: string) {
    await this.nameInput.fill(name);
    await this.companyInput.fill(company);
  }

  async save() {
    await this.saveButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }

  async completeUserInfo(name: string, company: string) {
    await this.fillUserInfo(name, company);
    await this.save();
  }

  async hasValidationError(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }
}
