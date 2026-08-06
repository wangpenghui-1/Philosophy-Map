import { expect, test } from "@playwright/test";

test("local owner can enter and leave the read-only admin preview", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.getByRole("heading", { name: "进入思想星图内容后台" })).toBeVisible();

  await page.getByRole("button", { name: "进入本地只读预览" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("你正在查看本地只读预览")).toBeVisible();
  await expect(page.getByRole("heading", { name: "内容治理总览" })).toBeVisible();

  await page.goto("/admin/content?q=康德");
  await expect(page.getByRole("heading", { name: "知识内容" })).toBeVisible();
  await expect(page.getByText("康德", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "康德", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "发布质量门禁" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "逐段引用工作台" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "版本历史" })).toBeVisible();
  await expect(page.getByRole("button", { name: "创建后继修订" })).toHaveCount(0);

  await page.goto("/admin/content/new");
  await expect(page.getByText("只读预览不能创建内容")).toBeVisible();
  await expect(page.getByRole("button", { name: "创建 candidate 版本" })).toBeDisabled();

  await page.getByRole("button", { name: "退出" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
});
