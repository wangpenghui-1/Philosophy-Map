import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const atlasData = JSON.parse(readFileSync(new URL("../../app/_generated/atlas.json", import.meta.url), "utf8"));

async function openHydrated(page: Page, pathname: string) {
  await page.goto(pathname);
  await expect(page.locator('[data-hydrated="true"]')).toBeVisible();
}

async function waitForHydration(page: Page) {
  await expect(page.locator('[data-hydrated="true"]')).toBeVisible();
}

test("epistemology journey pauses and advances without losing its place", async ({ page }) => {
  await openHydrated(page, "/");
  await expect(page.getByRole("heading", { name: "开启一次思想旅程" })).toBeVisible();
  const journeyCards = page.locator(".journey-deck-card");
  await expect(journeyCards).toHaveCount(8);
  const activeJourneyCard = page.locator(".journey-deck-card.is-active");
  await expect(activeJourneyCard).toContainText("认识论");
  await activeJourneyCard.click();
  await expect(page.getByRole("heading", { name: "眼前所见，可能只是表象" })).toBeVisible();
  await expect(page.getByText("认识论之旅 · 1/7")).toBeVisible();
  const pause = page.getByRole("button", { name: "暂停旅程" });
  await pause.click();
  await expect(page.getByRole("button", { name: "继续旅程" })).toBeVisible();
  await page.getByRole("button", { name: "下一站" }).click();
  await expect(page.getByRole("heading", { name: "把“知道”拆成不同渠道" })).toBeVisible();
  await expect(page.getByText("平行回答", { exact: true })).toBeVisible();
});

test("journey deck cycles with wheel, focuses side cards, and exposes sound control", async ({ page }) => {
  await openHydrated(page, "/");
  const deck = page.locator(".journey-deck");
  const activeCard = page.locator(".journey-deck-card.is-active");
  await expect(activeCard).toContainText("认识论");
  await expect(page.getByRole("button", { name: "关闭卡片切换音效" })).toHaveAttribute("aria-pressed", "true");

  await deck.hover();
  await page.mouse.wheel(0, 120);
  await expect(activeCard).toContainText("本体论");

  const nextSideCard = page.locator('.journey-deck-card[data-offset="1"]');
  await expect(nextSideCard).toHaveCount(1);
  await nextSideCard.click();
  await expect(activeCard).toContainText("存在主义");
  await expect(page).toHaveURL(/\/$/);

  const deckBox = await deck.boundingBox();
  if (!deckBox) throw new Error("Missing journey deck bounds");
  await page.mouse.move(deckBox.x + deckBox.width * 0.56, deckBox.y + deckBox.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(deckBox.x + deckBox.width * 0.34, deckBox.y + deckBox.height * 0.55, { steps: 5 });
  await page.mouse.up();
  await expect(activeCard).toContainText("现象学");

  await page.getByRole("button", { name: "关闭卡片切换音效" }).click();
  await expect(page.getByRole("button", { name: "开启卡片切换音效" })).toHaveAttribute("aria-pressed", "false");
});

test("all visitors see the new entry once and returning visitors resume exploration", async ({ page }) => {
  await page.goto("/explore");
  await page.evaluate(() => localStorage.setItem("atlas-visual-state:v1", JSON.stringify({
    version: 1,
    entrySeen: true,
    mode: "explore",
    timelineYear: 1000,
    questionId: null,
    thinkerSlug: null,
    relationId: null,
    earthMode: "night",
    qualityPreference: "auto",
    camera: null,
  })));
  await openHydrated(page, "/");
  await expect(page.getByRole("heading", { name: "开启一次思想旅程" })).toBeVisible();
  await page.getByRole("button", { name: "跳过，进入地图" }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("atlas-journey-intro:v2"))).toBe("seen");
  await expect(page).toHaveURL(/\/explore\?from=journey-skip/);
  await page.goto("/");
  await waitForHydration(page);
  await expect(page.getByRole("button", { name: "探索", exact: true })).toHaveClass(/is-active/);
  await expect(page.getByRole("slider", { name: "历史时间轴" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "开启一次思想旅程" })).toBeHidden();
});

test("all eight journey routes open the shared player", async ({ page }) => {
  const journeys = [
    ["free-will", "自由意志"],
    ["knowledge-world", "认识世界"],
    ["happiness", "幸福"],
    ["justice", "正义"],
    ["epistemology", "认识论"],
    ["ontology", "本体论"],
    ["existentialism", "存在主义"],
    ["phenomenology", "现象学"],
  ];
  for (const [id, title] of journeys) {
    await openHydrated(page, `/journey/${id}`);
    await expect(page.getByText(new RegExp(`${title}之旅 · 1/`))).toBeVisible();
  }
});

