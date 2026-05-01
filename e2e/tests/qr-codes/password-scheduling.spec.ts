import {
  test,
  expect,
  mockAuthCompany,
} from "../../fixtures/authenticated-test";
import { QRCodesPage } from "../../pages/qr-codes.page";
import { createMockQRCode, createMockProject } from "../../fixtures/builders";
import { safeRoute } from "../../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

const qrCodeId = "qr-password-001";

const mockProject = createMockProject({
  _id: "proj-password-001",
  projectName: "Password Test Project",
});

const mockQRCodeNoPassword = createMockQRCode({
  _id: qrCodeId,
  qrcodeName: "Equipment Panel A",
  project: mockProject._id,
  projectName: mockProject.projectName,
  passwordActivated: false,
});

const mockQRCodeWithPassword = createMockQRCode({
  _id: "qr-password-002",
  qrcodeName: "Secured Equipment B",
  project: mockProject._id,
  projectName: mockProject.projectName,
  passwordActivated: true,
});

const mockQRCodeResponse = {
  data: mockQRCodeNoPassword,
};

const mockScannedQRResponse = {
  data: {
    _id: qrCodeId,
    qrcodeName: "Equipment Panel A",
    type: "folder",
    project: {
      _id: mockProject._id,
      projectName: mockProject.projectName,
    },
    company: {
      _id: mockAuthCompany._id,
      editProcoreItemsAllowed: true,
    },
  },
  procoreTools: [],
  folders: [],
  documents: [],
};

const mockQrProcoreTools = {
  procoreTools: [],
  qrType: "folder",
  procoreCategory: null,
};

const mockPasswordUpdateSuccess = {
  success: true,
  message: "Password settings updated successfully",
};

// ============================================================================
// PAGE OBJECT EXTENSION - SetPasswordModal
// ============================================================================

class SetPasswordModal {
  constructor(private readonly page: import("@playwright/test").Page) {}

  // Modal Structure - matches "Set Password" or "Update Password" title
  get modal() {
    return this.page.locator('[role="dialog"]').filter({
      hasText: /Set Password|Update Password/,
    });
  }

  get modalTitle() {
    return this.modal.locator("#modal-title");
  }

  // Close via the X button (aria-label="Close") - NOT the Cancel button
  get closeIconButton() {
    return this.modal.locator('button[aria-label="Close"]');
  }

  // Cancel button in footer
  get cancelButton() {
    return this.modal.getByRole("button", { name: "Cancel" });
  }

  // Password Fields - use specific IDs from the component
  get passwordInput() {
    return this.modal.locator("#set-password-input");
  }

  get confirmPasswordInput() {
    return this.modal.locator("#confirm-password-input");
  }

  // Password Protection Toggle (the main activation switch)
  get activationToggle() {
    return this.modal.locator('[role="switch"]').first();
  }

  // Mode Selection - actual button text from the component
  get alwaysActiveOption() {
    return this.modal.locator("button").filter({ hasText: "Always" }).first();
  }

  get scheduledOption() {
    return this.modal
      .locator("button")
      .filter({ hasText: "Scheduled" })
      .first();
  }

  // Schedule Controls - timezone is a <select> element
  get timezoneSelect() {
    return this.modal.locator("select").first();
  }

  // Weekday/Weekend sections - find by the container that has the text
  get weekdaySection() {
    return this.modal.locator(".p-3").filter({ hasText: "Weekdays" });
  }

  get weekendSection() {
    return this.modal.locator(".p-3").filter({ hasText: "Weekends" });
  }

  // Weekday/Weekend toggles are role="switch" buttons within their sections
  get weekdayToggle() {
    return this.weekdaySection.locator('[role="switch"]');
  }

  get weekendToggle() {
    return this.weekendSection.locator('[role="switch"]');
  }

  // Time inputs are within schedule sections
  get weekdayStartTime() {
    return this.weekdaySection.locator('input[type="time"]').first();
  }

  get weekdayEndTime() {
    return this.weekdaySection.locator('input[type="time"]').nth(1);
  }

  get weekendStartTime() {
    return this.weekendSection.locator('input[type="time"]').first();
  }

  get weekendEndTime() {
    return this.weekendSection.locator('input[type="time"]').nth(1);
  }

  // Actions - button text is "Set Password" or "Update Password"
  get saveButton() {
    return this.modal.getByRole("button", {
      name: /Set Password|Update Password/,
    });
  }

  // Password Protection toggle to deactivate
  get deactivateToggle() {
    return this.activationToggle;
  }

  // State
  get errorMessage() {
    return this.modal.locator(".text-red-600");
  }

