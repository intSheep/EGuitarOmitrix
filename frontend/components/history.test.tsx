import { render, screen, cleanup } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { it, expect, vi, afterEach } from "vitest";
import { History } from "./records";
const fixture = vi.hoisted(() => {
  const entry = {
    id: "1",
    title: "SYNTHETIC <img src=x>",
    kind: "lesson",
    stage: 1,
    exercises: [1],
  };
  const logs = Array.from({ length: 21 }, (_, i) => ({
    id: String(i),
    entryId: "1",
    assignmentVersion: "<unsafe>",
    practicedAt: `2026-01-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
    createdAt: "2026-01-01T10:00:00Z",
    minutes: 5,
    bpm: 60,
    bpmBasis: "self-reported-stable",
    outcome: null,
  }));
  return {
    entry,
    snapshot: { logs, assignments: { items: [] }, watches: [], ready: true },
  };
});
vi.mock("../controllers/practice", () => ({
  getSnapshot: () => fixture.snapshot,
  subscribe: () => () => {},
  lesson: () => fixture.entry,
  route: () => ({
    params: new URLSearchParams({ lesson: "1", version: "<unsafe>" }),
  }),
}));
afterEach(cleanup);
it("escapes historical labels, keeps tempo observations separate and paginates exact records", () => {
  render(
    <HashRouter>
      <History />
    </HashRouter>,
  );
  expect(
    screen.getByRole("heading", { name: "SYNTHETIC <img src=x>" }),
  ).toBeInTheDocument();
  expect(document.querySelector("img[src=x]")).toBeNull();
  expect(screen.getByRole("option")).toHaveTextContent("<unsafe>");
  expect(screen.getByText("下一页")).toBeInTheDocument();
  expect(document.querySelectorAll("tbody tr")).toHaveLength(20);
  expect(document.querySelectorAll(".tempo-chart circle")).toHaveLength(21);
  expect(document.querySelector(".tempo-chart polyline")).toBeNull();
});
