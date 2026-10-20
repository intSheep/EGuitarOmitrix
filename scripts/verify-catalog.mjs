import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ["--no-sandbox"],
});
const base = process.env.EGUITAR_QA_URL || "http://localhost:5173";
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/#catalog");
  await page.locator(".library-group").first().waitFor();
  assert.equal(await page.locator(".library-group").count(), 8);
  const count = await page.locator(".directory-row").count();
  assert.ok(count > 100);
  await page.screenshot({ path: "/tmp/catalog-library-desktop.png" });
  await page.locator('.library-stages a[href*="stage=1"]').click();
  await page.waitForFunction(
    () => document.querySelectorAll(".library-group").length === 1,
  );
  assert.equal(await page.locator(".library-group").count(), 1);
  await page.locator('.library-types a[href*="kind=backing"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector(".library-types a[aria-current]")?.textContent ===
      "伴奏",
  );
  assert.ok((await page.locator("button.directory-row").count()) > 0);
  assert.equal(await page.locator("a.directory-row").count(), 0);
  await page.locator("button.directory-row").first().click();
  await page.locator("#video-launch").waitFor();
  assert.ok(await page.locator("a[data-watch][target=_blank]").count() >= 1);
  assert.equal(await page.locator('#material-select').count(), 0);
  await page.keyboard.press("Escape");
  await page.locator("[name=q]").fill("no-such-synthetic-title");
  await page.locator(".library-search button").click();
  await page.locator(".library-empty").waitFor();
  await page.locator(".library-empty a").click();
  await page.locator(".library-group").first().waitFor();
  await page.locator("#library-legacy").check();
  await page.waitForFunction(
    () => document.querySelectorAll(".directory-row").length === 140,
  );
  assert.equal(await page.locator(".directory-row").count(), 140);
  await page.locator('.library-stages a[href*="stage=0"]').click();
  await page.waitForFunction(() =>
    document
      .querySelector(".library-stages a[aria-current]")
      ?.getAttribute("href")
      .includes("stage=0"),
  );
  assert.equal(await page.locator(".library-group").count(), 1);
  await page.goto(base + "/#catalog?stage=1&kind=lesson");
  await page.locator("a.directory-row").first().click();
  await page.locator("[data-start]").waitFor();
  for (const width of [820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/#catalog?stage=1");
    await page.locator(".library-group").first().waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  await page.screenshot({ path: "/tmp/catalog-library-mobile.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: grouped catalog, stage/type/legacy/search filters, empty reset, material and exercise navigation, responsive layouts.",
  );
} finally {
  await browser.close();
}