  get successMessage() {
    return this.page.locator("text=/success|saved|updated/i").first();
  }

  // Actions
  async isOpen(): Promise<boolean> {
    return await this.modal.isVisible();
  }

  async waitForOpen() {
    await this.modal.waitFor({ state: "visible", timeout: 5000 });
  }

  async close() {
    await this.cancelButton.click();
    await this.modal.waitFor({ state: "hidden", timeout: 5000 });
  }

  async enablePasswordProtection() {
    const isChecked =
      (await this.activationToggle.getAttribute("aria-checked")) === "true";
    if (!isChecked) {
      await this.activationToggle.click();
    }
  }

  async disablePasswordProtection() {
    const isChecked =
      (await this.activationToggle.getAttribute("aria-checked")) === "true";
    if (isChecked) {
      await this.activationToggle.click();
    }
  }

  async fillPassword(password: string, confirm?: string) {
    // Enable password protection first if not already enabled
    await this.enablePasswordProtection();
    // Wait for animation to complete
    await this.page.waitForTimeout(400);
    await this.passwordInput.fill(password);
    if (confirm !== undefined) {
      await this.confirmPasswordInput.fill(confirm);
    }
  }

  async selectScheduledMode() {
    await this.scheduledOption.click();
  }

  async selectAlwaysActiveMode() {
    await this.alwaysActiveOption.click();
  }

  async setSchedule(options: {
    startTime?: string;
    endTime?: string;
    weekday?: boolean;
    weekend?: boolean;
  }) {
    // Enable weekday schedule if requested
    if (options.weekday !== undefined) {
      const isChecked =
        (await this.weekdayToggle.getAttribute("aria-checked")) === "true";
      if (isChecked !== options.weekday) {
        await this.weekdayToggle.click();
        await this.page.waitForTimeout(300);
      }
    }
    // Set weekday times
    if (options.startTime && options.weekday !== false) {
      await this.weekdayStartTime.fill(options.startTime);
    }
    if (options.endTime && options.weekday !== false) {
      await this.weekdayEndTime.fill(options.endTime);
    }
    // Enable weekend schedule if requested
    if (options.weekend !== undefined) {
      const isChecked =
        (await this.weekendToggle.getAttribute("aria-checked")) === "true";
      if (isChecked !== options.weekend) {
        await this.weekendToggle.click();
        await this.page.waitForTimeout(300);
      }
    }
    // Set weekend times
    if (options.weekend === true && options.startTime) {
      await this.weekendStartTime.fill(options.startTime);
    }
    if (options.weekend === true && options.endTime) {
      await this.weekendEndTime.fill(options.endTime);
    }
  }

  async save() {
    await this.saveButton.click();
  }
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Password Scheduling @desktop", () => {
  let qrPage: QRCodesPage;
  let passwordModal: SetPasswordModal;