test("a completed journey offers the related journey and free exploration", async ({ page }) => {
  await openHydrated(page, "/journey/existentialism");
  await page.getByRole("button", { name: "暂停旅程" }).click();
  for (let index = 0; index < 5; index += 1) await page.getByRole("button", { name: "下一站" }).click();
  await page.getByRole("button", { name: "完成旅程" }).click();
  await expect(page.getByRole("button", { name: "继续：自由意志" })).toBeVisible();
  await expect(page.getByRole("button", { name: "进入自由探索" })).toBeVisible();
});

test("touching the globe pauses the journey and details stay paused until resumed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Pointer interruption is covered once on the reference desktop project.");
  await openHydrated(page, "/");
  await page.locator(".journey-deck-card.is-active").click();
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Missing globe canvas bounds");
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.66, box.y + box.height * 0.52, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "继续旅程" })).toBeVisible();

  await page.getByRole("button", { name: "继续旅程" }).click();
  await expect(page.getByRole("button", { name: "暂停旅程" })).toBeVisible();
  const visibleMarker = page.locator('.globe-marker[data-visible="true"]').first();
  await expect(visibleMarker).toBeVisible();
  await visibleMarker.click();
  await expect(page.getByRole("button", { name: "继续旅程" })).toBeVisible();
  await expect(page.getByRole("button", { name: "关闭人物详情" })).toBeVisible();
  await page.getByRole("button", { name: "关闭人物详情" }).click();
  await expect(page.getByRole("button", { name: "继续旅程" })).toBeVisible();
});

test("display settings preserve the canvas while changing light and quality", async ({ page }) => {
  await openHydrated(page, "/explore");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await canvas.evaluate((element) => { element.dataset.visualProbe = "stable"; });
  await page.getByLabel("打开显示设置").click();
  await page.getByRole("button", { name: "白昼" }).click();
  await page.getByRole("button", { name: /典藏/ }).click();
  await expect(page.locator('canvas[data-visual-probe="stable"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("atlas-visual-state:v1") ?? "{}").qualityPreference)).toBe("high");
});

test("selected thinkers expose relationship focus depth", async ({ page }, testInfo) => {
  await openHydrated(page, "/explore?thinker=kant");
  await expect(page.getByRole("group", { name: "思想关系聚焦范围" })).toBeVisible();
  await page.getByRole("button", { name: "两度" }).click();
  await expect(page.getByRole("button", { name: "两度" })).toHaveClass(/is-active/);
  if (testInfo.project.name === "desktop-chromium") {
    await expect.poll(() => page.locator('.globe-marker--dimmed[data-visible="true"]').count()).toBeGreaterThan(0);
  }
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
  await expect(page.locator('img.thinker-portrait__image[src="/media/thinkers/full/kant.webp"]')).toBeVisible();
  await page.getByRole("link", { name: "深入阅读" }).click();
  await expect(page).toHaveURL(/\/thinker\/kant$/);
  await page.getByRole("link", { name: "在3D地球中定位" }).click();
  await waitForHydration(page);
  await expect(page).toHaveURL(/\/explore\?thinker=kant/);
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("3D渲染不可用")).toBeHidden();
});

test("question and timeline filters are reflected in the exploration URL", async ({ page }) => {
  await openHydrated(page, "/explore");
  await expect(page.getByRole("slider", { name: "历史时间轴" })).toHaveValue("2026");
  await page.getByRole("button", { name: /人是否自由/ }).click();
  await expect(page).toHaveURL(/question=freedom/);
  await page.getByRole("slider", { name: "历史时间轴" }).fill("1000");
  await expect(page).toHaveURL(/year=1000/);
  await page.reload();
  await waitForHydration(page);
  await expect(page.getByRole("button", { name: /人是否自由/ })).toHaveClass(/is-active/);
  await expect(page.getByRole("slider", { name: "历史时间轴" })).toHaveValue("1000");
});

test("closing a detail pane clears the selection and preserves exploration filters", async ({ page }) => {
  await openHydrated(page, "/explore?thinker=confucius&question=good-life&year=1000");
  await expect(page.getByRole("heading", { name: "孔子" })).toBeVisible();
  await page.getByRole("button", { name: "关闭人物详情" }).click();
  await expect(page).toHaveURL(/\/explore\?question=good-life&year=1000$/);
  await expect(page.locator(".detail-pane")).not.toHaveClass(/detail-pane--active/);

  await page.reload();
  await waitForHydration(page);
  await expect(page.getByRole("slider", { name: "历史时间轴" })).toHaveValue("1000");
  await expect(page.getByRole("button", { name: /怎样才算过好一生/ })).toHaveClass(/is-active/);
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

test("text explorer portraits keep their vertical frames without cropping", async ({ page }) => {
  await openHydrated(page, "/explore");
  await page.getByRole("button", { name: "打开文字探索" }).click();
  const portraits = page.locator(".semantic-panel__grid .thinker-portrait");
  await expect(portraits).toHaveCount(atlasData.thinkers.length);

  const framings = await portraits.evaluateAll((elements) => elements.map((element) => {
    const image = element.querySelector(".thinker-portrait__image");
    if (!image) return null;
    const frame = element.getBoundingClientRect();
    return {
      frameAspect: frame.width / frame.height,
      objectFit: getComputedStyle(image).objectFit,
    };
  }));

  for (const framing of framings) {
    expect(framing).not.toBeNull();
    if (!framing) throw new Error("Missing text explorer portrait");
    expect(Math.abs(framing.frameAspect - 4 / 5)).toBeLessThanOrEqual(0.01);
    expect(framing.objectFit).toBe("contain");
  }
});

test("WebGL2 failure stays on the globe fallback until text exploration is requested", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === "webgl2") return null;
      return original.call(this, type, ...args as []) as RenderingContext | null;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await openHydrated(page, "/explore");
  await expect(page.getByRole("dialog", { name: "文字探索" })).toBeHidden();
  await expect(page.getByText("3D渲染不可用")).toBeVisible();
  await page.getByRole("button", { name: "重新尝试3D" }).click();
  await expect(page.getByText("本次恢复未成功，请稍后再试。")).toBeVisible();
  await page.locator(".globe-fallback").getByRole("button", { name: "打开文字探索" }).click();
  await expect(page.getByRole("dialog", { name: "文字探索" })).toBeVisible();
});

test("runtime WebGL loss remains in place and retry remounts the canvas", async ({ page }) => {
  await openHydrated(page, "/explore");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-webgl-lifecycle", "ready");
  await canvas.evaluate((element) => { element.dataset.contextProbe = "before-retry"; });
  await canvas.evaluate((element) => {
    element.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  });

  await expect(page.getByRole("dialog", { name: "文字探索" })).toBeHidden();
  await expect(page.getByText("3D渲染暂时中断")).toBeVisible();
  await page.getByRole("button", { name: "重新尝试3D" }).click();
  await expect(page.getByText("3D渲染暂时中断")).toBeHidden();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator('canvas[data-context-probe="before-retry"]')).toHaveCount(0);
});

