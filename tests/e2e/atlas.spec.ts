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

async function openDisplaySettings(page: Page) {
  await page.getByText("更多", { exact: true }).click();
  await page.getByLabel("打开显示设置").click();
}

async function openTextExplorer(page: Page) {
  await page.getByText("更多", { exact: true }).click();
  await page.getByRole("button", { name: "文字探索", exact: true }).click();
}

test("homepage question cards focus the globe and launch a journey", async ({ page }) => {
  await openHydrated(page, "/");
  await page.mouse.click(900, 300);
  await expect(page.locator(".question-card")).toHaveCount(3);
  await page.getByRole("button", { name: "我们如何知道？：感官、推理与经验" }).click();
  await expect(page).toHaveURL(/\/explore\?question=knowledge&year=2026/);
  await expect(page.getByRole("button", { name: "开始思想旅程" })).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "开始思想旅程" }).click();
  await expect(page.getByRole("heading", { name: "眼前所见，可能只是表象" })).toBeVisible();
  await expect(page.getByText("认识论之旅 · 1/7")).toBeVisible();
  const pause = page.getByRole("button", { name: "暂停旅程" });
  await pause.click();
  await expect(page.getByRole("button", { name: "继续旅程" })).toBeVisible();
  await page.getByRole("button", { name: "下一站" }).click();
  await expect(page.getByRole("heading", { name: "把“知道”拆成不同渠道" })).toBeVisible();
  await expect(page.getByText("平行回答", { exact: true })).toBeVisible();
});

test("intro uses full, quick, skip, and reduced-motion timing", async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem("atlas-intro-test-ready")) {
      window.localStorage.clear();
      window.sessionStorage.setItem("atlas-intro-test-ready", "1");
    }
    const introSequences: string[] = [];
    (window as typeof window & { __atlasIntroSequences?: string[] }).__atlasIntroSequences = introSequences;
    const recordIntroSequence = () => {
      document.querySelectorAll<HTMLElement>("[data-intro-sequence]").forEach((element) => {
        const sequence = element.dataset.introSequence;
        if (sequence && !introSequences.includes(sequence)) introSequences.push(sequence);
      });
    };
    new MutationObserver(recordIntroSequence).observe(document, {
      attributes: true,
      attributeFilter: ["data-intro-sequence"],
      childList: true,
      subtree: true,
    });
  });
  await page.goto("/");
  await waitForHydration(page);
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __atlasIntroSequences?: string[] }).__atlasIntroSequences ?? []
  ))).toContain("full");
  await page.keyboard.press("Tab");
  await expect(page.locator("[data-intro-sequence]")).toHaveCount(0);

  await page.reload();
  await waitForHydration(page);
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __atlasIntroSequences?: string[] }).__atlasIntroSequences ?? []
  ))).toContain("quick");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await waitForHydration(page);
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __atlasIntroSequences?: string[] }).__atlasIntroSequences ?? []
  ))).toContain("reduced");
  await expect(page.locator("[data-intro-sequence]")).toHaveCount(0, { timeout: 1_500 });
});

test("v1 preferences migrate while homepage selection and camera state reset", async ({ page }) => {
  test.slow();
  await page.goto("/explore");
  await page.evaluate(() => localStorage.setItem("atlas-visual-state:v1", JSON.stringify({
    version: 1,
    entrySeen: true,
    mode: "explore",
    timelineYear: 1000,
    questionId: "freedom",
    thinkerSlug: "kant",
    relationId: "hume-kant",
    earthMode: "day",
    qualityPreference: "high",
    camera: { position: [0, 1, 5], target: [0, 0, 0], distance: 5.1 },
  })));
  await openHydrated(page, "/");
  await page.mouse.click(900, 300);
  await expect(page.locator(".question-card")).toHaveCount(3);
  await expect(page.locator(".detail-pane")).not.toHaveClass(/detail-pane--active/);
  await expect(page.getByRole("slider", { name: "历史时间轴" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "历史时间轴" })).toHaveValue("2026");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("atlas-visual-state:v2") ?? "{}").qualityPreference)).toBe("high");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("atlas-visual-state:v2") ?? "{}").earthMode)).toBe("day");
  await expect(page.evaluate(() => localStorage.getItem("atlas-visual-state:v1"))).resolves.not.toBeNull();
});

