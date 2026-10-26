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
    const items = (await (await page.request.get('/local-scores/index.json')).json()).items;
    expect(info.privateMediaIncluded).toBe(Boolean(info.courseResources));
    expect(items).toHaveLength(info.courseResources?.itemCount || 0);
    await page.locator('[data-start]').click();
    await expect(page.locator('#timer-value')).toBeVisible();
    await page.locator('[data-score]').click();
    if (info.courseResources) {
      await expect(page.locator('#score-play')).toBeEnabled({ timeout: 20000 });
      await expect(page.locator('#score-render svg').first()).toBeVisible();
    } else await expect(page.locator('#score-status')).toContainText('可载入本地');
    // Clearly synthetic notation; no course material or fingering is inferred.
    const xml = '<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>SYNTHETIC QA</work-title></work><part-list><score-part id="P1"><part-name>Synthetic</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note></measure></part></score-partwise>';
    await page.locator('#score-file').setInputFiles({ name: 'synthetic.musicxml', mimeType: 'application/xml', buffer: Buffer.from(xml) });
    await expect(page.locator('#score-play')).toBeEnabled();
    await expect(page.locator('#score-render svg').first()).toBeVisible();
    await page.locator('#score-close').click();
    expect(errors).toEqual([]);
  });
}
test('bundled XML-only notation and source diagrams load without manual file import', async ({ page }) => {
  await page.goto('/');
  const info = await (await page.request.get('/build-info.json')).json();
  test.skip(!info.courseResources, 'Lightweight CI excludes private course resources');
  const { items } = await (await page.request.get('/local-scores/index.json')).json();
  const xml = items.find(item => item.xml && !item.gp && !item.acceptedAudioGp);
  const diagram = items.find(item => !item.xml && !item.gp && item.images.length);
  expect(xml).toBeTruthy(); expect(diagram).toBeTruthy();
  await page.evaluate(async item => { const m = await import('./score-viewer.js'); await m.showScore(item.entryId, item.title); }, xml);
  await expect(page.locator('#score-play')).toBeEnabled({ timeout: 20000 });
  await expect(page.locator('#score-render svg').first()).toBeVisible();
  await page.locator('#score-close').click();
  await page.evaluate(async item => { const m = await import('./score-viewer.js'); await m.showScore(item.entryId, item.title); }, diagram);
  const choices = items.filter(item => item.entryId === diagram.entryId || item.entryIds?.includes(diagram.entryId));
  if (choices.length > 1) await page.locator('#score-choice').selectOption(String(choices.findIndex(item => item.id === diagram.id)));
  await expect(page.locator('#score-images img').first()).toBeVisible();
  expect(await page.locator('#score-images img').first().evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.locator('#score-play')).toBeDisabled();
});
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
    globalThis.Capacitor = { getPlatform: () => 'android', Plugins: { ExportFile: { save: async args => { calls.push(args); return { saved: true }; } } } };
    const { saveFile } = await import('./file-export.js');
    await saveFile(new Blob(['SYNTHETIC BACKUP'], { type: 'application/json' }), 'eguitar-practice.json');
    return calls;
  });
  expect(result).toEqual([{ name: 'eguitar-practice.json', mime: 'application/json', data: Buffer.from('SYNTHETIC BACKUP').toString('base64') }]);
});

test('update preparation persists a paused draft and does not resume on focus or reload', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-start]').click();
  const draft = () => page.evaluate(async () => {
    const m = await import('./practice-store.js'), db = await m.openPracticeDB();
    const d = await m.readDraft(db); db.close(); return d;
  });
  await expect.poll(async () => (await draft())?.elapsedMs || 0).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.eguitarPrepareForUpdate())).toBe(true);
  const paused = await draft();
  expect(paused.running).toBe(false);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect((await draft()).running).toBe(false);
  await page.reload();
  await expect(page.locator('[data-action="pause"]')).toHaveText('继续练习');
  expect((await draft()).id).toBe(paused.id);
  expect((await draft()).running).toBe(false);
});

test('update cannot discard an unfinished result form', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-start]').click();
  await expect.poll(() => page.evaluate(async () => {
    const m = await import('./practice-store.js'), db = await m.openPracticeDB();
    const d = await m.readDraft(db); db.close(); return d?.elapsedMs || 0;
  })).toBeGreaterThan(1000);
  await page.locator('[data-action=finish]').click();
  await page.locator('#stable-bpm').fill('65');
  expect(await page.evaluate(() => window.eguitarPrepareForUpdate().then(() => false, () => true))).toBe(true);
  await expect(page.locator('#stable-bpm')).toHaveValue('65');
});
