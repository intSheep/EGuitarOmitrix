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
import type { ChromaticReading } from "../domain/tuner-model";
import { Button } from "./ui/button";

const SPAN_SEMITONES = 22;
const HISTORY_MS = 5600;
const MAX_PARTICLES = 32;
const MAX_RIPPLES = 5;
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

function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}

export function PitchStage({
  running,
  reason,
  elapsedMs,
  onClose,
}: {
  running: boolean;
  reason: string;
  elapsedMs: number;
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
    lastPulseAt: number;
    lastParticleAt: number;
    phase: number;
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
    lastPulseAt: 0,
    lastParticleAt: 0,
    phase: 0,
  });

  useEffect(() => {
    const state = liveRef.current;
    let lastUiKey = "";
    const unsubscribe = subscribePitchFrames((frame) => {
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
        if (Math.abs(midiFloat - state.targetCenterMidi) > 4.5) {
          state.targetCenterMidi = clamp(
            midiFloat - Math.sign(midiFloat - state.targetCenterMidi) * 4.5,
            34,
            82,
          );
        }
        const rgb = pitchRgb(frame.reading.cents);
        const nowMs = Date.now();
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
      stopPitchCapture();
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

    const draw = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const reducedMotion = Boolean(motionQuery?.matches);
      const state = liveRef.current;
      const frame = state.latestFrame;
      const reading = frame?.reading ?? null;
      const rms = frame?.rms ?? 0;

      // Keep recent 5.6 seconds of trail.
      while (state.history.length > 0 && now - state.history[0].t > HISTORY_MS) {
        state.history.shift();
      }

      if (reducedMotion) {
        state.displayCenterMidi = state.targetCenterMidi;
        state.smoothOrbMidi = reading ? reading.midiFloat : null;
        state.smoothRms = rms;
        state.ripples = [];
        state.particles = [];
      } else {
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
      const playheadX = compact ? width * 0.78 : Math.max(220, width - 275);
      const topPad = compact ? 104 : 26;
      const bottomPad = compact ? 28 : 40;
      const drawableHeight = Math.max(120, height - topPad - bottomPad);
      const pxPerSemitone = drawableHeight / SPAN_SEMITONES;
      const pxPerSec = Math.max(75, playheadX / 4.4);

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

      // 3. Subtle harmonic bars along the bottom edge (kept clear of privacy caption)
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

      // 4. Semitone lanes and active lane highlight
      const minMidi = Math.floor(state.displayCenterMidi - SPAN_SEMITONES / 2) - 1;
      const maxMidi = Math.ceil(state.displayCenterMidi + SPAN_SEMITONES / 2) + 1;
      const activeMidi = reading?.midi ?? null;

      ctx.font = "700 11px system-ui, -apple-system, sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      for (let m = minMidi; m <= maxMidi; m++) {
        const y = midiToY(m);
        if (y < topPad - 8 || y > height - bottomPad + 8) continue;
        const pitchIdx = ((m % 12) + 12) % 12;
        const isNatural = NATURAL_NOTES.has(pitchIdx);
        const isC = pitchIdx === 0;
        const isActive = activeMidi === m;

        if (isActive) {
          const rgb = pitchRgb(reading?.cents ?? 0);
          ctx.fillStyle = rgbCss(rgb, 0.075);
          ctx.fillRect(0, y - pxPerSemitone * 0.46, width, pxPerSemitone * 0.92);
        }

        ctx.beginPath();
        ctx.strokeStyle = isActive
          ? "rgb(63 92 240 / 0.42)"
          : isC
            ? "#d3dcf6"
            : isNatural
              ? "#eaedf7"
              : "#f3f5fb";
        ctx.lineWidth = isActive || isC ? 1.5 : 1;
        if (!isNatural && !isActive) {
          ctx.setLineDash([4, 6]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.moveTo(46, y);
        ctx.lineTo(width - 12, y);
        ctx.stroke();
        ctx.setLineDash([]);

        if (isNatural || isActive) {
          const octave = Math.floor(m / 12) - 1;
          const label = `${NOTE_NAMES[pitchIdx]}${octave}`;
          ctx.fillStyle = isActive
            ? "#3f5cf0"
            : isC
              ? "#64748b"
              : "#94a3b8";
          ctx.fillText(label, 12, y);
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

  const active = readout.reading;
  const roundedCents = active ? Math.round(active.cents) : null;
  const thumbOffset = active ? clamp(active.cents, -50, 50) : 0;
  const centsLabel =
    roundedCents === null
      ? "— 音分"
      : `${roundedCents > 0 ? "+" : ""}${roundedCents} 音分`;

  return (
    <div className="pitch-stage" data-pitch-status={capture.status}>
      <div className="pitch-stage-top">
        <div className="pitch-timer-chip">
          <span
            className={`pitch-timer-dot ${running ? "is-running" : ""}`}
            aria-hidden="true"
          />
          <span id="timer-state" role="status">
            {running ? "练习中" : reason || "已暂停"}
          </span>
          <strong id="timer-value" role="timer" aria-label="练习时间">
            {formatClock(elapsedMs / 1000)}
          </strong>
        </div>

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
          <span className="pitch-stage-status" role="status">
            {capture.message}
          </span>
          <div className="pitch-stage-actions">
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
              {capture.status === "requesting" ? "取消" : "关闭音高"}
            </Button>
          </div>
        </div>
      </div>

      <div className="pitch-stage-board" ref={boardRef}>
        <canvas ref={canvasRef} className="pitch-canvas" aria-hidden="true" />

        <div
          className={`pitch-hero ${active ? "has-reading" : ""}`}
          data-held={String(readout.held)}
        >
          <span className="pitch-hero-caption">
            {active ? "当前音高" : "等待声音"}
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

        <span className="pitch-privacy-tag">本机实时识别 · 不保存录音</span>
        <span className="sr-only" aria-live="polite">
          {announcement}
        </span>
      </div>
    </div>
  );
}