test("full detail portraits retain their source frames without cropping heads", async ({ page }) => {
  for (const thinkerId of ["dai-zhen", "aquinas"]) {
    await openHydrated(page, `/explore?thinker=${thinkerId}`);
    const portrait = page.locator(".detail-card .thinker-portrait--full");
    const image = portrait.locator(".thinker-portrait__image");
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element) => {
      const portraitImage = element as HTMLImageElement;
      return portraitImage.complete && portraitImage.naturalWidth > 0;
    })).toBe(true);

    const framing = await portrait.evaluate((element) => {
      const image = element.querySelector(".thinker-portrait__image");
      if (!(image instanceof HTMLImageElement)) return null;
      const frame = element.getBoundingClientRect();
      const scale = Math.min(frame.width / image.naturalWidth, frame.height / image.naturalHeight);
      return {
        objectFit: getComputedStyle(image).objectFit,
        horizontalOverflow: Math.max(0, image.naturalWidth * scale - frame.width),
        verticalOverflow: Math.max(0, image.naturalHeight * scale - frame.height),
      };
    });

    expect(framing).not.toBeNull();
    if (!framing) throw new Error(`Missing full portrait for ${thinkerId}`);
    expect(framing.objectFit).toBe("contain");
    expect(framing.horizontalOverflow).toBeLessThanOrEqual(0.5);
    expect(framing.verticalOverflow).toBeLessThanOrEqual(0.5);
  }
});

test("globe keeps its visible portrait markers within budget while selected people and relations remain readable", async ({ page }, testInfo) => {
  const budget = testInfo.project.name === "mobile-chromium" ? 16 : 36;
  await openHydrated(page, "/explore?thinker=kant");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByRole("heading", { name: "康德" })).toBeVisible();
  await expect.poll(() => page.locator('.globe-marker[data-visible="true"]').count())
    .toBeLessThanOrEqual(budget);

  await openHydrated(page, "/explore?relation=hume-kant");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("因果怀疑唤醒批判哲学", { exact: false })).toBeVisible();
  await expect.poll(() => page.locator('.globe-marker[data-visible="true"]').count())
    .toBeLessThanOrEqual(budget);
});

