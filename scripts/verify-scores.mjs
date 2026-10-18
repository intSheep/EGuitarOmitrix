// Uses isolated browser storage; requires locally prepared pilot assets.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import * as alpha from "@coderline/alphatab";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.EGUITAR_QA_URL || "http://localhost:5174";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ["--no-sandbox"],
});
try {
  const errors = [];
  for (const [id, stage, bars, bpm, images] of [
    ["35754410769", 2, 4, 60, 1],
    ["35224489557", 4, 10, 40, 2],
  ]) {
    // Fresh page closes prior exclusive practice owner without saving synthetic activity.
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
    });
    const p = await context.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`${base}/#practice?stage=${stage}&lesson=${id}`);
    await p.locator("[data-start]").click();
    await p.locator("[data-score]").click();
    await p.waitForFunction(
      () => !document.querySelector("#score-play").disabled,
    );
    assert.match(
      await p.locator("#score-status").innerText(),
      new RegExp(`${bars} 小节`),
    );
    assert.equal(await p.locator("#score-bpm").inputValue(), String(bpm));
    assert.ok((await p.locator("#score-render svg").count()) > 0);
    await p.locator("#score-bpm").fill("50");
    await p.locator("#score-bpm").dispatchEvent("change");
    await p.locator("#score-loop").check();
    await p.locator("#score-play").click();
    await p.waitForFunction(
      () => document.querySelector("#score-play").textContent === "暂停",
    );
    await p.waitForTimeout(500);
    await p.locator("#score-play").click();
    await p.waitForFunction(
      () => document.querySelector("#score-play").textContent === "播放",
    );
    await p.locator("#score-source").click();
    assert.equal(await p.locator("#score-images img").count(), images);
    await p.locator("#score-source").click();
    const download = p.waitForEvent("download");
    await p.locator("#score-gp").click();
    const path = `/tmp/score-test-${id}.gp`;
    await (await download).saveAs(path);
    const score = alpha.importer.ScoreLoader.loadScoreFromBytes(
      new Uint8Array(await fs.readFile(path)),
    );
    assert.equal(score.masterBars.length, bars);
    await p.screenshot({ path: `/tmp/score-${bars}-desktop.png` });
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(300);
    assert.equal(
      await p
        .locator("#score-dialog")
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 2),
      true,
    );
    await p.screenshot({ path: `/tmp/score-${bars}-mobile.png` });
    await p.locator("#score-close").click();
    await p.locator("#score-dialog").waitFor({ state: "hidden" });
    await context.close();
  }
  const extra = await browser.newContext();
  const p = await extra.newPage();
  await p.goto(`${base}/#practice?stage=1`);
  await p.locator("[data-start]").click();
  await p.locator("[data-score]").click();
  await p.waitForFunction(() =>
    document.querySelector("#score-status").textContent.includes("还没有谱"),
  );
  await p
    .locator("#score-file")
    .setInputFiles("/tmp/score-test-35754410769.gp");
  await p.waitForFunction(
    () => !document.querySelector("#score-play").disabled,
  );
  assert.match(await p.locator("#score-status").innerText(), /4 小节/);
  await p
    .locator("#score-file")
    .setInputFiles({
      name: "invalid.musicxml",
      mimeType: "application/xml",
      buffer: Buffer.from("not a score"),
    });
  await p.waitForFunction(() =>
    /失败|无法|不支持/.test(
      document.querySelector("#score-status").textContent,
    ),
  );
  assert.equal(await p.locator("#score-gp").isDisabled(), true);
  await extra.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: both pilot scores render, playback toggles, BPM/loop controls, source pages, GP download and reimport, responsive overlay, close cleanup.",
  );
} finally {
  await browser.close();
}