test("question hover is temporary, deep links skip intro, and relation controls only filter", async ({ page }) => {
  await openHydrated(page, "/explore");
  const initialUrl = page.url();
  const reality = page.getByRole("button", { name: "世界是什么？：存在、物质与真实" });
  await reality.hover();
  await expect(page).toHaveURL(initialUrl);
  await expect(page.locator(".detail-pane")).not.toHaveClass(/detail-pane--active/);

  await page.getByText(/^关系 /).click();
  const directInfluence = page.getByRole("button", { name: "有文献依据的直接影响" });
  await expect(directInfluence).toHaveAttribute("aria-pressed", "true");
  await directInfluence.click();
  await expect(directInfluence).toHaveAttribute("aria-pressed", "false");
  await expect(page).toHaveURL(initialUrl);
  await expect(page.locator(".detail-pane")).not.toHaveClass(/detail-pane--active/);

  await openHydrated(page, "/explore?question=self&year=2026");
  await expect(page.locator("[data-intro-sequence]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "开始思想旅程" })).toBeVisible();
});

test("all eight journey routes open the shared player", async ({ page }) => {
  test.slow();
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
  const progress = await page.getByText(/存在主义之旅 · 1\/\d+/).textContent();
  const stopCount = Number(progress?.match(/1\/(\d+)/)?.[1]);
  expect(stopCount).toBeGreaterThan(1);
  for (let index = 1; index < stopCount; index += 1) {
    await page.getByRole("button", { name: "下一站" }).dispatchEvent("click");
  }
  await page.getByRole("button", { name: "完成旅程" }).dispatchEvent("click");
  await expect(page.getByRole("button", { name: "继续：自由意志" })).toBeVisible();
  await expect(page.getByRole("button", { name: "进入自由探索" })).toBeVisible();
});

test("touching the globe pauses the journey and details stay paused until resumed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Pointer interruption is covered once on the reference desktop project.");
  await openHydrated(page, "/journey/epistemology");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Missing globe canvas bounds");
  const resumeJourney = page.getByRole("button", { name: "继续旅程" });
  for (let attempt = 0; attempt < 3 && !(await resumeJourney.isVisible()); attempt += 1) {
    await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * (0.66 - attempt * 0.02), box.y + box.height * 0.52, { steps: 4 });
    await page.mouse.up();
  }
  await expect(resumeJourney).toBeVisible();

  await resumeJourney.click();
  await expect(page.getByRole("button", { name: "暂停旅程" })).toBeVisible();
  const visibleMarker = page.locator('.globe-marker[data-visible="true"]').first();
  await expect(visibleMarker).toBeVisible();
  await visibleMarker.dispatchEvent("click");
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
  await openDisplaySettings(page);
  await page.getByRole("button", { name: "白昼" }).click();
  await page.getByRole("button", { name: /典藏/ }).click();
  await expect(page.locator('canvas[data-visual-probe="stable"]')).toBeVisible();
  await expect(page.locator(".globe-runtime")).toHaveAttribute("data-render-effects", "smaa");
  await expect(page.locator(".globe-runtime")).toHaveAttribute("data-render-effects", "bloom-smaa", { timeout: 5_000 });
  await expect.poll(() => page.locator(".globe-runtime").getAttribute("data-render-dpr")).not.toBeNull();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("atlas-visual-state:v2") ?? "{}").qualityPreference)).toBe("high");
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

test("search traps focus and links the globe state to the reading page", async ({ page }, testInfo) => {
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
  if (testInfo.project.name === "desktop-chromium") {
    await expect(page.locator(".globe-marker--selected")).toHaveAttribute("data-visible", "true");
  }
});

test("question and timeline filters are reflected in the exploration URL", async ({ page }) => {
  await openHydrated(page, "/explore");
  await expect(page.getByRole("slider", { name: "历史时间轴" })).toHaveValue("2026");
  await page.getByRole("button", { name: "全部问题" }).click();
  await page.getByRole("button", { name: /我们真的自由吗/ }).click();
  await expect(page).toHaveURL(/question=freedom/);
  await page.getByRole("slider", { name: "历史时间轴" }).fill("1000");
  await expect(page).toHaveURL(/year=1000/);
  await page.reload();
  await waitForHydration(page);
  await expect(page.getByRole("button", { name: /我们真的自由吗/ })).toHaveClass(/is-active/);
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
  await expect(page.getByRole("button", { name: /怎样过好一生/ })).toHaveClass(/is-active/);
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
  await page.goto("/knowledge?q=Kant&type=person&tier=standard");
  await expect(page.getByRole("heading", { name: "从人物出发，沿着概念与文本阅读思想史" })).toBeVisible();
  await expect(page.locator('input[name="q"]')).toHaveValue("Kant");
  await expect(page.locator('select[name="type"]')).toHaveValue("person");
  await expect(page.locator('select[name="tier"]')).toHaveValue("standard");
  await expect(page.getByRole("link", { name: "康德" })).toBeVisible();
  await page.reload();
  await expect(page.locator('input[name="q"]')).toHaveValue("Kant");
  await expect(page.locator('select[name="tier"]')).toHaveValue("standard");
  await expect(page.getByRole("link", { name: "康德" })).toBeVisible();
});

