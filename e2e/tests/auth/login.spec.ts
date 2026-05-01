import { test, expect } from "../../fixtures/verified-test";
import { AuthPage } from "../../pages/auth.page";
import { safeRoute } from "../../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockLoginSuccess = {
  firstName: "Test",
  accessToken: "mock-jwt-access-token-e2e",
  userId: "user-test-001",
  _id: "user-test-001",
  company: "comp-test-001",
  companyId: "comp-test-001",
};

const mockLoginInvalidCredentials = {
  statusCode: 401,
  message: "Invalid credentials",
  error: "Unauthorized",
};

// ============================================================================
// TESTS
// ============================================================================

test.describe("Login @desktop", () => {
  test("renders login form with email and password fields", async ({
    page,
  }) => {
    const authPage = new AuthPage(page);
    await authPage.gotoLogin();

    await expect(authPage.loginHeading).toBeVisible();
    await expect(authPage.emailInput).toBeVisible();
    await expect(authPage.passwordInput).toBeVisible();
    await expect(authPage.signInButton).toBeVisible();
    await expect(authPage.forgotPasswordLink).toBeVisible();
    await expect(authPage.signUpLink).toBeVisible();
    await expect(authPage.procoreSignInButton).toBeVisible();
  });

  test("prevents empty form submission via required fields", async ({
    page,
  }) => {
    const authPage = new AuthPage(page);
    await authPage.gotoLogin();

    // Both inputs have the HTML required attribute
    await expect(authPage.emailInput).toHaveAttribute("required", "");
    await expect(authPage.passwordInput).toHaveAttribute("required", "");

    // Click Sign In without filling fields — browser validation blocks submission
    await authPage.signInButton.click();

    // Login form should still be displayed (form did not submit)
    await expect(authPage.loginHeading).toBeVisible();
  });

  test("shows invalid credentials error on 401 response", async ({ page }) => {
    const authPage = new AuthPage(page);

    // The login() API function catches 401 errors and returns the response body.
    // The component then checks statusCode >= 400 and calls toast.error(message).
    await safeRoute(page, "**/auth/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify(mockLoginInvalidCredentials),
      });
    });

    await authPage.gotoLogin();
    await authPage.login("wrong@example.com", "WrongPass1");

    // Toast error should display the message from the API response
    await expect(page.getByText("Invalid credentials")).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows loading state during login submission", async ({ page }) => {
    const authPage = new AuthPage(page);

    // Delay the response to observe loading state
    await safeRoute(page, "**/auth/login", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockLoginSuccess),
      });
    });

    await authPage.gotoLogin();
    await authPage.emailInput.fill("test@example.com");
    await authPage.passwordInput.fill("ValidPass1");

    // Click and immediately check for loading state
    await authPage.signInButton.click();

    // Verify loading state: button should be disabled and show loading text
    const loadingButton = page.getByRole("button", { name: /Signing in/i });
    await expect(loadingButton).toBeVisible({ timeout: 500 });
    await expect(loadingButton).toBeDisabled();

    // Wait for login to complete
    await page.waitForURL((url) => url.pathname !== "/", { timeout: 10000 });
  });

  test("prevents double-click during login submission", async ({ page }) => {
    const authPage = new AuthPage(page);
    let loginCallCount = 0;

    await safeRoute(page, "**/auth/login", async (route) => {
      loginCallCount++;
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockLoginSuccess),
      });
    });

    await authPage.gotoLogin();
    await authPage.emailInput.fill("test@example.com");
    await authPage.passwordInput.fill("ValidPass1");

    // Use dblclick() which fires both clicks as a single atomic action
    // before the button state can change
    await authPage.signInButton.dblclick();

    // Wait for navigation
    await page.waitForURL((url) => url.pathname !== "/", { timeout: 10000 });

    // Should only have made one login request
    expect(loginCallCount).toBe(1);
  });

  test("successful login stores JWT and redirects", async ({ page }) => {
    const authPage = new AuthPage(page);

    await safeRoute(page, "**/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockLoginSuccess),
      });
    });

    await authPage.gotoLogin();
    await authPage.login("test@example.com", "ValidPass1");

    // Wait for navigation away from the login page
    await page.waitForURL((url) => url.pathname !== "/", { timeout: 10000 });

    // Verify access token was stored in localStorage
    const storedToken = await page.evaluate(() =>
      localStorage.getItem("accessToken"),
    );
    expect(storedToken).toBe("mock-jwt-access-token-e2e");

    // Verify user data was persisted with expected structure
    const storedUser = await page.evaluate(() => localStorage.getItem("user"));
    expect(storedUser).not.toBeNull();
    const userData = JSON.parse(storedUser!);
    expect(userData).toMatchObject({
      _id: "user-test-001",
      firstName: "Test",
      company: expect.any(String),
    });
  });

  test("forgot password link navigates to /forgot-password", async ({
    page,
  }) => {
    const authPage = new AuthPage(page);
    await authPage.gotoLogin();

    await authPage.forgotPasswordLink.click();
    await page.waitForURL("**/forgot-password");
  });

  test("sign up link navigates to /signup", async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.gotoLogin();

    await authPage.signUpLink.click();
    await page.waitForURL("**/signup");
  });
});
