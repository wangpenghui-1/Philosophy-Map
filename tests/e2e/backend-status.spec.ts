import { expect, test } from "@playwright/test";

test("backend status cards inspect API responses without leaving the page", async ({ page }) => {
  await page.goto("/backend-status");

  await page.getByRole("button", { name: /公开目录/ }).click();

  await expect(page).toHaveURL(/\/backend-status$/);
  await expect(page.getByText("HTTP 200 OK")).toBeVisible();
  await expect(page.getByText(/published-static-snapshot/)).toBeVisible();
  await expect(page.getByText(/"people": 213/)).toBeVisible();
});
