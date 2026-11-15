import type { SessionDraft, PracticeLog, DurationRecord } from "./types.ts";
// Manual intent survives navigation; uncertain clock gaps are excluded (ADR 0008).
export function createSession(
  entryId: string,
  assignmentVersion: string,
  now = Date.now(),
  id: string = crypto.randomUUID(),
): SessionDraft {
  return {
    id,
    entryId,
    assignmentVersion,
    createdAt: new Date(now).toISOString(),
    running: false,
    elapsedMs: 0,
    intervals: [],
    lastWall: null,
    lastMono: null,
    reason: "",
  };
}
export function resumeSession(
  s: SessionDraft,
  wall: number,
  mono: number,
): SessionDraft {
  return { ...s, running: true, lastWall: wall, lastMono: mono, reason: "" };
}
export function tickSession(
  s: SessionDraft,
  wall: number,
  mono: number,
  metronomeBpm: number | null = null,
): SessionDraft {
  if (!s.running) return s;
  const dw = wall - (s.lastWall ?? wall),
    dm = mono - (s.lastMono ?? mono);
  if (dw < 0 || dm < 0 || Math.abs(dw - dm) > 1000)
    return {
      ...s,
      lastWall: Math.max(wall, s.intervals.at(-1)?.end ?? wall),
      lastMono: mono,
      reason: "时钟已校准，中断间隔未计入",
    };
  const counted = Math.min(dw, 86400000 - s.elapsedMs);
  wall = (s.lastWall ?? wall) + counted;
  const intervals = s.intervals.map((i) => ({ ...i }));
  if (dw > 0) {
    const last = intervals.at(-1);
    if (last && last.end === s.lastWall) last.end = wall;
    else intervals.push({ start: s.lastWall ?? wall, end: wall });
  }
  const elapsedMs = s.elapsedMs + counted;
  const tempoUsage = (s.tempoUsage || []).map((x) => ({ ...x }));
  if (
    counted > 0 &&
    metronomeBpm !== null &&
    Number.isInteger(metronomeBpm) &&
    metronomeBpm >= 20 &&
    metronomeBpm <= 300
  ) {
    const item = tempoUsage.find((x) => x.bpm === metronomeBpm);
    if (item) item.seconds += counted / 1000;
    else tempoUsage.push({ bpm: metronomeBpm, seconds: counted / 1000 });
  }
  return {
    ...s,
    elapsedMs,
    tempoUsage,
    intervals,
    lastWall: wall,
    lastMono: mono,
    running: elapsedMs < 86400000,
    reason: elapsedMs >= 86400000 ? "本次练习已达24小时，请结束保存" : "",
  };
}
export function pauseSession(
  s: SessionDraft,
  wall: number,
  mono: number,
  reason = "已暂停",
  metronomeBpm: number | null = null,
): SessionDraft {
  return {
    ...tickSession(s, wall, mono, metronomeBpm),
    running: false,
    lastWall: null,
    lastMono: null,
    reason,
  };
}
export function recoverSession(s: SessionDraft): SessionDraft {
  return {
    ...s,
    running: false,
    lastWall: null,
    lastMono: null,
    reason: "上次练习尚未结束",
  };
}
export function sessionLog(s: SessionDraft, now = Date.now()): PracticeLog {
  if (s.elapsedMs < 1000) throw new Error("练习不足1秒，暂不计入总结");
  return {
    id: s.id,
    entryId: s.entryId,
    assignmentVersion: s.assignmentVersion,
    source: "timer",
    seconds: s.elapsedMs / 1000,
    minutes: s.elapsedMs / 60000,
    intervals: s.intervals,
    practicedAt: s.createdAt,
    createdAt: s.createdAt,
    updatedAt: new Date(now).toISOString(),
    tempoUsage: s.tempoUsage || [],
    goal: s.goal || null,
    bpmBasis: "self-reported-stable",
    outcome: null,
    bpm: null,
    note: "",
    nextFocus: "",
    deletedAt: null,
  };
}
export function dayKey(time: string | number | Date) {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function dailySeconds(logs: DurationRecord[]) {
  const days: Record<string, number> = {};
  for (const l of logs.filter((l) => !l.deletedAt)) {
    if (l.source === "timer" && l.intervals?.length) {
      for (const i of l.intervals) {
        let start = i.start;
        while (start < i.end) {
          const midnight = new Date(start);
          midnight.setHours(24, 0, 0, 0);
          const end = Math.min(i.end, midnight.getTime());
          const key = dayKey(start);
          days[key] = (days[key] || 0) + (end - start) / 1000;
          start = end;
        }
      }
    } else {
      const key = dayKey(l.practicedAt);
      days[key] = (days[key] || 0) + l.minutes * 60;
    }
  }
  return days;
}
