// Single-note standard-tuning aid. No recordings or performance evidence.
export const STRINGS = [
  { string: 6, note: "E2", midi: 40 },
  { string: 5, note: "A2", midi: 45 },
  { string: 4, note: "D3", midi: 50 },
  { string: 3, note: "G3", midi: 55 },
  { string: 2, note: "B3", midi: 59 },
  { string: 1, note: "E4", midi: 64 },
].map((s) => ({ ...s, frequency: 440 * 2 ** ((s.midi - 69) / 12) }));

export function tuningReading(
  frequency: number | null,
  preferredString: number | null = null,
) {
  if (frequency === null || !Number.isFinite(frequency) || frequency <= 0)
    return null;
  const locked =
    preferredString !== null
      ? STRINGS.find((s) => s.string === preferredString) || null
      : null;
  const target =
    locked ||
    STRINGS.reduce((a, b) =>
      Math.abs(Math.log2(frequency / a.frequency)) <
      Math.abs(Math.log2(frequency / b.frequency))
        ? a
        : b,
    );
  const cents = 1200 * Math.log2(frequency / target.frequency);
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const names = [
    "C",
    "C♯",
    "D",
    "D♯",
    "E",
    "F",
    "F♯",
    "G",
    "G♯",
    "A",
    "A♯",
    "B",
  ];
  return {
    frequency,
    target,
    cents,
    note: names[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1),
    direction: (Math.abs(cents) <= 5 ? "in-tune" : cents < 0 ? "flat" : "sharp") as
      | "in-tune"
      | "flat"
      | "sharp",
  };
}

export type TuningReading = NonNullable<ReturnType<typeof tuningReading>>;

/**
 * Stabilizes raw pitch frames using a 3-point median filter, adaptive cents-domain
 * exponential smoothing (One-Euro inspired), string hysteresis, and a 3-second
 * sustain hold so a single plucked note stays readable on screen and emits audio cues.
 */
export class TunerTracker {
  private window: number[] = [];
  private smoothedFreq: number | null = null;
  private activeString: number | null = null;
  private lockedString: number | null = null;
  private lastReading: TuningReading | null = null;
  private lastValidAt = -Infinity;
  private stableFrames = 0;
  private inTuneFrames = 0;
  private lastCueAt = -Infinity;
  private lastCueDirection: "in-tune" | "flat" | "sharp" | null = null;
  readonly holdMs: number;

  constructor({ holdMs = 3000 }: { holdMs?: number } = {}) {
    this.holdMs = holdMs;
  }

  setLockedString(stringNumber: number | null) {
    this.lockedString = stringNumber;
    this.reset();
  }

  getLockedString() {
    return this.lockedString;
  }

  reset() {
    this.window = [];
    this.smoothedFreq = null;
    this.activeString = null;
    this.lastReading = null;
    this.lastValidAt = -Infinity;
    this.stableFrames = 0;
    this.inTuneFrames = 0;
    this.lastCueDirection = null;
  }

