import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
for (const width of [1440, 768, 390]) {
  test(`bundled workspace and local score loading at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('[data-start]')).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const info = await (await page.request.get('/build-info.json')).json();
    expect(info.privateMediaIncluded).toBe(false);
    expect((await (await page.request.get('/local-scores/index.json')).json()).items).toEqual([]);
    await page.locator('[data-start]').click();
    await expect(page.locator('#timer-value')).toBeVisible();
    await page.locator('[data-score]').click();
    await expect(page.locator('#score-status')).toContainText('可载入本地');
    // Clearly synthetic notation; no course material or fingering is inferred.
    const xml = '<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>SYNTHETIC QA</work-title></work><part-list><score-part id="P1"><part-name>Synthetic</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note></measure></part></score-partwise>';
    await page.locator('#score-file').setInputFiles({ name: 'synthetic.musicxml', mimeType: 'application/xml', buffer: Buffer.from(xml) });
    await expect(page.locator('#score-play')).toBeEnabled();
    await expect(page.locator('#score-render svg').first()).toBeVisible();
    await page.locator('#score-close').click();
    expect(errors).toEqual([]);
  });
}
test('built app saves, exports and restores one actual session in isolated storage', async ({ page, browser }) => {
  await page.goto('/');
  await page.locator('[data-start]:enabled').click();
  await expect.poll(async () => page.evaluate(async () => {
    const m = await import('./practice-store.js'), db = await m.openPracticeDB();
    const draft = await m.readDraft(db); db.close(); return draft?.elapsedMs || 0;
  })).toBeGreaterThan(1000);
  await page.locator('[data-action=finish]').click();
  await expect(page.locator('#stable-bpm')).toHaveValue('');
  await page.locator('#finish-form button[type=submit]').click();
  await expect(page.locator('.completion')).toBeVisible();
  await page.locator('[data-action=manage]').click();
  const downloading = page.waitForEvent('download');
  await page.locator('[data-action=export]').click();
  const file = await downloading;
  const backup = JSON.parse(await readFile(await file.path(), 'utf8'));
  expect(backup.logs).toHaveLength(1);
  expect(backup.logs[0].bpm).toBeNull();
  const context = await browser.newContext();
  try {
    const restored = await context.newPage();
    await restored.goto('http://127.0.0.1:5189/#history');
    await restored.locator('[data-action=manage]').click();
    await restored.locator('input[type=file]').setInputFiles({ name: 'synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await restored.locator('[data-action=import-confirm]').click();
    await expect.poll(() => restored.evaluate(async () => { const m = await import('./practice-store.js'), db = await m.openPracticeDB(); const logs = await m.allLogs(db); db.close(); return logs.length; })).toBe(1);
  } finally { await context.close(); }
});
test('Android export adapter delegates to the system picker without creating a blob download', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const calls = [];
    globalThis.Capacitor = { getPlatform: () => 'android', registerPlugin: plugin => ({ save: async args => { calls.push({ plugin, ...args }); return { saved: true }; } }) };
    const { saveFile } = await import('./file-export.js');
    await saveFile(new Blob(['SYNTHETIC BACKUP'], { type: 'application/json' }), 'eguitar-practice.json');
    return calls;
  });
  expect(result).toEqual([{ plugin: 'ExportFile', name: 'eguitar-practice.json', mime: 'application/json', data: Buffer.from('SYNTHETIC BACKUP').toString('base64') }]);
});
