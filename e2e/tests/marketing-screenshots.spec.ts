/**
 * Marketing Website Screenshot Generator
 *
 * Generates app screenshots for the Taliho marketing website (taliho-website-v3).
 * Uses mocked API endpoints so no backend is required.
 *
 * Run:
 *   PLAYWRIGHT_ENABLE_MARKETING_SCREENSHOTS=1 npx playwright test e2e/tests/marketing-screenshots.spec.ts --project="Desktop Chrome"
 *
 * Screenshots are saved to:
 *   C:\Projects\Taliho Website\taliho-website-v3\public\images\screenshots\
 */

import { test, expect, mockAuthCompany } from "../fixtures/authenticated-test";
import { toBackendRoutePattern } from "../utils/runtime-env";

const COMPANY_ID = mockAuthCompany._id;
const SCREENSHOT_DIR =
  "C:/Projects/Taliho Website/taliho-website-v3/public/images/screenshots";
const ENABLE_MARKETING_SCREENSHOTS =
  process.env.PLAYWRIGHT_ENABLE_MARKETING_SCREENSHOTS === "1";
const marketingDescribe = ENABLE_MARKETING_SCREENSHOTS
  ? test.describe
  : test.describe.skip;

// ============================================================================
// MOCK DATA â€” realistic data for visually appealing screenshots
// ============================================================================

const mockDashboardStats = {
  data: {
    qrCodesCount: 156,
    qrScansCount: 12840,
    documentsCount: 423,
    projectsCount: 8,
    groupsCount: 14,
    arrangementsCount: 9,
    equipmentCount: 5,
  },
};

const mockRecentQRCodes = {
  success_message: "QR codes retrieved",
  total_items: 5,
  data: [
    {
      _id: "qr-001",
      qrcodeName: "Building A â€” Lobby Entrance",
      qrcodeType: "standard",
      company: COMPANY_ID,
      group: "grp-001",
      project: "proj-001",
      createdAt: "2026-02-10T09:00:00Z",
      mobileScanCount: 245,
      passwordActivated: false,
      procoreConnect: false,
      procoreFetch: false,
    },
    {
      _id: "qr-002",
      qrcodeName: "Electrical Panel â€” Level 3",
      qrcodeType: "standard",
      company: COMPANY_ID,
      group: "grp-002",
      project: "proj-001",
      createdAt: "2026-02-09T14:30:00Z",
      mobileScanCount: 89,
      passwordActivated: false,
      procoreConnect: true,
      procoreFetch: true,
    },
    {
      _id: "qr-003",
      qrcodeName: "HVAC Rooftop Unit #4",
      qrcodeType: "standard",
      company: COMPANY_ID,
      group: "grp-003",
      project: "proj-002",
      createdAt: "2026-02-08T11:15:00Z",
      mobileScanCount: 67,
      passwordActivated: false,
      procoreConnect: false,
      procoreFetch: false,
    },
    {
      _id: "qr-004",
      qrcodeName: "Fire Safety Station â€” East Wing",
      qrcodeType: "standard",
      company: COMPANY_ID,
      group: "grp-001",
      project: "proj-003",
      createdAt: "2026-02-07T16:45:00Z",
      mobileScanCount: 134,
      passwordActivated: false,
      procoreConnect: false,
      procoreFetch: false,
    },
    {
      _id: "qr-005",
      qrcodeName: "Parking Garage â€” Level B2",
      qrcodeType: "standard",
      company: COMPANY_ID,
      group: "grp-004",
      project: "proj-001",
      createdAt: "2026-02-06T08:20:00Z",
      mobileScanCount: 56,
      passwordActivated: false,
      procoreConnect: false,
      procoreFetch: false,
    },
  ],
};

const mockProjects = [
  {
    _id: "proj-001",
    name: "Parkview Luxury Residences",
    qrCodes: 45,
    archived: false,
    projectStatus: "active",
  },
  {
    _id: "proj-002",
    name: "Downtown Office Tower",
    qrCodes: 32,
    archived: false,
    projectStatus: "active",
  },
  {
    _id: "proj-003",
    name: "Westfield Community Center",
    qrCodes: 28,
    archived: false,
    projectStatus: "active",
  },
  {
    _id: "proj-004",
    name: "Harbor Bridge Renovation",
    qrCodes: 21,
    archived: false,
    projectStatus: "completed",
  },
  {
    _id: "proj-005",
    name: "Meridian Mixed-Use Complex",
    qrCodes: 18,
    archived: false,
    projectStatus: "active",
  },
  {
    _id: "proj-006",
    name: "Lincoln High School Expansion",
    qrCodes: 12,
    archived: false,
    projectStatus: "on hold",
  },
];

