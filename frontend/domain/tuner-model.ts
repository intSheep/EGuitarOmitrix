// Single-note standard-tuning aid & chromatic ear-training pitch helpers.
// No recordings or performance evidence.
const NOTE_NAMES = [
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
] as const;

const SOLFEGE_NATURAL: readonly (string | null)[] = [
  "do",
  null,
  "re",
  null,
  "mi",
  "fa",
  null,
  "sol",
  null,
  "la",
  null,
  "si",
];

export const STRINGS = [
  { string: 6, note: "E2", midi: 40 },
  { string: 5, note: "A2", midi: 45 },
  { string: 4, note: "D3", midi: 50 },
  { string: 3, note: "G3", midi: 55 },
  { string: 2, note: "B3", midi: 59 },
  { string: 1, note: "E4", midi: 64 },
].map((s) => ({ ...s, frequency: 440 * 2 ** ((s.midi - 69) / 12) }));

export function microphoneErrorMessage(error: unknown): string {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "未获得麦克风权限。请在系统设置或浏览器地址栏允许访问后重试。";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "找不到所选输入设备。请连接麦克风或声卡，再重新开启。";
  if (name === "NotReadableError" || name === "AbortError")
    return "无法读取输入设备。请检查设备连接及其他应用的占用，再重试。";
  return "麦克风未能启动。请检查浏览器和设备后重试。";
}

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
  return {
    frequency,
    target,
    cents,
    note: NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1),
    direction: (Math.abs(cents) <= 5 ? "in-tune" : cents < 0 ? "flat" : "sharp") as
      | "in-tune"
      | "flat"
      | "sharp",
  };
}

export type TuningReading = NonNullable<ReturnType<typeof tuningReading>>;

export interface ChromaticReading {
  frequency: number;
  midiFloat: number;
  midi: number;
  cents: number;
  noteName: string;
  octave: number;
  note: string;
  solfege: string | null;
  pitchIndex: number;
}

/** Maps any audible fundamental frequency to the nearest equal-tempered semitone. */
export function chromaticReading(
  frequency: number | null,
): ChromaticReading | null {
  if (frequency === null || !Number.isFinite(frequency) || frequency <= 0)
    return null;
  const midiFloat = 69 + 12 * Math.log2(frequency / 440);
  const midi = Math.round(midiFloat);
  const cents = (midiFloat - midi) * 100;
  const pitchIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const noteName = NOTE_NAMES[pitchIndex];
  return {
    frequency,
    midiFloat,
    midi,
    cents,
    noteName,
    octave,
    note: `${noteName}${octave}`,
    solfege: SOLFEGE_NATURAL[pitchIndex],
    pitchIndex,
  };
}

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

export interface ChromaticStepResult {
  reading: ChromaticReading | null;
  held: boolean;
  discontinuous: boolean;
  lastConfirmed: ChromaticReading | null;
}

/**
 * Tracks continuous chromatic pitch across guitar plucks and vocal humming.
 * Uses 2-frame onset confirmation, 3-frame median outlier rejection, adaptive
 * MIDI-space EMA, and a short silence grace so stopping sound clears promptly.
 */
export class ChromaticPitchTracker {
  private window: number[] = [];
  private pendingJump: number[] = [];
  private smoothedMidi: number | null = null;
  private activeReading: ChromaticReading | null = null;
  private lastConfirmed: ChromaticReading | null = null;
  private lastValidAt = -Infinity;
  private confirmCount = 0;
  readonly graceMs: number;

  constructor({ graceMs = 160 }: { graceMs?: number } = {}) {
    this.graceMs = graceMs;
  }

  reset(clearLast = true) {
    this.window = [];
    this.pendingJump = [];
    this.smoothedMidi = null;
    this.activeReading = null;
    this.lastValidAt = -Infinity;
    this.confirmCount = 0;
    if (clearLast) this.lastConfirmed = null;
  }

