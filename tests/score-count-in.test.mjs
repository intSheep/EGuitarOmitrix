import test from "node:test";
import assert from "node:assert/strict";
import { countInTiming, ScoreCountIn } from "../app/score-count-in.js";

const bar = (start, end, numerator, denominator, tempo) => ({
  start, end,
  masterBar: { timeSignatureNumerator: numerator, timeSignatureDenominator: denominator },
  tempoChanges: [{ tick: start, tempo }],
});
const player = (bars, tick = 0, speed = 1) => ({
  tickPosition: tick, playbackSpeed: speed,
  score: { tempo: 120, masterBars: bars.map((b) => b.masterBar) },
  tickCache: { masterBars: bars },
});

test("one complete bar follows meter, denominator and current playback speed", () => {
  assert.deepEqual(countInTiming(player([bar(0, 3840, 4, 4, 120)])), { beats: 4, beatSeconds: 0.5 });
  assert.deepEqual(countInTiming(player([bar(0, 2880, 3, 4, 120)], 0, 0.5)), { beats: 3, beatSeconds: 1 });
  assert.deepEqual(countInTiming(player([bar(0, 2880, 6, 8, 120)])), { beats: 6, beatSeconds: 0.25 });
});

test("resume uses the current occurrence, changed meter and intra-bar tempo", () => {
  const bars = [bar(0, 3840, 4, 4, 80), bar(3840, 6720, 3, 4, 90), bar(6720, 10560, 4, 4, 100)];
  bars[2].tempoChanges.push({ tick: 7680, tempo: 150 });
  assert.deepEqual(countInTiming(player(bars, 4000)), { beats: 3, beatSeconds: 60 / 90 });
  assert.deepEqual(countInTiming(player(bars, 8000)), { beats: 4, beatSeconds: 0.4 });
});

test("backing sync tempo preserves later speed changes without doubling the rate", () => {
  const p = player([bar(0, 3840, 4, 4, 120)], 100, 0.5);
  assert.deepEqual(countInTiming(p, { currentTick: 100, modifiedTempo: 100, speed: 1 }), { beats: 4, beatSeconds: 1.2 });
  assert.deepEqual(countInTiming(p, { currentTick: 100, modifiedTempo: 50, speed: 0.5 }), { beats: 4, beatSeconds: 1.2 });
  assert.throws(() => countInTiming({ score: {} }), /无法确定/);
});

function fakeAudio() {
  return {
    currentTime: 0, state: "running", destination: {}, nodes: [],
    async resume() {}, async close() { this.state = "closed"; },
    createOscillator() {
      const osc = { frequency: {}, connect() {}, disconnect() {}, start(at) { this.at = at; }, stop() { this.stopped = true; } };
      this.nodes.push(osc); return osc;
    },
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; },
  };
}
async function flush() { await Promise.resolve(); await Promise.resolve(); }

test("clicks occupy exactly one bar and completion waits for its last beat interval", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const audio = fakeAudio(), beats = [], count = new ScoreCountIn(() => audio);
  const done = count.start({ beats: 3, beatSeconds: 0.5 }, (b) => beats.push(b));
  await flush();
  assert.deepEqual(audio.nodes.map((n) => n.at), [0.05, 0.55, 1.05]);
  assert.equal(audio.nodes[0].frequency.value, 1100);
  assert.equal(audio.nodes[1].frequency.value, 740);
  for (const at of [0.05, 0.55, 1.05, 1.54]) { audio.currentTime = at; t.mock.timers.tick(20); }
  assert.equal(count.active, true);
  audio.currentTime = 1.55; t.mock.timers.tick(20);
  assert.equal(await done, true);
  assert.deepEqual(beats, [1, 2, 3]);
  assert.equal(audio.state, "closed");
});

test("cancellation releases all clicks and late audio activation cannot restart it", async () => {
  const audio = fakeAudio(); let resume;
  audio.resume = () => new Promise((resolve) => { resume = resolve; });
  const count = new ScoreCountIn(() => audio);
  const done = count.start({ beats: 4, beatSeconds: 1 }, () => assert.fail("cancelled beat"));
  count.stop(); resume(); await flush();
  assert.equal(await done, false);
  assert.equal(count.active, false);
  assert.equal(audio.nodes.length, 0);
  assert.equal(audio.state, "closed");
});

test("failed audio activation rejects and releases its context without clicks", async () => {
  const audio = fakeAudio();
  audio.resume = async () => { throw Error("Synthetic audio denial"); };
  const count = new ScoreCountIn(() => audio);
  await assert.rejects(count.start({ beats: 4, beatSeconds: 1 }, () => {}), /Synthetic audio denial/);
  assert.equal(count.active, false);
  assert.equal(audio.state, "closed");
  assert.equal(audio.nodes.length, 0);
});

test("audio interruption and a delayed timer cancel rather than starting late", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  for (const interrupted of [true, false]) {
    const audio = fakeAudio(), count = new ScoreCountIn(() => audio);
    const done = count.start({ beats: 4, beatSeconds: 0.5 }, () => {});
    await flush();
    if (interrupted) audio.state = "suspended";
    else audio.currentTime = 5;
    t.mock.timers.tick(20);
    assert.equal(await done, false);
    assert.ok(audio.nodes.every((n) => n.stopped));
    assert.equal(audio.state, "closed");
  }
});