test("the complete text explorer remains keyboard accessible", async ({ page }) => {
  await openHydrated(page, "/explore");
  await openTextExplorer(page);
  await expect(page.getByRole("dialog", { name: "文字探索" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "关系及其证据" })).toBeVisible();
  await expect(page.getByText("艺术化人物形象", { exact: false }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "文字探索" })).toBeHidden();
});

test("text explorer portraits keep their vertical frames without cropping", async ({ page }) => {
  await openHydrated(page, "/explore");
  await openTextExplorer(page);
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
  await expect(page.getByText("正在释放旧画布，并以稳定画质恢复当前位置。")).toBeVisible();
  await expect(page.getByText("显卡仍在恢复，请稍后再次检测。")).toBeVisible();
  await page.locator(".globe-fallback").getByRole("button", { name: "打开文字探索" }).click();
  await expect(page.getByRole("dialog", { name: "文字探索" })).toBeVisible();
});

test("runtime WebGL loss waits for native recovery before remounting the canvas", async ({ page }, testInfo) => {
  await openHydrated(page, "/explore?thinker=kant");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-webgl-lifecycle", "ready");
  if (testInfo.project.name === "desktop-chromium") {
    await expect(page.locator('.globe-marker--selected[data-visible="true"]')).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "康德" })).toBeVisible();
  }
  await canvas.evaluate((element) => { element.dataset.contextProbe = "before-retry"; });
  await canvas.evaluate((element) => {
    element.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  });

  await expect(page.getByRole("dialog", { name: "文字探索" })).toBeHidden();
  await expect(page.getByText("3D渲染暂时中断")).toBeVisible();
  await expect(page.getByRole("button", { name: "等待显卡恢复…" })).toBeDisabled();
  await expect(page.getByText("正在释放旧画布，并以稳定画质恢复当前位置。")).toBeVisible({ timeout: 6_000 });
  await expect(page.getByText("3D渲染暂时中断")).toBeHidden({ timeout: 6_000 });
  await expect(page.locator("canvas")).toBeVisible({ timeout: 8_000 });
  await expect(page.locator('canvas[data-context-probe="before-retry"]')).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(1);
  if (testInfo.project.name === "desktop-chromium") {
    await expect(page.locator('.globe-marker--selected[data-visible="true"]')).toBeVisible({ timeout: 8_000 });
  } else {
    await expect(page.getByRole("heading", { name: "康德" })).toBeVisible();
  }
});

test("native WebGL restoration keeps the existing canvas and camera", async ({ page }) => {
  await openHydrated(page, "/explore");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-webgl-lifecycle", "ready");
  await canvas.evaluate((element) => { element.dataset.nativeRestoreProbe = "stable"; });
  await canvas.evaluate((element) => {
    element.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  });
  await expect(page.getByText("3D渲染暂时中断")).toBeVisible();
  await canvas.evaluate((element) => {
    element.dispatchEvent(new Event("webglcontextrestored"));
  });
  await expect(page.getByText("3D渲染暂时中断")).toBeHidden();
  await expect(page.locator('canvas[data-native-restore-probe="stable"]')).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("Windows Edge uses the stable-high GPU profile after an unclean renderer exit", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      get: () => "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0",
    });
    window.sessionStorage.setItem("atlas-edge-gpu-session:v1", "active");
    const original = HTMLCanvasElement.prototype.getContext;
    const preferences: string[] = [];
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, options?: unknown) {
      if (type === "webgl2" && options && typeof options === "object" && "powerPreference" in options) {
        preferences.push(String((options as { powerPreference?: unknown }).powerPreference));
      }
      return original.call(this, type, options as never) as RenderingContext | null;
    } as typeof HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(window, "__atlasPowerPreferences", { get: () => preferences });
  });

  await openHydrated(page, "/explore");
  await expect(page.getByText("正在点亮思想星图")).toBeVisible();
  const runtime = page.locator(".globe-runtime");
  await expect(runtime).toHaveAttribute("data-gpu-profile", "edge-stable", { timeout: 6_000 });
  await openDisplaySettings(page);
  await page.getByRole("button", { name: /典藏/ }).click();
  await expect(runtime).toHaveAttribute("data-render-effects", "smaa", { timeout: 5_000 });
  await expect.poll(async () => Number(await runtime.getAttribute("data-render-dpr"))).toBeLessThanOrEqual(1.25);
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __atlasPowerPreferences: string[] }
  ).__atlasPowerPreferences.every((value) => value === "default"))).toBe(true);
});

