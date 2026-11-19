let toneAudio: AudioContext | null = null;

function getToneContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!toneAudio || toneAudio.state === "closed") {
    toneAudio = new AudioCtor();
  }
  if (toneAudio.state === "suspended") {
    toneAudio.resume().catch(() => {});
  }
  return toneAudio;
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Plays a gentle plucked-like harmonic reference tone for ear orientation.
 */
export function playReferenceFrequency(frequency: number): void {
  if (!Number.isFinite(frequency) || frequency <= 0) return;
  const ctx = getToneContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(Math.min(6000, frequency * 5), now);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(180, frequency * 1.6),
      now + 0.95,
    );
    filter.connect(ctx.destination);

    for (const [mult, amp] of [
      [1, 0.14],
      [2, 0.065],
      [3, 0.025],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = mult === 1 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(frequency * mult, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(amp, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
      osc.connect(gain);
      gain.connect(filter);
      osc.start(now);
      osc.stop(now + 1.05);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
  } catch {
    // Ignore audio context startup limits when triggered outside gesture.
  }
}

export function playReferenceMidi(midi: number): void {
  playReferenceFrequency(midiToFrequency(midi));
}

export function disposeReferenceTone(): void {
  toneAudio?.close().catch(() => {});
  toneAudio = null;
}
