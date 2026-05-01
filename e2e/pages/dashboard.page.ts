import { Page, Locator } from "@playwright/test";

/**
 * Page Object for the Dashboard route (/dashboard).
 * Provides locators and helpers for the authenticated dashboard page.
 */
export class DashboardPage {
  readonly page: Page;

  // Header
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly createQRButton: Locator;

  // Loading State
  readonly loadingSkeleton: Locator;

  // Section Headings
  readonly recentProjectsHeading: Locator;
  readonly recentQRCodesHeading: Locator;
  readonly recentGroupsHeading: Locator;

  // Empty States
  readonly projectsEmptyState: Locator;
  readonly qrCodesEmptyState: Locator;
  readonly groupsEmptyState: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.heading = page.locator("h1").filter({ hasText: "Dashboard" });
    this.subtitle = page.getByText(
      "Here's an overview of your QR codes and activity",
    );
    this.createQRButton = page.getByRole("button", {
      name: "Create QR Code",
    });

    // Loading
    this.loadingSkeleton = page.locator(".animate-pulse");

    // Section headings
    this.recentProjectsHeading = page.getByRole("heading", {
      name: "Recent Projects",
    });
    this.recentQRCodesHeading = page.getByRole("heading", {
      name: "Recent QR Codes",
    });
    this.recentGroupsHeading = page.getByRole("heading", {
      name: "Recent Groups",
    });

    // Empty states
    this.projectsEmptyState = page.getByText("No Projects yet");
    this.qrCodesEmptyState = page.getByText("No QR Codes yet");
    this.groupsEmptyState = page.getByText("No Groups yet");
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  async goto() {
    await this.page.goto("/dashboard/");
  }

  async waitForLoad() {
    await this.loadingSkeleton
      .first()
      .waitFor({ state: "hidden", timeout: 15000 })
      .catch(() => {
        // Skeleton may not appear if data loaded quickly
      });
  }

  // ============================================================================
  // STATS CARDS
  // ============================================================================

  /**
   * Get the displayed value for a stat card by its title.
   * @param title - "Total QR Codes", "Total Scans", or "Files Shared"
   */
  getStatValue(title: string): Locator {
    // StatCard renders: <p class="text-sm...">title</p> <p class="text-3xl...">value</p>
    // Navigate from title to sibling value element via shared parent.
    return this.page
      .getByText(title, { exact: true })
      .locator("..")
      .locator(".text-3xl");
  }

  // ============================================================================
  // RECENT PROJECTS
  // ============================================================================

  /** Get a project card link by project name. */
  getProjectCard(name: string): Locator {
    // ProjectCard is a <Link> (renders <a>) inside the projects section
    const section = this.recentProjectsHeading.locator("../.."); // up to section container
    return section.locator("a").filter({ hasText: name });
  }

  /** Get the QR code count pill badge on a project card. */
  getProjectPill(name: string): Locator {
    // Use span.rounded-full to distinguish the pill badge from the icon circle (div.rounded-full)
    return this.getProjectCard(name).locator("span.rounded-full");
  }

  // ============================================================================
  // RECENT QR CODES
  // ============================================================================

  /** Get a recent QR code item link by name. */
  getQRCodeItem(name: string): Locator {
    const section = this.recentQRCodesHeading.locator("../.."); // up to section container
    return section.locator("a").filter({ hasText: name });
  }

  // ============================================================================
  // RECENT GROUPS
  // ============================================================================

  /** Get a recent group item link by name. */
  getGroupItem(name: string): Locator {
    const section = this.recentGroupsHeading.locator("../.."); // up to section container
    return section.locator("a").filter({ hasText: name });
  }

  // ============================================================================
  // VIEW ALL LINKS
  // ============================================================================

  /**
   * Get the "View All" link within a section identified by its heading locator.
   * The heading and "View All" link are siblings inside a flex container.
   */
  getViewAllLink(sectionHeading: Locator): Locator {
    return sectionHeading.locator("..").getByText("View All");
  }
}
