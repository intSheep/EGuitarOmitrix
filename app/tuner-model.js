// Single-note standard-tuning aid. No recordings or performance evidence.
export const STRINGS = [
  { string: 6, note: 'E2', midi: 40 },
  { string: 5, note: 'A2', midi: 45 },
  { string: 4, note: 'D3', midi: 50 },
  { string: 3, note: 'G3', midi: 55 },
  { string: 2, note: 'B3', midi: 59 },
  { string: 1, note: 'E4', midi: 64 },
].map(s => ({ ...s, frequency: 440 * 2 ** ((s.midi - 69) / 12) }));

export function tuningReading(frequency) {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  const target = STRINGS.reduce((a, b) => Math.abs(Math.log2(frequency / a.frequency)) < Math.abs(Math.log2(frequency / b.frequency)) ? a : b);
  const cents = 1200 * Math.log2(frequency / target.frequency);
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  return { frequency, target, cents, note: names[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1),
    direction: Math.abs(cents) <= 5 ? 'in-tune' : cents < 0 ? 'flat' : 'sharp' };
}

// YIN cumulative mean normalized difference, first qualified local minimum,
// and parabolic interpolation (de Cheveigne & Kawahara, JASA 2002).
// Bounded for standard guitar open strings; rejects weak/aperiodic signals.
export function detectPitch(samples, sampleRate) {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || samples.length < 2048) return { frequency: null, rms: 0 };
  let mean = 0, power = 0;
  for (const v of samples) mean += v;
  mean /= samples.length;
  for (const v of samples) power += (v - mean) ** 2;
  const rms = Math.sqrt(power / samples.length);
  if (!Number.isFinite(rms) || rms < 0.004) return { frequency: null, rms: Number.isFinite(rms) ? rms : 0 };
  // Search above the supported range too, so a high note is rejected rather
  // than accepted at a later subharmonic minimum (e.g. 660 Hz as 330 Hz).
  const minLag = Math.floor(sampleRate / 1200), maxLag = Math.min(Math.ceil(sampleRate / 65), Math.floor(samples.length / 2) - 1);
  const size = samples.length - maxLag - 1, difference = new Float64Array(maxLag + 2);
  let sum = 0;
  difference[0] = 1;
  for (let lag = 1; lag <= maxLag + 1; lag++) {
    let value = 0;
    for (let i = 0; i < size; i++) value += (samples[i] - samples[i + lag]) ** 2;
    sum += value;
    difference[lag] = sum ? value * lag / sum : 1;
  }
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (difference[lag] >= 0.15) continue;
    while (lag < maxLag && difference[lag + 1] < difference[lag]) lag++;
    if (lag === minLag || lag === maxLag) return { frequency: null, rms };
    const a = difference[lag - 1], b = difference[lag], c = difference[lag + 1];
    const divisor = 2 * (2 * b - a - c);
    const period = lag + (divisor ? (c - a) / divisor : 0);
    const frequency = sampleRate / period;
    return { frequency: frequency >= 65 && frequency <= 380 ? frequency : null, rms };
  }
  return { frequency: null, rms };
}