test("WebGL capability detection never deliberately loses a healthy context", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    let deliberateLosses = 0;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      const context = original.call(this, type, ...args as []) as RenderingContext | null;
      if (type === "webgl2" && context && "getExtension" in context) {
        const originalGetExtension = context.getExtension.bind(context);
        context.getExtension = ((name: string) => {
          const extension = originalGetExtension(name);
          if (name === "WEBGL_lose_context" && extension) {
            return {
              ...extension,
              loseContext: () => { deliberateLosses += 1; },
            };
          }
          return extension;
        }) as typeof context.getExtension;
      }
      return context;
    } as typeof HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(window, "__atlasDeliberateWebglLosses", {
      get: () => deliberateLosses,
    });
  });
  await openHydrated(page, "/explore");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __atlasDeliberateWebglLosses: number }).__atlasDeliberateWebglLosses)).toBe(0);
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
  await openHydrated(page, "/journey/epistemology");
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

test("public pages keep visible text at or above the 11px floor", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Typography is shared; one desktop browser audits computed styles.");
  await page.setViewportSize({ width: 1440, height: 900 });
  const paths = [
    "/",
    "/explore?thinker=kant",
    "/journey/epistemology",
    "/thinker/kant",
    "/knowledge",
    "/compare/confucius/aristotle",
    "/chat",
    "/account/login",
    "/journeys",
  ];
  for (const path of paths) {
    await page.goto(path);
    await expect(page.locator("body")).toBeVisible();
    const offenders = await page.evaluate(() => [...document.body.querySelectorAll<HTMLElement>("*")]
      .filter((element) => {
        if (element.closest('[aria-hidden="true"]')) return false;
        if (![...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) return false;
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && Number(style.opacity) > 0
          && bounds.width > 0
          && bounds.height > 0
          && Number.parseFloat(style.fontSize) < 11;
      })
      .slice(0, 20)
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}:${getComputedStyle(element).fontSize}:${element.textContent?.trim().slice(0, 24)}`));
    expect(offenders, `${path} has undersized visible text`).toEqual([]);
  }
});

test("mobile details use the three-stage bottom sheet", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile sheet behavior only applies to compact layouts.");
  await openHydrated(page, "/explore?thinker=kant");
  const detail = page.locator(".detail-pane");
  await expect(detail).toHaveAttribute("data-snap", "half");
  await page.getByRole("button", { name: "调整详情面板高度" }).click();
  await expect(detail).toHaveAttribute("data-snap", "full");
});

test("homepage first screen matches desktop and mobile visual snapshots", async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.CI), "First-screen snapshots are reviewed on the reference machine.");
  const isMobile = testInfo.project.name === "mobile-chromium";
  await page.setViewportSize(isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await openHydrated(page, "/");
  await expect(page.getByRole("heading", { name: "你想先追问什么？" })).toBeVisible();
  await page.waitForTimeout(1800);
  await expect(page).toHaveScreenshot(isMobile ? "mobile-atlas-first-screen-390x844.png" : "desktop-atlas-first-screen-1440x900.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.1,
  });
});

test("critical interface layers match approved visual snapshots", async ({ page }, testInfo) => {
  test.skip(Boolean(process.env.CI), "Release-candidate snapshots are reviewed locally to avoid platform font drift.");
  const isMobile = testInfo.project.name === "mobile-chromium";
  if (isMobile) {
    await openHydrated(page, "/explore");
    await openTextExplorer(page);
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
  await openDisplaySettings(page);
  await page.getByRole("button", { name: "白昼" }).click();
  await page.getByLabel("打开显示设置").click();
  await page.getByText("更多", { exact: true }).click();
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
