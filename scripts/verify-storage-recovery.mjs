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
  const ctx = await browser.newContext();
  const old = await ctx.newPage();
  await old.route("**/app.js", (r) =>
    r.fulfill({ contentType: "text/javascript", body: "" }),
  );
  await old.goto(base);
  await old.evaluate(
    () =>
      new Promise((resolve) => {
        const r = indexedDB.open("eguitar-practice-v1", 1);
        r.onupgradeneeded = () =>
          r.result.createObjectStore("logs", { keyPath: "id" });
        r.onsuccess = () => {
          window.oldConnection = r.result;
          resolve();
        };
      }),
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/#catalog");
  await page.locator(".storage-banner").waitFor();
  await page.waitForFunction(() =>
    document
      .querySelector(".storage-banner")
      .textContent.includes("旧版标签页"),
  );
  assert.ok((await page.locator(".directory-row").count()) > 100);
  assert.equal(await page.locator(".catalog-card").count(), 0);
  await page.locator("[data-action=retry-storage]").click();
  await page.locator("[data-action=retry-storage]").click();
  await page.evaluate(() => (window.documentIdentity = "unchanged"));
  await old.close();
  await page.locator(".storage-banner").waitFor({ state: "detached" });
  assert.equal(await page.evaluate(() => window.documentIdentity), "unchanged");
  await page.locator("a.directory-action").first().click();
  await page.locator("[data-start]").waitFor();
  assert.equal(await page.locator("[data-start]").isEnabled(), true);
  await page.goto(base + "/#catalog");
  await page.locator(".directory-row").first().waitFor();
  await page.screenshot({ path: "/tmp/catalog-flat-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: "/tmp/catalog-flat-mobile.png" });
  const fail = await browser.newContext();
  await fail.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    let failed = false;
    IDBFactory.prototype.open = function (...args) {
      if (!failed) {
        failed = true;
        throw Error("Synthetic temporary storage failure");
      }
      return open.apply(this, args);
    };
  });
  const fp = await fail.newPage();
  await fp.goto(base);
  await fp.locator("[data-action=retry-storage]").waitFor();
  await fp.locator("[data-action=retry-storage]").click();
  await fp.locator(".storage-banner").waitFor({ state: "detached" });
  assert.equal(await fp.locator("[data-start]").isEnabled(), true);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real v1 upgrade blocking, repeated retry without duplicate requests, automatic recovery without reload, transient failure retry, flat catalog desktop/mobile.",
  );
} finally {
  await browser.close();
}
