import { test, expect, type Page, type TestInfo } from "@playwright/test";

async function ready(page: Page) {
  await expect(page.locator(".loading")).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator("canvas")).toHaveCount(1);
}

async function chooseHeart(page: Page) {
  await page.getByRole("button", { name: "搜索解剖结构", exact: true }).click();
  await page.getByRole("combobox").fill("心脏");
  await expect(page.getByRole("option").first()).toContainText("心脏");
  await expect(page.getByRole("option").first().locator("mark")).toContainText("心脏");
  await page.getByRole("combobox").press("ArrowDown");
  await page.getByRole("combobox").press("Enter");
  await expect(page.locator(".detail-sheet")).toBeVisible();
}

// Decode a screenshot through the browser's image decoder to inspect the actual rendered model.
async function modelPixels(page: Page, allowEmpty = false) {
  const png = await page.locator("canvas").screenshot({
    style:
      ".studio > :not(.scene), [data-slot=sheet-content], [data-slot=sheet-overlay] { visibility:hidden !important; }",
  });
  const pixels = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0,
      left = canvas.width,
      right = 0,
      top = canvas.height,
      bottom = 0;
    for (let y = 0; y < canvas.height; y++)
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (
          Math.max(data[i], data[i + 1], data[i + 2]) -
            Math.min(data[i], data[i + 1], data[i + 2]) >
          35
        ) {
          count++;
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
    return { count, left, right, top, bottom };
  }, png.toString("base64"));
  if (!allowEmpty) expect(pixels.count).toBeGreaterThan(100);
  return { png, pixels };
}

