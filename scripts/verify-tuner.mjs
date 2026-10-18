import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.EGUITAR_QA_URL || 'http://localhost:5176';
// Synthetic six-string input, supplied to Chromium's real capture/WebAudio path.
const rate = 48000, frames = rate * 2, wav = Buffer.alloc(44 + frames * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(frames * 2, 40);
for (let i = 0; i < frames; i++) wav.writeInt16LE(Math.round(6000 * Math.sin(2 * Math.PI * 110 * i / rate) + 9000 * Math.sin(2 * Math.PI * 220 * i / rate)), 44 + i * 2);
await writeFile('/tmp/eguitar-tuner-synthetic.wav', wav);
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=/tmp/eguitar-tuner-synthetic.wav'] });
const errors = [];
async function context(mode = 'normal', width = 1440) {
  const ctx = await browser.newContext({ viewport: { width, height: 960 }, permissions: ['microphone'], reducedMotion: 'reduce' });
  await ctx.addInitScript(({ mode }) => {
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.tunerQA = { streams: [], requests: [], contexts: [] };
    const NativeAudio = window.AudioContext;
    window.AudioContext = class extends NativeAudio {
      constructor(...args) { super(...args); window.tunerQA.contexts.push(this); }
    };
    navigator.mediaDevices.getUserMedia = async constraints => {
      window.tunerQA.requests.push(constraints);
      if (mode === 'denied') throw new DOMException('Synthetic denial', 'NotAllowedError');
      if (mode === 'missing') throw new DOMException('Synthetic missing input', 'NotFoundError');
      if (mode === 'busy') throw new DOMException('Synthetic busy input', 'NotReadableError');
      if (mode === 'delayed') await new Promise(resolve => { window.tunerQA.grant = resolve; });
      // Device switching is an injected two-device fixture; capture itself stays real.
      const stream = await capture({ audio: { ...constraints.audio, deviceId: undefined }, video: false });
      window.tunerQA.streams.push(stream);
      if (mode === 'silent') stream.getAudioTracks()[0].enabled = false;
      return stream;
    };
    navigator.mediaDevices.enumerateDevices = async () => [
      { kind: 'audioinput', deviceId: 'synthetic-1', label: 'Synthetic microphone' },
      { kind: 'audioinput', deviceId: 'synthetic-2', label: '<img src=x onerror=alert(1)> Synthetic USB' },
    ];
  }, { mode });
  const page = await ctx.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.locator('[data-start]:enabled').waitFor();
  return { ctx, page };
}
async function open(page) { await page.locator('[data-tuner]').first().click(); await page.locator('#tuner-dialog[open]').waitFor(); }
async function listen(page) { await page.locator('#tuner-start').click(); await page.waitForFunction(() => document.querySelector('#tuner-note')?.textContent === 'A2'); }
async function released(page) {
  await page.waitForFunction(() => tunerQA.streams.every(s => s.getTracks().every(t => t.readyState === 'ended')) && tunerQA.contexts.every(c => c.state === 'closed'));
}
try {
  for (const width of [1440, 768, 390]) {
    const { ctx, page } = await context('normal', width);
    await open(page);
    assert.equal(await page.locator('#tuner-note').innerText(), '—');
    assert.equal(await page.evaluate(() => tunerQA.requests.length), 0);
    await listen(page);
    assert.equal(await page.locator('[data-guitar-string="5"]').getAttribute('data-active'), 'true');
    assert.equal(await page.locator('[data-guitar-string][data-active="true"]').count(), 1);
    assert.match(await page.locator('#tuner-direction').innerText(), /准确/);
    assert.match(await page.locator('#tuner-frequency').innerText(), /110\.\d+ Hz/);
    assert.equal(await page.evaluate(() => tunerQA.requests[0].audio.echoCancellation), false);
    await page.locator('[data-tuner-string="6"]').click();
    assert.equal(await page.locator('[data-guitar-string="6"]').getAttribute('data-active'), 'true');
    await page.waitForFunction(() => document.querySelector('#tuner-cents').textContent.includes('+500'));
    assert.match(await page.locator('#tuner-direction').innerText(), /偏高/);
    await page.locator('[data-tuner-string="auto"]').click();
    await page.waitForFunction(() => document.querySelector('#tuner-direction').textContent === '准确');
    await page.locator('#tuner-device').selectOption('synthetic-2');
    await page.waitForFunction(() => tunerQA.requests.length === 2 && document.querySelector('#tuner-note').textContent === 'A2');
    assert.equal(await page.evaluate(() => tunerQA.requests[1].audio.deviceId.exact), 'synthetic-2');
    assert.equal(await page.evaluate(() => tunerQA.streams[0].getAudioTracks()[0].readyState), 'ended');
    assert.equal(await page.locator('#tuner-device img').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator('#tuner-dialog').evaluate(e => e.scrollWidth > e.clientWidth), false);
    await page.screenshot({ path: `/tmp/eguitar-tuner-${width}.png` });
    await page.keyboard.press('Escape');
    await released(page);
    assert.equal(await page.locator('[data-tuner]').first().evaluate(e => e === document.activeElement), true);
    await page.locator('[data-start]').click();
    await page.locator('#timer-value').waitFor();
    await page.locator('[data-action="metronome"]').click();
    await page.locator('[data-action="metro-toggle"]').click();
    await open(page);
    assert.match(await page.locator('#timer-state').innerText(), /调音中/);
    assert.equal(await page.locator('[data-action="metro-toggle"]').innerText(), '播放节拍');
    const time = await page.locator('#timer-value').innerText();
    await listen(page);
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('#timer-value').innerText(), time);
    await page.locator('#tuner-stop').click(); await released(page);
    assert.equal(await page.locator('#tuner-note').innerText(), '—');
    await listen(page);
    await page.evaluate(() => { location.hash = 'history'; });
    await page.waitForFunction(() => !document.querySelector('#tuner-dialog').open); await released(page);
    await ctx.close();
  }
  for (const [mode, message] of [['denied', /权限/], ['missing', /找不到/], ['busy', /无法读取/], ['silent', /声音较小/]]) {
    const { ctx, page } = await context(mode);
    await open(page); await page.locator('#tuner-start').click();
    await page.waitForFunction(() => !document.querySelector('#tuner-status').textContent.includes('正在请求'));
    assert.match(await page.locator('#tuner-status').innerText(), message);
    assert.equal(await page.locator('#tuner-note').innerText(), '—');
    if (mode !== 'silent') { assert.equal(await page.locator('#tuner-start').isEnabled(), true); await released(page); }
    await page.locator('#tuner-close').click(); await released(page); await ctx.close();
  }
  {
    const { ctx, page } = await context('delayed');
    await open(page); await page.locator('#tuner-start').click();
    await page.waitForFunction(() => tunerQA.grant);
    await page.keyboard.press('Escape'); await page.evaluate(() => tunerQA.grant());
    await page.waitForFunction(() => tunerQA.streams.length === 1); await released(page);
    assert.equal(await page.locator('#tuner-dialog').evaluate(e => e.open), false);
    await ctx.close();
  }
  {
    const { ctx, page } = await context(); await open(page); await listen(page);
    await page.evaluate(() => { const track = tunerQA.streams[0].getAudioTracks()[0]; track.stop(); track.dispatchEvent(new Event('ended')); });
    assert.match(await page.locator('#tuner-status').innerText(), /断开/); await released(page);
    await listen(page);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await released(page); assert.match(await page.locator('#tuner-status').innerText(), /页面已离开/);
    await ctx.close();
  }
  assert.deepEqual(errors, []);
  console.log('Tuner: real Chromium capture/WebAudio with synthetic A2/harmonics, auto/manual cents, input switching, paused practice/metronome, stop/Escape/navigation/background/disconnect/delayed grant, permission/missing/busy/silent states and responsive focus passed. No real instrument accuracy claim.');
} finally { await browser.close(); }
