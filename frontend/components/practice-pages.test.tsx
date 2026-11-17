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
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  update: vi.fn(),
  start: vi.fn(),
  discard: vi.fn(),
  pause: vi.fn(),
  finish: vi.fn(),
  openTool: vi.fn(),
  setTool: vi.fn(),
  setDialog: vi.fn(),
  startPitch: vi.fn(),
  stopPitch: vi.fn(),
  switchDevice: vi.fn(),
  frameListeners: new Set<(frame: unknown) => void>(),
  statusListeners: new Set<() => void>(),
  pitchSnapshot: {
    status: "idle" as "idle" | "requesting" | "listening" | "error",
    message: "开启麦克风，实时显示弹奏与哼唱音高。",
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
    tool: null as string | null,
    dialog: null,
    busy: false,
  },
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
  subscribe: () => () => {},
  lesson: () => ({ id: "1", title: "SYNTHETIC QA", kind: "lesson", stage: 1, exercises: [1] }),
  assignment: () => mocks.snapshot.assignment,
  updateReview: mocks.update,
  saveResult: mocks.save,
  start: mocks.start,
  pause: mocks.pause,
  finish: mocks.finish,
  discard: mocks.discard,
  openTool: mocks.openTool,
  setTool: mocks.setTool,
  setDialog: mocks.setDialog,
  stopMetronome: vi.fn(),
  toggleMetronome: vi.fn(),
  run: (fn: () => unknown) => fn(),
}));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.snapshot.tool = null;
  mocks.pitchSnapshot.status = "idle";
  mocks.frameListeners.clear();
  mocks.statusListeners.clear();
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

describe("focus ear-training pitch stage", () => {
  it("opens pitch stage on the white focus canvas, displays incoming pitch, and stops capture cleanly", () => {
    const { unmount } = render(<Focus />);
    expect(document.querySelector('[data-pitch-stage="true"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "开启实时音高（模唱）" }));
    expect(mocks.startPitch).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-pitch-stage="true"]')).not.toBeNull();
    expect(document.querySelector("#timer-value")?.textContent).toBe("01:05");
    expect(document.querySelector("#timer-state")?.textContent).toBe("练习中");

    act(() => {
      const reading = chromaticReading(261.63)!;
      mocks.frameListeners.forEach((fn) =>
        fn({
          reading,
          held: false,
          discontinuous: true,
          lastConfirmed: reading,
          rms: 0.05,
          timestamp: 1000,
        }),
      );
    });
    expect(document.querySelector("[data-pitch-note]")?.textContent).toBe("C4");
    expect(screen.getByText("唱名 do")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "关闭音高" }));
    expect(mocks.stopPitch).toHaveBeenCalled();
    expect(document.querySelector('[data-pitch-stage="true"]')).toBeNull();
    const callsAfterClose = mocks.stopPitch.mock.calls.length;

    // Opening a practice tool also tears down pitch stage and stops capture.
    fireEvent.click(screen.getByRole("button", { name: "开启实时音高（模唱）" }));
    expect(document.querySelector('[data-pitch-stage="true"]')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "节拍器" }));
    expect(mocks.stopPitch.mock.calls.length).toBeGreaterThan(callsAfterClose);
    expect(mocks.openTool).toHaveBeenCalledWith("metronome");

    unmount();
  });
});
