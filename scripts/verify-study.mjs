// Synthetic external video and isolated storage only; no course playback or personal data.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args:['--no-sandbox'] });
const base = process.env.EGUITAR_QA_URL || 'http://localhost:5173';
const context = await browser.newContext({ viewport:{width:1440,height:1000}, acceptDownloads:true });
await context.route('https://www.bilibili.com/**', r => r.fulfill({contentType:'text/html',body:'<h1>Synthetic external course video</h1>'}));
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
const study = () => page.evaluate(async () => (await import('/study-store.js')).readStudy(await (await import('/practice-store.js')).openPracticeDB()));
const practice = () => page.evaluate(async () => (await import('/practice-store.js')).readDraft(await (await import('/practice-store.js')).openPracticeDB()));
async function launch(selector = '#video-launch') {
  await page.locator('[data-material]').first().click();
  const href = await page.locator(selector).getAttribute('href');
  const popupEvent = context.waitForEvent('page');
  await page.locator(selector).click();
  const popup = await popupEvent;
  await popup.waitForURL(href);
  await popup.bringToFront();
  // Explicit lifecycle delivery makes background semantics deterministic in headless Chromium.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  return popup;
}
try {
  await page.goto(base);
  await page.locator('[data-start]:enabled').waitFor();
  await page.locator('[data-start]').click();
  await page.waitForTimeout(1400);
  await page.locator('[data-material]').click();
  assert.equal(await page.locator('#material-select').count(), 0);
  assert.ok(await page.locator('a[data-watch]').count() >= 2);
  assert.match(await page.locator('a[data-watch]').nth(1).getAttribute('href'), /[?&]t=\d+/);
  for (const width of [1440,768,390]) {
    await page.setViewportSize({width,height:1000});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({path:`/tmp/eguitar-materials-${width}.png`});
  }
  await page.keyboard.press('Escape');
  const popup = await launch();
  const paused = await practice();
  assert.equal(paused.running, false);
  await page.waitForTimeout(2200);
  assert.equal((await practice()).elapsedMs, paused.elapsedMs);
  assert.equal((await study()).records.length, 0);
  const other = await context.newPage();
  await other.goto(base);
  await other.locator('[data-start]:enabled').click();
  await other.waitForFunction(() => /另一标签页|先确认/.test(document.querySelector('#notice').textContent));
  await other.close();
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.locator('#watch-form').waitFor();
  const stopped = await study();
  assert.ok(stopped.draft.endedAt > stopped.draft.startedAt);
  await page.waitForTimeout(1200);
  assert.equal((await study()).draft.endedAt, stopped.draft.endedAt);
  await page.locator('[name=watchDuration]').fill('00:01');
  await page.screenshot({path:'/tmp/eguitar-watch-confirm-390.png'});
  // Atomic failed save preserves both the form and draft, allowing one retry.
  await page.evaluate(() => {
    window.realTx = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function(stores,...args) {
      const tx = window.realTx.call(this,stores,...args);
      if (Array.isArray(stores) && stores.includes('watches') && args[0] === 'readwrite') queueMicrotask(() => tx.abort());
      return tx;
    };
  });
  await page.locator('#watch-form [type=submit]').click();
  await page.waitForFunction(() => document.querySelector('.study-error').textContent.includes('未能保存'));
  assert.equal((await study()).records.length, 0);
  assert.ok((await study()).draft);
  await page.evaluate(() => IDBDatabase.prototype.transaction = window.realTx);
  await page.locator('#watch-form [type=submit]').dblclick();
  await page.waitForFunction(() => !document.querySelector('#watch-form'));
  assert.equal((await study()).records.length, 1);
  assert.equal((await study()).records[0].seconds, 1);
  assert.equal((await practice()).elapsedMs, paused.elapsedMs);
  await popup.close();
  await page.waitForFunction(async () => { const m=await import('/practice-store.js'); return (await m.readDraft(await m.openPracticeDB())).running; });
  await page.waitForTimeout(1200);
  await page.locator('[data-action=finish]').click();
  await page.locator('#finish-form [type=submit]').click();
  await page.locator('.completion').waitFor();
  assert.equal(await page.locator('.study-history .session-row').count(), 1);
  assert.equal(await page.locator('.session-row').count(), 2);
  assert.match(await page.locator('.study-totals').innerText(), /看课 00:01/);
  await page.locator('[data-action=manage]').click();
  const download = page.waitForEvent('download');
  await page.locator('[data-action=export]').click();
  await (await download).saveAs('/tmp/eguitar-study-synthetic-backup.json');
  const backup = JSON.parse(await readFile('/tmp/eguitar-study-synthetic-backup.json','utf8'));
  assert.equal(backup.schemaVersion, 3); assert.equal(backup.watches.length, 1); assert.equal(backup.logs.length, 1);
  await page.locator('[data-watch-delete]').click();
  await page.waitForFunction(() => document.querySelector('[data-watch-delete]').textContent === '恢复');
  await page.keyboard.press('Escape');
  assert.match(await page.locator('.study-totals').innerText(), /看课 00:00/);
  await page.locator('[data-action=manage]').click();
  await page.locator('[data-watch-delete]').click();
  await page.waitForFunction(() => document.querySelector('[data-watch-delete]').textContent === '删除');
  await page.keyboard.press('Escape');
  const fresh = await browser.newContext(), imported = await fresh.newPage();
  await imported.goto(base + '/#history');
  await imported.locator('[data-action=manage]').click();
  await imported.locator('#import').setInputFiles('/tmp/eguitar-study-synthetic-backup.json');
  await imported.locator('[data-action=import-confirm]').click();
  await imported.locator('.study-history .session-row').waitFor();
  assert.equal(await imported.locator('.session-row').count(), 2);
  // Conflicting watch records roll back practice additions in the same import transaction.
  assert.equal(await imported.evaluate(async backup => {
    const store = await import('/practice-store.js'), db = await store.openPracticeDB();
    try { await store.importLogs(db, [{...backup.logs[0],id:'synthetic-new-log'}], backup.goals, [{...backup.watches[0],seconds:2}]); }
    catch { return (await store.allLogs(db)).length; }
    return -1;
  }, backup), 1);
  await fresh.close();
  // Refresh preserves an unconfirmed external interval; navigation never saves it silently.
  await page.goto(base);
  await page.locator('[data-start]:enabled').waitFor();
  const interrupted = await launch();
  await page.waitForTimeout(1200);
  await page.reload();
  await page.locator('#watch-form').waitFor();
  assert.match(await page.locator('#watch-form').innerText(), /中断/);
  assert.equal((await study()).records.length, 1);
  await page.locator('[data-action=watch-discard]').click();
  await page.waitForFunction(() => !document.querySelector('.study-panel'));
  assert.equal((await study()).draft, null);
  await interrupted.close();
  // A blocked popup must not start a watch draft or save learning time.
  await page.evaluate(() => window.open = () => null);
  await page.locator('[data-material]').click();
  await page.locator('#video-launch').click();
  await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('未能打开'));
  assert.equal((await study()).draft, null);
  assert.deepEqual(errors, []);
  console.log('Study browser acceptance passed: direct links, three viewports, background separation, confirmation/retry, cross-tab exclusion, backup/import rollback, delete/undo, recovery/discard and popup failure.');
} finally { await browser.close(); }