  step(
    frequency: number | null,
    nowMs = Date.now(),
  ): {
    reading: TuningReading | null;
    held: boolean;
    lockedInTune: boolean;
    cue: "in-tune" | "flat" | "sharp" | null;
  } {
    if (frequency === null || !Number.isFinite(frequency) || frequency <= 0) {
      this.window = [];
      this.stableFrames = 0;
      this.inTuneFrames = 0;
      if (this.lastReading && nowMs - this.lastValidAt <= this.holdMs) {
        return {
          reading: this.lastReading,
          held: true,
          lockedInTune: this.lastReading.direction === "in-tune",
          cue: null,
        };
      }
      this.smoothedFreq = null;
      this.activeString = null;
      this.lastReading = null;
      this.lastCueDirection = null;
      return { reading: null, held: false, lockedInTune: false, cue: null };
    }

    if (
      this.window.length > 0 &&
      Math.abs(1200 * Math.log2(frequency / this.window.at(-1)!)) > 120
    ) {
      this.window = [];
      this.smoothedFreq = null;
      this.stableFrames = 0;
      this.inTuneFrames = 0;
    }

    this.window.push(frequency);
    if (this.window.length > 3) this.window.shift();
    const sorted = [...this.window].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    if (this.smoothedFreq === null) {
      this.smoothedFreq = median;
    } else {
      const driftCents = Math.abs(1200 * Math.log2(median / this.smoothedFreq));
      const alpha = driftCents > 25 ? 0.65 : driftCents > 8 ? 0.4 : 0.25;
      this.smoothedFreq =
        this.smoothedFreq * (1 - alpha) + median * alpha;
    }

    let preferred = this.lockedString;
    if (preferred === null && this.activeString !== null) {
      const currentTarget = STRINGS.find((s) => s.string === this.activeString);
      const nearest = tuningReading(this.smoothedFreq)?.target;
      if (currentTarget && nearest && nearest.string !== currentTarget.string) {
        const centsToCurrent = Math.abs(
          1200 * Math.log2(this.smoothedFreq / currentTarget.frequency),
        );
        const centsToNearest = Math.abs(
          1200 * Math.log2(this.smoothedFreq / nearest.frequency),
        );
        if (centsToCurrent - centsToNearest < 35) {
          preferred = currentTarget.string;
        }
      }
    }

    const current = tuningReading(this.smoothedFreq, preferred);
    if (!current) {
      return { reading: null, held: false, lockedInTune: false, cue: null };
    }
    this.activeString = current.target.string;
    this.lastReading = current;
    this.lastValidAt = nowMs;
    this.stableFrames++;

    if (current.direction === "in-tune") {
      this.inTuneFrames++;
    } else {
      this.inTuneFrames = 0;
    }

    const lockedInTune = this.inTuneFrames >= 2;
    let cue: "in-tune" | "flat" | "sharp" | null = null;
    if (lockedInTune && this.lastCueDirection !== "in-tune") {
      cue = "in-tune";
      this.lastCueDirection = "in-tune";
      this.lastCueAt = nowMs;
    } else if (
      this.stableFrames >= 3 &&
      current.direction !== "in-tune" &&
      Math.abs(current.cents) <= 400 &&
      (nowMs - this.lastCueAt >= 1800 ||
        (this.lastCueDirection !== null &&
          this.lastCueDirection !== current.direction &&
          nowMs - this.lastCueAt >= 900))
    ) {
      cue = current.direction;
      this.lastCueDirection = current.direction;
      this.lastCueAt = nowMs;
    }

    return {
      reading: current,
      held: false,
      lockedInTune,
      cue,
    };
  }
}

// YIN cumulative mean normalized difference, first qualified local minimum,
// and parabolic interpolation (de Cheveigne & Kawahara, JASA 2002).
// Bounded for standard guitar open strings; rejects weak/aperiodic signals.
export function detectPitch(
  samples: Float32Array | number[],
  sampleRate: number,
) {
  if (
    !Number.isFinite(sampleRate) ||
    sampleRate < 8000 ||
    samples.length < 2048
  )
    return { frequency: null, rms: 0 };
  let mean = 0,
    power = 0;
  for (const v of samples) mean += v;
  mean /= samples.length;
  for (const v of samples) power += (v - mean) ** 2;
  const rms = Math.sqrt(power / samples.length);
  if (!Number.isFinite(rms) || rms < 0.004)
    return { frequency: null, rms: Number.isFinite(rms) ? rms : 0 };
  // Search above the supported range too, so a high note is rejected rather
  // than accepted at a later subharmonic minimum (e.g. 660 Hz as 330 Hz).
  const minLag = Math.floor(sampleRate / 1200),
    maxLag = Math.min(
      Math.ceil(sampleRate / 65),
      Math.floor(samples.length / 2) - 1,
    );
  const size = samples.length - maxLag - 1,
    difference = new Float64Array(maxLag + 2);
  let sum = 0;
  difference[0] = 1;
  for (let lag = 1; lag <= maxLag + 1; lag++) {
    let value = 0;
    for (let i = 0; i < size; i++)
      value += (samples[i] - samples[i + lag]) ** 2;
    sum += value;
    difference[lag] = sum ? (value * lag) / sum : 1;
  }
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (difference[lag] >= 0.15) continue;
    while (lag < maxLag && difference[lag + 1] < difference[lag]) lag++;
    if (lag === minLag || lag === maxLag) return { frequency: null, rms };
    const a = difference[lag - 1],
      b = difference[lag],
      c = difference[lag + 1];
    const divisor = 2 * (2 * b - a - c);
    const period = lag + (divisor ? (c - a) / divisor : 0);
    const frequency = sampleRate / period;
    return {
      frequency: frequency >= 65 && frequency <= 380 ? frequency : null,
      rms,
    };
  }
  return { frequency: null, rms };
}
