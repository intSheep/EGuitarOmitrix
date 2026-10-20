// Isolated synthetic scores/audio only; never reads or writes learner records.
import assert from "node:assert/strict";
import * as alpha from "@coderline/alphatab";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.EGUITAR_QA_URL || "http://localhost:5188";
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
const xml = (n = 4, d = 4, tempo = 240) => Buffer.from(`<?xml version="1.0"?><!DOCTYPE score-partwise><score-partwise version="4.0"><work><work-title>Synthetic count-in fixture</work-title></work><part-list><score-part id="P1"><part-name>Synthetic guitar</part-name></score-part></part-list><part id="P1">${Array.from({ length: 4 }, (_, i) => `<measure number="${i + 1}"><attributes><divisions>2</divisions><time><beats>${n}</beats><beat-type>${d}</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><direction><sound tempo="${tempo}"/></direction>${Array.from({ length: n * 8 / d }, () => '<note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>').join("")}</measure>`).join("")}</part></score-partwise>`);
function backing() {
  const score = alpha.importer.ScoreLoader.loadScoreFromBytes(xml());
  // Four 4/4 bars at 240 BPM; synthetic WAV, deliberately no course material.
  const samples = 8000 * 4, bytes = Buffer.alloc(44 + samples * 2);
  bytes.write("RIFF", 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(Math.round(1000 * Math.sin(2 * Math.PI * 220 * i / 8000)), 44 + i * 2);
  score.backingTrack = new alpha.model.BackingTrack(); score.backingTrack.rawAudioFile = bytes;
  score.applyFlatSyncPoints([{ barIndex: 0, barPosition: 0, barOccurence: 0, millisecondOffset: 0 }, { barIndex: 3, barPosition: 1, barOccurence: 0, millisecondOffset: 4000 }]);
  return Buffer.from(new alpha.exporter.Gp7Exporter().export(score));
}
const errors = [], results = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.route("**/local-scores/index.json", (route) => route.fulfill({ json: { items: [] } }));
  await page.addInitScript(() => {
    const make = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (...args) {
      const osc = make.apply(this, args), start = osc.start.bind(osc), audio = this;
      osc.start = (at) => { (window.__clicks ||= []).push({ at: performance.now() + (at - audio.currentTime) * 1000, hz: osc.frequency.value }); return start(at); };
      return osc;
    };
  });
  async function setup() {
    await page.goto(base);
    await page.evaluate(async () => {
      const sdk = await import("./vendor/alphatab/alphaTab.min.mjs");
      const proto = sdk.AlphaTabApi.prototype, load = proto.load, play = proto.play;
      proto.load = function (...args) { window.__player = this; return load.apply(this, args); };
      proto.play = function (...args) { (window.__plays ||= []).push(performance.now()); return play.apply(this, args); };
    });
  }
  async function open() {
    await page.evaluate(async () => (await import("./score-viewer.js")).showScore("synthetic-count-in", "Synthetic count-in fixture"));
    await page.locator("#score-status").filter({ hasText: "还没有谱" }).waitFor();
  }
  async function load(buffer = xml(), name = "synthetic.musicxml") {
    await page.locator("#score-file").setInputFiles({ name, mimeType: "application/octet-stream", buffer });
    await page.waitForFunction(() => !document.querySelector("#score-play").disabled);
  }
  async function reset() { await page.evaluate(() => { window.__clicks = []; window.__plays = []; }); }
  async function run(expectedBeats, expectedMs) {
    await reset();
    const startPosition = await page.evaluate(() => window.__player.timePosition);
    await page.locator("#score-play").click();
    assert.equal(await page.locator("#score-play").innerText(), "取消预备");
    assert.equal(await page.evaluate(() => window.__player.playerState), 0);
    assert.equal(await page.evaluate(() => document.querySelector("audio")?.paused ?? true), true);
    await page.waitForFunction(() => window.__plays?.length === 1);
    await page.waitForFunction(() => document.querySelector("#score-play").textContent === "暂停");
    const timing = await page.evaluate(() => ({ clicks: window.__clicks, start: window.__plays[0] }));
    assert.equal(timing.clicks.length, expectedBeats);
    const elapsed = timing.start - timing.clicks[0].at;
    assert.ok(elapsed >= expectedMs - 60 && elapsed <= expectedMs + 600, `Wrong one-bar duration: ${elapsed} vs ${expectedMs}`);
    assert.equal(timing.clicks[0].hz, 1100);
    assert.ok(timing.clicks.slice(1).every((c) => c.hz === 740));
    results.push({ beats: expectedBeats, expectedMs, actualMs: Math.round(elapsed) });
    await page.waitForFunction((start) => window.__player.timePosition > start + 50, startPosition);
  }
  async function cancel(action) {
    await reset(); await page.locator("#score-play").click();
    await page.locator("#score-count-in-status").filter({ hasText: /预备拍/ }).waitFor();
    await action();
    await page.waitForTimeout(1250);
    assert.equal(await page.evaluate(() => window.__plays.length), 0, "Cancelled count-in launched playback");
  }
  await setup(); await open(); await load();
  assert.equal(await page.locator("#score-count-in").isChecked(), false);
  await reset(); await page.locator("#score-play").click();
  await page.waitForFunction(() => window.__plays?.length === 1);
  await page.waitForFunction(() => window.__player.timePosition > 50);
  assert.equal(await page.evaluate(() => window.__clicks.length), 0);
  await page.locator("#score-stop").click();
  await page.locator("#score-count-in").check();
  await run(4, 1000);
  await page.locator("#score-play").click(); // pause
  await run(4, 1000); // explicit resume receives its own preparation
  await page.locator("#score-stop").click();
  await page.locator("#score-loop").check();
  await run(4, 1000);
  await page.waitForFunction(() => window.__player.timePosition > 3200);
  await page.waitForFunction(() => window.__player.timePosition < 1000);
  assert.equal(await page.evaluate(() => window.__clicks.length), 4);
  await page.locator("#score-stop").click();
  await page.locator("#score-loop").uncheck();
  await cancel(() => page.locator("#score-play").click());
  await cancel(() => page.locator("#score-stop").click());
  await cancel(() => page.locator("#score-count-in").uncheck());
  await page.locator("#score-count-in").check();
  await cancel(async () => {
    await page.locator("#score-bpm").fill("200");
    await page.locator("#score-bpm").dispatchEvent("change");
  });
  await load();
  await cancel(() => page.evaluate(async () => (await import("./score-viewer.js")).pauseScore()));
  await cancel(() => page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }));
  await page.evaluate(() => { delete document.hidden; });
  await cancel(() => page.evaluate(() => { location.hash = "history"; }));
  await open(); await load();
  assert.equal(await page.locator("#score-count-in").isChecked(), true);
  await cancel(() => page.locator("#score-close").click());
  await open(); await load();
  await cancel(() => load(xml(3, 4, 240)));
  await run(3, 750);
  await page.locator("#score-stop").click();
  await load(xml(6, 8, 240)); await run(6, 750);
  await page.locator("#score-stop").click();
  await load(backing(), "synthetic.gp");
  await page.locator("#score-bpm").fill("50"); await page.locator("#score-bpm").dispatchEvent("change");
  await run(4, 2000);
  await page.waitForFunction(() => document.querySelector("audio")?.currentTime > 0.1);
  await page.locator("#score-stop").click();
  await cancel(() => page.locator("[data-tuner]").click());
  await page.keyboard.press("Escape");
  await page.locator("#score-close").click();
  await setup(); await open(); await load(); // persisted across reload
  assert.equal(await page.locator("#score-count-in").isChecked(), true);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForFunction(() => {
      const e = document.querySelector("#score-dialog");
      return e.scrollWidth <= e.clientWidth + 2;
    });
    await page.screenshot({ path: `/tmp/score-count-in-${width}.png` });
  }
  // Preference writes may fail: setting still works for this open app.
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw Error("Synthetic storage denial"); }; });
  await page.locator("#score-count-in").uncheck();
  assert.match(await page.locator("#score-status").innerText(), /本次有效/);
  await page.locator("#score-count-in").check(); await run(4, 1000);
  await page.locator("#score-stop").click();
  await reset();
  await page.evaluate(() => {
    window.__resume = AudioContext.prototype.resume;
    AudioContext.prototype.resume = () => Promise.reject(Error("Synthetic audio denial"));
  });
  await page.locator("#score-play").click();
  await page.locator("#score-status").filter({ hasText: "无法开始预备拍" }).waitFor();
  assert.equal(await page.locator("#score-play").innerText(), "播放");
  assert.equal(await page.evaluate(() => window.__plays.length), 0);
  await page.evaluate(() => { AudioContext.prototype.resume = window.__resume; });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: "PASS", timings: results, coverage: "default off, synth/backing, 3/4 and 6/8, speed, resume, cancellation, tuner/background/navigation, persistence, storage denial, desktop/tablet/mobile" }, null, 2));
  await context.close();
} finally { await browser.close(); }
