import { test, expect, mockAuthCompany } from "../fixtures/authenticated-test";
import { DashboardPage } from "../pages/dashboard.page";
import type { RouteTracker } from "../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

const COMPANY_ID = mockAuthCompany._id;

// Dashboard stats API returns { data: DashboardStats } envelope
const mockDashboardStats = {
  data: {
    qrCodesCount: 42,
    qrScansCount: 1250,
    documentsCount: 85,
    projectsCount: 3,
    groupsCount: 5,
    arrangementsCount: 3,
    equipmentCount: 2,
  },
};

const mockQRCodesList = {
  success_message: "QR codes retrieved",
  total_items: 3,
  data: [
    {
      _id: "qr-dash-001",
      qrcodeName: "Site A Inspection QR",
      qrcodeType: "standard",
      company: COMPANY_ID,
      group: "grp-001",
      project: "proj-001",
      createdAt: "2025-01-15T09:00:00Z",
      mobileScanCount: 10,
      passwordActivated: false,
      procoreConnect: false,
      procoreFetch: false,
    },
    {
      _id: "qr-dash-002",
      qrcodeName: "Building B Safety",
      qrcodeType: "standard",
      company: COMPANY_ID,
      group: "grp-001",
      project: "proj-001",
      createdAt: "2025-01-14T09:00:00Z",
      mobileScanCount: 5,
      passwordActivated: false,
      procoreConnect: false,
      procoreFetch: false,
    },
    {
      _id: "qr-dash-003",
      qrcodeName: "Elevator Shaft Monitor",
      qrcodeType: "standard",
      company: COMPANY_ID,
      group: "grp-002",
      project: "proj-002",
      createdAt: "2025-01-13T09:00:00Z",
      mobileScanCount: 2,
      passwordActivated: false,
      procoreConnect: false,
      procoreFetch: false,
    },
  ],
};

const mockProjectsList = [
  {
    _id: "proj-dash-001",
    name: "Highway Renovation",
    qrCodes: 10,
    archived: false,
    projectStatus: "active",
  },
  {
    _id: "proj-dash-002",
    name: "Office Tower Build",
    qrCodes: 5,
    archived: false,
    projectStatus: "completed",
  },
  {
    _id: "proj-dash-003",
    name: "Bridge Inspection",
    qrCodes: 3,
    archived: false,
    projectStatus: "on hold",
  },
];

const mockProjectsResponse = {
  success_message: "Projects fetched successfully",
  total_pages: 1,
  current_page: 1,
  total_items: mockProjectsList.length,
  has_next: false,
  has_prev: false,
  data: mockProjectsList,
};

const mockGroupsList = {
  success_message: "Groups retrieved",
  total_items: 3,
  total_pages: 1,
  current_page: 1,
  has_next: false,
  has_prev: false,
  data: [
    {
      _id: "grp-dash-001",
      groupName: "Level 1 Drawings",
      type: "arrangement",
      numberOfCodes: 8,
      mobileScanCount: 50,
      createdAt: "2025-01-10T09:00:00Z",
    },
    {
      _id: "grp-dash-002",
      groupName: "HVAC Equipment",
      type: "equipment",
      numberOfCodes: 3,
      mobileScanCount: 15,
      createdAt: "2025-01-09T09:00:00Z",
    },
    {
      _id: "grp-dash-003",
      groupName: "Safety Signage",
      type: "arrangement",
      numberOfCodes: 12,
      mobileScanCount: 100,
      createdAt: "2025-01-08T09:00:00Z",
    },
  ],
};

const emptyQRCodesList = { success_message: "ok", total_items: 0, data: [] };

const emptyProjectsResponse = {
  success_message: "ok",
  total_pages: 1,
  current_page: 1,
  total_items: 0,
  has_next: false,
  has_prev: false,
  data: [],
};

const emptyGroupsList = {
  success_message: "ok",
  total_items: 0,
  total_pages: 0,
  current_page: 1,
  has_next: false,
  has_prev: false,
  data: [],
};

