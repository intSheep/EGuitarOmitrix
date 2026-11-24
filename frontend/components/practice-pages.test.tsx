import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { Focus, Finish } from "./practice-pages";
import { chromaticReading } from "../domain/tuner-model";
import type { FocusMainView } from "../controllers/practice";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  update: vi.fn(),
  start: vi.fn(),
  discard: vi.fn(),
  pause: vi.fn(),
  finish: vi.fn(),
  setFocusView: vi.fn(),
  returnToTimer: vi.fn(),
  setMetroOpen: vi.fn(),
  toggleMetroOpen: vi.fn(),
  setMetronomeBpm: vi.fn(),
  toggleMetronome: vi.fn(),
  stopMetronome: vi.fn(),
  setPositionOpen: vi.fn(),
  togglePosition: vi.fn(),
  openTuner: vi.fn(),
  closeTunerOverlay: vi.fn(),
  setDialog: vi.fn(),
  startPitch: vi.fn(),
  stopPitch: vi.fn(),
  switchDevice: vi.fn(),
  frameListeners: new Set<(frame: unknown) => void>(),
  statusListeners: new Set<() => void>(),
  controllerListeners: new Set<() => void>(),
  pitchSnapshot: {
    status: "idle" as "idle" | "requesting" | "listening" | "error",
    message: "开启麦克风，实时显示琴声与人声音高。",
    devices: [],
    selectedDeviceId: "",
  },
  snapshot: {
    draft: {
      id: "synthetic",
      entryId: "1",
      elapsedMs: 65000,
      running: true,
      reason: "",
      review: undefined,
    },
    assignment: { summary: "SYNTHETIC summary", dailyMinutes: 5, tempo: "40" },
    course: { entries: [] },
    logs: [],
    focusView: "timer" as FocusMainView,
    metroOpen: false,
    metroPlaying: false,
    metroBpm: null as number | null,
    metroTargetBpm: 40,
    positionOpen: false,
    tunerOpen: false,
    dialog: null,
    busy: false,
  },
}));
vi.mock("../../app/score-viewer.js", () => ({
  showScore: vi.fn(),
  closeScore: vi.fn(),
}));
vi.mock("../../app/tuner.js", () => ({
  showTuner: vi.fn(),
  closeTuner: vi.fn(),
}));
vi.mock("../../app/position-reference.js", () => ({
  showPositionReference: vi.fn(),
  closePositionReference: vi.fn(),
}));
vi.mock("../audio/pitch-capture", () => ({
  getPitchCaptureSnapshot: () => mocks.pitchSnapshot,
  subscribePitchCapture: (fn: () => void) => {
    mocks.statusListeners.add(fn);
    return () => mocks.statusListeners.delete(fn);
  },
  subscribePitchFrames: (fn: (frame: unknown) => void) => {
    mocks.frameListeners.add(fn);
    return () => mocks.frameListeners.delete(fn);
  },
  startPitchCapture: mocks.startPitch,
  stopPitchCapture: mocks.stopPitch,
  switchPitchDevice: mocks.switchDevice,
}));
vi.mock("../controllers/practice", () => ({
  getSnapshot: () => mocks.snapshot,
  subscribe: (fn: () => void) => {
    mocks.controllerListeners.add(fn);
    return () => mocks.controllerListeners.delete(fn);
  },
  lesson: () => ({
    id: "1",
    title: "SYNTHETIC QA",
    kind: "lesson",
    stage: 1,
    exercises: [1],
  }),
  assignment: () => mocks.snapshot.assignment,
  updateReview: mocks.update,
  saveResult: mocks.save,
  start: mocks.start,
  pause: mocks.pause,
  finish: mocks.finish,
  discard: mocks.discard,
  setFocusView: mocks.setFocusView,
  returnToTimer: mocks.returnToTimer,
  setMetroOpen: mocks.setMetroOpen,
  toggleMetroOpen: mocks.toggleMetroOpen,
  setMetronomeBpm: mocks.setMetronomeBpm,
  toggleMetronome: mocks.toggleMetronome,
  stopMetronome: mocks.stopMetronome,
  setPositionOpen: mocks.setPositionOpen,
  togglePosition: mocks.togglePosition,
  openTuner: mocks.openTuner,
  closeTunerOverlay: mocks.closeTunerOverlay,
  setDialog: mocks.setDialog,
  run: (fn: () => unknown) => fn(),
}));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.snapshot = {
    ...mocks.snapshot,
    focusView: "timer",
    metroOpen: false,
    metroPlaying: false,
    metroBpm: null,
    metroTargetBpm: 40,
    positionOpen: false,
    tunerOpen: false,
  };
  mocks.pitchSnapshot.status = "idle";
  mocks.frameListeners.clear();
  mocks.statusListeners.clear();
  mocks.controllerListeners.clear();
  const emit = (changes: Partial<typeof mocks.snapshot>) => {
    mocks.snapshot = { ...mocks.snapshot, ...changes };
    mocks.controllerListeners.forEach((fn) => fn());
  };
  mocks.setFocusView.mockImplementation((view: FocusMainView) => {
    if (view === "pitch" || view === "score-pitch") mocks.startPitch();
    else mocks.stopPitch();
    emit({ focusView: view, tunerOpen: false });
  });
  mocks.returnToTimer.mockImplementation(() => {
    mocks.stopPitch();
    emit({ focusView: "timer", tunerOpen: false, positionOpen: false });
  });
  mocks.setMetroOpen.mockImplementation((open: boolean) => {
    emit({ metroOpen: open });
  });
  mocks.toggleMetroOpen.mockImplementation(() => {
    emit({ metroOpen: !mocks.snapshot.metroOpen });
  });
  mocks.setPositionOpen.mockImplementation((open: boolean) => {
    emit({ positionOpen: open });
  });
  mocks.togglePosition.mockImplementation(() => {
    emit({ positionOpen: !mocks.snapshot.positionOpen });
  });
  mocks.openTuner.mockImplementation(() => {
    mocks.stopPitch();
    mocks.stopMetronome();
    const nextView =
      mocks.snapshot.focusView === "score-pitch"
        ? "score"
        : mocks.snapshot.focusView === "pitch"
          ? "timer"
          : mocks.snapshot.focusView;
    emit({ tunerOpen: true, focusView: nextView, metroPlaying: false, metroBpm: null });
  });
  mocks.closeTunerOverlay.mockImplementation(() => {
    emit({ tunerOpen: false });
  });
  mocks.update.mockResolvedValue(undefined);
  mocks.save.mockResolvedValue(undefined);
  mocks.startPitch.mockResolvedValue(undefined);
});

