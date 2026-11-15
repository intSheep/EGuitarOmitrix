import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { Finish } from "./practice-pages";
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  update: vi.fn(),
  start: vi.fn(),
  snapshot: {
    draft: {
      id: "synthetic",
      entryId: "1",
      elapsedMs: 65000,
      review: undefined,
    },
    busy: false,
  },
}));
vi.mock("../controllers/practice", () => ({
  getSnapshot: () => mocks.snapshot,
  subscribe: () => () => {},
  lesson: () => ({ title: "SYNTHETIC QA", kind: "lesson" }),
  updateReview: mocks.update,
  saveResult: mocks.save,
  start: mocks.start,
  run: (fn: () => unknown) => fn(),
}));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockResolvedValue(undefined);
  mocks.save.mockResolvedValue(undefined);
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
});