const emptyDashboardStats = {
  data: {
    qrCodesCount: 0,
    qrScansCount: 0,
    documentsCount: 0,
    projectsCount: 0,
    groupsCount: 0,
    arrangementsCount: 0,
    equipmentCount: 0,
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Set up all API mocks needed for the dashboard to render.
 * Accepts optional overrides for individual endpoints.
 */
async function setupDashboardMocks(
  routeTracker: RouteTracker,
  overrides?: {
    stats?: object;
    qrCodes?: object;
    projects?: object;
    groups?: object;
    delay?: number;
  },
) {
  const opts = overrides?.delay ? { delay: overrides.delay } : undefined;

  await routeTracker.mockRoute(
    "**/company/*/dashboard-stats",
    (overrides?.stats ?? mockDashboardStats) as object,
    opts,
  );
  await routeTracker.mockRoute(
    "**/qr-code*",
    (overrides?.qrCodes ?? mockQRCodesList) as object,
    opts,
  );
  await routeTracker.mockRoute(
    "**/project**",
    (overrides?.projects ?? mockProjectsResponse) as object,
    opts,
  );
  await routeTracker.mockRoute(
    "**/groups*",
    (overrides?.groups ?? mockGroupsList) as object,
    opts,
  );
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Dashboard @desktop", () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // The dashboard reads user.companyId for API calls.
    // The authenticated fixture stores user.company but the dashboard needs
    // user.companyId. Patch it after the fixture's init script runs.
    await authenticatedPage.addInitScript((companyId: string) => {
      const raw = window.localStorage.getItem("user");
      if (raw) {
        const user = JSON.parse(raw);
        user.companyId = companyId;
        window.localStorage.setItem("user", JSON.stringify(user));
      }
    }, COMPANY_ID);
  });

  test("renders stats cards with correct counts", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await setupDashboardMocks(routeTracker);

    await dashboard.goto();
    await dashboard.waitForLoad();

    await expect(dashboard.getStatValue("Total QR Codes")).toHaveText("42");
    await expect(dashboard.getStatValue("Total Scans")).toHaveText("1,250");
    await expect(dashboard.getStatValue("Files Shared")).toHaveText("85");
  });

  test("renders recent QR codes list with names", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await setupDashboardMocks(routeTracker);

    await dashboard.goto();
    await dashboard.waitForLoad();

    await expect(dashboard.recentQRCodesHeading).toBeVisible();
    await expect(dashboard.getQRCodeItem("Site A Inspection QR")).toBeVisible();
    await expect(dashboard.getQRCodeItem("Building B Safety")).toBeVisible();
    await expect(
      dashboard.getQRCodeItem("Elevator Shaft Monitor"),
    ).toBeVisible();
  });

  test("renders recent projects list with cards", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await setupDashboardMocks(routeTracker);

    await dashboard.goto();
    await dashboard.waitForLoad();

    await expect(dashboard.recentProjectsHeading).toBeVisible();
    await expect(dashboard.getProjectCard("Highway Renovation")).toBeVisible();
    await expect(dashboard.getProjectCard("Office Tower Build")).toBeVisible();
    await expect(dashboard.getProjectCard("Bridge Inspection")).toBeVisible();

    // Verify QR code count pill on a project card
    await expect(dashboard.getProjectPill("Highway Renovation")).toHaveText(
      "10 QR Codes",
    );
  });

  test("renders recent groups list", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await setupDashboardMocks(routeTracker);

    await dashboard.goto();
    await dashboard.waitForLoad();

    await expect(dashboard.recentGroupsHeading).toBeVisible();
    await expect(dashboard.getGroupItem("Level 1 Drawings")).toBeVisible();
    await expect(dashboard.getGroupItem("HVAC Equipment")).toBeVisible();
    await expect(dashboard.getGroupItem("Safety Signage")).toBeVisible();
  });

  test("Create QR Code button links to /create-qr", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await setupDashboardMocks(routeTracker);

    await dashboard.goto();
    await dashboard.waitForLoad();

    await expect(dashboard.createQRButton).toBeVisible();
    // The button is wrapped in a <Link to="/create-qr"> which renders as <a>
    const link = dashboard.createQRButton.locator("xpath=ancestor::a");
    await expect(link).toHaveAttribute("href", "/create-qr");
  });

  test("shows empty states when no data exists", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await setupDashboardMocks(routeTracker, {
      stats: emptyDashboardStats,
      qrCodes: emptyQRCodesList,
      projects: emptyProjectsResponse,
      groups: emptyGroupsList,
    });

    await dashboard.goto();
    await dashboard.waitForLoad();

    // Stats show zeros
    await expect(dashboard.getStatValue("Total QR Codes")).toHaveText("0");
    await expect(dashboard.getStatValue("Total Scans")).toHaveText("0");
    await expect(dashboard.getStatValue("Files Shared")).toHaveText("0");

    // Empty state messages appear
    await expect(dashboard.projectsEmptyState).toBeVisible();
    await expect(dashboard.qrCodesEmptyState).toBeVisible();
    await expect(dashboard.groupsEmptyState).toBeVisible();
  });

  test("clicking a recent QR code links to its detail page", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await setupDashboardMocks(routeTracker);

    await dashboard.goto();
    await dashboard.waitForLoad();

    // Verify the QR code link points to the correct detail route
    const qrItem = dashboard.getQRCodeItem("Site A Inspection QR");
    await expect(qrItem).toBeVisible();
    await expect(qrItem).toHaveAttribute("href", /\/qrcode\/qr-dash-001/);
  });

  test("View All links navigate to correct pages", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const dashboard = new DashboardPage(authenticatedPage);
    await setupDashboardMocks(routeTracker);

    await dashboard.goto();
    await dashboard.waitForLoad();

    // Projects "View All" → /projects
    const projectsViewAll = dashboard.getViewAllLink(
      dashboard.recentProjectsHeading,
    );
    await expect(projectsViewAll).toHaveAttribute("href", "/projects");

    // QR Codes "View All" → /my-qrcodes
    const qrCodesViewAll = dashboard.getViewAllLink(
      dashboard.recentQRCodesHeading,
    );
    await expect(qrCodesViewAll).toHaveAttribute("href", "/my-qrcodes");

    // Groups "View All" → /groups
    const groupsViewAll = dashboard.getViewAllLink(
      dashboard.recentGroupsHeading,
    );
    await expect(groupsViewAll).toHaveAttribute("href", "/groups");
  });

  test("shows loading skeleton while data loads", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const dashboard = new DashboardPage(authenticatedPage);

    // Mock with delay so loading skeleton is observable
    await setupDashboardMocks(routeTracker, { delay: 3000 });

    await dashboard.goto();

    // Skeleton should be visible while data is loading
    await expect(dashboard.loadingSkeleton.first()).toBeVisible();

    // Wait for data to load and skeleton to disappear
    await dashboard.waitForLoad();

    // Content should now be visible
    await expect(dashboard.heading).toBeVisible();
    await expect(dashboard.recentProjectsHeading).toBeVisible();
  });
});
