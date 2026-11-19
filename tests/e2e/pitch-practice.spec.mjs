// Synthetic WebAudio pitch fixtures; never touches the owner's profile or real microphone.
import { test, expect } from "@playwright/test";
import { syntheticScore } from "../fixtures/synthetic-score.mjs";

const draft = (page) =>
  page.evaluate(async () => {
    const m = await import("./practice-store.js");
    const db = await m.openPracticeDB();
    const d = await m.readDraft(db);
    db.close();
    return d;
  });

async function setupSyntheticAudio(page, mode = "normal") {
  await page.addInitScript(
    ({ mode }) => {
      window.eguitarDesktop = { checkUpdates: async () => {} };
      window.pitchQA = {
        streams: [],
        requests: [],
        contexts: [],
        setTone(freq, gain = 0.25) {
          if (this.osc && this.gain) {
            this.osc.frequency.value = freq;
            this.gain.gain.value = gain;
          }
        },
      };
      const NativeAudio = window.AudioContext;
      window.AudioContext = class extends NativeAudio {
        constructor(...args) {
          super(...args);
          window.pitchQA.contexts.push(this);
        }
      };
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        window.pitchQA.requests.push(constraints);
        if (mode === "denied") {
          throw new DOMException("Synthetic denial", "NotAllowedError");
        }
        const synth = new NativeAudio();
        const osc = synth.createOscillator();
        const gain = synth.createGain();
        const dest = synth.createMediaStreamDestination();
        osc.type = "triangle";
        osc.frequency.value = 261.63;
        gain.gain.value = 0.25;
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
        await synth.resume();
        window.pitchQA.osc = osc;
        window.pitchQA.gain = gain;
        const stream = dest.stream;
        const track = stream.getAudioTracks()[0];
        const origStop = track.stop.bind(track);
        track.stop = () => {
          origStop();
          try {
            osc.stop();
          } catch {}
          synth.close().catch(() => {});
        };
        window.pitchQA.streams.push(stream);
        return stream;
      };
      navigator.mediaDevices.enumerateDevices = async () => [
        {
          kind: "audioinput",
          deviceId: "synthetic-mic-1",
          label: "Synthetic Guitar Mic",
        },
        {
          kind: "audioinput",
          deviceId: "synthetic-usb-2",
          label: "Synthetic USB Interface",
        },
      ];
    },
    { mode },
  );
}

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 800, height: 600 },
  { width: 390, height: 700 },
]) {
  test(`white-canvas pitch playground works and fits at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize(viewport);
    await setupSyntheticAudio(page, "normal");

    await page.goto("/#practice?view=lesson");
    await page.locator("[data-start]:enabled").click();
    await page.locator("#focus-clock").waitFor();

    // Mic must never start automatically on entering focus.
    expect(await page.evaluate(() => window.pitchQA.requests.length)).toBe(0);
    if (viewport.width === 1280 || viewport.width === 390) {
      await page.screenshot({
        path: `test-results/focus-default-${viewport.width}.png`,
      });
    }

    await page.locator("[data-action=pitch-open]").click();
    await page.locator('#focus-clock[data-pitch-stage="true"]').waitFor();

    // Initial guitar tone C4 (261.63 Hz)
    await expect(page.locator("[data-pitch-note]")).toHaveText("C4");
    await expect(page.locator(".pitch-solfege-pill")).toHaveText("唱名 do");
    expect(
      await page.evaluate(
        () => window.pitchQA.requests[0].audio.echoCancellation,
      ),
    ).toBe(false);

    // Let the scrolling pitch ribbon paint across the white canvas.
    await page.waitForTimeout(700);
    const hasCanvasInk = await page.evaluate(() => {
      const canvas = document.querySelector(".pitch-canvas");
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return false;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < data.length; i += 16) {
        if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245)
          return true;
      }
      return false;
    });
    expect(hasCanvasInk).toBe(true);

    // Shift tone to D4 (293.66 Hz) simulating humming off-pitch after muting guitar.
    await page.evaluate(() => window.pitchQA.setTone(293.66, 0.25));
    await expect(page.locator("[data-pitch-note]")).toHaveText("D4");
    await expect(page.locator(".pitch-solfege-pill")).toHaveText("唱名 re");
    await page.waitForTimeout(550);

    await page.screenshot({
      path: `test-results/pitch-stage-${viewport.width}.png`,
    });

    // Verify geometry: no horizontal overflow and transport actions remain inside viewport.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const selector of [
      ".pitch-stage-board",
      "[data-action=pause]",
      "[data-action=finish]",
    ]) {
      const rect = await page.locator(selector).boundingBox();
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height + 1);
    }

    // Silence releases the live note promptly and reveals the previous-note cue.
    await page.evaluate(() => window.pitchQA.setTone(293.66, 0));
    await expect(page.locator("[data-pitch-note]")).toHaveText("—");
    await expect(page.locator("[data-pitch-last]")).toContainText("D4");

    // Opening metronome keeps pitch stage open and capture alive simultaneously.
    await page.evaluate(() => window.pitchQA.setTone(261.63, 0.25));
    await page.locator("[data-action=metronome]").click();
    await expect(page.locator("#metro-panel")).toBeVisible();
    await expect(page.locator("[data-pitch-note]")).toHaveText("C4");
    await page.locator("[data-action=metro-toggle]").click();
    await expect(page.locator("[data-action=metro-toggle]")).toHaveText(
      "停止节拍",
    );
    await expect(
      page.locator('[data-action=metronome][data-playing="true"]'),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        window.pitchQA.streams.some((s) =>
          s.getTracks().some((t) => t.readyState === "live"),
        ),
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/pitch-metronome-${viewport.width}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const selector of [
      ".pitch-stage-board",
      "#metro-panel",
      "[data-action=pause]",
      "[data-action=finish]",
    ]) {
      const rect = await page.locator(selector).boundingBox();
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height + 1);
    }

    // Switching to score keeps BOTH pitch capture AND active metronome running.
    await page.locator("[data-score]").click();
    await expect(page.locator("#score-dialog")).toBeVisible();
    await page.locator(".score-options summary").click();
    await expect(page.locator("#score-file")).toBeEnabled();
    await page.locator("#score-file").setInputFiles({
      name: "synthetic.musicxml",
      mimeType: "application/xml",
      buffer: Buffer.from(syntheticScore),
    });
    await expect(page.locator("#score-play")).toBeEnabled();
    await page.locator(".score-options summary").click();
    await expect(page.locator("[data-pitch-note]")).toHaveText("C4");
    await expect(
      page.locator('[data-action=metronome][data-playing="true"]'),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/pitch-score-${viewport.width}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const selector of [
      ".pitch-stage-board",
      "#focus-tool-content",
      "[data-action=pause]",
      "[data-action=finish]",
    ]) {
      const rect = await page.locator(selector).boundingBox();
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height + 1);
    }

    // Closing and reopening pitch directly from the dock works while score stays open.
    await page.locator("[data-action=pitch-toggle]").click();
    await expect(page.locator(".pitch-stage")).toHaveCount(0);
    await expect(page.locator("#score-dialog")).toBeVisible();
    await page.locator("[data-action=pitch-toggle]").click();
    await expect(page.locator("[data-pitch-note]")).toHaveText("C4");
    await expect(page.locator("#score-dialog")).toBeVisible();

    // Switching to tuner releases prior pitch capture, starts tuner immediately, and omits privacy caption.
    const priorStreamCount = await page.evaluate(
      () => window.pitchQA.streams.length,
    );
    await page.locator("[data-tuner]").click();
    await expect(
      page.locator('#tuner-dialog[data-listening="true"]'),
    ).toBeVisible();
    await page.waitForFunction(
      (count) =>
        window.pitchQA.streams
          .slice(0, count)
          .every((s) => s.getTracks().every((t) => t.readyState === "ended")),
      priorStreamCount,
    );
    await expect(page.locator(".tuner-privacy")).toHaveCount(0);
    await expect(page.locator(".pitch-privacy-tag")).toHaveCount(0);
    // Navigating away cancels tuner microphone capture cleanly.
    await page.locator("#focus-back").click();
    await page.waitForFunction(() =>
      window.pitchQA.streams.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ),
    );
    expect((await draft(page)).running).toBe(true);
    expect(errors).toEqual([]);
  });
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
]) {
  test(`tuner auto-starts in one click, fits MacBook ${viewport.width}x${viewport.height} without scrolling, and cancels on navigation`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await setupSyntheticAudio(page, "normal");
    await page.goto("/#practice?view=lesson");

    // 1. Standalone modal on Workspace: one click opens and starts capture immediately.
    await page.locator("[data-tuner]").click();
    await expect(
      page.locator('#tuner-dialog[data-listening="true"]'),
    ).toBeVisible();
    await expect(page.locator("#tuner-stop")).toBeVisible();
    await expect(page.locator(".tuner-privacy")).toHaveCount(0);
    const modalRect = await page.locator("#tuner-stop").boundingBox();
    expect(modalRect.y + modalRect.height).toBeLessThanOrEqual(
      viewport.height,
    );
    expect(
      await page.locator("#tuner-dialog").evaluate((el) => el.scrollTop),
    ).toBe(0);
    await page.screenshot({
      path: `test-results/tuner-modal-${viewport.width}.png`,
    });

    // Closing modal releases capture.
    await page.locator("#tuner-close").click();
    await page.waitForFunction(() =>
      window.pitchQA.streams.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ),
    );

    // 2. Focus mode: one click starts tuner and fits completely inside viewport without scrolling.
    await page.locator("[data-start]:enabled").click();
    await page.locator("[data-tuner]").click();
    await expect(
      page.locator('#tuner-dialog[data-listening="true"]'),
    ).toBeVisible();
    for (const selector of [
      ".tuner-instrument",
      "#tuner-readout",
      "#tuner-stop",
      "[data-action=pause]",
      "[data-action=finish]",
    ]) {
      const rect = await page.locator(selector).boundingBox();
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    expect(
      await page
        .locator(".focus-main")
        .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/tuner-focus-${viewport.width}.png`,
    });

    // Navigating to another route cancels capture immediately.
    await page.locator("[data-action=practice-menu]").click();
    await page.locator(".practice-menu").getByRole("link", { name: "课程目录" }).click();
    await page.waitForFunction(
      () =>
        window.pitchQA.streams.every((s) =>
          s.getTracks().every((t) => t.readyState === "ended"),
        ) && window.pitchQA.contexts.every((c) => c.state === "closed"),
    );
  });
}