async function assertDetailLayout(page: Page) {
  await expect(page.locator('.detail-sheet')).not.toHaveAttribute('data-starting-style');
  await page.locator('.detail-sheet').evaluate(async el => {
    await Promise.all(el.getAnimations().map(animation => animation.finished));
  });
  const boxes = await page.evaluate(() => {
    const rect = (selector: string) => {
      const el = document.querySelector(selector)!;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    return {
      sheet: rect(".detail-sheet"),
      header: rect(".detail-header"),
      scroll: rect(".detail-scroll"),
      actions: rect(".detail-actions"),
      dock: rect(".bottom-dock"),
      w: innerWidth,
      h: innerHeight,
    };
  });
  expect(boxes.sheet.x).toBeGreaterThanOrEqual(0);
  expect(boxes.sheet.right).toBeLessThanOrEqual(boxes.w);
  expect(boxes.sheet.bottom).toBeLessThanOrEqual(boxes.h);
  expect(boxes.header.bottom).toBeLessThanOrEqual(boxes.scroll.y + 1);
  expect(boxes.scroll.bottom).toBeLessThanOrEqual(boxes.actions.y + 1);
  expect(boxes.actions.bottom).toBeLessThanOrEqual(boxes.sheet.bottom);
  expect(boxes.scroll.height).toBeGreaterThanOrEqual(24);
  expect(boxes.sheet.bottom <= boxes.dock.y || boxes.sheet.x >= boxes.dock.right).toBeTruthy();
}

async function capture(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`) });
}

test("desktop search, keyboard selection, canvas motion, isolation and reset", async ({
  page,
}, info) => {
  // Full-atlas motion plus screenshots use software WebGL in CI.
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await ready(page);
  await capture(page, info, "desktop");
  const before = await modelPixels(page);
  await page.getByRole("button", { name: "从侧面查看人体", exact: true }).click();
  await expect.poll(async () => (await modelPixels(page)).png.equals(before.png)).toBe(false);
  await page.keyboard.press("/");
  const input = page.getByRole("combobox");
  await expect(input).toBeFocused();
  await input.fill("femur");
  await expect(page.getByRole("option").first()).toContainText("骨骼");
  await expect(page.getByRole("option").first().locator("mark")).toContainText("股骨");
  await input.fill("[不存在]+");
  await expect(page.getByText("没有找到匹配的结构。")).toBeVisible();
  await page.getByRole("button", { name: "清空搜索", exact: true }).click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await input.press("Escape");
  await expect(page.locator(".search-panel")).toHaveCount(0);
  await chooseHeart(page);
  await page.getByRole("button", { name: "孤立显示此结构", exact: true }).click();
  await expect(page.locator(".detail-sheet")).toHaveClass(/is-isolated/);
  await assertDetailLayout(page);
  await modelPixels(page);
  await capture(page, info, "desktop-isolated");
  await page.getByRole("button", { name: "显示周围结构", exact: true }).click();
  await page.getByRole("button", { name: "清除选择", exact: true }).click();
  await expect(page.locator(".detail-sheet")).toHaveCount(0);
  const canvas = page.locator("canvas"),
    rect = (await canvas.boundingBox())!;
  await page.mouse.move(rect.width / 2, rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.width / 2 + 80, rect.height / 2 + 20, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator(".detail-sheet")).toHaveCount(0);
  await page.getByRole("button", { name: "组合并重置", exact: true }).click();
  await expect(page.getByRole("button", { name: "从斜前方查看人体", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("slider").focus();
  await page.getByRole("slider").press("End");
  await expect(page.locator("output")).toHaveText("100%");
  await expect(page.locator(".gesture-hint")).toContainText("左键或中键拖动平移");
  await page.getByRole("button", { name: "组合并重置", exact: true }).click();
  await expect(page.locator("output")).toHaveText("0%");
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
  { width: 568, height: 320 },
]) {
  test(`touch layout ${viewport.width}x${viewport.height}`, async ({ browser }, info) => {
    const context = await browser.newContext({
      viewport,
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    try {
      await page.goto("http://127.0.0.1:3027/");
      await ready(page);
      await modelPixels(page);
      await capture(page, info, "initial");
      await page.getByRole("button", { name: "打开系统图层", exact: true }).click();
      await expect(page.locator(".layers-panel")).toBeVisible();
      await page
        .locator(".layer-presets")
        .getByRole("button", { name: "骨骼", exact: true })
        .click();
      await page.getByRole("button", { name: "关闭系统面板", exact: true }).click();
      await expect(page.locator(".layers-panel")).toBeHidden();
      await chooseHeart(page);
      await assertDetailLayout(page);
      await page.getByRole("button", { name: "孤立显示此结构", exact: true }).click();
      await assertDetailLayout(page);
      await modelPixels(page, true);
      await capture(page, info, "isolated");
      await page
        .locator(".detail-sheet")
        .getByRole("button", { name: "关闭", exact: true })
        .click();
      await expect(page.locator(".detail-sheet")).toHaveCount(0);
      await page.getByRole("button", { name: "组合并重置", exact: true }).click();
      await expect(page.locator("output")).toHaveText("0%");
    } finally {
      await context.close();
    }
  });
}

test("failed model and catalog requests can retry without navigation or losing search/layers", async ({
  page,
}) => {
  let catalogFailures = 1,
    modelFailures = 1,
    navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });
  await page.route("**/models/atlas.json", (route) =>
    catalogFailures-- > 0 ? route.fulfill({ status: 503, body: "" }) : route.continue(),
  );
  await page.route("**/models/body-0.bin*", (route) =>
    modelFailures-- > 0 ? route.fulfill({ status: 503, body: "" }) : route.continue(),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("目录");
  await page.getByRole("button", { name: "重试模型加载", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("模型文件");
  await page.locator(".layer-presets").getByRole("button", { name: "骨骼", exact: true }).click();
  await page.getByRole("button", { name: "搜索解剖结构", exact: true }).click();
  await page.getByRole("combobox").fill("股骨");
  await page.getByRole("combobox").press("Escape");
  await page.getByRole("button", { name: "重试模型加载", exact: true }).click();
  await ready(page);
  await expect(
    page.locator(".layer-presets").getByRole("button", { name: "骨骼", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "搜索解剖结构", exact: true }).click();
  await expect(page.getByRole("combobox")).toHaveValue("股骨");
  expect(navigations).toBe(1);
});

test("WebGL initialization failure and context loss are recoverable", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    (window as unknown as { blockWebGL: boolean }).blockWebGL = true;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      if (
        (window as unknown as { blockWebGL: boolean }).blockWebGL &&
        String(args[0]).includes("webgl")
      )
        return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("无法启动");
  await page.evaluate(() => {
    (window as unknown as { blockWebGL: boolean }).blockWebGL = false;
  });
  await page.getByRole("button", { name: "重试模型加载", exact: true }).click();
  await ready(page);
  await page
    .locator("canvas")
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
    );
  await expect(page.getByRole("alert")).toContainText("设备暂停");
  await page.getByRole("button", { name: "重试模型加载", exact: true }).click();
  await ready(page);
  await modelPixels(page);
});
