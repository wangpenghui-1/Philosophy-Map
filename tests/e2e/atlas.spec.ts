import { expect, test, type Page } from "@playwright/test";

async function openHydrated(page: Page, pathname: string) {
  await page.goto(pathname);
  await expect(page.locator('[data-hydrated="true"]')).toBeVisible();
}

async function waitForHydration(page: Page) {
  await expect(page.locator('[data-hydrated="true"]')).toBeVisible();
}

test("story controls pause and advance the guided narrative", async ({ page }) => {
  await openHydrated(page, "/");
  await expect(page.getByRole("heading", { name: "世界同时开始提问" })).toBeVisible();
  const pause = page.getByRole("button", { name: "暂停故事" });
  await pause.click();
  await expect(page.getByRole("button", { name: "继续故事" })).toBeVisible();
  await page.getByRole("button", { name: "下一章" }).click();
  await expect(page.getByRole("heading", { name: "怎样才算过好一生？" })).toBeVisible();
});

test("search traps focus and links the globe state to the reading page", async ({ page }) => {
  await openHydrated(page, "/explore");
  const trigger = page.getByRole("button", { name: "搜索思想星图" });
  await trigger.focus();
  await trigger.click();
  const input = page.getByPlaceholder("例如：空、德性、Kant、《论语》");
  await expect(input).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await trigger.click();
  await input.fill("Kant");
  await page.getByRole("dialog", { name: "搜索思想星图" }).getByRole("button", { name: /康德/ }).evaluate((button) => (button as HTMLButtonElement).click());
  await expect(page).toHaveURL(/\/explore\?[^#]*thinker=kant/);
  await expect(page.locator('img[src="/media/thinkers/full/kant.webp"]')).toBeVisible();
  await page.getByRole("link", { name: "深入阅读" }).click();
  await expect(page).toHaveURL(/\/thinker\/kant$/);
  await page.getByRole("link", { name: "在3D地球中定位" }).click();
  await waitForHydration(page);
  await expect(page).toHaveURL(/\/explore\?thinker=kant/);
});

test("question and timeline filters are reflected in the exploration URL", async ({ page }) => {
  await openHydrated(page, "/explore");
  await expect(page.getByRole("slider", { name: "历史时间轴" })).toHaveValue("1986");
  await page.getByRole("button", { name: /人是否自由/ }).click();
  await expect(page).toHaveURL(/question=freedom/);
  await page.getByRole("slider", { name: "历史时间轴" }).fill("1000");
  await expect(page).toHaveURL(/year=1000/);
  await page.reload();
  await waitForHydration(page);
  await expect(page.getByRole("button", { name: /人是否自由/ })).toHaveClass(/is-active/);
  await expect(page.getByRole("slider", { name: "历史时间轴" })).toHaveValue("1000");
});

test("two selected thinkers produce and restore a shareable comparison", async ({ page }) => {
  await openHydrated(page, "/explore?thinker=confucius");
  await page.getByRole("button", { name: "加入比较" }).click();
  await page.getByRole("button", { name: "搜索思想星图" }).click();
  await page.getByPlaceholder("例如：空、德性、Kant、《论语》").fill("Aristotle");
  await page.getByRole("dialog", { name: "搜索思想星图" }).getByRole("button", { name: /亚里士多德/ }).click();
  await page.getByRole("button", { name: "加入比较" }).click();
  await expect(page).toHaveURL(/\/compare\/confucius\/aristotle$/);
  await expect(page.getByText("双人物比较")).toBeVisible();

  await page.reload();
  await waitForHydration(page);
  await expect(page.getByText("双人物比较")).toBeVisible();
  await expect(page.getByRole("heading", { name: "孔子" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "亚里士多德" })).toBeVisible();
});

test("knowledge filters and search survive a URL reload", async ({ page }) => {
  await page.goto("/knowledge?q=Kant&type=person&tier=index");
  await expect(page.getByRole("heading", { name: "从人物出发，沿着概念与文本阅读思想史" })).toBeVisible();
  await expect(page.locator('input[name="q"]')).toHaveValue("Kant");
  await expect(page.locator('select[name="type"]')).toHaveValue("person");
  await expect(page.locator('select[name="tier"]')).toHaveValue("index");
  await expect(page.getByRole("link", { name: "康德" })).toBeVisible();
  await page.reload();
  await expect(page.locator('input[name="q"]')).toHaveValue("Kant");
  await expect(page.getByText("索引条目").first()).toBeVisible();
});

test("the complete text explorer remains keyboard accessible", async ({ page }) => {
  await openHydrated(page, "/explore");
  await page.getByRole("button", { name: "打开文字探索" }).click();
  await expect(page.getByRole("dialog", { name: "文字探索" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "关系及其证据" })).toBeVisible();
  await expect(page.getByText("艺术化人物形象", { exact: false }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "文字探索" })).toBeHidden();
});

test("WebGL2 failure automatically opens the complete text fallback", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === "webgl2") return null;
      return original.call(this, type, ...args as []) as RenderingContext | null;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await openHydrated(page, "/explore");
  await expect(page.getByRole("dialog", { name: "文字探索" })).toBeVisible();
  await page.getByRole("button", { name: "返回地球" }).click();
  await expect(page.getByText("3D渲染不可用")).toBeVisible();
  await expect(page.getByRole("button", { name: "重新尝试3D" })).toBeVisible();
});

test("reduced-motion mode keeps story controls usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHydrated(page, "/");
  await page.getByRole("button", { name: "暂停故事" }).click();
  await page.getByRole("button", { name: "下一章" }).click();
  await expect(page.getByRole("heading", { name: "怎样才算过好一生？" })).toBeVisible();
});

test("supported responsive widths have no horizontal overflow or hidden header controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One browser project covers the shared responsive CSS.");
  await openHydrated(page, "/explore");
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width <= 768 ? 844 : 900 });
    const metrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      headerControls: [...document.querySelectorAll<HTMLElement>("header button")].map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
      }),
    }));
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport);
    for (const control of metrics.headerControls) {
      expect(control.width).toBeGreaterThanOrEqual(36);
      expect(control.height).toBeGreaterThanOrEqual(32);
      expect(control.left).toBeGreaterThanOrEqual(0);
      expect(control.right).toBeLessThanOrEqual(metrics.viewport);
    }
  }

  await page.goto("/knowledge");
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width <= 768 ? 844 : 900 });
    const metrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }));
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport);
    expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewport);
  }
});

test("critical interface layers match approved visual snapshots", async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.CI), "Release-candidate snapshots are reviewed locally to avoid platform font drift.");
  const isMobile = testInfo.project.name === "mobile-chromium";
  if (isMobile) {
    await openHydrated(page, "/explore");
    await page.getByRole("button", { name: "打开文字探索" }).click();
    await expect(page.getByRole("dialog", { name: "文字探索" })).toBeVisible();
  } else {
    await page.goto("/thinker/confucius");
    await expect(page.getByRole("img", { name: "孔子的艺术化人物形象" })).toBeVisible();
  }
  await page.locator("canvas").evaluateAll((canvases) => {
    for (const canvas of canvases) (canvas as HTMLElement).style.visibility = "hidden";
  });
  await expect(page).toHaveScreenshot(isMobile ? "mobile-text-explorer.png" : "desktop-thinker-detail.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.06,
  });
});
