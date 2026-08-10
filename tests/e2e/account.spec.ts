import { expect, test } from "@playwright/test";

test("member entry points remain clear when external account services are absent", async ({ page }) => {
  await page.goto("/account/login");
  await expect(page.getByRole("heading", { name: "登录思想星图" })).toBeVisible();
  await expect(page.getByText("当前环境尚未配置数据库和邮件服务")).toBeVisible();
  await expect(page.getByRole("button", { name: "登录" })).toBeDisabled();
  await page.getByRole("link", { name: "创建账户" }).click();
  await expect(page).toHaveURL(/\/account\/register$/);
  await expect(page.getByRole("heading", { name: "创建会员账户" })).toBeVisible();
  await expect(page.getByRole("button", { name: "发送验证邮件" })).toBeDisabled();
});

test("protected account center redirects anonymous readers to member login", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account\/login\?next=%2Faccount$/);
});

test("account pages remain vertically scrollable on short screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto("/account/register");

  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(500);
  await page.mouse.wheel(0, 700);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});
