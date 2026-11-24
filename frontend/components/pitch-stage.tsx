import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import {
  getPitchCaptureSnapshot,
  startPitchCapture,
  stopPitchCapture,
  subscribePitchCapture,
  subscribePitchFrames,
  switchPitchDevice,
  type PitchFrame,
} from "../audio/pitch-capture";
import { playReferenceMidi } from "../audio/reference-tone";
import type { ChromaticReading } from "../domain/tuner-model";
import { Button } from "./ui/button";

const SPAN_SEMITONES = 22;
const HISTORY_MS = 5600;
const MAX_PARTICLES = 32;
const MAX_RIPPLES = 5;
const LABEL_ZONE_WIDTH = 56;
const NATURAL_NOTES = new Set([0, 2, 4, 5, 7, 9, 11]);
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

const OPEN_STRING_LABELS = new Map<number, string>([
  [40, "6弦 E2"],
  [45, "5弦 A2"],
  [50, "4弦 D3"],
  [55, "3弦 G3"],
  [59, "2弦 B3"],
  [64, "1弦 E4"],
]);

const INTERVAL_NAMES = [
  "同度",
  "小二度",
  "大二度",
  "小三度",
  "大三度",
  "纯四度",
  "增四度",
  "纯五度",
  "小六度",
  "大六度",
  "小七度",
  "大七度",
  "纯八度",
] as const;

type GuideMode = "chromatic" | "cmajor" | "strings";

function formatIntervalLabel(fromMidi: number, toMidi: number): string | null {
  const diff = toMidi - fromMidi;
  const abs = Math.abs(diff);
  if (abs === 0 || abs > 24) return null;
  const arrow = diff > 0 ? "↑" : "↓";
  if (abs <= 12) return `${arrow} ${INTERVAL_NAMES[abs]}`;
  const inner = INTERVAL_NAMES[abs % 12];
  return `${arrow} 八度+${inner}`;
}