test("pitch stage releases capture on background and handles permission denial", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await setupSyntheticAudio(page, "normal");
  await page.goto("/#practice?view=lesson");
  await page.locator("[data-start]:enabled").click();
  await page.locator("[data-action=pitch-open]").click();
  await expect(page.locator("[data-pitch-note]")).toHaveText("C4");

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(
    () =>
      window.pitchQA.streams.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ) && window.pitchQA.contexts.every((c) => c.state === "closed"),
  );
  expect((await draft(page)).running).toBe(true);

  // Denied permission shows clear error and retry without breaking practice.
  const deniedCtx = await page.context().browser().newContext({
    viewport: { width: 1280, height: 720 },
  });
  const deniedPage = await deniedCtx.newPage();
  await setupSyntheticAudio(deniedPage, "denied");
  await deniedPage.goto("/#practice?view=lesson");
  await deniedPage.locator("[data-start]:enabled").click();
  await deniedPage.locator("[data-action=pitch-open]").click();
  await expect(deniedPage.locator(".pitch-stage-status")).toContainText(
    "未获得麦克风权限",
  );
  await expect(deniedPage.locator("[data-action=pitch-retry]")).toBeVisible();
  expect((await draft(deniedPage)).running).toBe(true);
  await deniedCtx.close();
});