describe("quiet finish confirmation", () => {
  it("leaves BPM and proficiency empty and permits saving unknown results", async () => {
    render(<Finish />);
    expect(screen.getByLabelText("实际稳定 BPM · 选填")).toHaveValue(null);
    for (const radio of screen.getAllByRole("radio"))
      expect(radio).not.toBeChecked();
    fireEvent.submit(document.querySelector("#finish-form")!);
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(null, null));
  });
  it("retains input and offers retry after a failed save", async () => {
    mocks.save.mockRejectedValueOnce(Error("SYNTHETIC storage unavailable"));
    render(<Finish />);
    fireEvent.change(screen.getByLabelText("实际稳定 BPM · 选填"), {
      target: { value: "65" },
    });
    fireEvent.click(screen.getByLabelText("基本顺畅"));
    fireEvent.submit(document.querySelector("#finish-form")!);
    await screen.findByText("SYNTHETIC storage unavailable");
    expect(screen.getByLabelText("实际稳定 BPM · 选填")).toHaveValue(65);
    expect(screen.getByLabelText("基本顺畅")).toBeChecked();
    fireEvent.submit(document.querySelector("#finish-form")!);
    await waitFor(() =>
      expect(mocks.save).toHaveBeenLastCalledWith(65, "steady"),
    );
  });
  it("allows discarding the session from the finish confirmation page", () => {
    render(<Finish />);
    fireEvent.click(screen.getByRole("button", { name: "放弃本次练习" }));
    expect(mocks.discard).toHaveBeenCalledTimes(1);
  });
});