function noteLabelForMidi(midi: number): string {
  const idx = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[idx]}${octave}`;
}

interface HistoryPoint {
  t: number;
  midiFloat: number | null;
  cents: number;
  rms: number;
  discontinuous: boolean;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  rgb: [number, number, number];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  phase: number;
  rgb: [number, number, number];
}

interface ReadoutState {
  reading: ChromaticReading | null;
  held: boolean;
  lastConfirmed: ChromaticReading | null;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function pitchRgb(cents: number): [number, number, number] {
  const abs = Math.abs(cents);
  if (abs <= 12) return [63, 92, 240];
  const mix = clamp((abs - 12) / 34, 0, 1);
  if (cents < 0) {
    return [
      Math.round(lerp(63, 217, mix)),
      Math.round(lerp(92, 119, mix)),
      Math.round(lerp(240, 6, mix)),
    ];
  }
  return [
    Math.round(lerp(63, 14, mix)),
    Math.round(lerp(92, 165, mix)),
    Math.round(lerp(240, 233, mix)),
  ];
}

function rgbCss([r, g, b]: [number, number, number], alpha = 1) {
  return alpha >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}

export function PitchStage({
  embedded = false,
  standalone = false,
  onClose,
}: {
  embedded?: boolean;
  standalone?: boolean;
  onClose: () => void;
}) {
  const capture = useSyncExternalStore(
    subscribePitchCapture,
    getPitchCaptureSnapshot,
    getPitchCaptureSnapshot,
  );
  const deviceSelectId = useId();
  const boardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const meterRef = useRef<HTMLMeterElement>(null);
  const statusRef = useRef(capture.status);
  useEffect(() => {
    statusRef.current = capture.status;
  }, [capture.status]);

  const [readout, setReadout] = useState<ReadoutState>({
    reading: null,
    held: false,
    lastConfirmed: null,
  });
  const [guideMode, setGuideMode] = useState<GuideMode>("chromatic");
  const [lockedTargetMidi, setLockedTargetMidi] = useState<number | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [zen, setZen] = useState(false);
  const [intervalLabel, setIntervalLabel] = useState<string | null>(null);
  const [hoverZone, setHoverZone] = useState<"tone" | "target" | "default">(
    "default",
  );
  const [announcement, setAnnouncement] = useState("");
  const lastAnnouncedRef = useRef<{ note: string; at: number }>({
    note: "",
    at: 0,
  });

  const liveRef = useRef<{
    latestFrame: PitchFrame | null;
    history: HistoryPoint[];
    ripples: Ripple[];
    particles: Particle[];
    targetCenterMidi: number;
    displayCenterMidi: number;
    smoothOrbMidi: number | null;
    smoothRms: number;
    lastNoteMidi: number | null;
    lastDistinctMidi: { midi: number; at: number } | null;
    lastPulseAt: number;
    lastParticleAt: number;
    phase: number;
    guideMode: GuideMode;
    lockedTargetMidi: number | null;
    frozen: boolean;
    frozenAt: number;
    flashMidi: number | null;
    flashUntil: number;
    layout: {
      topPad: number;
      drawableHeight: number;
      pxPerSemitone: number;
      displayCenterMidi: number;
    } | null;
  }>({
    latestFrame: null,
    history: [],
    ripples: [],
    particles: [],
    targetCenterMidi: 55,
    displayCenterMidi: 55,
    smoothOrbMidi: null,
    smoothRms: 0,
    lastNoteMidi: null,
    lastDistinctMidi: null,
    lastPulseAt: 0,
    lastParticleAt: 0,
    phase: 0,
    guideMode: "chromatic",
    lockedTargetMidi: null,
    frozen: false,
    frozenAt: 0,
    flashMidi: null,
    flashUntil: 0,
    layout: null,
  });

  useEffect(() => {
    liveRef.current.guideMode = guideMode;
  }, [guideMode]);
  useEffect(() => {
    liveRef.current.lockedTargetMidi = lockedTargetMidi;
  }, [lockedTargetMidi]);
  useEffect(() => {
    liveRef.current.frozen = frozen;
    if (frozen) {
      liveRef.current.frozenAt = performance.now();
    }
  }, [frozen]);

  useEffect(() => {
    const state = liveRef.current;
    let lastUiKey = "";
    const unsubscribe = subscribePitchFrames((frame) => {
      if (state.frozen) {
        if (meterRef.current) {
          meterRef.current.value = Math.min(1, frame.rms * 7);
        }
        return;
      }
      state.latestFrame = frame;
      if (meterRef.current) {
        meterRef.current.value = Math.min(1, frame.rms * 7);
      }

      const t = performance.now();
      state.history.push({
        t,
        midiFloat: frame.reading?.midiFloat ?? null,
        cents: frame.reading?.cents ?? 0,
        rms: frame.rms,
        discontinuous: frame.discontinuous,
      });
      if (state.history.length > 280) {
        state.history.splice(0, state.history.length - 280);
      }

      if (frame.reading) {
        const { midiFloat, midi } = frame.reading;
        const nowMs = Date.now();
        if (
          state.lastDistinctMidi &&
          state.lastDistinctMidi.midi !== midi &&
          nowMs - state.lastDistinctMidi.at <= 6000
        ) {
          setIntervalLabel(
            formatIntervalLabel(state.lastDistinctMidi.midi, midi),
          );
        } else if (
          !state.lastDistinctMidi ||
          nowMs - state.lastDistinctMidi.at > 6000
        ) {
          setIntervalLabel(null);
        }
        if (!frame.held) {
          state.lastDistinctMidi = { midi, at: nowMs };
        }

        if (Math.abs(midiFloat - state.targetCenterMidi) > 4.5) {
          state.targetCenterMidi = clamp(
            midiFloat - Math.sign(midiFloat - state.targetCenterMidi) * 4.5,
            34,
            82,
          );
        }
        const rgb = pitchRgb(frame.reading.cents);
        if (
          state.lastNoteMidi !== midi ||
          nowMs - state.lastPulseAt >= 520
        ) {
          state.lastNoteMidi = midi;
          state.lastPulseAt = nowMs;
          if (state.ripples.length < MAX_RIPPLES) {
            state.ripples.push({
              x: 0,
              y: 0,
              radius: 11,
              maxRadius: 72,
              alpha: 0.34,
              rgb,
            });
          }
        }
      } else {
        state.lastNoteMidi = null;
      }

      const uiKey = frame.reading
        ? `${frame.reading.note}|${Math.round(frame.reading.cents)}|${Math.round(frame.reading.frequency * 10)}|${frame.held}`
        : `none|${frame.lastConfirmed?.note || ""}`;
      if (uiKey !== lastUiKey) {
        lastUiKey = uiKey;
        setReadout({
          reading: frame.reading,
          held: frame.held,
          lastConfirmed: frame.lastConfirmed,
        });
      }

      const nextNote = frame.reading?.note || "";
      const now = Date.now();
      if (
        nextNote &&
        nextNote !== lastAnnouncedRef.current.note &&
        now - lastAnnouncedRef.current.at >= 650
      ) {
        lastAnnouncedRef.current = { note: nextNote, at: now };
        setAnnouncement(
          `${nextNote}${frame.reading?.solfege ? `，${frame.reading.solfege}` : ""}`,
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const board = boardRef.current;
    const canvas = canvasRef.current;
    if (!board || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = board.clientWidth || 640;
    let height = board.clientHeight || 360;
    const resize = () => {
      const nextWidth = board.clientWidth || 640;
      const nextHeight = board.clientHeight || 360;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = nextWidth;
      height = nextHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(resize);
      ro.observe(board);
    } else {
      window.addEventListener("resize", resize);
    }

    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let rafId = 0;
    let lastTime = performance.now();

    const draw = (rafNow: number) => {
      const state = liveRef.current;
      const now = state.frozen ? state.frozenAt : rafNow;
      const dt = state.frozen
        ? 0
        : Math.min(0.05, Math.max(0.001, (rafNow - lastTime) / 1000));
      lastTime = rafNow;
      const reducedMotion = Boolean(motionQuery?.matches);
      const frame = state.latestFrame;
      const reading = frame?.reading ?? null;
      const rms = frame?.rms ?? 0;

      // Keep recent 5.6 seconds of trail.
      if (!state.frozen) {
        while (state.history.length > 0 && now - state.history[0].t > HISTORY_MS) {
          state.history.shift();
        }
      }

      if (reducedMotion) {
        state.displayCenterMidi = state.targetCenterMidi;
        state.smoothOrbMidi = reading ? reading.midiFloat : null;
        state.smoothRms = rms;
        state.ripples = [];
        state.particles = [];
      } else if (!state.frozen) {
        const centerEase = 1 - Math.exp(-dt * 4.2);
        state.displayCenterMidi = lerp(
          state.displayCenterMidi,
          state.targetCenterMidi,
          centerEase,
        );
        if (reading) {
          if (state.smoothOrbMidi === null || frame?.discontinuous) {
            state.smoothOrbMidi = reading.midiFloat;
          } else {
            const orbEase = 1 - Math.exp(-dt * 22);
            state.smoothOrbMidi = lerp(
              state.smoothOrbMidi,
              reading.midiFloat,
              orbEase,
            );
          }
        } else {
          state.smoothOrbMidi = null;
        }
        state.smoothRms = lerp(
          state.smoothRms,
          rms,
          1 - Math.exp(-dt * 14),
        );
        state.phase += dt * (reading ? 3.5 + (reading.midiFloat - 40) * 0.12 : 1.4);
      }

      const compact = width < 640;
      const tight = compact && height < 230;
      const spanSemitones = tight ? 12 : SPAN_SEMITONES;
      const playheadX = compact ? width * 0.78 : Math.max(220, width - 275);
      const topPad = compact ? (tight ? 96 : 104) : 26;
      const bottomPad = compact ? (tight ? 12 : 28) : 40;
      const drawableHeight = Math.max(
        tight ? 48 : 120,
        height - topPad - bottomPad,
      );
      const pxPerSemitone = drawableHeight / spanSemitones;
      const pxPerSec = Math.max(75, playheadX / 4.4);
      state.layout = {
        topPad,
        drawableHeight,
        pxPerSemitone,
        displayCenterMidi: state.displayCenterMidi,
      };

      const midiToY = (midi: number) =>
        topPad +
        drawableHeight / 2 -
        (midi - state.displayCenterMidi) * pxPerSemitone;

      // 1. Crisp white canvas background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // 2. Ambient pitch-following radial glow across the white canvas
      if (state.smoothOrbMidi !== null && !reducedMotion) {
        const orbY = midiToY(state.smoothOrbMidi);
        const rgb = pitchRgb(reading?.cents ?? 0);
        const auraRadius = Math.max(180, Math.min(width, height) * 0.45);
        const grad = ctx.createRadialGradient(
          playheadX,
          orbY,
          8,
          playheadX,
          orbY,
          auraRadius,
        );
        grad.addColorStop(0, rgbCss(rgb, 0.09 + Math.min(0.06, state.smoothRms)));
        grad.addColorStop(1, "rgb(255 255 255 / 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      // 3. Subtle harmonic bars along the bottom edge
      if (!reducedMotion) {
        const bars = compact ? 14 : 26;
        const barStart = compact ? Math.max(168, width * 0.44) : 44;
        const barEnd = compact ? width - 16 : playheadX - 18;
        const barAreaWidth = Math.max(60, barEnd - barStart);
        const step = barAreaWidth / bars;
        const energy = clamp(state.smoothRms * 12, 0.04, 1);
        for (let i = 0; i < bars; i++) {
          const wave =
            0.45 +
            0.55 *
              Math.sin(state.phase * 1.6 + i * 0.55) *
              Math.cos(state.phase * 0.7 + i * 0.2);
          const barH = 4 + energy * 22 * Math.max(0.15, wave);
          const x = barStart + i * step;
          ctx.fillStyle =
            reading !== null
              ? rgbCss(pitchRgb(reading.cents), 0.1)
              : "rgb(63 92 240 / 0.05)";
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(x, height - barH - 8, Math.max(3, step * 0.42), barH, 3);
          } else {
            ctx.rect(x, height - barH - 8, Math.max(3, step * 0.42), barH);
          }
          ctx.fill();
        }
      }

      // 4. Semitone lanes, guide mode highlights, reference flash, and target lock
      const minMidi = Math.floor(state.displayCenterMidi - spanSemitones / 2) - 1;
      const maxMidi = Math.ceil(state.displayCenterMidi + spanSemitones / 2) + 1;
      const activeMidi = reading?.midi ?? null;
      const mode = state.guideMode;
      const lockedMidi = state.lockedTargetMidi;
      const flashActive = state.flashMidi !== null && rafNow < state.flashUntil;

      ctx.font = "700 11px system-ui, -apple-system, sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      for (let m = minMidi; m <= maxMidi; m++) {
        const y = midiToY(m);
        if (y < topPad - 8 || y > height - bottomPad + 8) continue;
        const pitchIdx = ((m % 12) + 12) % 12;
        const isNatural = NATURAL_NOTES.has(pitchIdx);
        const isC = pitchIdx === 0;
        const openLabel = OPEN_STRING_LABELS.get(m);
        const isOpenString = openLabel !== undefined;
        const isActive = activeMidi === m;
        const isLocked = lockedMidi === m;
        const isFlashing = flashActive && state.flashMidi === m;

        if (isFlashing) {
          ctx.fillStyle = "rgb(63 92 240 / 0.14)";
          ctx.fillRect(0, y - pxPerSemitone * 0.48, width, pxPerSemitone * 0.96);
        } else if (isActive) {
          const rgb = pitchRgb(reading?.cents ?? 0);
          ctx.fillStyle = rgbCss(rgb, 0.075);
          ctx.fillRect(0, y - pxPerSemitone * 0.46, width, pxPerSemitone * 0.92);
        } else if (isLocked) {
          const hitLocked =
            reading !== null &&
            Math.abs(reading.midiFloat - m) <= 0.15;
          ctx.fillStyle = hitLocked
            ? "rgb(22 163 74 / 0.09)"
            : "rgb(63 92 240 / 0.05)";
          ctx.fillRect(0, y - pxPerSemitone * 0.44, width, pxPerSemitone * 0.88);
        } else if (mode === "cmajor" && isC) {
          ctx.fillStyle = "rgb(63 92 240 / 0.035)";
          ctx.fillRect(0, y - pxPerSemitone * 0.44, width, pxPerSemitone * 0.88);
        }

        ctx.beginPath();
        const highlightOpen = mode === "strings" && isOpenString;
        const highlightMajor = mode === "cmajor" && isNatural;
        ctx.strokeStyle = isLocked
          ? "rgb(63 92 240 / 0.72)"
          : isActive
            ? "rgb(63 92 240 / 0.42)"
            : highlightOpen
              ? "rgb(63 92 240 / 0.48)"
              : isC
                ? "#cbd5f6"
                : highlightMajor
                  ? "#dce3f7"
                  : isNatural
                    ? "#eaedf7"
                    : "#f3f5fb";
        ctx.lineWidth =
          isLocked || isActive || highlightOpen || isC ? 1.5 : 1;
        if (isLocked) {
          ctx.setLineDash([7, 5]);
        } else if (!isNatural && !isActive && !highlightOpen) {
          ctx.setLineDash([4, 6]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.moveTo(48, y);
        ctx.lineTo(width - 12, y);
        ctx.stroke();
        ctx.setLineDash([]);

        if (isNatural || isActive || isLocked || isFlashing || highlightOpen) {
          const baseLabel = `${NOTE_NAMES[pitchIdx]}${Math.floor(m / 12) - 1}`;
          const label = highlightOpen && !compact ? openLabel : baseLabel;
          ctx.fillStyle =
            isLocked || isActive || isFlashing || highlightOpen
              ? "#3f5cf0"
              : isC
                ? "#475569"
                : "#94a3b8";
          ctx.fillText(label, 10, y);
        }
      }

      // 5. Vertical NOW playhead line
      const lineGrad = ctx.createLinearGradient(0, topPad, 0, height - bottomPad);
      lineGrad.addColorStop(0, "rgb(203 213 245 / 0)");
      lineGrad.addColorStop(0.2, "rgb(180 194 242 / 0.85)");
      lineGrad.addColorStop(0.8, "rgb(180 194 242 / 0.85)");
      lineGrad.addColorStop(1, "rgb(203 213 245 / 0)");
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, topPad);
      ctx.lineTo(playheadX, height - bottomPad);
      ctx.stroke();

      // 6. Scrolling pitch ribbon
      const fadeWidth = Math.max(40, playheadX * 0.16);
      const pts = state.history;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        if (
          prev.midiFloat === null ||
          curr.midiFloat === null ||
          curr.discontinuous ||
          curr.t - prev.t > 140
        ) {
          continue;
        }
        const x1 = playheadX - ((now - prev.t) / 1000) * pxPerSec;
        const x2 = playheadX - ((now - curr.t) / 1000) * pxPerSec;
        if (x2 < 46) continue;
        const y1 = midiToY(prev.midiFloat);
        const y2 = midiToY(curr.midiFloat);
        const edgeFade = clamp((x2 - 46) / fadeWidth, 0, 1);
        const rgb = pitchRgb(curr.cents);
        const energy = clamp((curr.rms + prev.rms) * 8, 0, 1);

        // Outer soft halo
        ctx.strokeStyle = rgbCss(rgb, 0.15 * edgeFade);
        ctx.lineWidth = 10 + energy * 8;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Crisp core ribbon
        ctx.strokeStyle = rgbCss(rgb, 0.92 * edgeFade);
        ctx.lineWidth = 4 + energy * 3.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // 7. Particles & Ripples around the playhead orb
      if (!reducedMotion && state.smoothOrbMidi !== null) {
        const orbY = midiToY(state.smoothOrbMidi);
        const rgb = pitchRgb(reading?.cents ?? 0);

        if (now - state.lastParticleAt >= 75 && state.particles.length < MAX_PARTICLES) {
          state.lastParticleAt = now;
          const jitter = Math.sin(state.phase * 2.7) * 14;
          state.particles.push({
            x: playheadX - 2,
            y: orbY + (Math.random() - 0.5) * 6,
            vx: -pxPerSec * (0.45 + Math.random() * 0.3),
            vy: jitter,
            radius: 2 + Math.random() * 2.2,
            alpha: 0.55,
            phase: Math.random() * Math.PI * 2,
            rgb,
          });
        }

        for (let i = state.ripples.length - 1; i >= 0; i--) {
          const r = state.ripples[i];
          if (r.x === 0 && r.y === 0) {
            r.x = playheadX;
            r.y = orbY;
          }
          r.radius += dt * 76;
          r.alpha -= dt * 0.38;
          if (r.alpha <= 0 || r.radius >= r.maxRadius) {
            state.ripples.splice(i, 1);
            continue;
          }
          ctx.strokeStyle = rgbCss(r.rgb, r.alpha);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(playheadX, orbY, r.radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx * dt;
        p.y += Math.sin(state.phase * 3 + p.phase) * p.vy * dt;
        p.alpha -= dt * 0.55;
        if (p.alpha <= 0 || p.x < 46) {
          state.particles.splice(i, 1);
          continue;
        }
        ctx.fillStyle = rgbCss(p.rgb, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 8. Playhead orb
      if (state.smoothOrbMidi !== null) {
        const orbY = midiToY(state.smoothOrbMidi);
        const rgb = pitchRgb(reading?.cents ?? 0);
        const pulse = reducedMotion ? 0 : Math.min(6, state.smoothRms * 55);

        ctx.fillStyle = rgbCss(rgb, 0.18);
        ctx.beginPath();
        ctx.arc(playheadX, orbY, 15 + pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = rgbCss(rgb);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(playheadX, orbY, 8.5 + pulse * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (statusRef.current === "listening") {
        const restY = topPad + drawableHeight / 2;
        const breathe = reducedMotion ? 0 : Math.sin(state.phase * 2) * 2.5;
        ctx.strokeStyle = "rgb(63 92 240 / 0.28)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(playheadX, restY, 9 + breathe, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (!document.hidden) {
        rafId = requestAnimationFrame(draw);
      }
    };

    const startRaf = () => {
      cancelAnimationFrame(rafId);
      if (!document.hidden) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(draw);
      }
    };

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(rafId);
      else startRaf();
    };
    document.addEventListener("visibilitychange", onVisibility);
    startRaf();

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", onVisibility);
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", resize);
    };
  }, []);

  const midiFromClientY = (clientY: number): number | null => {
    const board = boardRef.current;
    const layout = liveRef.current.layout;
    if (!board || !layout) return null;
    const rect = board.getBoundingClientRect();
    const y = clientY - rect.top;
    const raw =
      layout.displayCenterMidi -
      (y - (layout.topPad + layout.drawableHeight / 2)) / layout.pxPerSemitone;
    return clamp(Math.round(raw), 28, 88);
  };

  const handleBoardClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const midi = midiFromClientY(e.clientY);
    if (midi === null) return;
    if (x <= LABEL_ZONE_WIDTH) {
      playReferenceMidi(midi);
      liveRef.current.flashMidi = midi;
      liveRef.current.flashUntil = performance.now() + 850;
      return;
    }
    setLockedTargetMidi((prev) => (prev === midi ? null : midi));
  };

  const handleBoardMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const board = boardRef.current;
    if (!board) return;
    const x = e.clientX - board.getBoundingClientRect().left;
    setHoverZone(x <= LABEL_ZONE_WIDTH ? "tone" : "target");
  };

  const active = readout.reading;
  const roundedCents = active ? Math.round(active.cents) : null;
  const thumbOffset = active ? clamp(active.cents, -50, 50) : 0;
  const centsLabel =
    roundedCents === null
      ? "— 音分"
      : `${roundedCents > 0 ? "+" : ""}${roundedCents} 音分`;

  return (
    <div
      className={`pitch-stage ${embedded ? "is-embedded" : ""} ${standalone ? "is-standalone" : ""} ${zen ? "is-zen" : ""}`.trim()}
      data-pitch-status={capture.status}
      data-pitch-frozen={frozen ? "true" : undefined}
    >
      <div className="pitch-stage-top">
        <div className="pitch-stage-controls">
          <div className="pitch-input-wrap">
            <label htmlFor={deviceSelectId} className="sr-only">
              输入设备
            </label>
            <select
              id={deviceSelectId}
              className="pitch-device-select"
              value={capture.selectedDeviceId}
              disabled={capture.status === "requesting"}
              onChange={(e) => void switchPitchDevice(e.target.value)}
            >
              <option value="">系统默认输入</option>
              {capture.devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
            <meter
              ref={meterRef}
              className="pitch-level"
              aria-label="输入音量"
              min={0}
              max={1}
              defaultValue={0}
            />
          </div>
          <div className="pitch-guide-tabs" role="group" aria-label="音高参考线">
            {(
              [
                ["chromatic", "半音"],
                ["cmajor", "C大调"],
                ["strings", "空弦"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="pitch-guide-tab"
                aria-pressed={guideMode === key}
                onClick={() => setGuideMode(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="pitch-stage-status" role="status">
            {capture.message}
          </span>
          <div className="pitch-stage-actions">
            {capture.status === "listening" && (
              <Button
                className="compact"
                data-action="pitch-freeze"
                aria-pressed={frozen}
                onClick={() => setFrozen((v) => !v)}
              >
                {frozen ? "继续" : "定格"}
              </Button>
            )}
            <Button
              className="compact"
              data-action="pitch-zen"
              aria-pressed={zen}
              onClick={() => setZen((v) => !v)}
            >
              {zen ? "显示读数" : "纯画布"}
            </Button>
            {(capture.status === "error" || capture.status === "idle") && (
              <Button
                variant="primary"
                className="compact"
                data-action="pitch-retry"
                onClick={() => void startPitchCapture()}
              >
                重新开启
              </Button>
            )}
            <Button
              className="compact"
              data-action="pitch-close"
              onClick={() => {
                stopPitchCapture();
                onClose();
              }}
            >
              {capture.status === "requesting" ? "取消" : "关闭"}
            </Button>
          </div>
        </div>
      </div>

      <div className="pitch-stage-board" ref={boardRef}>
        <canvas
          ref={canvasRef}
          className="pitch-canvas"
          data-hover-zone={hoverZone}
          title="点击左侧音名听基准音 · 点击画布锁定目标音线"
          onClick={handleBoardClick}
          onPointerMove={handleBoardMove}
          onPointerLeave={() => setHoverZone("default")}
        />

        {lockedTargetMidi !== null && (
          <button
            type="button"
            className="pitch-target-chip"
            data-action="pitch-unlock-target"
            onClick={() => setLockedTargetMidi(null)}
          >
            目标 {noteLabelForMidi(lockedTargetMidi)} ×
          </button>
        )}

        {!zen && (
          <div
            className={`pitch-hero ${active ? "has-reading" : ""}`}
            data-held={String(readout.held)}
          >
            <span className="pitch-hero-caption">
              {frozen ? "已定格" : active ? "当前音高" : "等待声音"}
            </span>
            <div className="pitch-hero-note" data-pitch-note>
              {active ? (
                <>
                  {active.noteName}
                  <sub>{active.octave}</sub>
                </>
              ) : (
                "—"
              )}
            </div>
            <div className="pitch-hero-meta">
              {active?.solfege && (
                <span className="pitch-solfege-pill">唱名 {active.solfege}</span>
              )}
              {intervalLabel && (
                <span className="pitch-interval-pill" data-pitch-interval>
                  {intervalLabel}
                </span>
              )}
              <span className="pitch-hz" data-pitch-hz>
                {active ? `${active.frequency.toFixed(1)} Hz` : "— Hz"}
              </span>
            </div>
            <div className="pitch-cents-track" aria-hidden="true">
              <span className="pitch-cents-center" />
              <i
                className="pitch-cents-thumb"
                style={{
                  opacity: active ? 1 : 0,
                  transform: `translateX(${thumbOffset * 0.72}px)`,
                }}
              />
            </div>
            <div className="pitch-cents-readout" data-pitch-cents>
              {centsLabel}
            </div>
            {!active && readout.lastConfirmed && (
              <div className="pitch-last-note" data-pitch-last>
                上一个音：{readout.lastConfirmed.note}
              </div>
            )}
          </div>
        )}

        <span className="sr-only" aria-live="polite">
          {announcement}
        </span>
      </div>
    </div>
  );
}
