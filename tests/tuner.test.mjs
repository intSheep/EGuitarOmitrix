import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, detectPitch, tuningReading } from '../app/tuner-model.js';

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
test('manual target preserves large deviations and octave differences', () => {
  const value = tuningReading(STRINGS[0].frequency * 2, 6);
  assert.ok(Math.abs(value.cents - 1200) < 1e-8);
  assert.equal(value.direction, 'sharp');
  assert.equal(value.note, 'E3');
  assert.equal(tuningReading(null), null);
  assert.equal(tuningReading(Infinity), null);
  assert.equal(tuningReading(110, 9), null);
});