describe("focus primary views and utility tools", () => {
  it("opens 实时识音 on the white focus canvas, shows intervals, return-to-timer button, and stops capture on close", () => {
    const { unmount } = render(<Focus />);
    expect(document.querySelector('[data-pitch-stage="true"]')).toBeNull();
    expect(document.querySelector("#focus-back")).toBeNull();

    // Primary views and utility tools live in separate toolbar groups.
    expect(screen.getByRole("group", { name: "主视图" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "小工具" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "实时识音" }));
    expect(mocks.setFocusView).toHaveBeenCalledWith("pitch");
    expect(mocks.startPitch).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-pitch-stage="true"]')).not.toBeNull();
    expect(document.querySelector("#focus-back")).not.toBeNull();
    expect(document.querySelector(".view-timer-badge")?.textContent).toBe("01:05");
    expect(document.querySelector("[data-session-time]")?.textContent).toBe("01:05");

    act(() => {
      const c4 = chromaticReading(261.63)!;
      mocks.frameListeners.forEach((fn) =>
        fn({
          reading: c4,
          held: false,
          discontinuous: true,
          lastConfirmed: c4,
          rms: 0.05,
          timestamp: 1000,
        }),
      );
    });
    expect(document.querySelector("[data-pitch-note]")?.textContent).toBe("C4");
    expect(screen.getByText("唱名 do")).toBeInTheDocument();

    act(() => {
      const d4 = chromaticReading(293.66)!;
      mocks.frameListeners.forEach((fn) =>
        fn({
          reading: d4,
          held: false,
          discontinuous: false,
          lastConfirmed: d4,
          rms: 0.05,
          timestamp: 1200,
        }),
      );
    });
    expect(document.querySelector("[data-pitch-interval]")?.textContent).toBe(
      "↑ 大二度",
    );

    fireEvent.click(screen.getByRole("button", { name: "空弦" }));
    expect(screen.getByRole("button", { name: "空弦" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "纯画布" }));
    expect(document.querySelector(".pitch-hero")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "显示读数" }));
    expect(document.querySelector(".pitch-hero")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(mocks.stopPitch).toHaveBeenCalled();
    expect(document.querySelector('[data-pitch-stage="true"]')).toBeNull();
    expect(document.querySelector("#focus-clock")).not.toBeNull();
    unmount();
  });

  it("supports simultaneous score + 实时识音 + 节拍器 + 把位图 without unmounting the score, and prominent return to timer", () => {
    const { unmount } = render(<Focus />);

    // Open 实时识音, then open 节拍器: both stay open without stopping capture.
    fireEvent.click(screen.getByRole("button", { name: "实时识音" }));
    const callsBeforeMetro = mocks.stopPitch.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "节拍器" }));
    expect(mocks.toggleMetroOpen).toHaveBeenCalled();
    expect(mocks.stopPitch.mock.calls.length).toBe(callsBeforeMetro);
    expect(document.querySelector('[data-pitch-stage="true"]')).not.toBeNull();
    expect(document.querySelector("#metro-panel")).not.toBeNull();

    // Switch to 谱+识音: score, pitch stage, and metronome all coexist.
    fireEvent.click(screen.getByRole("button", { name: "谱+识音" }));
    expect(mocks.setFocusView).toHaveBeenCalledWith("score-pitch");
    expect(document.querySelector('[data-pitch-stage="true"]')).not.toBeNull();
    expect(
      document.querySelector('#focus-tool-content[data-tool="score"]'),
    ).not.toBeNull();
    expect(document.querySelector("#metro-panel")).not.toBeNull();

    // Opening 把位图 keeps score mounted underneath.
    const scoreHostBefore = document.querySelector(
      '#focus-tool-content[data-tool="score"]',
    );
    fireEvent.click(screen.getByRole("button", { name: "把位图" }));
    expect(document.querySelector(".position-companion-pane")).not.toBeNull();
    expect(
      document.querySelector('#focus-tool-content[data-tool="score"]'),
    ).toBe(scoreHostBefore);

    // Return to timer via ← 返回计时 clears overlays and returns cleanly to #focus-clock.
    fireEvent.click(document.querySelector("#focus-back")!);
    expect(mocks.returnToTimer).toHaveBeenCalled();
    expect(document.querySelector("#focus-clock")).not.toBeNull();
    expect(document.querySelector(".position-companion-pane")).toBeNull();
    expect(document.querySelector('[data-pitch-stage="true"]')).toBeNull();

    // Opening tuner from score keeps score mounted underneath while stopping pitch/metronome.
    fireEvent.click(screen.getByRole("button", { name: "乐谱" }));
    const scoreHostInScore = document.querySelector(
      '#focus-tool-content[data-tool="score"]',
    );
    fireEvent.click(screen.getByRole("button", { name: "调音器" }));
    expect(mocks.openTuner).toHaveBeenCalled();
    expect(document.querySelector(".focus-tuner-overlay")).not.toBeNull();
    expect(
      document.querySelector('#focus-tool-content[data-tool="score"]'),
    ).toBe(scoreHostInScore);

    unmount();
  });
});
