// Fresh isolated contexts; no personal records or existing browser profiles.
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
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await ctx.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon"))
    errors.push(m.text());
});
try {
  await page.goto(base);
  await page.locator("[data-start]").waitFor();
  assert.equal(await page.locator("[data-start]").count(), 1);
  assert.equal(
    await page.locator("details, [name=minutes], a[target=_blank]").count(),
    0,
  );
  await page.locator("[data-start]").click();
  await page.locator("#timer-value").waitFor();
  await page.waitForTimeout(2200);
  await page.locator("[data-action=pause]").click();
  const paused = await page.locator("#timer-value").innerText();
  await page.waitForTimeout(1200);
  assert.equal(await page.locator("#timer-value").innerText(), paused);
  await page.reload();
  await page.locator("#timer-state").waitFor();
  assert.match(await page.locator("#timer-state").innerText(), /上次/);
  assert.equal(await page.locator("#timer-value").innerText(), paused);
  await page.locator("[data-action=pause]").click();
  await page.waitForTimeout(1200);
  const other = await ctx.newPage();
  await other.goto(base);
  await other.locator("[data-start]").click();
  await other.waitForFunction(() =>
    document.querySelector("#notice").textContent.includes("另一标签页"),
  );
  await other.goto(base + "/#focus");
  await other.locator("[data-action=finish]").click();
  await other.waitForFunction(() =>
    document.querySelector("#notice").textContent.includes("另一标签页"),
  );
  assert.equal(await other.locator(".completion").count(), 0);
  await other.close();
  await page.locator("[data-action=metronome]").click();
  await page.locator("[data-action=metro-toggle]").click();
  assert.equal(
    await page.locator("[data-action=metro-toggle]").innerText(),
    "停止节拍",
  );
  await page.locator("[data-material]").click();
  assert.ok(await page.locator("a[data-watch][target=_blank]").count() >= 2);
  assert.equal(await page.locator('#material-select').count(), 0);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "/tmp/focus-desktop.png" });
  // Synthetic transaction abort: finishing must keep the draft and retry safely.
  await page.evaluate(() => {
    window.originalTransaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (stores, ...args) {
      const tx = window.originalTransaction.call(this, stores, ...args);
      if (
        Array.isArray(stores) &&
        stores.includes("logs") &&
        stores.includes("session")
      )
        queueMicrotask(() => tx.abort());
      return tx;
    };
  });
  await page.locator("[data-action=finish]").click();
  await page.locator("#finish-form button[type=submit]").click();
  await page.waitForFunction(() => document.querySelector("#finish-error").textContent.includes("保存失败"));
  assert.equal(await page.locator("#finish-form").count(), 1);
  await page.evaluate(
    () => (IDBDatabase.prototype.transaction = window.originalTransaction),
  );
  await page.locator("#finish-form button[type=submit]").dblclick();
  await page.locator(".completion").waitFor();
  assert.equal(await page.locator(".session-row").count(), 1);
  await page.locator("[data-outcome=learning]").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("[data-outcome=learning]")
        ?.getAttribute("aria-pressed") === "true",
  );
  await page.screenshot({ path: "/tmp/focus-summary.png" });
  await page.locator("[data-action=manage]").click();
  const dl = page.waitForEvent("download");
  await page.locator("[data-action=export]").click();
  await (await dl).saveAs("/tmp/focus-synthetic-backup.json");
  await page.locator("[data-delete]").click();
  await page.waitForFunction(
    () => document.querySelector("[data-delete]")?.textContent === "恢复",
  );
  await page.locator("[data-delete]").click();
  await page.waitForFunction(
    () => document.querySelector("[data-delete]")?.textContent === "删除",
  );
  await page.keyboard.press("Escape");
  for (const width of [820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.goto(base);
    await page.locator("[data-start]").waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  await page.locator("[data-start]").click();
  await page.locator("#timer-value").waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".ambient-orbit")
      .evaluate((e) => getComputedStyle(e).animationName),
    "none",
  );
  await page.screenshot({ path: "/tmp/focus-mobile.png" });
  const fresh = await browser.newContext();
  const p = await fresh.newPage();
  await p.goto(base + "/#history");
  await p.locator("[data-action=manage]").click();
  await p.locator("#import").setInputFiles("/tmp/focus-synthetic-backup.json");
  await p.locator("[data-action=import-confirm]").click();
  await p.locator(".session-row").waitFor();
  assert.equal(await p.locator(".session-row").count(), 1);
  const blocked = await browser.newContext();
  await blocked.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw Error("Synthetic blocked storage");
      },
    }),
  );
  const b = await blocked.newPage();
  await b.goto(base);
  await b.locator("[data-start]").waitFor();
  assert.equal(await b.locator("[data-start]").isDisabled(), true);
  await b.locator("[data-material]").click();
  await b.locator("#video-launch").waitFor();
  // Upgrade a synthetic v1 database without rewriting legacy records.
  const migrated = await browser.newContext();
  await migrated.addInitScript(() => {
    window.seedReady = new Promise((resolve) => {
      const req = indexedDB.open("eguitar-practice-v1", 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore("logs", { keyPath: "id" });
        store.add({
          id: "synthetic-legacy",
          entryId: "36374643242",
          assignmentVersion: "test",
          minutes: 7,
          outcome: "slow",
          bpm: 40,
          practicedAt: "2026-01-01T00:00:00Z",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          note: "Synthetic legacy note",
          nextFocus: "Synthetic focus",
          deletedAt: null,
        });
      };
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => resolve();
    });
  });
  const mp = await migrated.newPage();
  await mp.goto(base + "/#history?session=synthetic-legacy");
  await mp.locator(".completion").waitFor();
  assert.match(
    await mp.locator(".completion").innerText(),
    /Synthetic legacy note/,
  );
  assert.equal(await mp.locator(".session-duration").innerText(), "07:00");
  // Hidden-page timing pauses and sound controls reset; no manual time input.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(() =>
    document.querySelector("#timer-state").textContent.includes("离开页面"),
  );
  const stopped = await page.locator("#timer-value").innerText();
  await page.waitForTimeout(1200);
  assert.equal(await page.locator("#timer-value").innerText(), stopped);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: timer pause/reload, single-session lock, metronome, one video launch, atomic finish, rating, backup/import, delete/restore, responsive layouts, reduced motion, blocked storage, transaction failure/retry, v1 migration, hidden-page pause.",
  );
} finally {
  await browser.close();
}