const mockProjectDetail = {
  _id: "proj-001",
  projectName: "Parkview Luxury Residences",
  projectAddress: "2400 Parkview Boulevard",
  projectCity: "Los Angeles",
  projectState: "CA",
  projectZIP: "90024",
  company: COMPANY_ID,
  createdAt: "2025-09-15T00:00:00Z",
};

const mockProjectQRCodes = {
  success_message: "QR codes retrieved",
  total_items: 6,
  data: [
    {
      _id: "pqr-001",
      qrcodeName: "Building A â€” Lobby Entrance",
      qrcodeType: "standard",
      company: COMPANY_ID,
      project: "proj-001",
      createdAt: "2026-01-15T09:00:00Z",
      mobileScanCount: 245,
    },
    {
      _id: "pqr-002",
      qrcodeName: "Electrical Panel â€” Level 3",
      qrcodeType: "standard",
      company: COMPANY_ID,
      project: "proj-001",
      createdAt: "2026-01-14T14:30:00Z",
      mobileScanCount: 89,
    },
    {
      _id: "pqr-003",
      qrcodeName: "Parking Garage â€” Level B2",
      qrcodeType: "standard",
      company: COMPANY_ID,
      project: "proj-001",
      createdAt: "2026-01-13T11:15:00Z",
      mobileScanCount: 56,
    },
    {
      _id: "pqr-004",
      qrcodeName: "Amenity Center â€” Pool Area",
      qrcodeType: "standard",
      company: COMPANY_ID,
      project: "proj-001",
      createdAt: "2026-01-12T16:45:00Z",
      mobileScanCount: 78,
    },
    {
      _id: "pqr-005",
      qrcodeName: "Rooftop Garden Access",
      qrcodeType: "standard",
      company: COMPANY_ID,
      project: "proj-001",
      createdAt: "2026-01-11T08:20:00Z",
      mobileScanCount: 34,
    },
    {
      _id: "pqr-006",
      qrcodeName: "Loading Dock â€” South Gate",
      qrcodeType: "standard",
      company: COMPANY_ID,
      project: "proj-001",
      createdAt: "2026-01-10T10:00:00Z",
      mobileScanCount: 112,
    },
  ],
};

const mockGroups = {
  success_message: "Groups retrieved",
  total_items: 5,
  total_pages: 1,
  current_page: 1,
  has_next: false,
  has_prev: false,
  data: [
    {
      _id: "grp-001",
      groupName: "Level 1 Floor Plans",
      type: "arrangement",
      numberOfCodes: 12,
      mobileScanCount: 340,
      createdAt: "2025-11-10T09:00:00Z",
    },
    {
      _id: "grp-002",
      groupName: "Electrical Panels",
      type: "equipment",
      numberOfCodes: 8,
      mobileScanCount: 156,
      createdAt: "2025-11-09T09:00:00Z",
    },
    {
      _id: "grp-003",
      groupName: "HVAC Equipment",
      type: "equipment",
      numberOfCodes: 5,
      mobileScanCount: 89,
      createdAt: "2025-11-08T09:00:00Z",
    },
    {
      _id: "grp-004",
      groupName: "Safety Signage",
      type: "arrangement",
      numberOfCodes: 15,
      mobileScanCount: 420,
      createdAt: "2025-11-07T09:00:00Z",
    },
    {
      _id: "grp-005",
      groupName: "Plumbing Risers",
      type: "equipment",
      numberOfCodes: 6,
      mobileScanCount: 72,
      createdAt: "2025-11-06T09:00:00Z",
    },
  ],
};

const mockCategories = [
  {
    _id: "cat-001",
    categoryName: "Electrical Panel",
    categoryClass: "Electrical",
    companyId: COMPANY_ID,
  },
  {
    _id: "cat-002",
    categoryName: "Fire Extinguisher",
    categoryClass: "Safety",
    companyId: COMPANY_ID,
  },
  {
    _id: "cat-003",
    categoryName: "HVAC Unit",
    categoryClass: "Mechanical",
    companyId: COMPANY_ID,
  },
];

// ============================================================================
// TESTS
// ============================================================================

// Disable route verification â€” screenshot tests mock broadly and not all routes may be called
test.use({
  verifyRoutesCalled: false,
  checkUnmockedCalls: false,
} as Parameters<typeof test.use>[0]);

