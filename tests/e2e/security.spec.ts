import { expect, test } from "@playwright/test";

test("security headers preserve chat and WebGL application boot", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  const chat = await page.goto("/chat");
  expect(chat?.status()).toBe(200);
  expect(chat?.headers()["content-security-policy"]).toContain("script-src 'self' 'nonce-");
  expect(chat?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(chat?.headers()["x-request-id"]).toBeTruthy();
  await expect(page.getByRole("heading", { name: "有据可查的哲学对话" })).toBeVisible();

  const explore = await page.goto("/explore");
  expect(explore?.status()).toBe(200);
  await expect(page.getByRole("region", { name: "思想星图3D地球" })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.waitForTimeout(1_000);

  expect(browserErrors).toEqual([]);
});
