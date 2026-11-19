import {
  ChromaticPitchTracker,
  detectChromaticPitch,
  microphoneErrorMessage,
  type ChromaticReading,
} from "../domain/tuner-model";

export type PitchCaptureStatus = "idle" | "requesting" | "listening" | "error";

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

export interface PitchFrame {
  reading: ChromaticReading | null;
  held: boolean;
  discontinuous: boolean;
  lastConfirmed: ChromaticReading | null;
  rms: number;
  timestamp: number;
}

export interface PitchCaptureSnapshot {
  status: PitchCaptureStatus;
  message: string;
  devices: AudioInputDevice[];
  selectedDeviceId: string;
}

const EMPTY_FRAME: PitchFrame = {
  reading: null,
  held: false,
  discontinuous: true,
  lastConfirmed: null,
  rms: 0,
  timestamp: 0,
};

const SAMPLE_INTERVAL_MS = 28;

const tracker = new ChromaticPitchTracker({ graceMs: 160 });
const statusListeners = new Set<() => void>();
const frameListeners = new Set<(frame: PitchFrame) => void>();

let snapshot: PitchCaptureSnapshot = {
  status: "idle",
  message: "开启麦克风，实时显示琴声与人声音高。",
  devices: [],
  selectedDeviceId: "",
};

let generation = 0;
let stream: MediaStream | null = null;
let audio: AudioContext | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let analyser: AnalyserNode | null = null;
let sampleTimer: ReturnType<typeof setTimeout> | null = null;
let samples: Float32Array<ArrayBuffer> | null = null;
let detachLifecycle: (() => void) | null = null;

function emitStatus(changes: Partial<PitchCaptureSnapshot>) {
  const next: PitchCaptureSnapshot = { ...snapshot, ...changes };
  if (
    next.status === snapshot.status &&
    next.message === snapshot.message &&
    next.selectedDeviceId === snapshot.selectedDeviceId &&
    next.devices === snapshot.devices
  )
    return;
  snapshot = next;
  statusListeners.forEach((listener) => listener());
}

function emitFrame(frame: PitchFrame) {
  frameListeners.forEach((listener) => listener(frame));
}

function releaseAudioResources() {
  generation++;
  if (sampleTimer !== null) {
    clearTimeout(sampleTimer);
    sampleTimer = null;
  }
  detachLifecycle?.();
  detachLifecycle = null;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  source?.disconnect();
  source = null;
  analyser = null;
  samples = null;
  audio?.close().catch(() => {});
  audio = null;
  tracker.reset();
}

export function getPitchCaptureSnapshot(): PitchCaptureSnapshot {
  return snapshot;
}

export function subscribePitchCapture(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function subscribePitchFrames(
  listener: (frame: PitchFrame) => void,
): () => void {
  frameListeners.add(listener);
  return () => {
    frameListeners.delete(listener);
  };
}

export async function refreshPitchDevices(
  expectedToken = generation,
): Promise<void> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.enumerateDevices
  )
    return;
  try {
    const list = await navigator.mediaDevices.enumerateDevices();
    if (expectedToken !== generation) return;
    const devices = list
      .filter(
        (d) =>
          d.kind === "audioinput" && d.deviceId && d.deviceId !== "default",
      )
      .map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label || `输入设备 ${index + 1}`,
      }));
    const activeId =
      stream?.getAudioTracks()[0]?.getSettings().deviceId ||
      snapshot.selectedDeviceId;
    const selectedDeviceId = devices.some((d) => d.deviceId === activeId)
      ? activeId
      : "";
    emitStatus({ devices, selectedDeviceId });
  } catch {
    // Ignore device enumeration errors when permission is absent.
  }
}

export function stopPitchCapture(
  message = "麦克风已停止",
  status: PitchCaptureStatus = "idle",
): void {
  releaseAudioResources();
  emitFrame({ ...EMPTY_FRAME, timestamp: Date.now() });
  emitStatus({ status, message });
}

