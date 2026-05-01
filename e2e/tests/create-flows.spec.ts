import { test, expect } from "../fixtures/verified-test";
import percySnapshot from "../utils/percy";
import { ScannedQRPage } from "../pages/scanned-qr.page";
import {
  CreateInspectionModal,
  CreatePunchListModal,
  CreateFormModal,
  UserInfoModal,
} from "../pages/modals.page";
import {
  mockMultiToolQR,
  mockAggregation,
  mockInspectionTemplates,
  mockFormTemplates,
  mockAssignees,
  mockInspectionData,
  mockPunchListData,
  mockFormData,
} from "../fixtures/test-data";
import { safeRoute } from "../utils/route-tracker";

test.describe("Create Flows - Section 3", () => {
  test.beforeEach(async ({ page }) => {
    // Set creator info in localStorage to skip UserInfoModal when creating items
    await page.addInitScript(() => {
      localStorage.setItem(
        "talihoCreatorInfo",
        JSON.stringify({
          name: "Test User",
          company: "Test Company",
        }),
      );
    });

    // Mock the QR code response with edit permissions
    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockMultiToolQR),
      });
    });

    // Mock the aggregation endpoint
    await safeRoute(
      page,
      "**/aggregation/qr-company-project**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAggregation),
        });
      },
    );
  });

  test.describe("FAB Menu - Section 3.1", () => {
    test("FAB button is visible on category menu", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      await expect(qrPage.fabButton).toBeVisible();

      await percySnapshot(page, "Create Flow - FAB Button Visible");
    });

    test("FAB opens create menu with options", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      await qrPage.openCreateMenu();

      // Verify create options are visible
      await expect(qrPage.createFormOption).toBeVisible();
      await expect(qrPage.createInspectionOption).toBeVisible();
      await expect(qrPage.createPunchListOption).toBeVisible();

      await percySnapshot(page, "Create Flow - FAB Menu Open");
    });

    test("FAB menu closes when clicking outside", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      await qrPage.openCreateMenu();
      await expect(qrPage.createMenu).toBeVisible();

      // Click outside to close
      await page.locator("body").click({ position: { x: 10, y: 10 } });

      // Menu should close
      await expect(qrPage.createMenu).not.toBeVisible();
    });
  });

  test.describe("Create Inspection Flow - Section 3.2", () => {
    test.beforeEach(async ({ page }) => {
      // Mock inspection templates
      await safeRoute(
        page,
        "**/procore/inspection-templates**",
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockInspectionTemplates),
          });
        },
      );
    });

    test("opens create inspection modal from FAB", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const modal = new CreateInspectionModal(page);

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      await qrPage.selectCreateOption("Inspection");

      await modal.waitForOpen();
      await expect(modal.modalHeader).toBeVisible();

      await percySnapshot(page, "Create Inspection - Modal Open");
    });

    test("shows template dropdown with options", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const modal = new CreateInspectionModal(page);

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      await qrPage.selectCreateOption("Inspection");
      await modal.waitForOpen();

      // Open template dropdown
      await modal.templateDropdown.click();
      await expect(modal.templateDropdownMenu).toBeVisible();

      await percySnapshot(page, "Create Inspection - Template Dropdown");
    });

    test("create button is disabled without template", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const modal = new CreateInspectionModal(page);

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      await qrPage.selectCreateOption("Inspection");
      await modal.waitForOpen();

      // Create button should be disabled
      const isDisabled = await modal.isSubmitDisabled();
      expect(isDisabled).toBeTruthy();
    });

    test("can fill all inspection fields", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const modal = new CreateInspectionModal(page);

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      await qrPage.selectCreateOption("Inspection");
      await modal.waitForOpen();

      // Fill form fields
      await modal.selectTemplate("Fire Safety Inspection");
      await modal.fillIdentifier("TEST-001");
      await modal.setInspectionDate("2024-02-01");
      await modal.fillDescription("Test inspection description");

      await percySnapshot(page, "Create Inspection - Fields Filled");
    });

    test("submits inspection successfully", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const modal = new CreateInspectionModal(page);

      // Mock the create endpoint (POST to /procore/inspections)
      await safeRoute(page, "**/procore/inspections**", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({ id: "INSP-001", ...mockInspectionData }),
          });
        } else {
          await route.fallback();
        }
      });

      // Mock the QR linking endpoint
      await safeRoute(page, "**/procore-item**", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({ _id: "link-123" }),
          });
        } else {
          await route.fallback();
        }
      });

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      await qrPage.selectCreateOption("Inspection");
      await modal.waitForOpen();

      // Fill all required fields
      await modal.selectTemplate("Fire Safety Inspection");
      await modal.setInspectionDate("2024-02-01");
      await modal.fillDescription("Test inspection from E2E");

      // Set up request listener before submitting
      const postPromise = page.waitForRequest(
        (req) =>
          req.url().includes("/procore/inspection") &&
          !req.url().includes("/procore/inspection-templates") &&
          req.method() === "POST",
      );

      await modal.createButton.click();

      // Verify the POST request was made
      const request = await postPromise;
      expect(request.method()).toBe("POST");
    });

    test("closes modal with X button", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const modal = new CreateInspectionModal(page);

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      await qrPage.selectCreateOption("Inspection");
      await modal.waitForOpen();

      await modal.close();

      await expect(modal.modalOverlay).not.toBeVisible();
    });
  });

  test.describe("Create Punch List Flow - Section 3.3", () => {
    test.beforeEach(async ({ page }) => {
      // Mock assignees
      await safeRoute(
        page,
        "**/procore/punch-list-assignee-options**",
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockAssignees),
          });
        },
      );
    });

    test("opens create punch list modal from FAB", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const modal = new CreatePunchListModal(page);

      await qrPage.goto("test-qr");
      await expect(qrPage.fabButton).toBeVisible({ timeout: 20000 });

      await qrPage.selectCreateOption("Punch List");

      await modal.waitForOpen();
      await expect(modal.modalHeader).toBeVisible();

      await percySnapshot(page, "Create Punch List - Modal Open");
    });

    test("shows assignees dropdown with checkboxes", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const modal = new CreatePunchListModal(page);

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      await qrPage.selectCreateOption("Punch List");
      await modal.waitForOpen();

      // Open assignees dropdown
      await modal.assigneesDropdown.click();
      await expect(modal.assigneesDropdownMenu).toBeVisible();

      await percySnapshot(page, "Create Punch List - Assignees Dropdown");
    });

    test("can fill all punch list fields", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const modal = new CreatePunchListModal(page);

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      await qrPage.selectCreateOption("Punch List");
      await modal.waitForOpen();

      // Fill form fields
      await modal.fillTitle("Test Punch Item");
      await modal.setDueDate("2024-02-15");
      await modal.fillDescription("Test punch list description");

      await percySnapshot(page, "Create Punch List - Fields Filled");
    });

    test("create button is disabled without title", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const modal = new CreatePunchListModal(page);

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      await qrPage.selectCreateOption("Punch List");
      await modal.waitForOpen();

      // Create button should be disabled without title
      const isDisabled = await modal.isSubmitDisabled();
      expect(isDisabled).toBeTruthy();
    });

    test("submits punch list successfully", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const modal = new CreatePunchListModal(page);

      // Mock the create endpoint
      await safeRoute(page, "**/procore/punch-list**", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({ id: "PL-001", ...mockPunchListData }),
          });
        } else {
          await route.fallback();
        }
      });

      // Mock the QR linking endpoint
      await safeRoute(page, "**/procore-item**", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({ _id: "link-123" }),
          });
        } else {
          await route.fallback();
        }
      });

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      await qrPage.selectCreateOption("Punch List");
      await modal.waitForOpen();

      // Fill required field
      await modal.fillTitle("Test Punch Item");
      await modal.fillDescription("Test punch list from E2E");

      // Set up request listener before submitting
      const postPromise = page.waitForRequest(
        (req) =>
          req.url().includes("/procore/punch-list") && req.method() === "POST",
      );

      await modal.createButton.click();

      // Verify the POST request was made
      const request = await postPromise;
      expect(request.method()).toBe("POST");
    });
  });

  test.describe("Create Form Flow - Section 3.4", () => {
    test.beforeEach(async ({ page }) => {
      // Mock form templates
      await safeRoute(page, "**/procore/form-templates**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockFormTemplates),
        });
      });
    });

    test("opens create form modal from FAB", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const modal = new CreateFormModal(page);

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      await qrPage.selectCreateOption("Form");

      await modal.waitForOpen();
      await expect(modal.modalHeader).toBeVisible();

      await percySnapshot(page, "Create Form - Modal Open");
    });

    test("shows template dropdown with options", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const modal = new CreateFormModal(page);

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      await qrPage.selectCreateOption("Form");
      await modal.waitForOpen();

      // Open template dropdown
      await modal.templateDropdown.click();
      await expect(modal.templateDropdownMenu).toBeVisible();

      await percySnapshot(page, "Create Form - Template Dropdown");
    });

    test("can fill all form fields", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const modal = new CreateFormModal(page);

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      await qrPage.selectCreateOption("Form");
      await modal.waitForOpen();

      // Fill form fields
      await modal.selectTemplate("Safety Checklist");
      await modal.fillFormName("Daily Safety Form - Feb 1");
      await modal.fillDescription("Test form description");

      await percySnapshot(page, "Create Form - Fields Filled");
    });

    test("create button is disabled without template", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const modal = new CreateFormModal(page);

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      await qrPage.selectCreateOption("Form");
      await modal.waitForOpen();

      // Create button should be disabled
      const isDisabled = await modal.isSubmitDisabled();
      expect(isDisabled).toBeTruthy();
    });

    test("submits form successfully", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const modal = new CreateFormModal(page);

      // Override form templates to include fillable PDF URLs (enables submit)
      await safeRoute(page, "**/procore/form-templates**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: 1,
              name: "Safety Checklist",
              fillable_pdf_url:
                "https://storage.example.com/templates/safety.pdf",
            },
            {
              id: 2,
              name: "Equipment Inspection",
              fillable_pdf_url:
                "https://storage.example.com/templates/equipment.pdf",
            },
            {
              id: 3,
              name: "Daily Report",
              fillable_pdf_url:
                "https://storage.example.com/templates/daily.pdf",
            },
          ]),
        });
      });

      // Mock the signed URL / PDF fetch proxy
      await safeRoute(page, "**/document/procore**", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/pdf",
            body: Buffer.from("mock-pdf-content"),
          });
        } else {
          await route.fallback();
        }
      });

      // Mock the form create endpoint
      await safeRoute(page, "**/procore/forms**", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({ id: "FORM-001", ...mockFormData }),
          });
        } else {
          await route.fallback();
        }
      });

      // Mock the QR linking endpoint
      await safeRoute(page, "**/procore-item**", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({ _id: "link-123" }),
          });
        } else {
          await route.fallback();
        }
      });

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      await qrPage.selectCreateOption("Form");
      await modal.waitForOpen();

      // Select template (with PDF URL) and fill name
      await modal.selectTemplate("Safety Checklist");
      await modal.fillFormName("Daily Safety Form - Feb 1");
      await modal.fillDescription("Test form from E2E");

      // Set up request listener before submitting
      const postPromise = page.waitForRequest(
        (req) =>
          req.url().includes("/procore/forms") &&
          !req.url().includes("/procore/form-templates") &&
          req.method() === "POST",
      );

      await modal.createButton.click();

      // Verify the POST request was made
      const request = await postPromise;
      expect(request.method()).toBe("POST");
    });
  });

  test.describe("User Info Modal - Section 3.5", () => {
    test("validates required fields", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const userInfoModal = new UserInfoModal(page);

      // Clear creator info via addInitScript (runs after the beforeEach init script that sets it)
      await page.addInitScript(() => {
        localStorage.removeItem("talihoCreatorInfo");
      });

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      // Select a create option — UserInfoModal appears instead of create modal
      await qrPage.selectCreateOption("Inspection");
      await userInfoModal.waitForOpen();

      await percySnapshot(page, "User Info Modal - Empty Fields");

      // Try to save without filling fields
      await userInfoModal.save();

      // Modal should remain open (validation silently prevents closure)
      await expect(userInfoModal.modalOverlay).toBeVisible();
    });

    test("can complete user info and proceed", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const userInfoModal = new UserInfoModal(page);
      const modal = new CreateInspectionModal(page);

      // Clear creator info via addInitScript (runs after the beforeEach init script that sets it)
      await page.addInitScript(() => {
        localStorage.removeItem("talihoCreatorInfo");
      });

      // Mock inspection templates for when create modal opens after saving user info
      await safeRoute(
        page,
        "**/procore/inspection-templates**",
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockInspectionTemplates),
          });
        },
      );

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      // Select a create option — UserInfoModal appears
      await qrPage.selectCreateOption("Inspection");
      await userInfoModal.waitForOpen();

      // Fill user info (use direct selectors — POM placeholders don't match actual component)
      await page.getByPlaceholder("Jane Doe").fill("John Doe");
      await page.getByPlaceholder("Acme Builders").fill("Test Company");

      await percySnapshot(page, "User Info Modal - Filled");

      await userInfoModal.save();

      // Verify UserInfoModal closed
      await expect(userInfoModal.modalOverlay).not.toBeVisible({
        timeout: 5000,
      });

      // Verify localStorage was updated with creator info
      const creatorInfo = await page.evaluate(() =>
        localStorage.getItem("talihoCreatorInfo"),
      );
      expect(creatorInfo).toBeTruthy();
      const parsed = JSON.parse(creatorInfo as string);
      expect(parsed.name).toBe("John Doe");
      expect(parsed.company).toBe("Test Company");

      // Verify create modal opened after saving user info
      await modal.waitForOpen();
      await expect(modal.modalHeader).toBeVisible();
    });

    test("can cancel user info modal", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);
      const userInfoModal = new UserInfoModal(page);

      // Clear creator info via addInitScript (runs after the beforeEach init script that sets it)
      await page.addInitScript(() => {
        localStorage.removeItem("talihoCreatorInfo");
      });

      await qrPage.goto("test-qr");
      await qrPage.waitForLoad();

      // Select a create option — UserInfoModal appears
      await qrPage.selectCreateOption("Inspection");
      await userInfoModal.waitForOpen();

      // Cancel without filling
      await userInfoModal.cancel();

      // Verify modal closed
      await expect(userInfoModal.modalOverlay).not.toBeVisible({
        timeout: 5000,
      });

      // Verify localStorage was NOT updated (still empty after cancel)
      const creatorInfo = await page.evaluate(() =>
        localStorage.getItem("talihoCreatorInfo"),
      );
      expect(creatorInfo).toBeNull();
    });
  });
});
