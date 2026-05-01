import { test, expect } from "../fixtures/authenticated-test";

test("debug localStorage @desktop", async ({ authenticatedPage }) => {
  await authenticatedPage.goto("/my-qrcodes");

  // Get localStorage content
  const userData = await authenticatedPage.evaluate(() => {
    const raw = localStorage.getItem("user");
    console.log("Raw user data:", raw);
    const parsed = JSON.parse(raw || "{}");
    console.log("Parsed user:", parsed);
    return { raw, parsed, companyId: parsed?.companyId };
  });

  console.log("User data from test:", userData);
  expect(userData.companyId).toBe("comp-test-001");
});