export async function startPitchCapture(
  deviceId = snapshot.selectedDeviceId,
): Promise<void> {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    document.hidden
  )
    return;
  const targetDevice = deviceId || "";
  releaseAudioResources();
  const token = generation;

  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    emitStatus({
      status: "error",
      selectedDeviceId: targetDevice,
      message:
        "此地址无法使用麦克风。请在电脑上使用 localhost 或 HTTPS，并使用支持麦克风的浏览器。",
    });
    return;
  }

  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) {
    emitStatus({
      status: "error",
      selectedDeviceId: targetDevice,
      message: "当前浏览器不支持音频分析，请使用新版 Chrome 或 Edge。",
    });
    return;
  }

  emitFrame({ ...EMPTY_FRAME, timestamp: Date.now() });
  emitStatus({
    status: "requesting",
    selectedDeviceId: targetDevice,
    message: "正在开启麦克风…",
  });

  let pendingAudio: AudioContext | undefined;
  try {
    pendingAudio = new AudioCtor();
    audio = pendingAudio;
    await pendingAudio.resume();
    if (token !== generation) return;
    if (document.hidden) {
      stopPitchCapture("页面已离开，麦克风已停止。返回后可重新开启。");
      return;
    }
    if (pendingAudio.state !== "running") throw Error("Audio suspended");

    const acquired = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(targetDevice ? { deviceId: { exact: targetDevice } } : {}),
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });

    if (token !== generation || document.hidden) {
      acquired.getTracks().forEach((track) => track.stop());
      if (token === generation) {
        stopPitchCapture("页面已离开，麦克风已停止。返回后可重新开启。");
      }
      return;
    }

    stream = acquired;
    const track = stream.getAudioTracks()[0];
    if (!track || track.readyState === "ended")
      throw Error("No active input");

    const onVisibility = () => {
      if (document.hidden && token === generation) {
        stopPitchCapture("页面已离开，麦克风已停止。返回后可重新开启。");
      }
    };
    const onPageHide = () => {
      if (token === generation) stopPitchCapture("麦克风已停止");
    };
    const onDeviceChange = () => {
      if (token === generation) void refreshPitchDevices(token);
    };
    const onTrackEnded = () => {
      if (token === generation)
        stopPitchCapture("输入设备已断开，请重新选择并开启。", "error");
    };
    const onTrackMute = () => {
      if (token !== generation) return;
      tracker.reset();
      emitFrame({ ...EMPTY_FRAME, timestamp: Date.now() });
      emitStatus({ message: "输入暂时中断，请检查麦克风或声卡。" });
    };
    const onAudioStateChange = () => {
      if (token === generation && pendingAudio?.state !== "running") {
        stopPitchCapture("音频分析已中断，请重新开启麦克风。", "error");
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    navigator.mediaDevices.addEventListener?.("devicechange", onDeviceChange);
    track.addEventListener("ended", onTrackEnded);
    track.addEventListener("mute", onTrackMute);
    pendingAudio.addEventListener("statechange", onAudioStateChange);

    detachLifecycle = () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      navigator.mediaDevices.removeEventListener?.(
        "devicechange",
        onDeviceChange,
      );
      track.removeEventListener("ended", onTrackEnded);
      track.removeEventListener("mute", onTrackMute);
      pendingAudio?.removeEventListener("statechange", onAudioStateChange);
    };

    source = audio.createMediaStreamSource(stream);
    // Bandpass 55 Hz – 2400 Hz attenuates rumble/mains hum and high hiss while
    // retaining fundamentals and early harmonics across guitar and voice.
    const highpass = audio.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 55;
    const lowpass = audio.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 2400;
    analyser = audio.createAnalyser();
    analyser.fftSize = 4096;
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(analyser);
    samples = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));

    emitStatus({
      status: "listening",
      message: "正在聆听 · 拨弦或哼唱即可看到音高轨迹",
    });
    void refreshPitchDevices(token);

    const sample = () => {
      if (token !== generation || !analyser || !samples || !audio) return;
      const now = Date.now();
      if (track.muted) {
        tracker.reset();
        emitFrame({ ...EMPTY_FRAME, timestamp: now });
      } else {
        analyser.getFloatTimeDomainData(samples);
        const raw = detectChromaticPitch(samples, audio.sampleRate);
        const step = tracker.step(raw.frequency, now);
        emitFrame({
          reading: step.reading,
          held: step.held,
          discontinuous: step.discontinuous,
          lastConfirmed: step.lastConfirmed,
          rms: raw.rms,
          timestamp: now,
        });
        if (step.reading) {
          emitStatus({ message: "正在追踪音高 · 点击左侧音名可听基准音" });
        } else {
          emitStatus({
            message:
              raw.rms < 0.0022
                ? "正在聆听 · 拨弦或哼唱即可看到音高轨迹"
                : "正在捕捉音高 · 保持单音更稳定",
          });
        }
      }
      sampleTimer = setTimeout(sample, SAMPLE_INTERVAL_MS);
    };
    sample();
  } catch (error) {
    if (token === generation) {
      stopPitchCapture(microphoneErrorMessage(error), "error");
    }
  } finally {
    if (token !== generation && pendingAudio?.state !== "closed") {
      pendingAudio?.close().catch(() => {});
    }
  }
}

export async function switchPitchDevice(deviceId: string): Promise<void> {
  const wasActive =
    snapshot.status === "listening" || snapshot.status === "requesting";
  emitStatus({ selectedDeviceId: deviceId });
  if (wasActive) {
    await startPitchCapture(deviceId);
  }
}
