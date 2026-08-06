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

  await page.goto("/admin/sources?q=Immanuel%20Kant");
  await expect(page.getByRole("heading", { name: "来源资料库" })).toBeVisible();
  await page.getByRole("link", { name: "Immanuel Kant", exact: true }).click();
  await expect(page.getByRole("heading", { name: "来源质量门禁" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "来源版本历史" })).toBeVisible();

  await page.goto("/admin/sources/new");
  await expect(page.getByText("只读来源快照")).toBeVisible();

  await page.goto("/admin/relations");
  await expect(page.getByRole("heading", { name: "关系图谱" })).toBeVisible();
  await page.getByRole("link", { name: "旧正理走向新正理", exact: true }).click();
  await expect(page.getByRole("heading", { name: "关系质量门禁" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "关系版本历史" })).toBeVisible();
  await expect(page.getByText("只读关系快照")).toBeVisible();
  await expect(page.getByRole("button", { name: "创建后继修订" })).toHaveCount(0);

  await page.goto("/admin/journeys");
  await expect(page.getByRole("heading", { name: "思想旅程" })).toBeVisible();
  await page.getByRole("link", { name: "认识论", exact: true }).click();
  await expect(page.getByRole("heading", { name: "旅程发布门禁" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "旅程节点与转场" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "旅程版本历史" })).toBeVisible();
  await expect(page.getByText("只读旅程快照")).toBeVisible();

  await page.goto("/admin/journeys/new");
  await expect(page.getByText("只读旅程快照")).toBeVisible();

  await page.goto("/admin/content/new");
  await expect(page.getByText("只读预览不能创建内容")).toBeVisible();
  await expect(page.getByRole("button", { name: "创建 candidate 版本" })).toBeDisabled();

  await page.getByRole("button", { name: "退出" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
});