test("workspace standalone pitch playground and position-reference live linkage work", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 720 });
  await setupSyntheticAudio(page, "normal");
  await page.goto("/#practice?view=lesson");

  // 1. Open standalone pitch playground right from the home screen without starting practice.
  await page.locator("[data-action=workspace-pitch]").click();
  await expect(page.locator("#pitch-playground-dialog")).toBeVisible();
  expect(await draft(page)).toBeNull();
  await expect(page.locator("[data-pitch-note]")).toHaveText("C4");

  // Interval pill appears on consecutive distinct notes, and freeze/zen/guide/target controls work.
  await page.evaluate(() => window.pitchQA.setTone(293.66, 0.25));
  await expect(page.locator("[data-pitch-note]")).toHaveText("D4");
  await expect(page.locator("[data-pitch-interval]")).toHaveText("↑ 大二度");

  await page.getByRole("button", { name: "空弦" }).click();
  await page.locator("[data-action=pitch-freeze]").click();
  await expect(page.locator('[data-pitch-frozen="true"]')).toBeVisible();
  await page.locator("[data-action=pitch-freeze]").click();

  const canvasBox = await page.locator(".pitch-canvas").boundingBox();
  await page.mouse.click(
    canvasBox.x + canvasBox.width * 0.5,
    canvasBox.y + canvasBox.height * 0.5,
  );
  await expect(page.locator("[data-action=pitch-unlock-target]")).toBeVisible();
  await page.locator("[data-action=pitch-unlock-target]").click();
  await expect(page.locator("[data-action=pitch-unlock-target]")).toHaveCount(
    0,
  );

  await page.locator("[data-action=pitch-zen]").click();
  await expect(page.locator(".pitch-hero")).toHaveCount(0);
  await page.locator("[data-action=pitch-zen]").click();
  await expect(page.locator(".pitch-hero")).toBeVisible();

  await page.screenshot({
    path: "test-results/pitch-playground-1280.png",
  });

  // Closing standalone playground releases capture cleanly.
  await page.locator("[data-action=pitch-close]").click();
  await expect(page.locator("#pitch-playground-dialog")).toHaveCount(0);
  await page.waitForFunction(() =>
    window.pitchQA.streams.every((s) =>
      s.getTracks().every((t) => t.readyState === "ended"),
    ),
  );

  // 2. Focus mode: position reference + live pitch lights up exact & octave frets.
  await page.evaluate(() => window.pitchQA.setTone(261.63, 0.25));
  await page.locator("[data-start]:enabled").click();
  await page.locator("[data-position-reference]").click();
  await page.locator("[data-action=pitch-toggle]").click();
  await expect(page.locator("[data-pitch-note]")).toHaveText("C4");
  await expect(
    page.locator('#position-dialog [data-fret-midi="60"][data-live-match="exact"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('#position-dialog [data-fret-midi="48"][data-live-match="octave"]'),
  ).toHaveCount(1);

  // Clicking a fretboard note plays reference sound without errors.
  await page.locator('#position-dialog [data-fret-midi="60"]').click();
  await page.screenshot({
    path: "test-results/pitch-position-1280.png",
  });
  expect(errors).toEqual([]);
});