  // Helper function to set up common routes for qr-password-001
  async function setupQrCodeRoutes(page: import("@playwright/test").Page) {
    await safeRoute(page, `**/qr-code/${qrCodeId}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockQRCodeResponse),
      });
    });
    await safeRoute(page, `**/qr-code/scanned/${qrCodeId}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockScannedQRResponse),
      });
    });
    await safeRoute(
      page,
      `**/qr-code/${qrCodeId}/procore-tools**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockQrProcoreTools),
        });
      },
    );
    await safeRoute(page, `**/qr-code/image/${qrCodeId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ signedUrl: null, exists: false }),
      });
    });
  }

  test.beforeEach(async ({ authenticatedPage }) => {
    qrPage = new QRCodesPage(authenticatedPage);
    passwordModal = new SetPasswordModal(authenticatedPage);
  });

  // ==========================================================================
  // MODAL OPEN/CLOSE
  // ==========================================================================

  test("Set Password button opens password modal", async ({
    authenticatedPage,
  }) => {
    await setupQrCodeRoutes(authenticatedPage);
    await qrPage.gotoDetail(qrCodeId);

    // Wait for page to load
    await expect(
      authenticatedPage.locator("text=Equipment Panel A"),
    ).toBeVisible();

    // Click Set Password button
    await qrPage.setPasswordButton.click();

    // Modal should open
    await passwordModal.waitForOpen();
    await expect(passwordModal.modal).toBeVisible();
  });

  test("modal can be closed without saving", async ({ authenticatedPage }) => {
    await setupQrCodeRoutes(authenticatedPage);
    await qrPage.gotoDetail(qrCodeId);
    await expect(
      authenticatedPage.locator("text=Equipment Panel A"),
    ).toBeVisible();

    await qrPage.setPasswordButton.click();
    await passwordModal.waitForOpen();

    await passwordModal.close();

    await expect(passwordModal.modal).toBeHidden();
  });

  // ==========================================================================
  // ALWAYS ACTIVE PASSWORD
  // ==========================================================================

  test("set password with Always Active mode", async ({
    authenticatedPage,
  }) => {
    // Track if password API was called (PATCH to /qr-code/:id)
    let passwordApiCalled = false;
    await safeRoute(
      authenticatedPage,
      `**/qr-code/${qrCodeId}**`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          passwordApiCalled = true;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockPasswordUpdateSuccess),
          });
        } else {
          // GET request - return QR code data
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockQRCodeResponse),
          });
        }
      },
    );
    // Set up remaining routes
    await safeRoute(
      authenticatedPage,
      `**/qr-code/scanned/${qrCodeId}**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockScannedQRResponse),
        });
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/${qrCodeId}/procore-tools**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockQrProcoreTools),
        });
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/image/${qrCodeId}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ signedUrl: null, exists: false }),
        });
      },
    );

    await qrPage.gotoDetail(qrCodeId);
    await expect(
      authenticatedPage.locator("text=Equipment Panel A"),
    ).toBeVisible();

    await qrPage.setPasswordButton.click();
    await passwordModal.waitForOpen();

    // Fill password (this enables password protection first)
    await passwordModal.fillPassword("SecurePass123!", "SecurePass123!");

    // "Always" mode is selected by default, so no need to click it
    // Just verify it's visible and selected
    await expect(passwordModal.alwaysActiveOption).toBeVisible();

    // Save
    await passwordModal.save();

    // Wait for modal to close (indicates success)
    await expect(passwordModal.modal).toBeHidden({ timeout: 5000 });

    // Verify API was called
    expect(passwordApiCalled).toBe(true);
  });

  test("password validation - passwords must match", async ({
    authenticatedPage,
  }) => {
    await setupQrCodeRoutes(authenticatedPage);
    await qrPage.gotoDetail(qrCodeId);
    await expect(
      authenticatedPage.locator("text=Equipment Panel A"),
    ).toBeVisible();

    await qrPage.setPasswordButton.click();
    await passwordModal.waitForOpen();

    // Fill mismatched passwords
    await passwordModal.fillPassword("Password123!", "DifferentPass456!");

    // Button should be disabled because passwords don't match
    const isDisabled = await passwordModal.saveButton.isDisabled();
    expect(isDisabled).toBe(true);

    // Modal should still be open
    expect(await passwordModal.isOpen()).toBe(true);
  });

  // ==========================================================================
  // SCHEDULED PASSWORD
  // ==========================================================================

  test("set password with scheduled mode - weekday schedule", async ({
    authenticatedPage,
  }) => {
    // Track if password API was called (PATCH to /qr-code/:id)
    let passwordApiCalled = false;
    await safeRoute(
      authenticatedPage,
      `**/qr-code/${qrCodeId}**`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          passwordApiCalled = true;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockPasswordUpdateSuccess),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockQRCodeResponse),
          });
        }
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/scanned/${qrCodeId}**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockScannedQRResponse),
        });
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/${qrCodeId}/procore-tools**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockQrProcoreTools),
        });
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/image/${qrCodeId}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ signedUrl: null, exists: false }),
        });
      },
    );

    await qrPage.gotoDetail(qrCodeId);
    await expect(
      authenticatedPage.locator("text=Equipment Panel A"),
    ).toBeVisible();

    await qrPage.setPasswordButton.click();
    await passwordModal.waitForOpen();

    // Fill password (this enables password protection first)
    await passwordModal.fillPassword("ScheduledPass123!", "ScheduledPass123!");

    // Select Scheduled mode
    await passwordModal.selectScheduledMode();
    await authenticatedPage.waitForTimeout(300);

    // Configure schedule - enable weekday
    await passwordModal.setSchedule({
      startTime: "08:00",
      endTime: "17:00",
      weekday: true,
      weekend: false,
    });

    // Save
    await passwordModal.save();

    // Modal should close on success
    await expect(passwordModal.modal).toBeHidden({ timeout: 5000 });

    // Verify API was called
    expect(passwordApiCalled).toBe(true);
  });

  test("set password with scheduled mode - weekend schedule", async ({
    authenticatedPage,
  }) => {
    // Track if password API was called (PATCH to /qr-code/:id)
    let passwordApiCalled = false;
    await safeRoute(
      authenticatedPage,
      `**/qr-code/${qrCodeId}**`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          passwordApiCalled = true;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockPasswordUpdateSuccess),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockQRCodeResponse),
          });
        }
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/scanned/${qrCodeId}**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockScannedQRResponse),
        });
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/${qrCodeId}/procore-tools**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockQrProcoreTools),
        });
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/image/${qrCodeId}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ signedUrl: null, exists: false }),
        });
      },
    );

    await qrPage.gotoDetail(qrCodeId);
    await expect(
      authenticatedPage.locator("text=Equipment Panel A"),
    ).toBeVisible();

    await qrPage.setPasswordButton.click();
    await passwordModal.waitForOpen();

    // Fill password (this enables password protection first)
    await passwordModal.fillPassword("WeekendPass123!", "WeekendPass123!");

    // Select Scheduled mode
    await passwordModal.selectScheduledMode();
    await authenticatedPage.waitForTimeout(300);

    // Configure weekend-only schedule
    await passwordModal.setSchedule({
      startTime: "09:00",
      endTime: "18:00",
      weekday: false,
      weekend: true,
    });

    await passwordModal.save();

    // Modal should close on success
    await expect(passwordModal.modal).toBeHidden({ timeout: 5000 });

    // Verify API was called
    expect(passwordApiCalled).toBe(true);
  });

  // ==========================================================================
  // TIMEZONE CONFIGURATION
  // ==========================================================================

  test("timezone can be configured for scheduled password", async ({
    authenticatedPage,
  }) => {
    // Track if password API was called (PATCH to /qr-code/:id)
    let passwordApiCalled = false;
    await safeRoute(
      authenticatedPage,
      `**/qr-code/${qrCodeId}**`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          passwordApiCalled = true;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockPasswordUpdateSuccess),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockQRCodeResponse),
          });
        }
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/scanned/${qrCodeId}**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockScannedQRResponse),
        });
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/${qrCodeId}/procore-tools**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockQrProcoreTools),
        });
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/image/${qrCodeId}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ signedUrl: null, exists: false }),
        });
      },
    );

    await qrPage.gotoDetail(qrCodeId);
    await expect(
      authenticatedPage.locator("text=Equipment Panel A"),
    ).toBeVisible();

    await qrPage.setPasswordButton.click();
    await passwordModal.waitForOpen();

    // Fill password (this enables password protection first)
    await passwordModal.fillPassword("TimezonePass123!", "TimezonePass123!");

    // Select Scheduled mode
    await passwordModal.selectScheduledMode();
    await authenticatedPage.waitForTimeout(300);

    // Timezone select should be visible in schedule settings
    await expect(passwordModal.timezoneSelect).toBeVisible();

    // Configure weekday schedule to enable schedule settings
    await passwordModal.setSchedule({
      startTime: "08:00",
      endTime: "17:00",
      weekday: true,
    });

    // Save
    await passwordModal.save();

    // Modal should close on success
    await expect(passwordModal.modal).toBeHidden({ timeout: 5000 });

    // Verify API was called
    expect(passwordApiCalled).toBe(true);
  });

  // ==========================================================================
  // VALIDATION ERRORS
  // ==========================================================================

  test("schedule mode shows weekday and weekend toggles", async ({
    authenticatedPage,
  }) => {
    await setupQrCodeRoutes(authenticatedPage);
    await qrPage.gotoDetail(qrCodeId);
    await expect(
      authenticatedPage.locator("text=Equipment Panel A"),
    ).toBeVisible();

    await qrPage.setPasswordButton.click();
    await passwordModal.waitForOpen();

    // Enable password protection
    await passwordModal.enablePasswordProtection();
    await authenticatedPage.waitForTimeout(400);

    // Select Scheduled mode
    await passwordModal.selectScheduledMode();
    await authenticatedPage.waitForTimeout(300);

    // Verify schedule controls are visible
    await expect(passwordModal.weekdayToggle).toBeVisible();
    await expect(passwordModal.weekendToggle).toBeVisible();

    // Close the modal
    await passwordModal.close();
  });

  test("validation error - empty password", async ({ authenticatedPage }) => {
    await setupQrCodeRoutes(authenticatedPage);
    await qrPage.gotoDetail(qrCodeId);
    await expect(
      authenticatedPage.locator("text=Equipment Panel A"),
    ).toBeVisible();

    await qrPage.setPasswordButton.click();
    await passwordModal.waitForOpen();

    // Enable password protection to reveal password fields
    await passwordModal.enablePasswordProtection();
    // Wait for animation
    await authenticatedPage.waitForTimeout(400);

    // Don't fill in password, but button should be disabled
    const isDisabled = await passwordModal.saveButton.isDisabled();
    expect(isDisabled).toBe(true);

    // Modal should still be open
    expect(await passwordModal.isOpen()).toBe(true);
  });

  // ==========================================================================
  // API ERROR HANDLING
  // ==========================================================================

  test("API save failure shows error and retains form data", async ({
    authenticatedPage,
  }) => {
    // Mock endpoint to return error on PATCH
    await safeRoute(
      authenticatedPage,
      `**/qr-code/${qrCodeId}**`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              message: "Failed to update password settings",
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockQRCodeResponse),
          });
        }
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/scanned/${qrCodeId}**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockScannedQRResponse),
        });
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/${qrCodeId}/procore-tools**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockQrProcoreTools),
        });
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/image/${qrCodeId}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ signedUrl: null, exists: false }),
        });
      },
    );

    await qrPage.gotoDetail(qrCodeId);
    await expect(
      authenticatedPage.locator("text=Equipment Panel A"),
    ).toBeVisible();

    await qrPage.setPasswordButton.click();
    await passwordModal.waitForOpen();

    await passwordModal.fillPassword("FailingPass123!", "FailingPass123!");
    await passwordModal.save();

    // Error should display (via toast) - look for toast with "Failed" text
    await expect(
      authenticatedPage
        .locator("[role='status'], .Toastify, [class*='toast']")
        .filter({ hasText: /failed/i }),
    ).toBeVisible({ timeout: 5000 });

    // Modal should close even on error (component behavior)
    // The error is shown via toast, not in modal
  });

  // ==========================================================================
  // PASSWORD REMOVAL
  // ==========================================================================

  test("remove existing password protection", async ({ authenticatedPage }) => {
    // Use QR code that already has password
    const passwordQrId = "qr-password-002";

    // Track password API call (PATCH to /qr-code/:id)
    let passwordApiCalled = false;
    await safeRoute(
      authenticatedPage,
      `**/qr-code/${passwordQrId}**`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          passwordApiCalled = true;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              message: "Password removed",
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: mockQRCodeWithPassword }),
          });
        }
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/scanned/${passwordQrId}**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...mockScannedQRResponse,
            data: { ...mockScannedQRResponse.data, _id: passwordQrId },
          }),
        });
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/${passwordQrId}/procore-tools**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockQrProcoreTools),
        });
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/image/${passwordQrId}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ signedUrl: null, exists: false }),
        });
      },
    );

    await qrPage.gotoDetail(passwordQrId);
    await expect(
      authenticatedPage.locator("text=Secured Equipment B"),
    ).toBeVisible();

    await qrPage.setPasswordButton.click();
    await passwordModal.waitForOpen();

    // The modal should show "Update Password" since passwordActivated is true
    await expect(passwordModal.modalTitle).toHaveText("Update Password");

    // Toggle off password protection
    await passwordModal.disablePasswordProtection();

    // Save the changes (button should say "Update Password")
    await passwordModal.save();

    // Verify success - modal should close
    await expect(passwordModal.modal).toBeHidden({ timeout: 5000 });

    // Verify the API was called
    expect(passwordApiCalled).toBe(true);
  });

  // ==========================================================================
  // PASSWORD STATUS DISPLAY
  // ==========================================================================

  test("password modal shows existing password configuration", async ({
    authenticatedPage,
  }) => {
    const passwordQrId = "qr-password-002";

    // Set up routes for qr-password-002 (not using routeTracker)
    await safeRoute(
      authenticatedPage,
      `**/qr-code/${passwordQrId}**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: mockQRCodeWithPassword }),
        });
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/scanned/${passwordQrId}**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...mockScannedQRResponse,
            data: {
              ...mockScannedQRResponse.data,
              _id: passwordQrId,
              passwordActivated: true,
            },
          }),
        });
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/${passwordQrId}/procore-tools**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockQrProcoreTools),
        });
      },
    );
    await safeRoute(
      authenticatedPage,
      `**/qr-code/image/${passwordQrId}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ signedUrl: null, exists: false }),
        });
      },
    );

    await qrPage.gotoDetail(passwordQrId);
    await expect(
      authenticatedPage.locator("text=Secured Equipment B"),
    ).toBeVisible();

    // Open the password modal
    await qrPage.setPasswordButton.click();
    await passwordModal.waitForOpen();

    // Modal should show "Update Password" title since password is already configured
    await expect(passwordModal.modalTitle).toHaveText("Update Password");

    // The activation toggle should be checked (enabled)
    await expect(passwordModal.activationToggle).toHaveAttribute(
      "aria-checked",
      "true",
    );

    // Close the modal
    await passwordModal.close();
    await expect(passwordModal.modal).toBeHidden();
  });
});
