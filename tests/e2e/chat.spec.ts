import { expect, test } from "@playwright/test";

test("anonymous reader can receive a grounded answer with visible citations", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.getByRole("heading", { name: "有据可查的哲学对话" })).toBeVisible();
  const input = page.getByRole("textbox", { name: "输入哲学问题" });
  await input.fill("康德的认识论为什么需要批判？");
  await page.getByRole("button", { name: "发送问题" }).click();
  await expect(page.getByText("思想星图", { exact: true })).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "思想星图" }).locator("ol")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/extractive-grounding-v1/)).toBeVisible();
});