test("reduced-motion mode keeps story controls usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHydrated(page, "/");
  await page.locator(".journey-deck-card.is-active").click();
  await page.getByRole("button", { name: "暂停旅程" }).click();
  await page.getByRole("button", { name: "下一站" }).click();
  await expect(page.getByRole("heading", { name: "把“知道”拆成不同渠道" })).toBeVisible();
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

test("mobile details use the three-stage archive sheet", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile sheet behavior only applies to compact layouts.");
  await openHydrated(page, "/explore?thinker=kant");
  const detail = page.locator(".detail-pane");
  await expect(detail).toHaveAttribute("data-snap", "half");
  await page.getByRole("button", { name: "调整详情面板高度" }).click();
  await expect(detail).toHaveAttribute("data-snap", "full");
});

test("homepage journey entry matches desktop and mobile visual snapshots", async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.CI), "Journey-entry snapshots are reviewed on the reference machine.");
  const isMobile = testInfo.project.name === "mobile-chromium";
  await page.setViewportSize(isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await openHydrated(page, "/");
  await expect(page.getByRole("heading", { name: "开启一次思想旅程" })).toBeVisible();
  await page.waitForTimeout(1800);
  await expect(page).toHaveScreenshot(isMobile ? "mobile-journey-entry-390x844.png" : "desktop-journey-entry-1440x900.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.1,
  });
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

test("cinematic museum views match the release-candidate visual set", async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.CI), "WebGL release-candidate snapshots are reviewed on the reference machine.");
  const isMobile = testInfo.project.name === "mobile-chromium";

  if (isMobile) {
    await page.setViewportSize({ width: 390, height: 844 });
    await openHydrated(page, "/explore?thinker=kant");
    await expect(page.getByRole("heading", { name: "康德" })).toBeVisible();
    await page.waitForTimeout(1300);
    await expect(page).toHaveScreenshot("mobile-thinker-sheet-390x844.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.08,
    });

    await page.goto("/knowledge?type=person");
    await expect(page.getByRole("heading", { name: "从人物出发，沿着概念与文本阅读思想史" })).toBeVisible();
    await expect(page.locator(".knowledge-card__portrait").first()).toBeVisible();
    await expect(page).toHaveScreenshot("mobile-knowledge-390x844.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.06,
    });

    await page.goto("/thinker/confucius");
    await expect(page.getByRole("img", { name: "孔子的艺术化人物形象" })).toBeVisible();
    await expect(page).toHaveScreenshot("mobile-thinker-reading-390x844.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.06,
    });
    return;
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await openHydrated(page, "/story/world-asks");
  await page.getByRole("button", { name: "暂停故事" }).click();
  await page.waitForTimeout(1800);
  await expect(page).toHaveScreenshot("desktop-story-night-1440x900.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.1,
  });

  await page.setViewportSize({ width: 1024, height: 768 });
  await openHydrated(page, "/explore");
  await page.waitForTimeout(1300);
  await expect(page).toHaveScreenshot("tablet-explore-empty-1024x768.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.1,
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await openHydrated(page, "/explore?thinker=kant");
  await expect(page.getByRole("heading", { name: "康德" })).toBeVisible();
  await page.waitForTimeout(1300);
  await expect(page).toHaveScreenshot("desktop-thinker-focus-1440x900.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.1,
  });

  await openHydrated(page, "/explore?relation=hume-kant");
  await expect(page.getByText("因果怀疑唤醒批判哲学", { exact: false })).toBeVisible();
  await page.waitForTimeout(1300);
  await expect(page).toHaveScreenshot("desktop-relation-focus-1440x900.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.1,
  });

  await page.setViewportSize({ width: 1024, height: 768 });
  await openHydrated(page, "/explore");
  await page.getByLabel("打开显示设置").click();
  await page.getByRole("button", { name: "白昼" }).click();
  await page.getByLabel("打开显示设置").click();
  await page.waitForTimeout(1300);
  await expect(page).toHaveScreenshot("tablet-explore-day-1024x768.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.1,
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/knowledge?type=person");
  await expect(page.locator(".knowledge-card__portrait").first()).toBeVisible();
  await expect(page).toHaveScreenshot("desktop-knowledge-1440x900.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.06,
  });
});
