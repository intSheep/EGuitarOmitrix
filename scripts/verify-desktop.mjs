// Real Electron, isolated synthetic profile. Never opens the owner's browser or records.
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect } from '@playwright/test';
import { syntheticScore } from '../tests/fixtures/synthetic-score.mjs';
const profile = await mkdtemp(join(tmpdir(), 'eguitar-desktop-synthetic-'));
let application;
async function launch() {
  const instance = await electron.launch({
    executablePath: process.env.EGUITAR_PACKAGED_EXECUTABLE ? resolve(process.env.EGUITAR_PACKAGED_EXECUTABLE) : undefined,
    args: [...(process.env.EGUITAR_TEST_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), '--use-fake-device-for-media-stream', ...(process.env.EGUITAR_PACKAGED_EXECUTABLE ? [] : [resolve('desktop')])],
    env: { ...process.env, EGUITAR_TEST_PROFILE: profile }, timeout: 45000,
  });
  const page = await instance.firstWindow();
  await page.locator('[data-start]:enabled').waitFor();
  return { instance, page };
}
try {
  let launched = await launch(); application = launched.instance;
  const page = launched.page;
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const flags = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  assert.equal(flags.nodeIntegration, false); assert.equal(flags.contextIsolation, true); assert.equal(flags.sandbox, true); assert.equal(flags.webSecurity, true);
  assert.deepEqual(await page.evaluate(() => [isSecureContext, typeof require, typeof process, !!navigator.locks]), [true, 'undefined', 'undefined', true]);
  assert.equal(await page.evaluate(async () => (await fetch('./local-scores/p003/score.musicxml')).status), 404);
  await application.evaluate(({ dialog, shell, session }, profile) => {
    global.testOpened = [];
    dialog.showMessageBox = async () => ({ response: 1 });
    shell.openExternal = async url => { global.testOpened.push(url); };
    session.defaultSession.on('will-download', (_, item) => item.setSavePath(profile + '/synthetic-backup.json'));
  }, profile);
  await page.evaluate(() => {
    window.testStreams = [];
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => { const stream = await capture(constraints); testStreams.push(stream); return stream; };
  });
  await page.locator('[data-tuner]').first().click();
  await page.locator('#tuner-start').click();
  await expect.poll(() => page.evaluate(() => testStreams.length)).toBe(1);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => testStreams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')))).toBe(true);
  const cameraDenied = await page.evaluate(() => navigator.mediaDevices.getUserMedia({ video: true }).then(() => false, () => true));
  assert.equal(cameraDenied, true);
  await page.locator('[data-start]').click();
  const draft = () => page.evaluate(async () => { const m = await import('./practice-store.js'), db = await m.openPracticeDB(); const d = await m.readDraft(db); db.close(); return d; });
  await expect.poll(async () => (await draft())?.elapsedMs || 0).toBeGreaterThan(1000);
  // Xvfb/WSLg may not have a window manager; simulate the native background signal.
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].emit('blur'));
  await expect.poll(async () => (await draft()).running).toBe(false);
  const paused = (await draft()).elapsedMs;
  await page.waitForTimeout(1200);
  assert.equal((await draft()).elapsedMs, paused);
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus());
  await page.locator('[data-score]').click();
  await expect(page.locator('#score-status')).toContainText('可载入本地');
  await page.locator('#score-file').setInputFiles({ name: 'synthetic.musicxml', mimeType: 'application/xml', buffer: Buffer.from(syntheticScore) });
  await expect(page.locator('#score-play')).toBeEnabled({ timeout: 15000 });
  await page.locator('#score-play').click();
  await expect(page.locator('#score-play')).toHaveText('暂停');
  await page.locator('#score-close').click();
  await page.locator('[data-action=finish]').click();
  await page.locator('#finish-form button[type=submit]').click();
  await page.locator('.completion').waitFor();
  await page.locator('[data-action=manage]').click();
  await page.locator('[data-action=export]').click();
  await expect.poll(async () => { try { return JSON.parse(await readFile(join(profile, 'synthetic-backup.json'), 'utf8')).logs.length; } catch { return 0; } }).toBe(1);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.open('https://www.bilibili.com/video/BV1FT411Z7iu/?p=3'); window.open('file:///etc/passwd'); });
  await expect.poll(() => application.evaluate(() => global.testOpened.length)).toBe(1);
  assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
  assert.deepEqual(errors, []);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/desktop.png' });
  await writeFile('test-results/desktop-runtime.json', JSON.stringify(await application.evaluate(() => ({ versions: process.versions, platform: process.platform })), null, 2));
  await application.close(); application = null;
  launched = await launch(); application = launched.instance;
  const persisted = await launched.page.evaluate(async () => { const m = await import('./practice-store.js'), db = await m.openPracticeDB(); const logs = await m.allLogs(db); db.close(); return logs.length; });
  assert.equal(persisted, 1);
  console.log('Desktop smoke passed: bundled offline UI and score playback, sandbox configuration, microphone start/stop, camera denial, simulated background pause, export, outbound links and persistence after restart.');
} finally {
  await application?.close();
  await rm(profile, { recursive: true, force: true });
}