marketingDescribe("Marketing Screenshots @desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ authenticatedPage }) => {
    // Ensure companyId is set for API calls
    await authenticatedPage.addInitScript((companyId: string) => {
      const raw = window.localStorage.getItem("user");
      if (raw) {
        const user = JSON.parse(raw);
        user.companyId = companyId;
        window.localStorage.setItem("user", JSON.stringify(user));
      }
    }, COMPANY_ID);
  });

  test("1 - Dashboard Overview", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/company/*/dashboard-stats",
      mockDashboardStats,
    );
    await routeTracker.mockRoute("**/qr-code*", mockRecentQRCodes);
    await routeTracker.mockRoute(
      "**/aggregation/all-projects/**",
      mockProjects,
    );
    await routeTracker.mockRoute("**/groups*", mockGroups);

    await authenticatedPage.goto("/dashboard/");
    await expect(authenticatedPage.locator("h1").first()).toBeVisible({
      timeout: 10000,
    });
    // Wait for stats to render
    await authenticatedPage.waitForTimeout(1000);

    await authenticatedPage.screenshot({
      path: `${SCREENSHOT_DIR}/dashboard-overview.png`,
      fullPage: false,
    });
  });

  test("2 - Projects List", async ({ authenticatedPage, routeTracker }) => {
    await routeTracker.mockRoute(
      "**/aggregation/all-projects/**",
      mockProjects,
    );

    await authenticatedPage.goto("/projects");
    await expect(authenticatedPage.locator("h1").first()).toBeVisible({
      timeout: 10000,
    });
    await authenticatedPage.waitForTimeout(1000);

    await authenticatedPage.screenshot({
      path: `${SCREENSHOT_DIR}/projects-list.png`,
      fullPage: false,
    });
  });

  test("3 - Project Detail", async ({ authenticatedPage, routeTracker }) => {
    // Use port-specific pattern to avoid intercepting page navigation to /project/proj-001
    await routeTracker.mockRoute(
      toBackendRoutePattern("/project/proj-001"),
      mockProjectDetail,
    );
    await routeTracker.mockRoute("**/qr-code*", mockProjectQRCodes);
    await routeTracker.mockRoute(toBackendRoutePattern("/groups"), mockGroups);

    await authenticatedPage.goto("/project/proj-001");
    await expect(authenticatedPage.locator("h1").first()).toBeVisible({
      timeout: 10000,
    });
    await authenticatedPage.waitForTimeout(1000);

    await authenticatedPage.screenshot({
      path: `${SCREENSHOT_DIR}/project-detail.png`,
      fullPage: false,
    });
  });

  test("4 - QR Codes List", async ({ authenticatedPage, routeTracker }) => {
    await routeTracker.mockRoute("**/qr-code*", mockRecentQRCodes);

    await authenticatedPage.goto("/my-qrcodes");
    await expect(authenticatedPage.locator("h1").first()).toBeVisible({
      timeout: 10000,
    });
    await authenticatedPage.waitForTimeout(1000);

    await authenticatedPage.screenshot({
      path: `${SCREENSHOT_DIR}/qr-codes-list.png`,
      fullPage: false,
    });
  });

  test("5 - Create QR Wizard", async ({ authenticatedPage, routeTracker }) => {
    await routeTracker.mockRoute(
      "**/aggregation/all-projects/**",
      mockProjects,
    );
    await routeTracker.mockRoute("**/groups*", mockGroups);
    await routeTracker.mockRoute("**/category*", mockCategories);

    await authenticatedPage.goto("/create-qr");
    await expect(authenticatedPage.locator("h1").first()).toBeVisible({
      timeout: 10000,
    });
    await authenticatedPage.waitForTimeout(1000);

    await authenticatedPage.screenshot({
      path: `${SCREENSHOT_DIR}/create-qr-wizard.png`,
      fullPage: false,
    });
  });

  test("6 - Groups Management", async ({ authenticatedPage, routeTracker }) => {
    // Use port-specific pattern to avoid intercepting page navigation to /groups
    await routeTracker.mockRoute(toBackendRoutePattern("/groups"), mockGroups);

    await authenticatedPage.goto("/groups");
    await expect(authenticatedPage.locator("h1").first()).toBeVisible({
      timeout: 10000,
    });
    await authenticatedPage.waitForTimeout(1000);

    await authenticatedPage.screenshot({
      path: `${SCREENSHOT_DIR}/groups-management.png`,
      fullPage: false,
    });
  });
});
