import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STRINGS,
  detectPitch,
  detectChromaticPitch,
  tuningReading,
  chromaticReading,
  TunerTracker,
  ChromaticPitchTracker,
} from '../frontend/domain/tuner-model.ts';

// Synthetic PCM only; no course or personal audio.
const signal = (frequency, rate, harmonics = [0.3], noise = 0) => {
  let seed = 715;
  return Float32Array.from({ length: 4096 }, (_, i) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return 0.12 + harmonics.reduce((v, a, h) => v + a * Math.sin(2 * Math.PI * frequency * (h + 1) * i / rate + 0.3), 0) * Math.exp(-i / (rate * 0.4)) + noise * (seed / 2 ** 32 - 0.5);
  });
};
test('all six strings and detuning remain within 2 cents at common input rates', () => {
  for (const rate of [44100, 48000, 96000]) for (const string of STRINGS) for (const cents of [-40, -12, 0, 12, 40]) {
    const frequency = string.frequency * 2 ** (cents / 1200);
    const detected = detectPitch(signal(frequency, rate), rate).frequency;
    assert.ok(detected && Math.abs(1200 * Math.log2(detected / frequency)) < 2, `${rate} ${string.note} ${cents}: ${detected}`);
    const reading = tuningReading(detected);
    assert.equal(reading.target.string, string.string);
    assert.equal(reading.direction, cents === 0 ? 'in-tune' : cents < 0 ? 'flat' : 'sharp');
  }
});
test('low E with stronger harmonics and modest noise retains its fundamental', () => {
  for (const rate of [44100, 48000]) for (const string of STRINGS) {
    const frequency = detectPitch(signal(string.frequency, rate, [0.12, 0.3, 0.18, 0.07], 0.015), rate).frequency;
    assert.ok(frequency && Math.abs(1200 * Math.log2(frequency / string.frequency)) < 3, `${string.note}: ${frequency}`);
  }
});
test('silence, DC, weak signal, aperiodic noise and unsupported high notes do not claim tuning', () => {
  for (const data of [new Float32Array(4096), new Float32Array(4096).fill(0.3), signal(110, 48000, [0.001]), signal(110, 48000, [0], 0.5), signal(440, 48000), signal(660, 48000)]) {
    assert.equal(detectPitch(data, 48000).frequency, null);
  }
});
test('automatic target preserves measured octave and large deviations without folding', () => {
  const value = tuningReading(STRINGS[0].frequency * 2);
  assert.ok(Math.abs(value.cents - 200) < 1e-8);
  assert.equal(value.target.string, 4);
  assert.equal(value.direction, 'sharp');
  assert.equal(value.note, 'E3');
  assert.equal(tuningReading(null), null);
  assert.equal(tuningReading(Infinity), null);
});
test('tracker smooths pitch, holds last reading during decay, and emits audio cues', () => {
  const tracker = new TunerTracker({ holdMs: 3000 });
  const flatA2 = STRINGS[1].frequency * 2 ** (-18 / 1200);
  tracker.step(flatA2, 1000);
  tracker.step(flatA2, 1060);
  const third = tracker.step(flatA2, 1120);
  assert.equal(third.reading.target.string, 5);
  assert.equal(third.reading.direction, 'flat');
  assert.equal(third.cue, 'flat');
  // Signal drops out as string decays: reading stays held for 3 seconds instead of flashing away.
  const held = tracker.step(null, 2500);
  assert.equal(held.held, true);
  assert.equal(held.reading.target.string, 5);
  assert.equal(held.reading.direction, 'flat');
  // After 3 seconds of silence, reading clears.
  const expired = tracker.step(null, 4200);
  assert.equal(expired.reading, null);
  assert.equal(expired.held, false);
  // Reaching in-tune emits in-tune lock cue.
  tracker.step(STRINGS[1].frequency, 5000);
  const locked = tracker.step(STRINGS[1].frequency, 5060);
  assert.equal(locked.lockedInTune, true);
  assert.equal(locked.cue, 'in-tune');
});

test('chromatic pitch detector covers full guitar and vocal humming range while rejecting noise', () => {
  const cases = [
    [82.41, 'E2', 'mi'],
    [185.0, 'F♯3', null],
    [261.63, 'C4', 'do'],
    [440.0, 'A4', 'la'],
    [659.25, 'E5', 'mi'],
    [880.0, 'A5', 'la'],
  ];
  for (const [freq, expectedNote, expectedSolfege] of cases) {
    const detected = detectChromaticPitch(signal(freq, 48000, [0.25, 0.12]), 48000).frequency;
    assert.ok(detected && Math.abs(1200 * Math.log2(detected / freq)) < 3, `${expectedNote}: ${detected}`);
    const reading = chromaticReading(detected);
    assert.equal(reading.note, expectedNote);
    assert.equal(reading.solfege, expectedSolfege);
    assert.ok(Math.abs(reading.cents) < 3);
  }
  // Soft vocal humming (RMS ~ 0.0035) is detected while silence and noise remain null.
  const softHum = detectChromaticPitch(signal(293.66, 48000, [0.0055]), 48000);
  assert.ok(softHum.frequency && Math.abs(softHum.frequency - 293.66) < 1);
  for (const bad of [new Float32Array(4096), signal(110, 48000, [0], 0.5), signal(1500, 48000)]) {
    assert.equal(detectChromaticPitch(bad, 48000).frequency, null);
  }
  assert.equal(chromaticReading(null), null);
  assert.equal(chromaticReading(NaN), null);
});

test('chromatic tracker confirms quickly, breaks on interval jumps, and releases promptly on silence', () => {
  const tracker = new ChromaticPitchTracker({ graceMs: 160 });
  // Single attack click followed by C4 rejects the 1-frame spike.
  assert.equal(tracker.step(523.25, 1000).reading, null);
  assert.equal(tracker.step(261.63, 1030).reading, null);
  const locked = tracker.step(261.63, 1060);
  assert.equal(locked.reading.note, 'C4');
  assert.equal(locked.discontinuous, true);

  // Continuous hum stays connected without discontinuity.
  const hum = tracker.step(262.0, 1090);
  assert.equal(hum.reading.note, 'C4');
  assert.equal(hum.discontinuous, false);

  // A 1-frame octave glitch does not derail C4; 2 consecutive frames at E4 jump cleanly.
  const glitch = tracker.step(523.25, 1120);
  assert.equal(glitch.reading.note, 'C4');
  assert.equal(glitch.held, true);
  assert.equal(tracker.step(329.63, 1150).reading.note, 'C4');
  const jumped = tracker.step(329.63, 1180);
  assert.equal(jumped.reading.note, 'E4');
  assert.equal(jumped.discontinuous, true);

  // Brief dropout holds within grace, then clears cleanly while retaining lastConfirmed.
  assert.equal(tracker.step(null, 1280).held, true);
  const released = tracker.step(null, 1400);
  assert.equal(released.reading, null);
  assert.equal(released.held, false);
  assert.equal(released.lastConfirmed.note, 'E4');
});
