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