  step(
    frequency: number | null,
    nowMs = Date.now(),
  ): ChromaticStepResult {
    if (frequency === null || !Number.isFinite(frequency) || frequency <= 0) {
      this.pendingJump = [];
      if (this.activeReading && nowMs - this.lastValidAt <= this.graceMs) {
        return {
          reading: this.activeReading,
          held: true,
          discontinuous: false,
          lastConfirmed: this.lastConfirmed,
        };
      }
      this.reset(false);
      return {
        reading: null,
        held: false,
        discontinuous: true,
        lastConfirmed: this.lastConfirmed,
      };
    }

    const rawMidi = 69 + 12 * Math.log2(frequency / 440);
    const wasSilent = this.activeReading === null;
    let jumped = false;

    if (this.window.length > 0) {
      const anchor = this.smoothedMidi ?? this.window.at(-1)!;
      if (Math.abs(rawMidi - anchor) > 1.1) {
        this.pendingJump.push(rawMidi);
        if (
          this.pendingJump.length >= 2 &&
          Math.abs(this.pendingJump.at(-1)! - this.pendingJump.at(-2)!) <= 1.1
        ) {
          this.window = this.pendingJump.slice(-2);
          this.pendingJump = [];
          this.smoothedMidi = null;
          this.confirmCount = 2;
          jumped = true;
        } else if (
          this.activeReading &&
          nowMs - this.lastValidAt <= this.graceMs
        ) {
          return {
            reading: this.activeReading,
            held: true,
            discontinuous: false,
            lastConfirmed: this.lastConfirmed,
          };
        } else {
          if (this.activeReading === null) {
            // Two mismatched onset frames: keep only the latest candidate.
            this.window = [rawMidi];
            this.pendingJump = [];
            this.confirmCount = 1;
          }
          return {
            reading: null,
            held: false,
            discontinuous: true,
            lastConfirmed: this.lastConfirmed,
          };
        }
      } else {
        this.pendingJump = [];
        this.window.push(rawMidi);
        if (this.window.length > 3) this.window.shift();
        this.confirmCount++;
      }
    } else {
      this.pendingJump = [];
      this.window = [rawMidi];
      this.confirmCount = 1;
    }

    if (this.confirmCount < 2) {
      return {
        reading: null,
        held: false,
        discontinuous: true,
        lastConfirmed: this.lastConfirmed,
      };
    }

    const sorted = [...this.window].sort((a, b) => a - b);
    const medianMidi = sorted[Math.floor(sorted.length / 2)];
    if (this.smoothedMidi === null || jumped) {
      this.smoothedMidi = medianMidi;
    } else {
      const delta = Math.abs(medianMidi - this.smoothedMidi);
      const alpha = delta > 0.35 ? 0.55 : delta > 0.1 ? 0.35 : 0.22;
      this.smoothedMidi =
        this.smoothedMidi + (medianMidi - this.smoothedMidi) * alpha;
    }

    const smoothedFreq = 440 * 2 ** ((this.smoothedMidi - 69) / 12);
    const current = chromaticReading(smoothedFreq);
    if (!current) {
      return {
        reading: null,
        held: false,
        discontinuous: true,
        lastConfirmed: this.lastConfirmed,
      };
    }

    this.activeReading = current;
    this.lastConfirmed = current;
    this.lastValidAt = nowMs;

    return {
      reading: current,
      held: false,
      discontinuous: wasSilent || jumped,
      lastConfirmed: this.lastConfirmed,
    };
  }
}

export interface PitchDetectOptions {
  minFreq: number;
  maxFreq: number;
  searchMaxFreq: number;
  minRms: number;
  threshold: number;
}

// YIN cumulative mean normalized difference, first qualified local minimum,
// and parabolic interpolation (de Cheveigne & Kawahara, JASA 2002).
export function detectPitchInRange(
  samples: Float32Array | number[],
  sampleRate: number,
  { minFreq, maxFreq, searchMaxFreq, minRms, threshold }: PitchDetectOptions,
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
  if (!Number.isFinite(rms) || rms < minRms)
    return { frequency: null, rms: Number.isFinite(rms) ? rms : 0 };
  // Search above the supported range too, so a high note is rejected rather
  // than accepted at a later subharmonic minimum (e.g. 660 Hz as 330 Hz).
  const minLag = Math.max(2, Math.floor(sampleRate / searchMaxFreq)),
    maxLag = Math.min(
      Math.ceil(sampleRate / minFreq),
      Math.floor(samples.length / 2) - 1,
    );
  const size = samples.length - maxLag - 1;
  if (maxLag <= minLag + 1 || size <= 0) return { frequency: null, rms };
  const difference = new Float64Array(maxLag + 2);
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
    if (difference[lag] >= threshold) continue;
    while (lag < maxLag && difference[lag + 1] < difference[lag]) lag++;
    if (lag === minLag || lag === maxLag) return { frequency: null, rms };
    const a = difference[lag - 1],
      b = difference[lag],
      c = difference[lag + 1];
    const divisor = 2 * (2 * b - a - c);
    const period = lag + (divisor ? (c - a) / divisor : 0);
    const frequency = sampleRate / period;
    return {
      frequency:
        frequency >= minFreq && frequency <= maxFreq ? frequency : null,
      rms,
    };
  }
  return { frequency: null, rms };
}

// Bounded for standard guitar open strings; rejects weak/aperiodic signals.
export function detectPitch(
  samples: Float32Array | number[],
  sampleRate: number,
) {
  return detectPitchInRange(samples, sampleRate, {
    minFreq: 65,
    maxFreq: 380,
    searchMaxFreq: 1200,
    minRms: 0.004,
    threshold: 0.15,
  });
}

// Broad guitar + vocal humming range (C2–C#6).
export function detectChromaticPitch(
  samples: Float32Array | number[],
  sampleRate: number,
) {
  return detectPitchInRange(samples, sampleRate, {
    minFreq: 65,
    maxFreq: 1100,
    searchMaxFreq: 2400,
    minRms: 0.0022,
    threshold: 0.16,
  });
}
